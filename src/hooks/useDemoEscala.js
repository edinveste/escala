import { useState, useEffect, useCallback, useMemo } from 'react'
import { useConfirm } from '../components/ConfirmModal'
import {
  DEMO_EMPRESA,
  DEMO_PONTOS,
  DEMO_TURNOS,
  carregarReservasDemo,
  salvarReservasDemo,
} from '../lib/demoData'
import { obterTermos } from '../lib/vocabularioHelper'
import { calcularResumoColaborador } from '../lib/horarioHelper'

// Gera um UUID v4 simples para rastreamento de aparelho no modo demonstração
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * useDemoEscala — Hook responsável por gerenciar toda a lógica do modo demonstração:
 * - Identidade Zero-Atrito do visitante no navegador (deviceId, nome, WhatsApp, e-mail)
 * - Reservas em memória e sandbox persistente no localStorage (sem tocar no Supabase)
 * - Validações de concorrência, lotação e cancelamento com confirmação
 * - Controle dos modais de identificação e notificações Toast contextuais
 */
export function useDemoEscala() {
  const confirm = useConfirm()
  const termos = useMemo(() => obterTermos(DEMO_EMPRESA), [])

  // Estado do visitante da demo (Zero-Atrito)
  const [deviceId, setDeviceId] = useState('')
  const [corretorNome, setCorretorNome] = useState('')
  const [corretorWhatsapp, setCorretorWhatsapp] = useState('')
  const [corretorEmail, setCorretorEmail] = useState('')

  // Estado das reservas na sandbox demo
  const [reservas, setReservas] = useState(() => carregarReservasDemo())

  // Modal de identificação e turnos pendentes
  const [showNomeModal, setShowNomeModal] = useState(false)
  const [nomeModalError, setNomeModalError] = useState('')
  const [pendingTurnoId, setPendingTurnoId] = useState(null)

  // Feedback via Toast
  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])
  const limparToast = useCallback(() => {
    setToast(null)
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

      // 3. Verifica regras inteligentes da demonstração (conflito de horário + cotas)
      const resumo = calcularResumoColaborador({
        empresa: DEMO_EMPRESA,
        pontos: DEMO_PONTOS,
        turnos: DEMO_TURNOS,
        reservas,
        deviceId,
      })
      const bloqueio = resumo.analisarTurno(turnoAlvo)
      if (bloqueio.bloqueado) {
        showToast(bloqueio.motivo, 'warning')
        return
      }

      // 4. Insere a nova reserva na memória e no localStorage
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

  // ─── Cancelamento Local de Reserva com Confirmação ────────────
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

  // ─── Ações de Controle do Modal de Perfil ──────────────────────
  const abrirEdicaoPerfil = useCallback(() => {
    setNomeModalError('')
    setPendingTurnoId(null)
    setShowNomeModal(true)
  }, [])

  const fecharNomeModal = useCallback(() => {
    setShowNomeModal(false)
    setNomeModalError('')
    setPendingTurnoId(null)
  }, [])

  // URL pública da demonstração
  const empresaShareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/demo` : ''),
    []
  )

  return {
    // Identidade do visitante
    deviceId,
    corretorNome,
    corretorWhatsapp,
    corretorEmail,

    // Dados de escala sandbox
    reservas,
    pontos: DEMO_PONTOS,
    turnos: DEMO_TURNOS,
    empresa: DEMO_EMPRESA,
    termos,
    empresaShareUrl,

    // Controle do modal de identificação
    showNomeModal,
    setShowNomeModal,
    nomeModalError,
    setNomeModalError,
    pendingTurnoId,
    setPendingTurnoId,
    abrirEdicaoPerfil,
    fecharNomeModal,

    // Feedback Toast
    toast,
    setToast,
    showToast,
    limparToast,

    // Ações de reserva
    executarReservaLocal,
    handleReservar,
    handleCancelar,
    handleNomeConfirm,
  }
}

export default useDemoEscala

