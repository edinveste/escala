import { useState, useCallback, useMemo, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { isRpcAusenteError, isMissingColumnError } from '../../../lib/supabasePublicHelper'
import { obterAberturaPonto } from '../../../lib/aberturaHelper'

/**
 * Converte Date ou ISO string para o formato aceito por <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
 */
export function dateToInputValue(dateOrIso) {
  if (!dateOrIso) return ''
  const d = new Date(dateOrIso)
  if (isNaN(d.getTime())) return ''
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  const hora = String(d.getHours()).padStart(2, '0')
  const minuto = String(d.getMinutes()).padStart(2, '0')
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`
}

/**
 * Converte valor do input datetime-local para string ISO (UTC).
 */
export function inputValueToIso(inputValue) {
  if (!inputValue) return null
  const d = new Date(inputValue)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * Gera data/hora para atalhos rápidos de 1 clique.
 */
export function gerarDatasAtalhos() {
  const agora = new Date()

  // 1. Hoje 18:00 (ou Hoje 20:00 / Amanhã 18:00 se já tiver passado)
  const hoje18 = new Date(agora)
  hoje18.setHours(18, 0, 0, 0)
  let labelHoje18 = 'Hoje às 18:00'
  if (hoje18.getTime() <= agora.getTime() + 5 * 60 * 1000) {
    hoje18.setHours(20, 0, 0, 0)
    labelHoje18 = 'Hoje às 20:00'
    if (hoje18.getTime() <= agora.getTime()) {
      hoje18.setDate(hoje18.getDate() + 1)
      hoje18.setHours(18, 0, 0, 0)
      labelHoje18 = 'Amanhã às 18:00'
    }
  }

  // 2. Amanhã 08:00
  const amanha08 = new Date(agora)
  amanha08.setDate(amanha08.getDate() + 1)
  amanha08.setHours(8, 0, 0, 0)

  // 3. Próxima Sexta 14:00
  const sexta14 = new Date(agora)
  const diaSemana = sexta14.getDay() // 0 = Domingo, 5 = Sexta
  let diasAteSexta = (5 - diaSemana + 7) % 7
  if (diasAteSexta === 0) {
    sexta14.setHours(14, 0, 0, 0)
    if (sexta14.getTime() <= agora.getTime() + 10 * 60 * 1000) {
      diasAteSexta = 7
    }
  }
  sexta14.setDate(sexta14.getDate() + diasAteSexta)
  sexta14.setHours(14, 0, 0, 0)
  const labelSexta14 = diasAteSexta === 0 ? 'Hoje (Sexta) às 14:00' : 'Próxima Sexta às 14:00'

  return [
    { id: 'hoje_18', label: labelHoje18, date: hoje18 },
    { id: 'amanha_08', label: 'Amanhã às 08:00', date: amanha08 },
    { id: 'sexta_14', label: labelSexta14, date: sexta14 },
  ]
}

/**
 * Hook para gerenciamento do agendamento de abertura de escala
 * (com suporte a escopo Global, Grupos de Pontos e Ponto Individual).
 */
export function useAgendamentoAbertura({
  empresa,
  pontos = [],
  alvoPontoId = null, // Se informado, agenda individualmente para 1 ponto
  onEmpresaUpdated,
  onDataChanged,
  showToast,
  onCloseModal,
}) {
  const [salvando, setSalvando] = useState(false)

  // Ponto alvo (caso seja individual)
  const pontoAlvo = useMemo(
    () => (alvoPontoId ? pontos.find((p) => p.id === alvoPontoId) || null : null),
    [pontos, alvoPontoId]
  )

  // Data atual de abertura do alvo
  const dataAtualAlvo = useMemo(() => {
    if (pontoAlvo) {
      const info = obterAberturaPonto(pontoAlvo, empresa)
      return info.dataAbertura
    }
    const dataEmpresa =
      empresa?.escala_abre_em !== undefined && empresa?.escala_abre_em !== null
        ? empresa.escala_abre_em
        : empresa?.termos?.escala_abre_em || null
    return dataEmpresa || null
  }, [pontoAlvo, empresa])

  // Escopo atual de pontos (null = todos)
  const [pontosIds, setPontosIds] = useState(() => {
    if (alvoPontoId) return [alvoPontoId]
    return (
      (empresa?.escala_abre_pontos_ids !== undefined && empresa?.escala_abre_pontos_ids !== null
        ? empresa.escala_abre_pontos_ids
        : empresa?.termos?.escala_abre_pontos_ids) || null
    )
  })

  const [dataInput, setDataInput] = useState(() => dateToInputValue(dataAtualAlvo))

  // Sincroniza sempre que o alvo ou empresa mudar
  useEffect(() => {
    setDataInput(dateToInputValue(dataAtualAlvo))
    if (!alvoPontoId) {
      const escopo =
        empresa?.escala_abre_pontos_ids !== undefined && empresa?.escala_abre_pontos_ids !== null
          ? empresa.escala_abre_pontos_ids
          : empresa?.termos?.escala_abre_pontos_ids || null
      setPontosIds(escopo)
    }
  }, [dataAtualAlvo, alvoPontoId, empresa?.escala_abre_pontos_ids, empresa?.termos?.escala_abre_pontos_ids])

  const statusAgendamento = useMemo(() => {
    if (!dataAtualAlvo) {
      return { agendado: false, targetDate: null }
    }
    const targetMs = new Date(dataAtualAlvo).getTime()
    const estaNoFuturo = !isNaN(targetMs) && targetMs > Date.now()
    return {
      agendado: estaNoFuturo,
      targetDate: estaNoFuturo ? dataAtualAlvo : null,
    }
  }, [dataAtualAlvo])

  const salvarAgendamento = useCallback(
    async (novaDataIso, novosPontosIds = null, overrideAlvoPontoId = undefined) => {
      if (!empresa?.id) return

      const pontoIdAlvoEfetivo =
        overrideAlvoPontoId !== undefined ? overrideAlvoPontoId : alvoPontoId

      // Validação de data no passado
      if (novaDataIso) {
        const targetMs = new Date(novaDataIso).getTime()
        if (isNaN(targetMs) || targetMs <= Date.now()) {
          showToast?.('Selecione uma data e horário futuro para o agendamento.', 'warning')
          return
        }
      }

      setSalvando(true)

      const ehLiberacao = !novaDataIso

      // Estrutura de novosTermos com limpeza estrita de chaves de agendamento
      const novosTermos = {
        ...(empresa?.termos || {}),
      }

      if (pontoIdAlvoEfetivo) {
        if (novaDataIso) {
          novosTermos.aberturaPontos = {
            ...(novosTermos.aberturaPontos || {}),
            [pontoIdAlvoEfetivo]: novaDataIso,
          }
        } else {
          if (novosTermos.aberturaPontos) {
            delete novosTermos.aberturaPontos[pontoIdAlvoEfetivo]
            if (Object.keys(novosTermos.aberturaPontos).length === 0) {
              delete novosTermos.aberturaPontos
            }
          }
        }
      } else {
        if (novaDataIso) {
          novosTermos.escala_abre_em = novaDataIso
          novosTermos.escala_abre_pontos_ids = novosPontosIds || null
        } else {
          delete novosTermos.escala_abre_em
          delete novosTermos.escala_abre_pontos_ids
          delete novosTermos.aberturaPontos
        }
      }

      const pontosIdsFinal = ehLiberacao
        ? null
        : (novosPontosIds !== null ? novosPontosIds : (pontosIds || null))

      try {
        // 1. Chamada prioritária à RPC Administrativa Atualizada (Fase 16)
        let rpcSucesso = false
        let rpcDataResult = null
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'atualizar_agendamento_escala',
            {
              p_empresa_id: empresa.id,
              p_abre_em: novaDataIso || null,
              p_pontos_ids: pontoIdAlvoEfetivo ? null : pontosIdsFinal,
              p_ponto_id: pontoIdAlvoEfetivo || null,
            }
          )

          if (!rpcErr) {
            rpcSucesso = true
            rpcDataResult = rpcData
          } else {
            console.warn('Aviso: RPC atualizar_agendamento_escala retornou erro, prosseguindo com sincronização direta:', rpcErr)
          }
        } catch (rpcCallErr) {
          console.warn('Erro ao executar RPC atualizar_agendamento_escala:', rpcCallErr)
        }

        // 2. Sincronização direta no banco para blindagem absoluta:
        // Garante que o campo JSONB `termos` e as colunas nas tabelas `empresas` e `pontos` fiquem consistentes
        if (ehLiberacao && !pontoIdAlvoEfetivo) {
          // Liberação geral de toda a escala
          try {
            await supabase
              .from('pontos')
              .update({ escala_abre_em: null })
              .eq('empresa_id', empresa.id)
          } catch (e) {
            console.warn('Aviso ao limpar escala_abre_em dos pontos:', e)
          }

          try {
            await supabase
              .from('empresas')
              .update({
                escala_abre_em: null,
                escala_abre_pontos_ids: null,
                termos: novosTermos,
              })
              .eq('id', empresa.id)
          } catch (e) {
            console.warn('Aviso ao sincronizar empresas na liberação:', e)
          }
        } else if (pontoIdAlvoEfetivo && ehLiberacao) {
          // Liberação individual de um ponto
          try {
            await supabase
              .from('pontos')
              .update({ escala_abre_em: null })
              .eq('id', pontoIdAlvoEfetivo)
              .eq('empresa_id', empresa.id)
          } catch (e) {
            console.warn('Aviso ao limpar escala_abre_em do ponto:', e)
          }

          try {
            await supabase
              .from('empresas')
              .update({ termos: novosTermos })
              .eq('id', empresa.id)
          } catch (e) {
            console.warn('Aviso ao salvar termos do ponto:', e)
          }
        } else if (!rpcSucesso) {
          // Fallback caso a RPC não tenha sido executada com sucesso
          if (pontoIdAlvoEfetivo) {
            await supabase
              .from('pontos')
              .update({ escala_abre_em: novaDataIso || null })
              .eq('id', pontoIdAlvoEfetivo)
              .eq('empresa_id', empresa.id)

            await supabase
              .from('empresas')
              .update({ termos: novosTermos })
              .eq('id', empresa.id)
          } else {
            await supabase
              .from('empresas')
              .update({
                escala_abre_em: novaDataIso || null,
                escala_abre_pontos_ids: pontosIdsFinal,
                termos: novosTermos,
              })
              .eq('id', empresa.id)
          }
        }

        // 3. Montagem do estado da empresa atualizado
        const empAtualizada = {
          ...(rpcDataResult || empresa),
          escala_abre_em: pontoIdAlvoEfetivo
            ? (empresa.escala_abre_em || null)
            : (novaDataIso || null),
          escala_abre_pontos_ids: pontoIdAlvoEfetivo
            ? (empresa.escala_abre_pontos_ids || null)
            : pontosIdsFinal,
          termos: novosTermos,
        }

        if (ehLiberacao && !pontoIdAlvoEfetivo) {
          empAtualizada.escala_abre_em = null
          empAtualizada.escala_abre_pontos_ids = null
          delete empAtualizada.termos.escala_abre_em
          delete empAtualizada.termos.escala_abre_pontos_ids
          delete empAtualizada.termos.aberturaPontos
          setPontosIds(null)
          setDataInput('')
        } else if (ehLiberacao && pontoIdAlvoEfetivo) {
          if (empAtualizada.termos.aberturaPontos) {
            delete empAtualizada.termos.aberturaPontos[pontoIdAlvoEfetivo]
          }
          setDataInput('')
        }

        onEmpresaUpdated?.(empAtualizada)
        onDataChanged?.()

        showToast?.(
          novaDataIso
            ? pontoIdAlvoEfetivo
              ? `Abertura programada para "${pontoAlvo?.nome}" com sucesso! ⏱️`
              : 'Abertura da escala agendada com sucesso! ⏱️'
            : pontoIdAlvoEfetivo
            ? `Ponto "${pontoAlvo?.nome}" liberado imediatamente! 🚀`
            : 'Escala liberada imediatamente para reservas! 🚀',
          'success'
        )
        onCloseModal?.()
      } catch (err) {
        console.error('Erro ao agendar abertura:', err)
        showToast?.(
          err.message?.includes('futura')
            ? err.message
            : 'Erro ao salvar agendamento de abertura. Tente novamente.',
          'error'
        )
      } finally {
        setSalvando(false)
      }
    },
    [empresa, alvoPontoId, pontoAlvo, pontosIds, onEmpresaUpdated, onDataChanged, showToast, onCloseModal]
  )

  const liberarImediatamente = useCallback(
    async (pontoId = alvoPontoId) => {
      await salvarAgendamento(null, null, pontoId)
    },
    [salvarAgendamento, alvoPontoId]
  )

  return {
    salvando,
    dataInput,
    setDataInput,
    pontosIds,
    setPontosIds,
    pontoAlvo,
    statusAgendamento,
    salvarAgendamento,
    liberarImediatamente,
  }
}
