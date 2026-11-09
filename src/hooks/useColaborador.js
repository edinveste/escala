import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// Gera um UUID v4 simples para rastreamento de aparelho (Zero-Atrito)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * useColaborador — Hook responsável pela identidade Zero-Atrito do colaborador,
 * persistência em localStorage, controle do modal de identificação e ações de reserva e cancelamento.
 */
export function useColaborador({ empresa, showToast, confirm }) {
  // Estado de identidade do Colaborador (Zero-Atrito)
  const [deviceId, setDeviceId] = useState('')
  const [corretorNome, setCorretorNome] = useState('')
  const [corretorWhatsapp, setCorretorWhatsapp] = useState('')
  const [corretorEmail, setCorretorEmail] = useState('')
  const [showNomeModal, setShowNomeModal] = useState(false)
  const [nomeModalError, setNomeModalError] = useState('')
  const [cadastroNaoAutorizado, setCadastroNaoAutorizado] = useState(false)
  const [pendingTurnoId, setPendingTurnoId] = useState(null)

  // ─── Inicialização do device_id, corretor_nome, whatsapp e email ──
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

    const storedEmail = localStorage.getItem('escala_corretor_email')
    if (storedEmail) {
      setCorretorEmail(storedEmail)
    }
  }, [])

  // Reseta erros e autorização ao alternar de empresa
  useEffect(() => {
    setCadastroNaoAutorizado(false)
    setNomeModalError('')
  }, [empresa?.id])

  // Se a proteção contra invasores for desativada, limpa imediatamente status de não autorizado
  useEffect(() => {
    if (!empresa?.exigir_cadastro_previo) {
      setCadastroNaoAutorizado(false)
      setNomeModalError('')
    }
  }, [empresa?.exigir_cadastro_previo])

  // ─── Ação: Reservar Vaga com dados explícitos ─────────────────
  const handleReservarComDados = useCallback(
    async (turnoId, nome, whatsapp, email) => {
      try {
        const { data, error } = await supabase.rpc('reservar_vaga', {
          p_turno_id: turnoId,
          p_corretor_nome: nome,
          p_device_id: deviceId,
          p_corretor_whatsapp: empresa?.exigir_cadastro_previo ? (whatsapp || null) : null,
          p_corretor_email: empresa?.exigir_cadastro_previo ? (email || null) : null,
        })

        if (error) {
          if (error.message.includes('já possui')) {
            showToast?.('Você já tem uma vaga reservada neste horário!', 'warning')
          } else if (
            error.message.includes('Acesso restrito') ||
            error.message.includes('cadastro prévio')
          ) {
            setCadastroNaoAutorizado(true)
            setNomeModalError(
              'Acesso restrito: Seu cadastro não foi encontrado na equipe desta empresa.'
            )
            setPendingTurnoId(turnoId)
            setShowNomeModal(true)
            showToast?.(
              'Acesso restrito: Cadastro não encontrado na equipe. Corrija seus dados abaixo.',
              'error'
            )
          } else {
            throw error
          }
          return
        }

        if (data === true) {
          setCadastroNaoAutorizado(false)
          setNomeModalError('')
          setPendingTurnoId(null)
          showToast?.('Vaga garantida com sucesso! ✅', 'success')
        } else {
          showToast?.('Turno esgotado! Tente outro horário.', 'error')
        }
      } catch (err) {
        console.error('Erro ao reservar:', err)
        showToast?.('Erro ao reservar vaga. Tente novamente.', 'error')
      }
    },
    [deviceId, empresa?.exigir_cadastro_previo, showToast]
  )

  // ─── Ação: Reservar Vaga pelo botão principal ─────────────────
  const handleReservar = useCallback(
    async (turnoId) => {
      const tipoValidacao = empresa?.tipo_validacao_equipe || 'whatsapp'
      const precisaZap = tipoValidacao === 'whatsapp' || tipoValidacao === 'ambos'
      const precisaEmail = tipoValidacao === 'email' || tipoValidacao === 'ambos'

      const faltaIdentificacao =
        !corretorNome ||
        (empresa?.exigir_cadastro_previo &&
          ((precisaZap && !corretorWhatsapp) || (precisaEmail && !corretorEmail)))

      if (faltaIdentificacao || (empresa?.exigir_cadastro_previo && cadastroNaoAutorizado)) {
        setPendingTurnoId(turnoId)
        if (empresa?.exigir_cadastro_previo && cadastroNaoAutorizado) {
          setNomeModalError('Acesso restrito: Seu cadastro não foi encontrado na equipe autorizada.')
        } else {
          setNomeModalError('')
        }
        setShowNomeModal(true)
        return
      }

      try {
        const { data, error } = await supabase.rpc('reservar_vaga', {
          p_turno_id: turnoId,
          p_corretor_nome: corretorNome,
          p_device_id: deviceId,
          p_corretor_whatsapp: empresa?.exigir_cadastro_previo ? (corretorWhatsapp || null) : null,
          p_corretor_email: empresa?.exigir_cadastro_previo ? (corretorEmail || null) : null,
        })

        if (error) {
          if (error.message.includes('já possui')) {
            showToast?.('Você já tem uma vaga reservada neste horário!', 'warning')
          } else if (
            error.message.includes('Acesso restrito') ||
            error.message.includes('cadastro prévio')
          ) {
            setCadastroNaoAutorizado(true)
            setNomeModalError(
              'Acesso restrito: Seu cadastro não foi encontrado na equipe desta empresa.'
            )
            setPendingTurnoId(turnoId)
            setShowNomeModal(true)
            showToast?.(
              'Acesso restrito: Cadastro não encontrado na equipe. Corrija seus dados abaixo.',
              'error'
            )
          } else {
            throw error
          }
          return
        }

        if (data === true) {
          setCadastroNaoAutorizado(false)
          setNomeModalError('')
          showToast?.('Vaga garantida com sucesso! ✅', 'success')
        } else {
          showToast?.('Turno esgotado! Tente outro horário.', 'error')
        }
      } catch (err) {
        console.error('Erro ao reservar:', err)
        showToast?.('Erro ao reservar vaga. Tente novamente.', 'error')
      }
    },
    [
      corretorNome,
      corretorWhatsapp,
      corretorEmail,
      deviceId,
      empresa?.exigir_cadastro_previo,
      empresa?.tipo_validacao_equipe,
      cadastroNaoAutorizado,
      showToast,
    ]
  )

  // ─── Ação: Cancelar Vaga com confirmação ──────────────────────
  const handleCancelar = useCallback(
    async (reservaId) => {
      const ok = await confirm?.({
        title: 'Cancelar sua vaga?',
        message:
          'Tem certeza que deseja cancelar sua vaga neste turno?\nEla ficará disponível para outro colaborador da equipe.',
        confirmText: 'Sim, cancelar vaga',
        cancelText: 'Voltar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { data, error } = await supabase.rpc('cancelar_vaga', {
          p_reserva_id: reservaId,
          p_device_id: deviceId,
          p_corretor_whatsapp: corretorWhatsapp || null,
          p_corretor_email: corretorEmail || null,
        })

        if (error) throw error

        if (data === true) {
          showToast?.('Reserva cancelada.', 'info')
        } else {
          showToast?.('Não foi possível cancelar. Verifique se é sua reserva.', 'error')
        }
      } catch (err) {
        console.error('Erro ao cancelar:', err)
        showToast?.('Erro ao cancelar reserva.', 'error')
      }
    },
    [confirm, deviceId, corretorWhatsapp, corretorEmail, showToast]
  )

  // ─── Confirmação do Modal de Nome ────────────────────────────
  const handleNomeConfirm = useCallback(
    ({ nome, whatsapp, email }) => {
      setCorretorNome(nome)
      setCorretorWhatsapp(whatsapp || '')
      setCorretorEmail(email || '')
      setCadastroNaoAutorizado(false)
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
          handleReservarComDados(turnoParaReservar, nome, whatsapp, email)
        }, 100)
      } else {
        showToast?.('Identificação atualizada com sucesso! ✅', 'success')
      }
    },
    [pendingTurnoId, handleReservarComDados, showToast]
  )

  // ─── Edição do Perfil e Fechamento do Modal ───────────────────
  const handleEditarPerfil = useCallback(() => {
    setNomeModalError('')
    setPendingTurnoId(null)
    setShowNomeModal(true)
  }, [])

  const fecharNomeModal = useCallback(() => {
    setShowNomeModal(false)
    setNomeModalError('')
    setPendingTurnoId(null)
  }, [])

  return {
    deviceId,
    corretorNome,
    corretorWhatsapp,
    corretorEmail,
    showNomeModal,
    nomeModalError,
    cadastroNaoAutorizado,
    pendingTurnoId,
    handleReservar,
    handleCancelar,
    handleNomeConfirm,
    handleEditarPerfil,
    fecharNomeModal,
  }
}

