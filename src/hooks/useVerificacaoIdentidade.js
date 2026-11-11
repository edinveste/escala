import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { executarPublicoSeguro, isRpcAusenteError } from '../lib/supabasePublicHelper'
import {
  TIPOS_VALIDACAO,
  limparWhatsApp,
  normalizarEmail,
  isEmailValido,
  exigeWhatsApp,
  exigeEmail,
} from '../lib/validacaoHelper'

/**
 * useVerificacaoIdentidade — Hook customizado para validação pontual em tempo real
 * via RPC segura `verificar_identidade_colaborador` (sem baixar listas de equipe ou reservas).
 */
export function useVerificacaoIdentidade({
  empresaId,
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  exigirCadastro = false,
  whatsapp = '',
  email = '',
  deviceId = '',
}) {
  const [membroAutorizado, setMembroAutorizado] = useState(null)
  const [verificando, setVerificando] = useState(false)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [mensagemErro, setMensagemErro] = useState(null)
  const [nomeExistenteReservas, setNomeExistenteReservas] = useState(null)

  useEffect(() => {
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
        // 1. Verificação pontual via RPC blindada (não expõe lista de equipe nem device_id)
        const { data: rpcRes, error: rpcErr } = await executarPublicoSeguro(() =>
          supabase.rpc('verificar_identidade_colaborador', {
            p_empresa_id: empresaId,
            p_whatsapp: cleanZap || null,
            p_email: cleanEmail || null,
            p_device_id: deviceId || null,
          })
        )

        if (cancel) return

        if (!rpcErr && rpcRes) {
          setMembroAutorizado(rpcRes.autorizado ? rpcRes.nome_oficial || null : null)
          setNaoEncontrado(Boolean(rpcRes.nao_encontrado))
          setMensagemErro(rpcRes.mensagem_erro || null)
          setNomeExistenteReservas(rpcRes.nome_existente_reservas || null)
          return
        }

        if (!isRpcAusenteError(rpcErr)) {
          throw rpcErr
        }

        // 2. Fallback transitório caso a migração SQL da Fase 14 ainda não tenha sido aplicada
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
            if (membro.device_id && deviceId && membro.device_id !== deviceId) {
              setMembroAutorizado(null)
              setNaoEncontrado(true)
              setMensagemErro(
                'Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular. Por segurança contra uso indevido, cada colaborador deve acessar exclusivamente pelo seu próprio aparelho.'
              )
              return
            }

            setMembroAutorizado(membro.nome)
            setNaoEncontrado(false)
            setMensagemErro(null)
            return
          }

          setMembroAutorizado(null)
          setNaoEncontrado(true)

          if (tipoValidacao === TIPOS_VALIDACAO.EMAIL) {
            setMensagemErro('Este e-mail corporativo não consta na equipe autorizada.')
          } else if (tipoValidacao === TIPOS_VALIDACAO.AMBOS) {
            const temZap = equipeData.some((m) => limparWhatsApp(m.whatsapp) === cleanZap)
            const temEmail = equipeData.some((m) => normalizarEmail(m.email) === cleanEmail)
            setMensagemErro(
              temZap || temEmail
                ? 'WhatsApp e E-mail não coincidem com o cadastro oficial da equipe.'
                : 'Dados não encontrados na equipe autorizada.'
            )
          } else {
            setMensagemErro('Este número de WhatsApp não consta na equipe autorizada.')
          }
          return
        }

        setMembroAutorizado(null)
        setNaoEncontrado(true)
        setMensagemErro('Nenhum colaborador autorizado foi cadastrado na coordenação ainda.')
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
