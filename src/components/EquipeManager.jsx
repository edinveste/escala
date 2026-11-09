import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import TipoValidacaoSelector from './TipoValidacaoSelector'
import AdicionarMembroForm from './AdicionarMembroForm'
import EditarMembroModal from './EditarMembroModal'
import {
  Users,
  Trash2,
  Phone,
  Mail,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Pencil,
} from 'lucide-react'
import { TIPOS_VALIDACAO } from '../lib/validacaoHelper'

export default function EquipeManager({
  empresaId,
  empresaNome,
  exigirCadastro = false,
  onExigirCadastroChange,
  tipoValidacao: propTipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  onTipoValidacaoChange,
  isFullAdmin = true,
  showToast,
  termos = {},
}) {
  const confirm = useConfirm()

  const [equipe, setEquipe] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [alterandoExigir, setAlterandoExigir] = useState(false)
  const [tipoValidacao, setTipoValidacao] = useState(propTipoValidacao)
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState(null)

  useEffect(() => {
    if (propTipoValidacao) {
      setTipoValidacao(propTipoValidacao)
    }
  }, [propTipoValidacao])

  // Chave de persistência de preferência (por empresa)
  const STORAGE_KEY_EQUIPE_EXPANDED = empresaId
    ? `escala_equipe_expanded_${empresaId}`
    : 'escala_equipe_expanded'

  // Por padrão recolhido (fechado), restaurando a preferência do usuário se houver
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_EQUIPE_EXPANDED)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de equipe expandida:', err)
    }
    return false
  })

  // Salva no localStorage sempre que o usuário alternar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EQUIPE_EXPANDED, JSON.stringify(isExpanded))
    } catch (err) {
      console.error('Erro ao salvar preferência de equipe expandida:', err)
    }
  }, [isExpanded, STORAGE_KEY_EQUIPE_EXPANDED])

  // ─── Carregar colaboradores da equipe ────────────────────────────
  const fetchEquipe = useCallback(async () => {
    if (!empresaId) return
    try {
      const { data, error } = await supabase
        .from('equipe_corretores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true })

      if (error) {
        console.warn('Aviso ao carregar equipe_corretores:', error.message)
        return
      }
      setEquipe(data || [])
    } catch (err) {
      console.error('Erro ao buscar equipe de colaboradores:', err)
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
      showToast?.('Apenas administradores podem alterar a política de acesso.', 'warning')
      return
    }

    const novoValor = !exigirCadastro
    setAlterandoExigir(true)
    try {
      // 1. Tenta via RPC segura
      let rpcSucesso = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('alternar_protecao_equipe', {
          p_empresa_id: empresaId,
          p_exigir: novoValor,
        })
        if (!rpcError && rpcData === true) {
          rpcSucesso = true
        }
      } catch (eRpc) {}

      // 2. Se a RPC não foi executada, tenta update direto
      if (!rpcSucesso) {
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ exigir_cadastro_previo: novoValor })
          .eq('id', empresaId)

        if (updateError) throw updateError
      }

      onExigirCadastroChange?.(novoValor)

      showToast?.(
        novoValor
          ? 'Proteção ativada: Apenas colaboradores autorizados podem reservar! 🛡️'
          : 'Acesso livre: Qualquer colaborador com o link pode reservar. 🔓',
        novoValor ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao atualizar exigir_cadastro_previo:', err)
      showToast?.('Erro ao atualizar política de cadastro prévio.', 'error')
    } finally {
      setAlterandoExigir(false)
    }
  }

  // ─── Alternar tipo de validação de equipe ──────────────────────
  const handleTipoValidacaoChange = (novoTipo) => {
    setTipoValidacao(novoTipo)
    onTipoValidacaoChange?.()
  }

  // ─── Adicionar novo colaborador na equipe ─────────────────────
  const handleAdicionarMembro = async ({ nome, whatsapp, email }) => {
    try {
      let novoMembro = null

      // 1. Tenta via RPC segura
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_corretor_equipe', {
          p_empresa_id: empresaId,
          p_nome: nome,
          p_whatsapp: whatsapp,
          p_email: email,
        })
        if (!rpcError && rpcData) {
          novoMembro = rpcData
        }
      } catch (eRpc) {}

      // 2. Se a RPC falhar, tenta insert direto
      if (!novoMembro) {
        const { data: directData, error: insertError } = await supabase
          .from('equipe_corretores')
          .insert({
            empresa_id: empresaId,
            nome,
            whatsapp,
            email,
            ativo: true,
          })
          .select()
          .single()

        if (insertError) throw insertError
        novoMembro = directData
      }

      setEquipe((prev) => [...prev, novoMembro].sort((a, b) => a.nome.localeCompare(b.nome)))
      showToast?.(`"${nome}" cadastrado(a) na equipe! ✅`, 'success')
      return true
    } catch (err) {
      console.error('Erro ao cadastrar:', err)
      if (
        err.message?.includes('já está cadastrado') ||
        err.message?.includes('idx_equipe_corretores') ||
        err.code === '23505'
      ) {
        showToast?.(err.message || 'Este contato já está cadastrado nesta equipe.', 'warning')
      } else {
        showToast?.('Erro ao cadastrar na equipe.', 'error')
      }
      return false
    }
  }

  // ─── Editar colaborador da equipe ─────────────────────────────
  const handleEditarMembro = async ({ id, nome, whatsapp, email }) => {
    try {
      let membroAtualizado = null

      // 1. Tenta via RPC segura editar_corretor_equipe
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('editar_corretor_equipe', {
          p_corretor_id: id,
          p_empresa_id: empresaId,
          p_nome: nome,
          p_whatsapp: whatsapp,
          p_email: email,
        })
        if (!rpcError && rpcData) {
          membroAtualizado = rpcData
        }
      } catch (eRpc) {}

      // 2. Se a RPC falhar ou não existir, faz update direto na tabela
      if (!membroAtualizado) {
        const { data: updateData, error: updateError } = await supabase
          .from('equipe_corretores')
          .update({
            nome,
            whatsapp,
            email,
          })
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (updateError) throw updateError
        membroAtualizado = updateData
      }

      setEquipe((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...membroAtualizado } : c))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      )

      showToast?.(`Cadastro de "${nome}" atualizado com sucesso! ✅`, 'success')
      return true
    } catch (err) {
      console.error('Erro ao atualizar colaborador:', err)
      if (
        err.message?.includes('já está cadastrado') ||
        err.message?.includes('idx_equipe_corretores') ||
        err.code === '23505'
      ) {
        showToast?.(err.message || 'Este contato já está cadastrado para outro colaborador.', 'warning')
      } else {
        showToast?.(err.message || 'Erro ao atualizar dados do colaborador.', 'error')
      }
      return false
    }
  }

  // ─── Alternar status ativo / inativo do colaborador ───────────
  const handleToggleAtivo = async (colaborador) => {
    const novoStatus = !colaborador.ativo
    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('alternar_status_corretor', {
          p_corretor_id: colaborador.id,
          p_empresa_id: empresaId,
          p_ativo: novoStatus,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .update({ ativo: novoStatus })
          .eq('id', colaborador.id)

        if (error) throw error
      }

      setEquipe((prev) =>
        prev.map((c) => (c.id === colaborador.id ? { ...c, ativo: novoStatus } : c))
      )
      showToast?.(
        novoStatus
          ? `"${colaborador.nome}" reativado na equipe!`
          : `"${colaborador.nome}" desativado. Não poderá reservar vagas.`,
        novoStatus ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao alterar status do colaborador:', err)
      showToast?.('Erro ao atualizar status do colaborador.', 'error')
    }
  }

  // ─── Excluir colaborador da equipe ────────────────────────────
  const handleDeleteColaborador = async (colaborador) => {
    const ok = await confirm({
      title: 'Remover colaborador da equipe?',
      message: `Tem certeza que deseja remover "${colaborador.nome}" da equipe autorizada?\n\nEle não terá mais permissão para garantir vagas quando a proteção contra invasores estiver ativa.`,
      confirmText: 'Remover Colaborador',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return

    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('remover_corretor_equipe', {
          p_corretor_id: colaborador.id,
          p_empresa_id: empresaId,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .delete()
          .eq('id', colaborador.id)

        if (error) throw error
      }

      setEquipe((prev) => prev.filter((c) => c.id !== colaborador.id))
      showToast?.(`"${colaborador.nome}" removido da equipe.`, 'info')
    } catch (err) {
      console.error('Erro ao excluir colaborador:', err)
      showToast?.('Erro ao excluir colaborador da equipe.', 'error')
    }
  }

  // ─── Desvincular aparelho celular do colaborador (Liberar novo aparelho) ──
  const handleDesvincularAparelho = async (colaborador) => {
    const ok = await confirm({
      title: 'Desvincular aparelho celular?',
      message: `Deseja liberar o cadastro de "${colaborador.nome}" para ser vinculado a um novo aparelho celular?\n\nEle poderá registrar seu novo aparelho na próxima reserva de vaga.`,
      confirmText: 'Desvincular Aparelho',
      cancelText: 'Cancelar',
      variant: 'info',
    })
    if (!ok) return

    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('desvincular_aparelho_corretor', {
          p_corretor_id: colaborador.id,
          p_empresa_id: empresaId,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .update({ device_id: null })
          .eq('id', colaborador.id)

        if (error) throw error
      }

      setEquipe((prev) =>
        prev.map((c) => (c.id === colaborador.id ? { ...c, device_id: null } : c))
      )
      showToast?.(`Aparelho de "${colaborador.nome}" desvinculado com sucesso! 📱`, 'success')
    } catch (err) {
      console.error('Erro ao desvincular aparelho:', err)
      showToast?.('Erro ao desvincular aparelho do colaborador.', 'error')
    }
  }

  // ─── Filtro de busca (Nome, WhatsApp ou E-mail) ───────────────
  const equipeFiltrada = useMemo(() => {
    if (!busca.trim()) return equipe
    const b = busca.toLowerCase().trim()
    const bDigits = busca.replace(/\D/g, '')
    return equipe.filter((c) => {
      const matchNome = c.nome.toLowerCase().includes(b)
      const matchZap = bDigits && (c.whatsapp || '').replace(/\D/g, '').includes(bDigits)
      const matchEmail = (c.email || '').toLowerCase().includes(b)
      return matchNome || matchZap || matchEmail
    })
  }, [equipe, busca])

  const totalAtivos = useMemo(() => equipe.filter((c) => c.ativo !== false).length, [equipe])

  return (
    <div className="card space-y-4">
      {/* ═══ CABEÇALHO UNIFICADO: PROTEÇÃO CONTRA INVASORES ═══ */}
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

          {/* Seta de Efeito Sanfona */}
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
                  ? `Apenas ${termos.pessoas?.toLowerCase() || 'colaboradores'} cadastrados e com status ativo nesta lista conseguem garantir vagas na escala.`
                  : `Qualquer pessoa com o link público pode reservar vagas normalmente. Cadastre a equipe abaixo e ative a chave no topo quando desejar bloquear invasores.`}
              </p>
            </div>
          </div>

          {/* ═══ SELETOR MODULAR DE IDENTIFICAÇÃO (WHATSAPP, E-MAIL, AMBOS) ═══ */}
          <TipoValidacaoSelector
            empresaId={empresaId}
            tipoAtual={tipoValidacao}
            onTipoChange={handleTipoValidacaoChange}
            isFullAdmin={isFullAdmin}
            showToast={showToast}
          />

          {/* ═══ FORMULÁRIO MODULAR DE CADASTRO DE COLABORADOR ═══ */}
          <AdicionarMembroForm
            tipoValidacao={tipoValidacao}
            termos={termos}
            equipe={equipe}
            onAdicionar={handleAdicionarMembro}
            showToast={showToast}
          />

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
                  placeholder="Buscar por nome, WhatsApp ou e-mail..."
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
                  ? `Nenhum ${termos?.pessoa?.toLowerCase() || 'colaborador'} encontrado para a busca informada.`
                  : `Nenhum ${termos?.pessoa?.toLowerCase() || 'colaborador'} cadastrado na equipe autorizada ainda.`}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {equipeFiltrada.map((colaborador) => {
                  const digitsZap = (colaborador.whatsapp || '').replace(/\D/g, '')
                  const waUrl = digitsZap ? `https://wa.me/55${digitsZap}` : null
                  const emailPendente =
                    (tipoValidacao === TIPOS_VALIDACAO.EMAIL ||
                      tipoValidacao === TIPOS_VALIDACAO.AMBOS) &&
                    !colaborador.email

                  return (
                    <div
                      key={colaborador.id}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all ${
                        colaborador.ativo !== false
                          ? 'bg-surface-750/70 border-surface-650 hover:border-surface-600'
                          : 'bg-surface-900/40 border-surface-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border ${
                            colaborador.ativo !== false
                              ? 'bg-brand-500/10 text-brand-300 border-brand-500/20'
                              : 'bg-surface-800 text-gray-500 border-surface-700'
                          }`}
                        >
                          {colaborador.nome.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-semibold text-gray-100 truncate">
                              {colaborador.nome}
                            </p>
                            {colaborador.ativo === false && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                                Inativo
                              </span>
                            )}
                            {colaborador.device_id && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 font-medium inline-flex items-center gap-0.5"
                                title="Aparelho celular vinculado. Apenas o dispositivo deste colaborador tem permissão para reservar ou cancelar suas vagas."
                              >
                                <Smartphone className="w-2.5 h-2.5 text-brand-400" />
                                Celular vinculado
                              </span>
                            )}
                            {emailPendente && (
                              <button
                                type="button"
                                onClick={() => setColaboradorParaEditar(colaborador)}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-400/50 font-medium transition-all flex items-center gap-1 cursor-pointer"
                                title="Clique para cadastrar o e-mail deste colaborador"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                E-mail pendente
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                            {colaborador.whatsapp && (
                              <div className="flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-gray-500" />
                                <span>{colaborador.whatsapp}</span>
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 ml-0.5"
                                    title="Conversar no WhatsApp"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}

                            {colaborador.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-gray-500" />
                                <a
                                  href={`mailto:${colaborador.email}`}
                                  className="text-gray-300 hover:text-brand-300 truncate max-w-[170px]"
                                  title={`Enviar e-mail para ${colaborador.email}`}
                                >
                                  {colaborador.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Botão de Editar */}
                        <button
                          type="button"
                          onClick={() => setColaboradorParaEditar(colaborador)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                          title="Editar colaborador (nome, WhatsApp, e-mail)"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Botão de Desvincular Aparelho Celular */}
                        {colaborador.device_id && (
                          <button
                            type="button"
                            onClick={() => handleDesvincularAparelho(colaborador)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                            title="Desvincular aparelho celular (liberar para novo aparelho)"
                          >
                            <Smartphone className="w-4 h-4 text-brand-400" />
                          </button>
                        )}

                        {/* Botão de Alternar Ativo/Inativo */}
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(colaborador)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            colaborador.ativo !== false
                              ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
                              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                          }`}
                          title={
                            colaborador.ativo !== false
                              ? 'Desativar colaborador (não poderá reservar)'
                              : 'Reativar colaborador na equipe'
                          }
                        >
                          {colaborador.ativo !== false ? (
                            <UserCheck className="w-4 h-4" />
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                        </button>

                        {/* Botão de Excluir */}
                        <button
                          type="button"
                          onClick={() => handleDeleteColaborador(colaborador)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Excluir colaborador da equipe"
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

      {/* ═══ MODAL DE EDIÇÃO DE COLABORADOR ═══ */}
      <EditarMembroModal
        isOpen={Boolean(colaboradorParaEditar)}
        colaborador={colaboradorParaEditar}
        onClose={() => setColaboradorParaEditar(null)}
        onSalvar={handleEditarMembro}
        onDesvincularAparelho={handleDesvincularAparelho}
        tipoValidacao={tipoValidacao}
        termos={termos}
        equipe={equipe}
        showToast={showToast}
      />
    </div>
  )
}
