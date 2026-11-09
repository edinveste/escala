import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarCheck } from 'lucide-react'
import CorretorView from './CorretorView'
import NomeModal from './NomeModal'
import DemoBanner from './DemoBanner'
import Toast from './Toast'
import ThemeToggle from './ThemeToggle'
import { useConfirm } from './ConfirmModal'
import {
  DEMO_EMPRESA,
  DEMO_PONTOS,
  DEMO_TURNOS,
  carregarReservasDemo,
  salvarReservasDemo,
} from '../lib/demoData'
import { obterTermos } from '../lib/vocabularioHelper'

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function DemoEscalaView({ onBackToSite, onCadastrarEmpresa }) {
  const confirm = useConfirm()
  const termos = useMemo(() => obterTermos(DEMO_EMPRESA), [])

  // Estado do visitante da demo
  const [deviceId, setDeviceId] = useState('')
  const [corretorNome, setCorretorNome] = useState('')
  const [corretorWhatsapp, setCorretorWhatsapp] = useState('')
  const [corretorEmail, setCorretorEmail] = useState('')

  // Estado das reservas na sandbox demo
  const [reservas, setReservas] = useState(() => carregarReservasDemo())

  // Modal de identificação e pendências
  const [showNomeModal, setShowNomeModal] = useState(false)
  const [nomeModalError, setNomeModalError] = useState('')
  const [pendingTurnoId, setPendingTurnoId] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // Inicializa deviceId e dados de identificação salvos no navegador
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('escala_device_id')
    if (!storedDeviceId) {
      storedDeviceId = generateUUID()
      localStorage.setItem('escala_device_id', storedDeviceId)
    }
    setDeviceId(storedDeviceId)

    const storedNome = localStorage.getItem('escala_corretor_nome')
    if (storedNome) setCorretorNome(storedNome)

    const storedZap = localStorage.getItem('escala_corretor_whatsapp')
    if (storedZap) setCorretorWhatsapp(storedZap)

    const storedEmail = localStorage.getItem('escala_corretor_email')
    if (storedEmail) setCorretorEmail(storedEmail)
  }, [])

  // ─── Execução Local da Reserva (Sandbox sem tocar no banco) ────
  const executarReservaLocal = useCallback(
    (turnoId, nome, zap, email) => {
      const turnoAlvo = DEMO_TURNOS.find((t) => t.id === turnoId)
      if (!turnoAlvo) {
        showToast('Horário não encontrado.', 'error')
        return
      }

      // 1. Verifica se já tem vaga neste turno
      const jaReservou = reservas.some(
        (r) => r.turno_id === turnoId && r.device_id === deviceId
      )
      if (jaReservou) {
        showToast('Você já tem uma vaga reservada neste horário!', 'warning')
        return
      }

      // 2. Verifica capacidade do turno
      const totalReservasTurno = reservas.filter((r) => r.turno_id === turnoId).length
      if (totalReservasTurno >= turnoAlvo.capacidade) {
        showToast('Turno esgotado! Tente outro horário.', 'error')
        return
      }

      // 3. Insere a nova reserva na memória e no localStorage
      const novaReserva = {
        id: `demo-res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        empresa_id: DEMO_EMPRESA.id,
        turno_id: turnoId,
        corretor_nome: nome,
        corretor_whatsapp: zap || null,
        corretor_email: email || null,
        device_id: deviceId,
        created_at: new Date().toISOString(),
      }

      const novasReservas = [...reservas, novaReserva]
      setReservas(novasReservas)
      salvarReservasDemo(novasReservas)
      showToast('Vaga garantida com sucesso! ✅ (Modo Demonstração)', 'success')
    },
    [reservas, deviceId, showToast]
  )

  // ─── Disparo de Reserva pelo Visitante ─────────────────────────
  const handleReservar = useCallback(
    (turnoId) => {
      if (!corretorNome) {
        setPendingTurnoId(turnoId)
        setNomeModalError('')
        setShowNomeModal(true)
        return
      }

      executarReservaLocal(turnoId, corretorNome, corretorWhatsapp, corretorEmail)
    },
    [corretorNome, corretorWhatsapp, corretorEmail, executarReservaLocal]
  )

  // ─── Cancelamento Local de Reserva ────────────────────────────
  const handleCancelar = useCallback(
    async (reservaId) => {
      const ok = await confirm({
        title: 'Cancelar sua vaga?',
        message:
          'Tem certeza que deseja cancelar sua vaga neste turno?\nEla ficará disponível para outro colaborador da equipe.',
        confirmText: 'Sim, cancelar vaga',
        cancelText: 'Voltar',
        variant: 'danger',
      })
      if (!ok) return

      const novasReservas = reservas.filter((r) => r.id !== reservaId)
      setReservas(novasReservas)
      salvarReservasDemo(novasReservas)
      showToast('Reserva cancelada.', 'info')
    },
    [confirm, reservas, showToast]
  )

  // ─── Confirmação dos Dados no Modal ───────────────────────────
  const handleNomeConfirm = useCallback(
    ({ nome, whatsapp, email }) => {
      setCorretorNome(nome)
      setCorretorWhatsapp(whatsapp || '')
      setCorretorEmail(email || '')
      setNomeModalError('')
      localStorage.setItem('escala_corretor_nome', nome)
      if (whatsapp) {
        localStorage.setItem('escala_corretor_whatsapp', whatsapp)
      } else {
        localStorage.removeItem('escala_corretor_whatsapp')
      }
      if (email) {
        localStorage.setItem('escala_corretor_email', email)
      } else {
        localStorage.removeItem('escala_corretor_email')
      }
      setShowNomeModal(false)

      const turnoParaReservar = pendingTurnoId
      if (turnoParaReservar) {
        setPendingTurnoId(null)
        setTimeout(() => {
          executarReservaLocal(turnoParaReservar, nome, whatsapp, email)
        }, 100)
      } else {
        showToast('Identificação atualizada com sucesso! ✅', 'success')
      }
    },
    [pendingTurnoId, executarReservaLocal, showToast]
  )

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* Banner de Demonstração no Topo */}
      <DemoBanner
        onBackToSite={onBackToSite}
        onCadastrar={onCadastrarEmpresa}
      />

      {/* Header EscalaFácil */}
      <header className="sticky top-0 z-40 bg-surface-900/95 backdrop-blur-md border-b border-surface-700">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarCheck className="w-6 h-6 text-brand-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-100 leading-tight flex items-center gap-1.5">
                <span>
                  Escala<span className="text-brand-400">Fácil</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
                  Demo
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Conteúdo Principal — Visão Idêntica ao Corretor Real */}
      <main className="flex-1 max-w-xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-4 pb-36 sm:pb-40">
        <CorretorView
          pontos={DEMO_PONTOS}
          turnos={DEMO_TURNOS}
          reservas={reservas}
          deviceId={deviceId}
          corretorNome={corretorNome}
          corretorWhatsapp={corretorWhatsapp}
          corretorEmail={corretorEmail}
          cadastroNaoAutorizado={false}
          onEditarPerfil={() => {
            setNomeModalError('')
            setPendingTurnoId(null)
            setShowNomeModal(true)
          }}
          onReservar={handleReservar}
          onCancelar={handleCancelar}
          showToast={showToast}
          empresa={DEMO_EMPRESA}
          empresaShareUrl={typeof window !== 'undefined' ? `${window.location.origin}/demo` : ''}
        />
      </main>

      {/* Modal de identificação de teste */}
      {showNomeModal && (
        <NomeModal
          initialNome={corretorNome}
          initialWhatsapp={corretorWhatsapp}
          initialEmail={corretorEmail}
          deviceId={deviceId}
          tipoValidacao="whatsapp"
          exigirCadastro={false}
          empresaId={null}
          termos={termos}
          errorMessage={nomeModalError}
          hasPendingTurno={Boolean(pendingTurnoId)}
          onConfirm={handleNomeConfirm}
          onClose={() => {
            setShowNomeModal(false)
            setNomeModalError('')
            setPendingTurnoId(null)
          }}
        />
      )}

      {/* Notificações Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

