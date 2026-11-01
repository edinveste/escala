import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import CorretorView from './components/CorretorView'
import AdminView from './components/AdminView'
import NomeModal from './components/NomeModal'
import Toast from './components/Toast'
import { useConfirm } from './components/ConfirmModal'
import { Shield, ArrowLeft, CalendarCheck } from 'lucide-react'

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
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [pontosRes, turnosRes, reservasRes] = await Promise.all([
        supabase.from('pontos').select('*').eq('ativo', true).order('ordem', { ascending: true }),
        supabase.from('turnos').select('*').order('ordem', { ascending: true }),
        supabase.from('reservas').select('*').order('created_at', { ascending: true }),
      ])

      if (pontosRes.error) throw pontosRes.error
      if (turnosRes.error) throw turnosRes.error
      if (reservasRes.error) throw reservasRes.error

      setPontos(pontosRes.data || [])
      setTurnos(turnosRes.data || [])
      setReservas(reservasRes.data || [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      showToast('Erro ao carregar dados. Verifique a conexão.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
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
            .then(({ data }) => { if (data) setTurnos(data) })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pontos' },
        () => {
          // Recarrega pontos ao mudar
          supabase.from('pontos').select('*').eq('ativo', true).order('ordem', { ascending: true })
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

  const handleAdminAccess = useCallback(async () => {
    const pin = prompt('Digite o PIN de administrador:')
    if (!pin) return

    try {
      const { data, error } = await supabase
        .from('config')
        .select('admin_pin')
        .eq('id', 1)
        .single()

      if (error) throw error

      if (data.admin_pin === pin) {
        setIsAdminAuth(true)
        setView('admin')
        showToast('Acesso admin concedido.', 'success')
      } else {
        showToast('PIN incorreto!', 'error')
      }
    } catch (err) {
      console.error('Erro ao verificar PIN:', err)
      showToast('Erro ao verificar PIN.', 'error')
    }
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
      <header className="sticky top-0 z-40 bg-surface-900/95 backdrop-blur-md border-b border-surface-700">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {view === 'admin' && (
              <button
                onClick={() => setView('corretor')}
                className="p-2 -ml-2 rounded-xl hover:bg-surface-700 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <CalendarCheck className="w-6 h-6 text-brand-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-100 leading-tight">
                Escala CRM
              </h1>
              <p className="text-[11px] text-gray-500 -mt-0.5">
                Controle de Captação
              </p>
            </div>
          </div>

          {view === 'corretor' && (
            <button
              onClick={handleAdminAccess}
              className="p-2.5 rounded-xl hover:bg-surface-700 transition-colors"
              aria-label="Acesso admin"
              title="Acesso Admin"
            >
              <Shield className="w-5 h-5 text-gray-600 hover:text-gray-400 transition-colors" />
            </button>
          )}

          {view === 'admin' && (
            <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full">
              Admin
            </span>
          )}
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Carregando escala...</p>
          </div>
        ) : view === 'corretor' ? (
          <CorretorView
            pontos={pontos}
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
