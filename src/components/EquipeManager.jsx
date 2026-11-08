import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import {
  Users,
  UserPlus,
  Trash2,
  Check,
  X,
  Phone,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// Máscara dinâmica para telefone brasileiro: (99) 99999-9999 ou (99) 9999-9999
function formatarWhatsApp(valor) {
  const digits = valor.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function EquipeManager({
  empresaId,
  empresaNome,
  exigirCadastro = false,
  onExigirCadastroChange,
  isFullAdmin = true,
  showToast,
}) {
  const confirm = useConfirm()

  const [equipe, setEquipe] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  // Formulário de adição
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [alterandoExigir, setAlterandoExigir] = useState(false)

  // ─── Carregar corretores da equipe ────────────────────────────
  const fetchEquipe = useCallback(async () => {
    if (!empresaId) return
    try {
      const { data, error } = await supabase
        .from('equipe_corretores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true })

      if (error) {
        // Se a tabela ainda não existir no ambiente local, não quebra a interface
        console.warn('Aviso ao carregar equipe_corretores:', error.message)
        return
      }
      setEquipe(data || [])
    } catch (err) {
      console.error('Erro ao buscar equipe de corretores:', err)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchEquipe()
  }, [fetchEquipe])

  // ─── Escuta Realtime para equipe_corretores ───────────────────
  useEffect(() => {
    if (!empresaId) return

    const channel = supabase
      .channel(`realtime-equipe-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipe_corretores',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => {
          fetchEquipe()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, fetchEquipe])

  // ─── Alternar chave exigir_cadastro_previo na empresa ─────────
  const handleToggleExigir = async () => {
    if (!isFullAdmin) {
      showToast('Apenas administradores podem alterar a política de acesso.', 'warning')
      return
    }

    const novoValor = !exigirCadastro
    setAlterandoExigir(true)
    try {
      // 1. Tenta via RPC segura (funciona com Supabase Auth e com PIN de contingência)
      let rpcSucesso = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('alternar_protecao_equipe', {
          p_empresa_id: empresaId,
          p_exigir: novoValor,
        })
        if (!rpcError && rpcData === true) {
          rpcSucesso = true
        }
      } catch (eRpc) {
        // Ignora e tenta o update direto
      }

      // 2. Se a RPC não foi executada, tenta update direto
      if (!rpcSucesso) {
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ exigir_cadastro_previo: novoValor })
          .eq('id', empresaId)

        if (updateError) throw updateError
      }

      if (onExigirCadastroChange) {
        onExigirCadastroChange(novoValor)
      }

      showToast(
        novoValor
          ? 'Proteção ativada: Apenas corretores autorizados podem reservar! 🛡️'
          : 'Acesso livre: Qualquer corretor com o link pode reservar. 🔓',
        novoValor ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao atualizar exigir_cadastro_previo:', err)
      if (
        err.message?.includes('does not exist') ||
        err.message?.includes('exigir_cadastro_previo') ||
        err.code === '42703'
      ) {
        showToast(
          'Coluna ausente: Execute o script supabase_migration_fase2_refinamentos.sql no Supabase.',
          'error'
        )
      } else {
        showToast('Erro ao atualizar política de cadastro prévio.', 'error')
      }
    } finally {
      setAlterandoExigir(false)
    }
  }

  // ─── Adicionar novo corretor ──────────────────────────────────
  const handleAddCorretor = async (e) => {
    e.preventDefault()
    const nomeLimpo = nome.trim()
    const zapDigits = whatsapp.replace(/\D/g, '')

    if (nomeLimpo.length < 2) {
      showToast('Digite o nome completo do corretor.', 'warning')
      return
    }

    if (zapDigits.length < 10) {
      showToast('Digite um WhatsApp válido com DDD (mínimo 10 dígitos).', 'warning')
      return
    }

    // Prevenção de duplicidade por número de WhatsApp na mesma imobiliária
    const zapExistente = equipe.find(
      (c) => c.whatsapp && c.whatsapp.replace(/\D/g, '') === zapDigits
    )
    if (zapExistente) {
      showToast(
        `Este WhatsApp já está cadastrado para o corretor "${zapExistente.nome}".`,
        'warning'
      )
      return
    }

    setAdicionando(true)
    try {
      let novoCorretor = null

      // 1. Tenta via RPC segura
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_corretor_equipe', {
          p_empresa_id: empresaId,
          p_nome: nomeLimpo,
          p_whatsapp: formatarWhatsApp(whatsapp),
        })
        if (!rpcError && rpcData) {
          novoCorretor = rpcData
        }
      } catch (eRpc) {
        // Ignora e tenta insert direto
      }

      // 2. Se a RPC não foi executada, tenta insert direto
      if (!novoCorretor) {
        const { data: directData, error: insertError } = await supabase
          .from('equipe_corretores')
          .insert({
            empresa_id: empresaId,
            nome: nomeLimpo,
            whatsapp: formatarWhatsApp(whatsapp),
            ativo: true,
          })
          .select()
          .single()

        if (insertError) throw insertError
        novoCorretor = directData
      }

      setEquipe((prev) => [...prev, novoCorretor].sort((a, b) => a.nome.localeCompare(b.nome)))
      setNome('')
      setWhatsapp('')
      showToast(`Corretor "${nomeLimpo}" cadastrado na equipe! ✅`, 'success')
    } catch (err) {
      console.error('Erro ao cadastrar corretor:', err)
      if (err.message?.includes('já está cadastrado') || err.message?.includes('idx_equipe_corretores') || err.code === '23505') {
        showToast(err.message || 'Este número de WhatsApp já está cadastrado nesta imobiliária.', 'warning')
      } else if (err.message?.includes('does not exist') || err.code === '42P01') {
        showToast('Tabela "equipe_corretores" ausente no banco. Execute a migração SQL no Supabase.', 'error')
      } else {
        showToast('Erro ao cadastrar corretor na equipe.', 'error')
      }
    } finally {
      setAdicionando(false)
    }
  }

  // ─── Alternar status ativo / inativo do corretor ──────────────
  const handleToggleAtivo = async (corretor) => {
    const novoStatus = !corretor.ativo
    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('alternar_status_corretor', {
          p_corretor_id: corretor.id,
          p_empresa_id: empresaId,
          p_ativo: novoStatus,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .update({ ativo: novoStatus })
          .eq('id', corretor.id)

        if (error) throw error
      }

      setEquipe((prev) =>
        prev.map((c) => (c.id === corretor.id ? { ...c, ativo: novoStatus } : c))
      )
      showToast(
        novoStatus
          ? `"${corretor.nome}" reativado na equipe!`
          : `"${corretor.nome}" desativado. Não poderá reservar vagas.`,
        novoStatus ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao alterar status do corretor:', err)
      showToast('Erro ao atualizar status do corretor.', 'error')
    }
  }

  // ─── Excluir corretor da equipe ───────────────────────────────
  const handleDeleteCorretor = async (corretor) => {
    const ok = await confirm({
      title: 'Remover corretor da equipe?',
      message: `Tem certeza que deseja remover "${corretor.nome}" da equipe autorizada?\n\nEle não terá mais permissão para garantir vagas quando a proteção contra invasores estiver ativa.`,
      confirmText: 'Remover Corretor',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return

    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('remover_corretor_equipe', {
          p_corretor_id: corretor.id,
          p_empresa_id: empresaId,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .delete()
          .eq('id', corretor.id)

        if (error) throw error
      }

      setEquipe((prev) => prev.filter((c) => c.id !== corretor.id))
      showToast(`"${corretor.nome}" removido da equipe.`, 'info')
    } catch (err) {
      console.error('Erro ao excluir corretor:', err)
      showToast('Erro ao excluir corretor da equipe.', 'error')
    }
  }

  // ─── Filtro de busca ──────────────────────────────────────────
  const equipeFiltrada = useMemo(() => {
    if (!busca.trim()) return equipe
    const b = busca.toLowerCase().trim()
    const bDigits = busca.replace(/\D/g, '')
    return equipe.filter((c) => {
      const matchNome = c.nome.toLowerCase().includes(b)
      const matchZap = bDigits && c.whatsapp.replace(/\D/g, '').includes(bDigits)
      return matchNome || matchZap
    })
  }, [equipe, busca])

  const totalAtivos = useMemo(() => equipe.filter((c) => c.ativo !== false).length, [equipe])

  return (
    <div className="card space-y-4">
      {/* ═══ CABEÇALHO UNIFICADO EM LINHA ÚNICA: PROTEÇÃO CONTRA INVASORES ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Identidade: Título, badges e descrição */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2.5 rounded-xl border flex-shrink-0 transition-colors ${
              exigirCadastro
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-surface-700/80 border-surface-600 text-gray-400'
            }`}
          >
            {exigirCadastro ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-100">
                Proteção Contra Invasores
              </h2>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  exigirCadastro
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-surface-700 text-gray-400 border-surface-600'
                }`}
              >
                {exigirCadastro ? 'Ativada (Restrito)' : 'Desativada (Aberto)'}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {totalAtivos} {totalAtivos === 1 ? 'autorizado' : 'autorizados'}
              </span>
            </div>
          </div>
        </div>

        {/* Controles: Switch de Ativação + Seta Sanfona */}
        <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
          {/* Switch Toggle */}
          <button
            type="button"
            disabled={alterandoExigir || !isFullAdmin}
            onClick={handleToggleExigir}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              exigirCadastro ? 'bg-emerald-500' : 'bg-surface-600'
            } ${!isFullAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              !isFullAdmin
                ? 'Apenas administradores podem alternar esta chave'
                : exigirCadastro
                ? 'Clique para desativar proteção (abrir reservas a todos)'
                : 'Clique para ativar proteção (restringir à equipe cadastrada)'
            }
            role="switch"
            aria-checked={exigirCadastro}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                exigirCadastro ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>

          {/* Seta de Efeito Sanfona (em 2 linhas, idêntico ao Coordenadores & Gestores) */}
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
      </div>

      {/* ═══ CONTEÚDO EXPANSÍVEL (SANFONA) ═══ */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-surface-700/60 animate-fade-in">
          {/* Card Contextual de Status da Proteção */}
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-colors ${
              exigirCadastro
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-surface-800/80 border-surface-700/70 text-gray-300'
            }`}
          >
            {exigirCadastro ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 leading-relaxed">
              <p>
                <strong className={exigirCadastro ? 'text-emerald-200' : 'text-gray-100'}>
                  {exigirCadastro
                    ? 'Proteção Ativada (Acesso Restrito):'
                    : 'Proteção Desativada (Acesso Livre):'}
                </strong>{' '}
                {exigirCadastro
                  ? 'Apenas corretores cadastrados e com status ativo nesta lista conseguem reservar vagas nos plantões.'
                  : 'Qualquer corretor com o link público pode reservar vagas normalmente. Cadastre a equipe abaixo e ative a chave no topo quando desejar bloquear invasores.'}
              </p>
            </div>
          </div>
          {/* ═══ FORMULÁRIO DE ADIÇÃO RÁPIDA DE CORRETOR ═══ */}
          <form
            onSubmit={handleAddCorretor}
            className="p-3 sm:p-4 rounded-2xl bg-surface-800/80 border border-surface-700 space-y-3"
          >
            <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-brand-400" />
              Cadastrar Novo Corretor na Imobiliária
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  Nome Completo do Corretor
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="input-field w-full text-xs py-2 px-3"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  WhatsApp (com DDD)
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatarWhatsApp(e.target.value))}
                  placeholder="(11) 98765-4321"
                  className="input-field w-full text-xs py-2 px-3 font-mono"
                  maxLength={15}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={adicionando || !nome.trim() || whatsapp.replace(/\D/g, '').length < 10}
              className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2"
            >
              {adicionando ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando na equipe...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Autorizar Corretor na Imobiliária</span>
                </>
              )}
            </button>
          </form>

          {/* ═══ LISTAGEM DA EQUIPE ═══ */}
          <div className="space-y-2.5 pt-1">
            {/* Barra de Busca quando houver mais de 3 membros */}
            {equipe.length > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou número de WhatsApp..."
                  className="w-full bg-surface-900 border border-surface-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            )}

            {loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-500">Carregando equipe...</p>
              </div>
            ) : equipeFiltrada.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 italic bg-surface-900/40 rounded-xl border border-surface-700/50">
                {busca.trim()
                  ? 'Nenhum corretor encontrado para a busca informada.'
                  : 'Nenhum corretor cadastrado na equipe desta imobiliária ainda.'}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {equipeFiltrada.map((corretor) => {
                  const digitsZap = corretor.whatsapp.replace(/\D/g, '')
                  const waUrl = digitsZap ? `https://wa.me/55${digitsZap}` : null

                  return (
                    <div
                      key={corretor.id}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all ${
                        corretor.ativo !== false
                          ? 'bg-surface-750/70 border-surface-650 hover:border-surface-600'
                          : 'bg-surface-900/40 border-surface-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border ${
                            corretor.ativo !== false
                              ? 'bg-brand-500/10 text-brand-300 border-brand-500/20'
                              : 'bg-surface-800 text-gray-500 border-surface-700'
                          }`}
                        >
                          {corretor.nome.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-gray-100 truncate">
                              {corretor.nome}
                            </p>
                            {corretor.ativo === false && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                                Inativo
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                            <span>{corretor.whatsapp}</span>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-sans"
                                title="Conversar no WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Botão de Alternar Ativo/Inativo */}
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(corretor)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            corretor.ativo !== false
                              ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
                              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                          }`}
                          title={
                            corretor.ativo !== false
                              ? 'Desativar corretor (não poderá reservar)'
                              : 'Reativar corretor na equipe'
                          }
                        >
                          {corretor.ativo !== false ? (
                            <UserCheck className="w-4 h-4" />
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                        </button>

                        {/* Botão de Excluir */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCorretor(corretor)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Excluir corretor da equipe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

