import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { formatarNomeDia, migrarDiasLegados } from './lib/diasSemana'
import { useTenant } from './contexts/TenantContext'
import { useAuth } from './contexts/AuthContext'
import { getPublicShareUrl, isAppPortal } from './lib/tenantHelper'
import { obterTermos } from './lib/vocabularioHelper'
import CorretorView from './components/CorretorView'
import AdminView from './components/AdminView'
import NomeModal from './components/NomeModal'
import AdminLoginModal from './components/AdminLoginModal'
import PortalGestorLogin from './components/PortalGestorLogin'
import TenantSwitcherModal from './components/TenantSwitcherModal'
import TenantNotFound from './components/TenantNotFound'
import TenantBlockedView from './components/TenantBlockedView'
import LandingPage from './components/LandingPage'
import Toast from './components/Toast'
import ThemeToggle from './components/ThemeToggle'
import { useConfirm } from './components/ConfirmModal'
import {
  Shield,
  ArrowLeft,
  CalendarCheck,
  LogOut,
  Building2,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

// Gera um UUID v4 simples
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function App() {
  const confirm = useConfirm()
  const {
    empresa,
    loading: tenantLoading,
    notFound,
    error: tenantError,
    refreshEmpresa,
    isAppPortal: isPortalDomain,
    isLandingPage: isLanding,
    switchTenant,
  } = useTenant()

  const termos = useMemo(() => obterTermos(empresa), [empresa])

  const {
    user,
    perfil,
    minhasEmpresas,
    canManageEmpresa,
    getEmpresaRole,
    signOut,
  } = useAuth()

  // Modal para alternar de imobiliária / compartilhar link
  const [showTenantSwitcher, setShowTenantSwitcher] = useState(false)

  // Estado de identidade do Corretor (Zero-Atrito)
  const [deviceId, setDeviceId] = useState('')
  const [corretorNome, setCorretorNome] = useState('')
  const [corretorWhatsapp, setCorretorWhatsapp] = useState('')
  const [showNomeModal, setShowNomeModal] = useState(false)
  const [pendingTurnoId, setPendingTurnoId] = useState(null)

  // Estado de dados da escala
  const [pontos, setPontos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)

  // Navegação e Acesso de Gestor
  const [view, setView] = useState(() => (isPortalDomain ? 'admin' : 'corretor')) // 'corretor' | 'admin'
  const [isPinAuth, setIsPinAuth] = useState(false) // Fallback de contingência para PIN
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false)

  // Verifica se o usuário atual é gestor autorizado da empresa ativa
  const isAuthorizedGestor = Boolean(user && empresa?.id && canManageEmpresa(empresa.id))
  const isAdminSession = isAuthorizedGestor || isPinAuth
  const userEmpresaRole = empresa?.id ? getEmpresaRole(empresa.id) : null
  const isFullAdmin = userEmpresaRole === 'admin' || isPinAuth
  // Alternar imobiliárias é restrito a gestores em modo administrativo
  const canSwitchTenant = (view === 'admin' && isAdminSession) || (isPortalDomain && (user || isPinAuth))

  // Toast
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // Reseta autenticação de PIN e ajusta visão ao alternar de empresa
  useEffect(() => {
    setIsPinAuth(false)
    if (isPortalDomain) {
      setView('admin')
    } else if (!isAuthorizedGestor) {
      setView('corretor')
    }
  }, [empresa?.id, isAuthorizedGestor, isPortalDomain])

  // ─── Inicialização do device_id, corretor_nome e corretor_whatsapp ──
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('escala_device_id')
    if (!storedDeviceId) {
      storedDeviceId = generateUUID()
      localStorage.setItem('escala_device_id', storedDeviceId)
    }
    setDeviceId(storedDeviceId)

    const storedNome = localStorage.getItem('escala_corretor_nome')
    if (storedNome) {
      setCorretorNome(storedNome)
    }

    const storedZap = localStorage.getItem('escala_corretor_whatsapp')
    if (storedZap) {
      setCorretorWhatsapp(storedZap)
    }
  }, [])

  // ─── Carregamento de dados (Isolado pelo empresa_id) ─────────
  const fetchData = useCallback(
    async (isSilent = true) => {
      if (!empresa?.id) return

      if (!isSilent) {
        setLoading(true)
      }
      try {
        const [pontosRes, turnosRes, reservasRes] = await Promise.all([
          supabase
            .from('pontos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true }),
          supabase
            .from('turnos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true }),
          supabase
            .from('reservas')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('created_at', { ascending: true }),
        ])

        if (pontosRes.error) throw pontosRes.error
        if (turnosRes.error) throw turnosRes.error
        if (reservasRes.error) throw reservasRes.error

        const turnosNormalizados = (turnosRes.data || []).map((t) => ({
          ...t,
          dia: formatarNomeDia(t.dia),
        }))

        setPontos(pontosRes.data || [])
        setTurnos(turnosNormalizados)
        setReservas(reservasRes.data || [])

        // Migra silenciosamente em background dias legados no banco se houver
        migrarDiasLegados(turnosRes.data)
      } catch (err) {
        console.error('Erro ao carregar dados da empresa:', err)
        showToast('Erro ao carregar escala desta imobiliária.', 'error')
      } finally {
        if (!isSilent) {
          setLoading(false)
        }
      }
    },
    [empresa?.id, showToast]
  )

  useEffect(() => {
    if (empresa?.id) {
      fetchData(false)
    }
  }, [empresa?.id, fetchData])

  // ─── Realtime: Escuta com filtro estrito de empresa_id ────────
  useEffect(() => {
    if (!empresa?.id) return

    const channel = supabase
      .channel(`realtime-tenant-${empresa.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservas',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        (payload) => {
          setReservas((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'reservas',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        (payload) => {
          setReservas((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turnos',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        () => {
          supabase
            .from('turnos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true })
            .then(({ data }) => {
              if (data) {
                setTurnos(data.map((t) => ({ ...t, dia: formatarNomeDia(t.dia) })))
              }
            })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pontos',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        () => {
          supabase
            .from('pontos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true })
            .then(({ data }) => {
              if (data) setPontos(data)
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresa?.id])

  // ─── Ações de Reserva e Cancelamento (Corretor Zero-Atrito) ───
  const handleReservar = useCallback(
    async (turnoId) => {
      // Se não tiver nome cadastrado ou a empresa exigir WhatsApp e não tiver WhatsApp
      if (!corretorNome || (!corretorWhatsapp && empresa?.exigir_cadastro_previo)) {
        setPendingTurnoId(turnoId)
        setShowNomeModal(true)
        return
      }

      try {
        const { data, error } = await supabase.rpc('reservar_vaga', {
          p_turno_id: turnoId,
          p_corretor_nome: corretorNome,
          p_device_id: deviceId,
          p_corretor_whatsapp: corretorWhatsapp || null,
        })

        if (error) {
          if (error.message.includes('já possui')) {
            showToast('Você já tem uma reserva neste turno!', 'warning')
          } else if (
            error.message.includes('Acesso restrito') ||
            error.message.includes('cadastro prévio')
          ) {
            showToast(
              'Acesso restrito: Seu cadastro não foi encontrado na equipe desta imobiliária. Fale com seu coordenador.',
              'error'
            )
          } else {
            throw error
          }
          return
        }

        if (data === true) {
          showToast('Vaga garantida com sucesso! ✅', 'success')
        } else {
          showToast('Turno esgotado! Tente outro horário.', 'error')
        }
      } catch (err) {
        console.error('Erro ao reservar:', err)
        showToast('Erro ao reservar vaga. Tente novamente.', 'error')
      }
    },
    [corretorNome, corretorWhatsapp, deviceId, empresa?.exigir_cadastro_previo, showToast]
  )

  const handleCancelar = useCallback(
    async (reservaId) => {
      const ok = await confirm({
        title: 'Cancelar sua vaga?',
        message:
          'Tem certeza que deseja cancelar sua vaga neste turno?\nEla ficará disponível para outro corretor da equipe.',
        confirmText: 'Sim, cancelar vaga',
        cancelText: 'Voltar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { data, error } = await supabase.rpc('cancelar_vaga', {
          p_reserva_id: reservaId,
          p_device_id: deviceId,
        })

        if (error) throw error

        if (data === true) {
          showToast('Reserva cancelada.', 'info')
        } else {
          showToast('Não foi possível cancelar. Verifique se é sua reserva.', 'error')
        }
      } catch (err) {
        console.error('Erro ao cancelar:', err)
        showToast('Erro ao cancelar reserva.', 'error')
      }
    },
    [confirm, deviceId, showToast]
  )

  const handleReservarComDados = useCallback(
    async (turnoId, nome, whatsapp) => {
      try {
        const { data, error } = await supabase.rpc('reservar_vaga', {
          p_turno_id: turnoId,
          p_corretor_nome: nome,
          p_device_id: deviceId,
          p_corretor_whatsapp: whatsapp || null,
        })

        if (error) {
          if (error.message.includes('já possui')) {
            showToast('Você já tem uma reserva neste turno!', 'warning')
          } else if (
            error.message.includes('Acesso restrito') ||
            error.message.includes('cadastro prévio')
          ) {
            showToast(
              'Acesso restrito: Seu cadastro não foi encontrado na equipe desta imobiliária. Fale com seu coordenador.',
              'error'
            )
          } else {
            throw error
          }
          return
        }

        if (data === true) {
          showToast('Vaga garantida com sucesso! ✅', 'success')
        } else {
          showToast('Turno esgotado! Tente outro horário.', 'error')
        }
      } catch (err) {
        console.error('Erro ao reservar:', err)
        showToast('Erro ao reservar vaga. Tente novamente.', 'error')
      }
    },
    [deviceId, showToast]
  )

  const handleNomeConfirm = useCallback(
    ({ nome, whatsapp }) => {
      setCorretorNome(nome)
      setCorretorWhatsapp(whatsapp)
      localStorage.setItem('escala_corretor_nome', nome)
      localStorage.setItem('escala_corretor_whatsapp', whatsapp)
      setShowNomeModal(false)

      if (pendingTurnoId) {
        setTimeout(() => {
          handleReservarComDados(pendingTurnoId, nome, whatsapp)
          setPendingTurnoId(null)
        }, 100)
      }
    },
    [pendingTurnoId, handleReservarComDados]
  )

  // ─── Navegação e Ações de Gestão ─────────────────────────────
  const handleAdminAccess = useCallback(() => {
    if (isAdminSession) {
      setView('admin')
      return
    }
    setShowAdminLoginModal(true)
  }, [isAdminSession])

  const handleAdminLogout = useCallback(async () => {
    setIsPinAuth(false)
    if (user) {
      await signOut()
    }
    if (!isPortalDomain) {
      setView('corretor')
    }
    showToast('Você saiu do modo administrador.', 'info')
  }, [signOut, showToast, user, isPortalDomain])

  const handleLimparEscala = useCallback(
    async (pontoId = null) => {
      if (!empresa?.id) return

      const pontoAlvo = pontoId ? pontos.find((p) => p.id === pontoId) : null
      const titulo = pontoAlvo
        ? `Limpar reservas de "${pontoAlvo.nome}"?`
        : `Limpar toda a escala de ${empresa.nome}?`
      const mensagem = pontoAlvo
        ? `⚠️ Tem certeza que deseja apagar TODAS as reservas do ponto "${pontoAlvo.nome}"?\n\nOs horários continuarão existindo, mas todas as vagas deste ponto voltarão a ficar livres.`
        : `⚠️ ATENÇÃO: Isso vai apagar TODAS as reservas de TODOS os pontos da imobiliária "${empresa.nome}"!\n\nEsta ação é irreversível e liberará todas as vagas cadastradas.`

      const ok = await confirm({
        title: titulo,
        message: mensagem,
        confirmText: 'Apagar tudo',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { error } = await supabase.rpc('limpar_escala', {
          p_empresa_id: empresa.id,
          p_ponto_id: pontoId,
        })
        if (error) throw error

        if (pontoId) {
          const turnoIdsDoPonto = turnos.filter((t) => t.ponto_id === pontoId).map((t) => t.id)
          setReservas((prev) => prev.filter((r) => !turnoIdsDoPonto.includes(r.turno_id)))
        } else {
          setReservas([])
        }
        showToast('Escala limpa com sucesso!', 'success')
      } catch (err) {
        console.error('Erro ao limpar escala:', err)
        showToast('Erro ao limpar escala.', 'error')
      }
    },
    [confirm, empresa, pontos, showToast, turnos]
  )

  // ─── Portal do Gestor (app.escalafacil.online) Desconectado ──
  if (isPortalDomain && !user && !isPinAuth) {
    return (
      <>
        <PortalGestorLogin
          onSuccess={(tipo, emp) => {
            if (tipo === 'pin') setIsPinAuth(true)
            setView('admin')
            if (emp) switchTenant(emp.id)
            refreshEmpresa()
          }}
          showToast={showToast}
          empresaId={empresa?.id}
          empresaNome={empresa?.nome}
        />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  // ─── Portal do Gestor Conectado mas sem Empresa Vinculada ────
  if (isPortalDomain && user && !empresa && minhasEmpresas.length === 0 && !tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
        <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 text-center space-y-5 animate-scale-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Nenhuma Imobiliária Vinculada</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-2">
              Sua conta ({user.email}) ainda não possui vínculo de gestão com nenhuma imobiliária cadastrada.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Solicite ao diretor da sua imobiliária para adicionar seu e-mail como gestor no painel de administração.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full btn-secondary py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Desconectar da Conta
          </button>
        </div>
      </div>
    )
  }

  // ─── Telas de Estado de Tenant (Carregando / Não Encontrado / Erro) ─
  if (tenantLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface-900 text-gray-100">
        <div className="w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  // ─── Página Inicial / Landing Page de Vendas (escalafacil.online/) ─
  if (isLanding) {
    return (
      <LandingPage
        onOpenDemo={() => {
          window.history.pushState({}, '', '/demo')
          switchTenant('demo')
        }}
        onOpenLogin={() => {
          if (isPortalDomain) {
            setShowAdminLoginModal(true)
          } else {
            window.location.href = window.location.hostname.includes('localhost')
              ? '/?portal=app'
              : 'https://app.escalafacil.online'
          }
        }}
      />
    )
  }

  if (notFound) {
    return (
      <>
        <TenantNotFound />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  if (tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
        <div className="w-full max-w-md bg-surface-800 border border-red-500/30 rounded-3xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-gray-100">Erro de Configuração</h2>
          <p className="text-xs text-gray-400">{tenantError}</p>
          <button
            onClick={refreshEmpresa}
            className="btn-primary py-2.5 px-4 text-xs flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  // ─── Tela de Empresa Bloqueada (Suspensão Asaas / Inadimplência) ─
  if (empresa?.status === 'bloqueado' && view !== 'admin') {
    return (
      <>
        <TenantBlockedView
          onOpenAdminLogin={() => setShowAdminLoginModal(true)}
        />
        <AdminLoginModal
          isOpen={showAdminLoginModal}
          onClose={() => setShowAdminLoginModal(false)}
          onSuccess={() => {
            setIsPinAuth(true)
            setView('admin')
          }}
          showToast={showToast}
          empresaId={empresa?.id}
          empresaNome={empresa?.nome}
        />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  // ─── Render Principal ────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-900 border-b border-surface-700">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {view === 'admin' && !isPortalDomain && (
              <button
                onClick={() => setView('corretor')}
                className="p-2 -ml-2 rounded-xl hover:bg-surface-700 transition-colors flex-shrink-0"
                aria-label="Voltar para a escala pública"
                title="Voltar para a escala do corretor (sessão continua ativa)"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <CalendarCheck className="w-6 h-6 text-brand-400 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-100 leading-tight flex items-center gap-1.5">
                <span>
                  Escala<span className="text-brand-400">Fácil</span>
                </span>
                {isPortalDomain && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20 select-none">
                    Gestão
                  </span>
                )}
              </h1>
              {/* Seletor de tenant interativo (apenas Visão Admin) vs. Nome Fixo Informativo (Corretor) */}
              {canSwitchTenant ? (
                <button
                  type="button"
                  onClick={() => setShowTenantSwitcher(true)}
                  className="group flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-400 -mt-0.5 transition-colors max-w-[170px] sm:max-w-[240px]"
                  title="Clique para alternar imobiliária ou copiar link"
                >
                  <Building2 className="w-3 h-3 text-gray-500 group-hover:text-brand-400 flex-shrink-0" />
                  <span className="truncate font-medium">{empresa?.nome || 'Minha Imobiliária'}</span>
                  <ChevronDown className="w-3 h-3 text-gray-500 group-hover:text-brand-400 flex-shrink-0" />
                </button>
              ) : (
                <div
                  className="flex items-center gap-1 text-[11px] text-gray-400 -mt-0.5 max-w-[170px] sm:max-w-[240px] select-none"
                  title={empresa?.nome || 'Minha Imobiliária'}
                >
                  <Building2 className="w-3 h-3 text-brand-400 flex-shrink-0" />
                  <span className="truncate font-medium text-gray-300">
                    {empresa?.nome || 'Minha Imobiliária'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {view === 'corretor' && (
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              <ThemeToggle />
            </div>
          )}

          {view === 'admin' && (
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Botão de Ver Escala Pública dos Corretores em nova aba */}
              {empresa && (
                <a
                  href={getPublicShareUrl(empresa)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-white bg-surface-800 hover:bg-surface-700 border border-surface-600 px-3 py-2 rounded-xl transition-all shadow-sm"
                  title="Abrir a escala pública exatamente como os corretores a veem"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-brand-400" />
                  <span>Escala Pública</span>
                </a>
              )}

              <ThemeToggle />

              {/* Badge de Papel */}
              {userEmpresaRole === 'admin' ? (
                <span
                  className="p-2 sm:p-2.5 rounded-xl text-brand-400 bg-brand-500/10 border border-brand-500/20 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Administrador da Imobiliária"
                >
                  <Shield className="w-5 h-5 text-brand-400" />
                </span>
              ) : (
                <span
                  className="p-2 sm:p-2.5 rounded-xl text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Gestor de Plantão"
                >
                  <Shield className="w-5 h-5 text-emerald-400" />
                </span>
              )}

              {/* Botão Sair */}
              <button
                onClick={handleAdminLogout}
                className="p-2 sm:p-2.5 rounded-xl text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Sair do modo administrador"
                aria-label="Sair do modo administrador"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 max-w-xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-4 pb-36 sm:pb-40">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Carregando escala...</p>
          </div>
        ) : view === 'corretor' ? (
          <CorretorView
            pontos={pontos.filter((p) => p.ativo !== false)}
            turnos={turnos}
            reservas={reservas}
            deviceId={deviceId}
            corretorNome={corretorNome}
            onReservar={handleReservar}
            onCancelar={handleCancelar}
            showToast={showToast}
            empresa={empresa}
            empresaShareUrl={getPublicShareUrl(empresa)}
          />
        ) : view === 'admin' && isAdminSession ? (
          <AdminView
            pontos={pontos}
            turnos={turnos}
            reservas={reservas}
            onLimparEscala={handleLimparEscala}
            onDataChanged={fetchData}
            showToast={showToast}
            empresaId={empresa?.id}
            empresaNome={empresa?.nome}
            empresa={empresa}
            onEmpresaUpdated={refreshEmpresa}
            isFullAdmin={isFullAdmin}
          />
        ) : null}
      </main>

      {/* Modal de identificação (Corretor 1º uso ou complementação) */}
      {showNomeModal && (
        <NomeModal
          initialNome={corretorNome}
          initialWhatsapp={corretorWhatsapp}
          exigirCadastro={empresa?.exigir_cadastro_previo || false}
          termos={termos}
          onConfirm={handleNomeConfirm}
          onClose={() => {
            setShowNomeModal(false)
            setPendingTurnoId(null)
          }}
        />
      )}

      {/* Modal de login de gestor / admin */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onSuccess={() => {
          setIsPinAuth(true)
          setView('admin')
        }}
        showToast={showToast}
        empresaId={empresa?.id}
        empresaNome={empresa?.nome}
      />

      {/* Modal para alternar de imobiliária / link do WhatsApp (apenas na visão admin) */}
      {canSwitchTenant && (
        <TenantSwitcherModal
          isOpen={showTenantSwitcher}
          onClose={() => setShowTenantSwitcher(false)}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
