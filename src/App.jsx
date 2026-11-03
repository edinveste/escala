import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import { formatarNomeDia, migrarDiasLegados } from './lib/diasSemana'
import CorretorView from './components/CorretorView'
import AdminView from './components/AdminView'
import NomeModal from './components/NomeModal'
import AdminLoginModal from './components/AdminLoginModal'
import Toast from './components/Toast'
import ThemeToggle from './components/ThemeToggle'
import { useConfirm } from './components/ConfirmModal'
import { Shield, ArrowLeft, CalendarCheck, LogOut } from 'lucide-react'

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

  // Estado de identidade
  const [deviceId, setDeviceId] = useState('')
  const [corretorNome, setCorretorNome] = useState('')
  const [showNomeModal, setShowNomeModal] = useState(false)
  const [pendingTurnoId, setPendingTurnoId] = useState(null)

  // Estado de dados
  const [pontos, setPontos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)

  // Navegação simples
  const [view, setView] = useState('corretor') // 'corretor' | 'admin'
  const [isAdminAuth, setIsAdminAuth] = useState(false)
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // ─── Inicialização do device_id e corretor_nome ──────────────
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
  }, [])

  // ─── Carregamento inicial de dados ───────────────────────────
  // isSilent = true por padrão nas recargas posteriores para evitar desmontar a tela e resetar o scroll
  const fetchData = useCallback(
    async (isSilent = true) => {
      if (!isSilent) {
        setLoading(true)
      }
      try {
        const [pontosRes, turnosRes, reservasRes] = await Promise.all([
          supabase.from('pontos').select('*').order('ordem', { ascending: true }),
          supabase.from('turnos').select('*').order('ordem', { ascending: true }),
          supabase.from('reservas').select('*').order('created_at', { ascending: true }),
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

        // Migra silenciosamente em background dias legados no banco (ex: 'SEGUNDA' -> 'SEGUNDA-FEIRA')
        migrarDiasLegados(turnosRes.data)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
        showToast('Erro ao carregar dados. Verifique a conexão.', 'error')
      } finally {
        if (!isSilent) {
          setLoading(false)
        }
      }
    },
    [showToast]
  )

  useEffect(() => {
    fetchData(false) // Apenas a 1ª carga mostra o spinner de tela cheia
  }, [fetchData])

  // ─── Realtime: escuta INSERT e DELETE em reservas ────────────
  useEffect(() => {
    const channel = supabase
      .channel('realtime-all')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservas' },
        (payload) => {
          setReservas((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reservas' },
        (payload) => {
          setReservas((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        () => {
          // Recarrega turnos ao mudar
          supabase.from('turnos').select('*').order('ordem', { ascending: true })
            .then(({ data }) => {
              if (data) {
                setTurnos(data.map((t) => ({ ...t, dia: formatarNomeDia(t.dia) })))
              }
            })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pontos' },
        () => {
          // Recarrega pontos ao mudar
          supabase.from('pontos').select('*').order('ordem', { ascending: true })
            .then(({ data }) => { if (data) setPontos(data) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ─── Ações ───────────────────────────────────────────────────
  const handleReservar = useCallback(
    async (turnoId) => {
      if (!corretorNome) {
        setPendingTurnoId(turnoId)
        setShowNomeModal(true)
        return
      }

      try {
        const { data, error } = await supabase.rpc('reservar_vaga', {
          p_turno_id: turnoId,
          p_corretor_nome: corretorNome,
          p_device_id: deviceId,
        })

        if (error) {
          if (error.message.includes('já possui')) {
            showToast('Você já tem uma reserva neste turno!', 'warning')
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
    [corretorNome, deviceId, showToast]
  )

  const handleCancelar = useCallback(
    async (reservaId) => {
      const ok = await confirm({
        title: 'Cancelar sua vaga?',
        message: 'Tem certeza que deseja cancelar sua vaga neste turno?\nEla ficará disponível para outro corretor da equipe.',
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

  const handleNomeConfirm = useCallback(
    (nome) => {
      setCorretorNome(nome)
      localStorage.setItem('escala_corretor_nome', nome)
      setShowNomeModal(false)

      if (pendingTurnoId) {
        setTimeout(() => {
          handleReservarComNome(pendingTurnoId, nome)
          setPendingTurnoId(null)
        }, 100)
      }
    },
    [pendingTurnoId, deviceId, showToast]
  )

  const handleReservarComNome = useCallback(
    async (turnoId, nome) => {
      try {
        const { data, error } = await supabase.rpc('reservar_vaga', {
          p_turno_id: turnoId,
          p_corretor_nome: nome,
          p_device_id: deviceId,
        })

        if (error) {
          if (error.message.includes('já possui')) {
            showToast('Você já tem uma reserva neste turno!', 'warning')
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

  const handleAdminAccess = useCallback(() => {
    if (isAdminAuth) {
      setView('admin')
      return
    }
    setShowAdminLoginModal(true)
  }, [isAdminAuth])

  const handleAdminLogout = useCallback(() => {
    setIsAdminAuth(false)
    setView('corretor')
    showToast('Você saiu do modo administrador.', 'info')
  }, [showToast])

  const handleLimparEscala = useCallback(async (pontoId = null) => {
    const pontoAlvo = pontoId ? pontos.find((p) => p.id === pontoId) : null
    const titulo = pontoAlvo ? `Limpar reservas de "${pontoAlvo.nome}"?` : 'Limpar toda a escala?'
    const mensagem = pontoAlvo
      ? `⚠️ Tem certeza que deseja apagar TODAS as reservas do ponto "${pontoAlvo.nome}"?\n\nOs horários continuarão existindo, mas todas as vagas deste ponto voltarão a ficar livres.`
      : '⚠️ ATENÇÃO: Isso vai apagar TODAS as reservas de TODOS os pontos da semana inteira!\n\nEsta ação é irreversível e liberará todas as vagas cadastradas.'

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
        p_ponto_id: pontoId,
      })
      if (error) throw error

      if (pontoId) {
        // Remove reservas locais deste ponto
        const turnoIdsDoPonto = turnos.filter(t => t.ponto_id === pontoId).map(t => t.id)
        setReservas(prev => prev.filter(r => !turnoIdsDoPonto.includes(r.turno_id)))
      } else {
        setReservas([])
      }
      showToast('Escala limpa com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao limpar escala:', err)
      showToast('Erro ao limpar escala.', 'error')
    }
  }, [confirm, pontos, showToast, turnos])

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-900 border-b border-surface-700">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {view === 'admin' && (
              <button
                onClick={() => setView('corretor')}
                className="p-2 -ml-2 rounded-xl hover:bg-surface-700 transition-colors"
                aria-label="Voltar para a escala"
                title="Voltar para a escala"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <CalendarCheck className="w-6 h-6 text-brand-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-100 leading-tight">
                Escala<span className="text-brand-400">Fácil</span>
              </h1>
              <p className="text-[11px] text-gray-500 -mt-0.5">
                Controle de Captação
              </p>
            </div>
          </div>

          {view === 'corretor' && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <ThemeToggle />
              <button
                onClick={handleAdminAccess}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-surface-700 transition-colors min-h-[40px] min-w-[40px]"
                aria-label="Acesso admin"
                title="Acesso Admin"
              >
                <Shield className="w-5 h-5 text-gray-400 hover:text-gray-100 transition-colors" />
                <span className="hidden sm:inline text-xs font-semibold">Admin</span>
              </button>
            </div>
          )}

          {view === 'admin' && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <span
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 sm:px-2.5 sm:py-1 rounded-xl sm:rounded-full min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0"
                title="Modo Administrador"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </span>
              <button
                onClick={handleAdminLogout}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 p-2 sm:px-3 sm:py-1.5 rounded-xl transition-all active:scale-95 min-h-[40px] min-w-[40px] sm:min-w-0"
                title="Sair do modo administrador"
                aria-label="Sair do modo administrador"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
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
          />
        ) : view === 'admin' && isAdminAuth ? (
          <AdminView
            pontos={pontos}
            turnos={turnos}
            reservas={reservas}
            onLimparEscala={handleLimparEscala}
            onDataChanged={fetchData}
            showToast={showToast}
          />
        ) : null}
      </main>

      {/* Modal de nome */}
      {showNomeModal && (
        <NomeModal
          onConfirm={handleNomeConfirm}
          onClose={() => {
            setShowNomeModal(false)
            setPendingTurnoId(null)
          }}
        />
      )}

      {/* Modal de login admin */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onSuccess={() => {
          setIsAdminAuth(true)
          setView('admin')
        }}
        showToast={showToast}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
