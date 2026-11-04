import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from './ConfirmModal'
import { setTenantUrl } from '../lib/tenantHelper'
import {
  Crown,
  Building2,
  Users,
  Search,
  ExternalLink,
  ShieldCheck,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  ShieldAlert,
  MapPin,
  Clock,
  Flame,
} from 'lucide-react'

export default function SuperadminModal({ isOpen, onClose, showToast }) {
  const confirm = useConfirm()
  const { user, isSuperadmin, refreshAuth } = useAuth()

  const [empresas, setEmpresas] = useState([])
  const [metricas, setMetricas] = useState({})
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  // Modal para vincular gestor
  const [modalVincular, setModalVincular] = useState(null) // { empresaId, empresaNome }
  const [emailGestor, setEmailGestor] = useState('')
  const [roleGestor, setRoleGestor] = useState('gestor') // 'gestor' | 'admin'
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)

  // Modal para promover superadmin
  const [showPromoverModal, setShowPromoverModal] = useState(false)
  const [emailNovoSuper, setEmailNovoSuper] = useState('')
  const [salvandoSuper, setSalvandoSuper] = useState(false)

  // ─── Carregar todas as empresas do SaaS e Métricas de Consumo ─────────
  const carregarEmpresas = useCallback(async () => {
    setLoading(true)
    try {
      const { data: empresasData, error: errEmpresas } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false })

      if (errEmpresas) throw errEmpresas
      setEmpresas(empresasData || [])

      // Carregar Métricas de Consumo Reais (Pontos ativos, Turnos e Reservas)
      try {
        const { data: metricasData, error: errMetricas } = await supabase.rpc(
          'get_metricas_empresas'
        )

        if (!errMetricas && metricasData) {
          const mapa = {}
          for (const m of metricasData) {
            mapa[m.empresa_id] = {
              total_pontos_ativos: Number(m.total_pontos_ativos || 0),
              total_turnos: Number(m.total_turnos || 0),
              total_reservas: Number(m.total_reservas || 0),
            }
          }
          setMetricas(mapa)
        } else {
          // Fallback resiliente: agrega diretamente caso a RPC ainda esteja pendente
          const [pontosRes, turnosRes, reservasRes] = await Promise.all([
            supabase.from('pontos').select('empresa_id, ativo'),
            supabase.from('turnos').select('empresa_id'),
            supabase.from('reservas').select('empresa_id'),
          ])

          const mapa = {}
          if (empresasData) {
            for (const emp of empresasData) {
              mapa[emp.id] = {
                total_pontos_ativos: (pontosRes.data || []).filter(
                  (p) => p.empresa_id === emp.id && p.ativo !== false
                ).length,
                total_turnos: (turnosRes.data || []).filter((t) => t.empresa_id === emp.id).length,
                total_reservas: (reservasRes.data || []).filter((r) => r.empresa_id === emp.id).length,
              }
            }
          }
          setMetricas(mapa)
        }
      } catch (errM) {
        console.warn('Aviso ao carregar métricas das empresas:', errM)
      }
    } catch (err) {
      console.error('Erro ao carregar lista de empresas:', err)
      showToast('Erro ao carregar lista de imobiliárias.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!isOpen) return
    carregarEmpresas()

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvandoVinculo && !salvandoSuper) {
        if (modalVincular) setModalVincular(null)
        else if (showPromoverModal) setShowPromoverModal(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, carregarEmpresas, onClose, salvandoVinculo, salvandoSuper, modalVincular, showPromoverModal])

  // ─── Atualizar Status da Empresa ─────────────────────────────
  const handleAlterarStatus = async (empresa, novoStatus) => {
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ status: novoStatus })
        .eq('id', empresa.id)

      if (error) throw error

      setEmpresas((prev) =>
        prev.map((e) => (e.id === empresa.id ? { ...e, status: novoStatus } : e))
      )
      showToast(`Status de "${empresa.nome}" alterado para ${novoStatus.toUpperCase()}!`, 'success')
    } catch (err) {
      console.error('Erro ao alterar status:', err)
      showToast('Erro ao atualizar status da imobiliária.', 'error')
    }
  }

  // ─── Atualizar Plano da Empresa ──────────────────────────────
  const handleAlterarPlano = async (empresa, novoPlano) => {
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ plano: novoPlano })
        .eq('id', empresa.id)

      if (error) throw error

      setEmpresas((prev) =>
        prev.map((e) => (e.id === empresa.id ? { ...e, plano: novoPlano } : e))
      )
      showToast(`Plano de "${empresa.nome}" alterado para ${novoPlano.toUpperCase()}!`, 'success')
    } catch (err) {
      console.error('Erro ao alterar plano:', err)
      showToast('Erro ao atualizar plano da imobiliária.', 'error')
    }
  }

  // ─── Vincular Gestor à Empresa ───────────────────────────────
  const handleSalvarVinculo = async (e) => {
    if (e) e.preventDefault()
    if (!emailGestor.trim() || !modalVincular?.empresaId) return

    setSalvandoVinculo(true)
    try {
      const { data, error } = await supabase.rpc('vincular_usuario_empresa', {
        p_email: emailGestor.trim(),
        p_empresa_id: modalVincular.empresaId,
        p_role: roleGestor,
      })

      if (error) throw error

      showToast(`Gestor ${emailGestor} vinculado à ${modalVincular.empresaNome}! ✅`, 'success')
      setModalVincular(null)
      setEmailGestor('')
      refreshAuth()
    } catch (err) {
      console.error('Erro ao vincular gestor:', err)
      showToast(err.message || 'Erro ao vincular gestor. Certifique-se que ele já se cadastrou.', 'error')
    } finally {
      setSalvandoVinculo(false)
    }
  }

  // ─── Promover Superadmin ─────────────────────────────────────
  const handlePromoverSuperadmin = async (e) => {
    if (e) e.preventDefault()
    if (!emailNovoSuper.trim()) return

    const ok = await confirm({
      title: 'Promover a Superadmin?',
      message: `Tem certeza que deseja conceder privilégios de Superadmin para "${emailNovoSuper}"?\n\nEle terá controle total sobre todas as imobiliárias cadastradas.`,
      confirmText: 'Sim, conceder Superadmin',
      cancelText: 'Cancelar',
      variant: 'warning',
    })
    if (!ok) return

    setSalvandoSuper(true)
    try {
      const { data, error } = await supabase.rpc('promover_superadmin', {
        p_email: emailNovoSuper.trim(),
      })

      if (error) throw error

      if (data === true) {
        showToast(`${emailNovoSuper} agora é Superadmin da plataforma! 👑`, 'success')
        setShowPromoverModal(false)
        setEmailNovoSuper('')
        refreshAuth()
      } else {
        showToast('E-mail não encontrado na base de perfis.', 'warning')
      }
    } catch (err) {
      console.error('Erro ao promover superadmin:', err)
      showToast(err.message || 'Erro ao promover usuário.', 'error')
    } finally {
      setSalvandoSuper(false)
    }
  }

  // ─── Navegar para a escala da empresa ────────────────────────
  const handleAcessarEscala = (slug) => {
    setTenantUrl(slug)
    window.location.reload()
  }

  // ─── Filtragem ───────────────────────────────────────────────
  const empresasFiltradas = useMemo(() => {
    return empresas.filter((emp) => {
      const bateBusca =
        emp.nome.toLowerCase().includes(busca.toLowerCase()) ||
        emp.slug.toLowerCase().includes(busca.toLowerCase())
      const bateStatus = filtroStatus === 'todos' || emp.status === filtroStatus
      return bateBusca && bateStatus
    })
  }, [empresas, busca, filtroStatus])

  // ─── Totais Globais do SaaS ──────────────────────────────────
  const totalPontosSaaS = useMemo(
    () => Object.values(metricas).reduce((sum, m) => sum + (m.total_pontos_ativos || 0), 0),
    [metricas]
  )
  const totalTurnosSaaS = useMemo(
    () => Object.values(metricas).reduce((sum, m) => sum + (m.total_turnos || 0), 0),
    [metricas]
  )
  const totalReservasSaaS = useMemo(
    () => Object.values(metricas).reduce((sum, m) => sum + (m.total_reservas || 0), 0),
    [metricas]
  )

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl bg-surface-800 border border-surface-700 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scale-up">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 border-b border-surface-700 flex items-center justify-between bg-surface-850">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-100">Painel Superadmin</h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Dono do SaaS
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Gerencie todas as imobiliárias, planos e acessos administrativos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPromoverModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-xs text-gray-200 transition-colors"
              title="Promover outro usuário a Superadmin"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Promover Superadmin</span>
            </button>

            <button
              onClick={carregarEmpresas}
              disabled={loading}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-surface-700 transition-colors"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-surface-700 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Métricas Rápidas Globais */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 sm:px-6 bg-surface-900/50 border-b border-surface-700 text-center">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700/60">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">Imobiliárias</p>
            <p className="text-base sm:text-lg font-bold text-gray-100">{empresas.length}</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700/60">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">Contas Ativas</p>
            <p className="text-base sm:text-lg font-bold text-emerald-400">
              {empresas.filter((e) => e.status === 'ativo').length}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700/60">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-brand-400" />
              Pontos Ativos
            </p>
            <p className="text-base sm:text-lg font-bold text-brand-400">{totalPontosSaaS}</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700/60">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-neon-green" />
              Turnos SaaS
            </p>
            <p className="text-base sm:text-lg font-bold text-neon-green">{totalTurnosSaaS}</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-2xl bg-surface-800/60 border border-surface-700/60 col-span-2 sm:col-span-1">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium flex items-center justify-center gap-1">
              <Users className="w-3 h-3 text-emerald-400" />
              Vagas Ocupadas
            </p>
            <p className="text-base sm:text-lg font-bold text-emerald-400">{totalReservasSaaS}</p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-center gap-3 border-b border-surface-700 bg-surface-800">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou slug..."
              className="w-full bg-surface-900 border border-surface-600 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-surface-900 border border-surface-600 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand-500 w-full sm:w-auto"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>
        </div>

        {/* Lista de Imobiliárias */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">Carregando imobiliárias do SaaS...</p>
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Nenhuma imobiliária encontrada para os critérios informados.
            </div>
          ) : (
            empresasFiltradas.map((emp) => {
              const mInfo = metricas[emp.id] || {
                total_pontos_ativos: 0,
                total_turnos: 0,
                total_reservas: 0,
              }
              const isHighUsage = mInfo.total_turnos >= 10 || mInfo.total_reservas >= 10

              return (
                <div
                  key={emp.id}
                  className="bg-surface-900/80 border border-surface-700/80 rounded-2xl p-4 flex flex-col gap-3 hover:border-surface-600 transition-all shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center flex-shrink-0 text-brand-400 font-bold text-sm">
                        {emp.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-gray-100 truncate">{emp.nome}</h3>
                          <span className="text-[10px] text-gray-400 font-mono bg-surface-800 px-2 py-0.5 rounded-lg border border-surface-700">
                            /{emp.slug}
                          </span>
                          {emp.asaas_customer_id && (
                            <span
                              className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25"
                              title={`Assinatura Asaas: ${emp.asaas_customer_id}`}
                            >
                              Asaas
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400 mt-0.5">
                          <span>Criada em: {new Date(emp.created_at).toLocaleDateString('pt-BR')}</span>
                          {emp.email_cobranca && (
                            <span className="text-gray-400 truncate max-w-[180px]">
                              • {emp.email_cobranca}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-0 border-surface-800">
                      {/* Seletor de Plano */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          Plano:
                        </span>
                        <select
                          value={emp.plano || 'trial'}
                          onChange={(e) => handleAlterarPlano(emp, e.target.value)}
                          className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-brand-500 font-medium"
                        >
                          <option value="trial">Trial</option>
                          <option value="pro">Pro</option>
                          <option value="ilimitado">Ilimitado</option>
                        </select>
                      </div>

                      {/* Seletor de Status */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          Status:
                        </span>
                        <select
                          value={emp.status || 'ativo'}
                          onChange={(e) => handleAlterarStatus(emp, e.target.value)}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none border ${
                            emp.status === 'ativo'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : emp.status === 'bloqueado'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                          <option value="bloqueado">Bloqueado</option>
                        </select>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setModalVincular({ empresaId: emp.id, empresaNome: emp.nome })
                          }
                          className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-gray-300 hover:text-brand-400 border border-surface-700 transition-colors"
                          title="Adicionar Gestor por E-mail"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleAcessarEscala(emp.slug)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-medium transition-colors"
                          title="Acessar painel e escala desta imobiliária"
                        >
                          <span>Acessar</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ═══ MÉTRICAS REAIS DE CONSUMO DA IMOBILIÁRIA ═══ */}
                  <div className="pt-2.5 border-t border-surface-800/90 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-800/90 border border-surface-700/60 text-gray-300">
                        <MapPin className="w-3.5 h-3.5 text-brand-400" />
                        <span className="font-bold text-gray-100">
                          {mInfo.total_pontos_ativos}
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          {mInfo.total_pontos_ativos === 1 ? 'ponto ativo' : 'pontos ativos'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-800/90 border border-surface-700/60 text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-neon-green" />
                        <span className="font-bold text-gray-100">{mInfo.total_turnos}</span>
                        <span className="text-gray-400 text-[11px]">
                          {mInfo.total_turnos === 1 ? 'turno' : 'turnos'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-800/90 border border-surface-700/60 text-gray-300">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-bold text-gray-100">{mInfo.total_reservas}</span>
                        <span className="text-gray-400 text-[11px]">
                          {mInfo.total_reservas === 1 ? 'vaga ocupada' : 'vagas ocupadas'}
                        </span>
                      </div>
                    </div>

                    {isHighUsage && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Uso Intenso
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 sm:p-4 bg-surface-850 border-t border-surface-700 flex items-center justify-between text-xs text-gray-400">
          <span>Logado como Superadmin ({user?.email})</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-gray-200 transition-colors"
          >
            Fechar Painel
          </button>
        </div>
      </div>

      {/* ─── MODAL VINCULAR GESTOR ───────────────────────────────── */}
      {modalVincular && (
        <div
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-sm bg-surface-800 border border-surface-700 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-400" />
                Adicionar Gestor
              </h3>
              <button
                onClick={() => setModalVincular(null)}
                className="p-1 text-gray-400 hover:text-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Vincular gestor à imobiliária <strong>{modalVincular.empresaNome}</strong>:
            </p>

            <form onSubmit={handleSalvarVinculo} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  E-mail do Gestor
                </label>
                <input
                  type="email"
                  value={emailGestor}
                  onChange={(e) => setEmailGestor(e.target.value)}
                  placeholder="gestor@imobiliaria.com"
                  disabled={salvandoVinculo}
                  className="w-full bg-surface-900 border border-surface-600 rounded-xl px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Papel</label>
                <select
                  value={roleGestor}
                  onChange={(e) => setRoleGestor(e.target.value)}
                  disabled={salvandoVinculo}
                  className="w-full bg-surface-900 border border-surface-600 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="gestor">Gestor (Coordenação de Plantão)</option>
                  <option value="admin">Admin (Direção da Imobiliária)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalVincular(null)}
                  disabled={salvandoVinculo}
                  className="w-1/2 py-2 px-3 rounded-xl bg-surface-700 hover:bg-surface-600 text-xs text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoVinculo}
                  className="w-1/2 btn-primary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {salvandoVinculo ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Confirmar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL PROMOVER SUPERADMIN ───────────────────────────── */}
      {showPromoverModal && (
        <div
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-sm bg-surface-800 border border-surface-700 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Promover a Superadmin
              </h3>
              <button
                onClick={() => setShowPromoverModal(false)}
                className="p-1 text-gray-400 hover:text-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Digite o e-mail do usuário que receberá acesso ilimitado a todas as imobiliárias:
            </p>

            <form onSubmit={handlePromoverSuperadmin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  E-mail do Usuário
                </label>
                <input
                  type="email"
                  value={emailNovoSuper}
                  onChange={(e) => setEmailNovoSuper(e.target.value)}
                  placeholder="novo.socio@meusaas.com"
                  disabled={salvandoSuper}
                  className="w-full bg-surface-900 border border-surface-600 rounded-xl px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromoverModal(false)}
                  disabled={salvandoSuper}
                  className="w-1/2 py-2 px-3 rounded-xl bg-surface-700 hover:bg-surface-600 text-xs text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoSuper}
                  className="w-1/2 btn-primary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 border-amber-500"
                >
                  {salvandoSuper ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Promover</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

