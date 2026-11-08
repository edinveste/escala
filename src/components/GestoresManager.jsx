import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import {
  Shield,
  UserCheck,
  UserPlus,
  Trash2,
  Mail,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  Clock,
  Send,
} from 'lucide-react'

export default function GestoresManager({
  empresaId,
  empresaNome,
  isFullAdmin = true,
  currentUserId,
  showToast,
}) {
  const confirm = useConfirm()

  const [gestores, setGestores] = useState([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)

  // Formulário de novo membro
  const [novoEmail, setNovoEmail] = useState('')
  const [novoRole, setNovoRole] = useState('gestor') // 'gestor' | 'admin'
  const [adicionando, setAdicionando] = useState(false)

  // ─── Carregar Gestores da Imobiliária ─────────────────────────
  const fetchGestores = useCallback(async () => {
    if (!empresaId) return
    try {
      // 1. Tenta buscar via RPC segura get_gestores_empresa (retorna membros e convites pendentes)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_gestores_empresa', {
        p_empresa_id: empresaId,
      })

      if (!rpcErr && rpcData) {
        setGestores(rpcData)
        return
      }

      // 2. Fallback caso a RPC não esteja disponível
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('usuarios_empresas')
        .select('id, user_id, role, ativo, created_at, perfis:user_id(id, email, nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })

      if (!fallbackErr && fallbackData) {
        const formatados = fallbackData.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          email: m.perfis?.email || '',
          nome: m.perfis?.nome || m.perfis?.email?.split('@')[0] || 'Usuário',
          role: m.role || 'gestor',
          ativo: m.ativo !== false,
          pendente: false,
          created_at: m.created_at,
        }))
        setGestores(formatados)
      }
    } catch (err) {
      console.error('Erro ao carregar gestores:', err)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchGestores()
  }, [fetchGestores])

  // ─── Realtime: Escuta alterações na equipe e convites ────────
  useEffect(() => {
    if (!empresaId) return

    const channel = supabase
      .channel(`realtime-gestores-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usuarios_empresas',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => fetchGestores()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'convites_gestores',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => fetchGestores()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, fetchGestores])

  // ─── Adicionar / Vincular Novo Gestor ou Coordenador ─────────
  const handleAddGestor = async (e) => {
    e.preventDefault()
    const emailLimpo = novoEmail.trim().toLowerCase()

    if (!emailLimpo || !emailLimpo.includes('@')) {
      showToast('Digite um endereço de e-mail válido.', 'warning')
      return
    }

    setAdicionando(true)
    try {
      const { data, error } = await supabase.rpc('vincular_usuario_empresa', {
        p_email: emailLimpo,
        p_empresa_id: empresaId,
        p_role: novoRole,
      })

      if (error) {
        showToast(error.message || 'Erro ao vincular gestor.', 'error')
        return
      }

      const roleNome = novoRole === 'admin' ? 'Administrador Geral' : 'Coordenador de Plantão'
      if (data?.status === 'convidado') {
        showToast(
          `Convite prévio salvo para "${emailLimpo}"! Ao criar a conta, o acesso será liberado automaticamente. ✉️`,
          'info'
        )
      } else {
        showToast(`"${emailLimpo}" vinculado como ${roleNome}! 🛡️`, 'success')
      }

      setNovoEmail('')
      setNovoRole('gestor')
      fetchGestores()
    } catch (err) {
      console.error('Erro ao vincular gestor:', err)
      showToast('Erro ao vincular gestor à imobiliária.', 'error')
    } finally {
      setAdicionando(false)
    }
  }

  // ─── Remover Acesso de um Gestor / Coordenador ───────────────
  const handleRemoveGestor = async (gestor) => {
    if (gestor.user_id && gestor.user_id === currentUserId) {
      showToast('Você não pode remover seu próprio acesso administrativo.', 'warning')
      return
    }

    // Se for convite pendente
    if (gestor.pendente) {
      const ok = await confirm({
        title: 'Cancelar convite pendente?',
        message: `Deseja cancelar o convite de ${gestor.role === 'admin' ? 'Administrador' : 'Coordenador'} para "${gestor.email}"?`,
        confirmText: 'Cancelar Convite',
        cancelText: 'Voltar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        await supabase.rpc('cancelar_convite_gestor', {
          p_convite_id: gestor.id,
          p_empresa_id: empresaId,
        })
        showToast('Convite cancelado.', 'info')
        fetchGestores()
      } catch (err) {
        console.error('Erro ao cancelar convite:', err)
        showToast('Erro ao cancelar convite.', 'error')
      }
      return
    }

    // Se for membro já ativo
    const papelLabel = gestor.role === 'admin' ? 'Administrador' : 'Coordenador'
    const ok = await confirm({
      title: 'Remover acesso?',
      message: `Tem certeza que deseja remover o acesso de ${papelLabel} de "${gestor.nome || gestor.email}"?\n\nEsta pessoa perderá o acesso administrativo a esta imobiliária imediatamente.`,
      confirmText: 'Remover Acesso',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!ok) return

    try {
      const { error } = await supabase.rpc('desvincular_usuario_empresa', {
        p_user_id: gestor.user_id,
        p_empresa_id: empresaId,
      })

      if (error) {
        const { error: directErr } = await supabase
          .from('usuarios_empresas')
          .delete()
          .eq('user_id', gestor.user_id)
          .eq('empresa_id', empresaId)

        if (directErr) throw directErr
      }

      showToast(`Acesso de "${gestor.nome || gestor.email}" removido.`, 'info')
      fetchGestores()
    } catch (err) {
      console.error('Erro ao desvincular gestor:', err)
      showToast('Erro ao remover acesso.', 'error')
    }
  }

  if (!isFullAdmin) return null

  return (
    <div className="card space-y-4">
      {/* ═══ CABEÇALHO DO COMPONENTE ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-100">
                Coordenadores & Gestores
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {gestores.length} {gestores.length === 1 ? 'membro' : 'membros'}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Controle quem pode acessar o painel administrativo desta imobiliária.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 self-end sm:self-center bg-surface-700/60 hover:bg-surface-700 px-2.5 py-1.5 rounded-lg border border-surface-600/50 transition-colors text-left"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex flex-col leading-tight">
                <span>Recolher</span>
                <span>Equipe</span>
              </span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex flex-col leading-tight">
                <span>Gerenciar</span>
                <span>Equipe</span>
              </span>
            </>
          )}
        </button>
      </div>

      {/* ═══ CONTEÚDO EXPANSÍVEL ═══ */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-surface-700/60 animate-fade-in">
          {/* Card Informativo com o funcionamento do RBAC */}
          <div className="p-3 rounded-xl bg-surface-800/80 border border-surface-700/70 flex items-start gap-2.5 text-xs text-gray-300">
            <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p>
                <strong className="text-gray-100">Coordenador / Gestor de Plantão:</strong> pode incluir e remover corretores dos plantões e visualizar turnos, mas <em>não pode excluir pontos nem alterar configurações globais</em>.
              </p>
              <p>
                <strong className="text-gray-100">Admin da Imobiliária:</strong> possui permissão irrestrita (criação e exclusão de pontos, senhas e gestão de equipe).
              </p>
            </div>
          </div>

          {/* ═══ FORMULÁRIO DE ADIÇÃO DE NOVO GESTOR ═══ */}
          <form
            onSubmit={handleAddGestor}
            className="p-3 sm:p-4 rounded-2xl bg-surface-900/60 border border-surface-700/80 space-y-3"
          >
            <p className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-brand-400" />
              Adicionar Novo Gestor ou Coordenador
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  E-mail do Usuário
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="coordenador@imobiliaria.com"
                    className="input-field w-full text-xs py-2 pl-9 pr-3"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  Nível de Acesso (Papel)
                </label>
                <select
                  value={novoRole}
                  onChange={(e) => setNovoRole(e.target.value)}
                  className="input-field w-full text-xs py-2 px-3 appearance-none"
                >
                  <option value="gestor">Coordenador (Plantões)</option>
                  <option value="admin">Admin (Acesso Total)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-brand-400 flex-shrink-0" />
                Se o coordenador ainda não tiver conta, o acesso será ativado automaticamente assim que ele se cadastrar.
              </p>

              <button
                type="submit"
                disabled={adicionando || !novoEmail.trim()}
                className="btn-primary text-xs py-2 px-4 flex items-center justify-center gap-1.5 self-end sm:self-auto whitespace-nowrap shadow-md shadow-brand-500/10"
              >
                {adicionando ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Vincular à Imobiliária
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ═══ LISTAGEM DOS GESTORES ATUAIS ═══ */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-gray-400">
              Membros com Acesso de Gestão ({gestores.length}):
            </p>

            {loading ? (
              <div className="text-center py-4 text-xs text-gray-500">
                Carregando membros da imobiliária...
              </div>
            ) : gestores.length === 0 ? (
              <div className="text-center py-4 rounded-xl bg-surface-800/40 border border-surface-700/50 text-xs text-gray-500">
                Nenhum gestor ou coordenador vinculado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {gestores.map((g) => {
                  const isCurrent = g.user_id && g.user_id === currentUserId
                  return (
                    <div
                      key={g.id || g.user_id || g.email}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        g.pendente
                          ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30'
                          : 'bg-surface-800/60 border-surface-700/70 hover:border-surface-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border ${
                            g.pendente
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : g.role === 'admin'
                              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {(g.nome || g.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-100 truncate">
                              {g.nome || g.email}
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-700 text-gray-300 border border-surface-600">
                                Você
                              </span>
                            )}
                            {g.pendente ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Convite Pendente (Aguardando Cadastro)
                              </span>
                            ) : g.role === 'admin' ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                                <Shield className="w-3 h-3 text-brand-400" />
                                Admin da Imobiliária
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                Gestor de Plantão
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {g.email}
                          </p>
                        </div>
                      </div>

                      {/* Botão de remoção / cancelamento (desabilitado para si mesmo) */}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGestor(g)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                          title={g.pendente ? 'Cancelar este convite' : 'Remover acesso deste gestor'}
                          aria-label="Remover gestor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
