import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  TIPOS_VALIDACAO,
  limparWhatsApp,
  normalizarEmail,
  isEmailValido,
  exigeWhatsApp,
  exigeEmail,
} from '../lib/validacaoHelper'

/**
 * useVerificacaoIdentidade — Hook customizado para validação em tempo real de colaboradores
 * Consulta a equipe autorizada e a tabela de reservas para garantir integridade e anti-spoofing.
 */
export function useVerificacaoIdentidade({
  empresaId,
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  exigirCadastro = false,
  whatsapp = '',
  email = '',
  nome = '',
  deviceId = '',
}) {
  const [membroAutorizado, setMembroAutorizado] = useState(null)
  const [verificando, setVerificando] = useState(false)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [mensagemErro, setMensagemErro] = useState(null)
  const [nomeExistenteReservas, setNomeExistenteReservas] = useState(null)

  useEffect(() => {
    // Quando a proteção contra invasores estiver desativada, não exige checagem de equipe
    if (!empresaId || !exigirCadastro) {
      setMembroAutorizado(null)
      setNaoEncontrado(false)
      setMensagemErro(null)
      setNomeExistenteReservas(null)
      setVerificando(false)
      return
    }

    const cleanZap = limparWhatsApp(whatsapp)
    const cleanEmail = normalizarEmail(email)

    const precisaZap = exigeWhatsApp(tipoValidacao)
    const precisaEmail = exigeEmail(tipoValidacao)

    // Avalia se os dados mínimos foram digitados para iniciar a consulta
    const zapPronto = !precisaZap || cleanZap.length >= 10
    const emailPronto = !precisaEmail || isEmailValido(cleanEmail)

    if (!zapPronto || !emailPronto) {
      setMembroAutorizado(null)
      setNaoEncontrado(false)
      setMensagemErro(null)
      setNomeExistenteReservas(null)
      return
    }

    let cancel = false

    const verificar = async () => {
      setVerificando(true)
      setMensagemErro(null)

      try {
        // 1. Consulta membros ativos da equipe_corretores
        const { data: equipeData, error: equipeError } = await supabase
          .from('equipe_corretores')
          .select('nome, whatsapp, email, device_id')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)

        if (cancel) return

        if (equipeError) {
          console.warn('Aviso ao consultar equipe de colaboradores:', equipeError.message)
        }

        if (equipeData && equipeData.length > 0) {
          let membro = null

          if (tipoValidacao === TIPOS_VALIDACAO.WHATSAPP) {
            membro = equipeData.find((m) => limparWhatsApp(m.whatsapp) === cleanZap)
          } else if (tipoValidacao === TIPOS_VALIDACAO.EMAIL) {
            membro = equipeData.find((m) => normalizarEmail(m.email) === cleanEmail)
          } else if (tipoValidacao === TIPOS_VALIDACAO.AMBOS) {
            membro = equipeData.find(
              (m) =>
                limparWhatsApp(m.whatsapp) === cleanZap &&
                normalizarEmail(m.email) === cleanEmail
            )
          }

          if (membro) {
            // Trava de Aparelho: se o membro já tem celular vinculado e não é este
            if (membro.device_id && deviceId && membro.device_id !== deviceId) {
              setMembroAutorizado(null)
              setNaoEncontrado(true)
              setMensagemErro(
                'Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular. Por segurança contra uso indevido, cada colaborador deve acessar exclusivamente pelo seu próprio aparelho.'
              )
              setVerificando(false)
              return
            }

            setMembroAutorizado(membro.nome)
            setNaoEncontrado(false)
            setMensagemErro(null)
            setVerificando(false)
            return
          } else if (exigirCadastro) {
            setMembroAutorizado(null)
            setNaoEncontrado(true)

            if (tipoValidacao === TIPOS_VALIDACAO.EMAIL) {
              setMensagemErro('Este e-mail corporativo não consta na equipe autorizada.')
            } else if (tipoValidacao === TIPOS_VALIDACAO.AMBOS) {
              // Verifica se um dos dois bate para mensagem mais precisa
              const temZap = equipeData.some((m) => limparWhatsApp(m.whatsapp) === cleanZap)
              const temEmail = equipeData.some((m) => normalizarEmail(m.email) === cleanEmail)
              if (temZap || temEmail) {
                setMensagemErro('WhatsApp e E-mail não coincidem com o cadastro oficial da equipe.')
              } else {
                setMensagemErro('Dados não encontrados na equipe autorizada.')
              }
            } else {
              setMensagemErro('Este número de WhatsApp não consta na equipe autorizada.')
            }

            setVerificando(false)
            return
          }
        } else if (exigirCadastro) {
          setMembroAutorizado(null)
          setNaoEncontrado(true)
          setMensagemErro('Nenhum colaborador autorizado foi cadastrado na coordenação ainda.')
          setVerificando(false)
          return
        }

        // 2. Se a empresa não exigir cadastro prévio, checa conflito de nomes em reservas (Anti-Spoofing)
        const { data: reservasData } = await supabase
          .from('reservas')
          .select('corretor_nome, corretor_whatsapp, corretor_email')
          .eq('empresa_id', empresaId)
          .limit(200)

        if (cancel) return

        if (reservasData && reservasData.length > 0) {
          let reservaConflito = null

          if (cleanZap) {
            reservaConflito = reservasData.find(
              (r) => limparWhatsApp(r.corretor_whatsapp) === cleanZap
            )
          }

          if (!reservaConflito && cleanEmail) {
            reservaConflito = reservasData.find(
              (r) => normalizarEmail(r.corretor_email) === cleanEmail
            )
          }

          if (reservaConflito && reservaConflito.corretor_nome) {
            setNomeExistenteReservas(reservaConflito.corretor_nome)
          } else {
            setNomeExistenteReservas(null)
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar identidade do colaborador:', err)
      } finally {
        if (!cancel) setVerificando(false)
      }
    }

    const timer = setTimeout(verificar, 220)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [empresaId, tipoValidacao, exigirCadastro, whatsapp, email, deviceId])

  return {
    membroAutorizado,
    verificando,
    naoEncontrado,
    mensagemErro,
    nomeExistenteReservas,
  }
}

