import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { processarTagsWhatsapp } from '../../corretor/escalaTextoHelper'

const MODELO_SUGERIDO_GERAL = `🛑🛑🛑 ATENÇÃO EQUIPE 🛑🛑🛑
📋 ESCALA DE CAPTAÇÃO — {empresa}

Fiquem atentos aos seus horários e regras:
👉 Cada turno conta com {capacidade}
👉 Garanta sua vaga exclusivamente pelo link oficial do app`

const MODELO_RODAPE_GERAL = `⚠️ IMPORTANTE:
• Em caso de imprevisto, libere sua vaga com antecedência pelo app.
• Pontualidade e respeito à escala são fundamentais. Boa captação a todos! 🚀`

export function useWhatsappConfig({
  empresa,
  pontos = [],
  initialAlvoId = 'geral',
  onEmpresaUpdated,
  onDataChanged,
  showToast,
  onClose,
}) {
  const [alvoId, setAlvoId] = useState(initialAlvoId || 'geral')
  const [cabecalho, setCabecalho] = useState('')
  const [rodape, setRodape] = useState('')
  const [saving, setSaving] = useState(false)

  // Dicionário de rascunhos em memória para cada alvo (geral ou ponto individual)
  // Estrutura: { [id]: { cabecalho: string, rodape: string, modificado: boolean } }
  const [drafts, setDrafts] = useState({})

  // Ponto atualmente selecionado (se não for 'geral')
  const pontoAtual = useMemo(
    () => (alvoId !== 'geral' ? pontos.find((p) => p.id === alvoId) : null),
    [alvoId, pontos]
  )

  // Obtém o valor salvo original no banco ou no JSONB empresas.termos
  const getValorSalvo = useCallback(
    (idDoAlvo) => {
      if (idDoAlvo === 'geral') {
        return {
          cabecalho: empresa?.msg_whatsapp_geral || empresa?.termos?.msgWhatsappGeral || '',
          rodape: empresa?.rodape_whatsapp_geral || empresa?.termos?.rodapeWhatsappGeral || '',
        }
      }
      const p = pontos.find((item) => item.id === idDoAlvo)
      return {
        cabecalho: p?.cabecalho_whatsapp || empresa?.termos?.whatsappPontos?.[idDoAlvo]?.cabecalho || '',
        rodape: p?.rodape_whatsapp || empresa?.termos?.whatsappPontos?.[idDoAlvo]?.rodape || '',
      }
    },
    [empresa, pontos]
  )

  // Ao montar ou mudar initialAlvoId, inicializa os campos
  useEffect(() => {
    const id = initialAlvoId || 'geral'
    setAlvoId(id)
    const inicial = getValorSalvo(id)
    setCabecalho(inicial.cabecalho || '')
    setRodape(inicial.rodape || '')
    setDrafts({})
  }, [initialAlvoId, getValorSalvo])

  // Troca de alvo com buffer de rascunho: preserva as edições do alvo anterior
  const mudarAlvo = useCallback(
    (novoAlvoId) => {
      if (novoAlvoId === alvoId) return

      setDrafts((prev) => {
        const valorOriginalAtual = getValorSalvo(alvoId)
        const foiModificado =
          prev[alvoId]?.modificado ||
          cabecalho !== valorOriginalAtual.cabecalho ||
          rodape !== valorOriginalAtual.rodape

        const novosDrafts = {
          ...prev,
          [alvoId]: {
            cabecalho,
            rodape,
            modificado: foiModificado,
          },
        }

        // Recupera o rascunho do novo alvo ou o valor salvo original
        const dadosNovo = novosDrafts[novoAlvoId] || getValorSalvo(novoAlvoId)
        setCabecalho(dadosNovo.cabecalho || '')
        setRodape(dadosNovo.rodape || '')

        return novosDrafts
      })

      setAlvoId(novoAlvoId)
    },
    [alvoId, cabecalho, rodape, getValorSalvo]
  )

  // Atualiza cabeçalho sincronizando o rascunho do alvo ativo
  const handleSetCabecalho = useCallback(
    (novoValor) => {
      setCabecalho((prevVal) => {
        const val = typeof novoValor === 'function' ? novoValor(prevVal) : novoValor
        setDrafts((prevDrafts) => ({
          ...prevDrafts,
          [alvoId]: {
            cabecalho: val,
            rodape: prevDrafts[alvoId]?.rodape ?? rodape,
            modificado: true,
          },
        }))
        return val
      })
    },
    [alvoId, rodape]
  )

  // Atualiza rodapé sincronizando o rascunho do alvo ativo
  const handleSetRodape = useCallback(
    (novoValor) => {
      setRodape((prevVal) => {
        const val = typeof novoValor === 'function' ? novoValor(prevVal) : novoValor
        setDrafts((prevDrafts) => ({
          ...prevDrafts,
          [alvoId]: {
            cabecalho: prevDrafts[alvoId]?.cabecalho ?? cabecalho,
            rodape: val,
            modificado: true,
          },
        }))
        return val
      })
    },
    [alvoId, cabecalho]
  )

  // ─── Status de Visibilidade do Botão Copiar da Escala ───────────
  const isCopiaGeralAtiva = useMemo(() => {
    return (
      empresa?.copia_whatsapp_geral_ativa !== false &&
      empresa?.termos?.copiaWhatsappGeralAtiva !== false
    )
  }, [empresa])

  const isCopiaPontoAtiva = useCallback(
    (pId) => {
      const p = pontos.find((item) => item.id === pId)
      return (
        p?.copia_whatsapp_ativa !== false &&
        empresa?.termos?.copiaWhatsappPontos?.[pId] !== false
      )
    },
    [pontos, empresa]
  )

  // ─── Alternar Visibilidade do Botão Copiar da Escala Geral ───────
  const alternarCopiaGeral = useCallback(
    async (e) => {
      e?.stopPropagation?.()
      if (!empresa?.id) return

      const statusAtual = isCopiaGeralAtiva
      const novoStatus = !statusAtual

      try {
        const novosTermos = {
          ...(empresa.termos || {}),
          copiaWhatsappGeralAtiva: novoStatus,
        }

        const payload = {
          copia_whatsapp_geral_ativa: novoStatus,
          termos: novosTermos,
        }

        const { error } = await supabase
          .from('empresas')
          .update(payload)
          .eq('id', empresa.id)

        if (error) {
          await supabase
            .from('empresas')
            .update({ termos: novosTermos })
            .eq('id', empresa.id)
        }

        onEmpresaUpdated?.({
          ...empresa,
          copia_whatsapp_geral_ativa: novoStatus,
          termos: novosTermos,
        })

        showToast?.(
          novoStatus
            ? 'Botão de copiar Escala Geral liberado aos corretores! 👁️'
            : 'Botão de copiar Escala Geral ocultado aos corretores. 🙈',
          novoStatus ? 'success' : 'info'
        )
      } catch (err) {
        console.error('Erro ao alternar cópia da escala geral:', err)
        showToast?.('Erro ao atualizar visibilidade da cópia.', 'error')
      }
    },
    [empresa, isCopiaGeralAtiva, onEmpresaUpdated, showToast]
  )

  // ─── Alternar Visibilidade do Botão Copiar de um Ponto ───────────
  const alternarCopiaPonto = useCallback(
    async (pontoId, e) => {
      e?.stopPropagation?.()
      const ponto = pontos.find((p) => p.id === pontoId)
      if (!ponto) return

      const statusAtual = isCopiaPontoAtiva(pontoId)
      const novoStatus = !statusAtual

      // Atualização otimista em memória
      ponto.copia_whatsapp_ativa = novoStatus

      try {
        const { error } = await supabase
          .from('pontos')
          .update({ copia_whatsapp_ativa: novoStatus })
          .eq('id', pontoId)

        if (error) {
          const novosTermos = {
            ...(empresa?.termos || {}),
            copiaWhatsappPontos: {
              ...(empresa?.termos?.copiaWhatsappPontos || {}),
              [pontoId]: novoStatus,
            },
          }
          await supabase
            .from('empresas')
            .update({ termos: novosTermos })
            .eq('id', empresa?.id)

          onEmpresaUpdated?.({
            ...empresa,
            termos: novosTermos,
          })
        }

        showToast?.(
          novoStatus
            ? `Botão de copiar escala de "${ponto.nome}" liberado aos corretores! 👁️`
            : `Botão de copiar escala de "${ponto.nome}" ocultado aos corretores. 🙈`,
          novoStatus ? 'success' : 'info'
        )

        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao alternar cópia do ponto:', err)
        showToast?.('Erro ao atualizar visibilidade da cópia do ponto.', 'error')
      }
    },
    [pontos, isCopiaPontoAtiva, empresa, onEmpresaUpdated, onDataChanged, showToast]
  )

  // Inserir tag no cursor ou ao final do campo
  const inserirTag = useCallback(
    (tag, campo = 'cabecalho') => {
      if (campo === 'cabecalho') {
        handleSetCabecalho((prev) => (prev ? `${prev} ${tag}` : tag))
      } else {
        handleSetRodape((prev) => (prev ? `${prev} ${tag}` : tag))
      }
    },
    [handleSetCabecalho, handleSetRodape]
  )

  // Inserir emoji diretamente no campo selecionado
  const inserirEmoji = useCallback(
    (emoji, campo = 'cabecalho') => {
      if (campo === 'cabecalho') {
        handleSetCabecalho((prev) => `${prev || ''}${emoji}`)
      } else {
        handleSetRodape((prev) => `${prev || ''}${emoji}`)
      }
    },
    [handleSetCabecalho, handleSetRodape]
  )

  // Restaura para o padrão automático do sistema para o alvo atual
  const restaurarPadrao = useCallback(() => {
    handleSetCabecalho('')
    handleSetRodape('')
    showToast?.('Campos limpos. O formato padrão do sistema será utilizado.', 'info')
  }, [handleSetCabecalho, handleSetRodape, showToast])

  // Gera texto de exemplo para a prévia ao vivo
  const textoPreview = useMemo(() => {
    const nomeEmp = empresa?.nome || 'Minha Imobiliária'
    const linkExemplo = window.location.origin
    const nomePonto = pontoAtual ? pontoAtual.nome : 'Todos os Pontos'

    let txt = ''
    if (cabecalho.trim()) {
      txt += processarTagsWhatsapp(cabecalho, {
        empresaNome: nomeEmp,
        pontoNome: nomePonto,
        capacidade: '2 por horário',
        shareUrl: linkExemplo,
      })
      txt += '\n\n━━━━━━━━━━━━━━━━━━\n\n'
    } else {
      txt += `📋 *ESCALA DE CAPTAÇÃO — ${nomeEmp.toUpperCase()} (2 por horário)*\n`
      txt += '━━━━━━━━━━━━━━━━━━\n\n'
      if (pontoAtual) {
        txt += `📍 *${pontoAtual.nome.toUpperCase()}*\n\n`
      }
    }

    if (!pontoAtual) {
      txt += `📍 *PLANTÃO PRINCIPAL*\n\n`
    }

    txt += `📅 *SEGUNDA-FEIRA*\n\n`
    txt += `🕐 08:00 às 10:00\n   → CARLOS SILVA / MARIANA SOUZA\n`
    txt += `🕐 10:00 às 12:00\n   → _vago_\n\n`

    if (rodape.trim()) {
      txt += `━━━━━━━━━━━━━━━━━━\n`
      txt += `${processarTagsWhatsapp(rodape, {
        empresaNome: nomeEmp,
        pontoNome: nomePonto,
        capacidade: '2 por horário',
        shareUrl: linkExemplo,
      })}\n\n`
    }

    txt += `━━━━━━━━━━━━━━━━━━\n`
    txt += `🔗 *GARANTA SUA VAGA*: ${linkExemplo}`

    return txt
  }, [cabecalho, rodape, empresa, pontoAtual])

  // Salvar no Supabase — persiste de forma individual cada opção que foi editada
  const salvarConfiguracao = useCallback(async () => {
    if (!empresa?.id) return

    setSaving(true)
    try {
      // 1. Consolida todos os rascunhos, incluindo o alvo que está aberto no momento
      const draftsFinais = {
        ...drafts,
        [alvoId]: {
          cabecalho,
          rodape,
          modificado: true,
        },
      }

      // Identifica todos os alvos que possuem alterações
      const alvosParaSalvar = Object.keys(draftsFinais).filter(
        (id) => draftsFinais[id]?.modificado !== false
      )

      if (alvosParaSalvar.length === 0) {
        onClose?.()
        return
      }

      let payloadGeral = null
      const whatsappPontosMap = {}
      const promessas = []

      for (const id of alvosParaSalvar) {
        const item = draftsFinais[id]
        const cabTexto = item.cabecalho?.trim() || null
        const rodTexto = item.rodape?.trim() || null

        if (id === 'geral') {
          payloadGeral = {
            msg_whatsapp_geral: cabTexto,
            rodape_whatsapp_geral: rodTexto,
          }

          promessas.push(
            (async () => {
              const { error: updateErr } = await supabase
                .from('empresas')
                .update(payloadGeral)
                .eq('id', empresa.id)

              if (updateErr) {
                await supabase.rpc('atualizar_whatsapp_empresa', {
                  p_empresa_id: empresa.id,
                  p_cabecalho: payloadGeral.msg_whatsapp_geral,
                  p_rodape: payloadGeral.rodape_whatsapp_geral,
                })
              }
            })()
          )
        } else {
          // Ponto individual de captação
          const payloadPonto = {
            cabecalho_whatsapp: cabTexto,
            rodape_whatsapp: rodTexto,
          }

          whatsappPontosMap[id] = {
            cabecalho: cabTexto,
            rodape: rodTexto,
          }

          // Atualiza o objeto do ponto em memória imediatamente
          const pIndex = pontos.findIndex((p) => p.id === id)
          if (pIndex !== -1) {
            pontos[pIndex].cabecalho_whatsapp = cabTexto
            pontos[pIndex].rodape_whatsapp = rodTexto
          }

          promessas.push(
            (async () => {
              const { error: updateErr } = await supabase
                .from('pontos')
                .update(payloadPonto)
                .eq('id', id)

              if (updateErr) {
                await supabase.rpc('atualizar_whatsapp_ponto', {
                  p_ponto_id: id,
                  p_empresa_id: empresa.id,
                  p_cabecalho: payloadPonto.cabecalho_whatsapp,
                  p_rodape: payloadPonto.rodape_whatsapp,
                })
              }
            })()
          )
        }
      }

      // Executa as atualizações de todos os pontos alterados
      await Promise.allSettled(promessas)

      // Salva também no JSONB empresas.termos como blindagem de contingência
      const novosTermos = {
        ...(empresa?.termos || {}),
        whatsappPontos: {
          ...(empresa?.termos?.whatsappPontos || {}),
          ...whatsappPontosMap,
        },
        ...(payloadGeral
          ? {
              msgWhatsappGeral: payloadGeral.msg_whatsapp_geral,
              rodapeWhatsappGeral: payloadGeral.rodape_whatsapp_geral,
            }
          : {}),
      }

      await supabase
        .from('empresas')
        .update({ termos: novosTermos })
        .eq('id', empresa.id)

      // Atualiza o contexto da empresa em memória
      onEmpresaUpdated?.({
        ...empresa,
        ...(payloadGeral || {}),
        termos: novosTermos,
      })

      onDataChanged?.()

      const qtd = alvosParaSalvar.length
      if (qtd === 1) {
        const nomeAlvo =
          alvosParaSalvar[0] === 'geral'
            ? 'Escala Geral'
            : pontos.find((p) => p.id === alvosParaSalvar[0])?.nome || 'Ponto'
        showToast?.(`Texto do WhatsApp de "${nomeAlvo}" salvo no banco com sucesso! 💬`, 'success')
      } else {
        showToast?.(`Textos de WhatsApp de ${qtd} itens salvos no banco com sucesso! 💬`, 'success')
      }

      onClose?.()
    } catch (err) {
      console.error('Erro ao salvar mensagens do WhatsApp:', err)
      showToast?.('Erro ao salvar: ' + (err.message || err), 'error')
    } finally {
      setSaving(false)
    }
  }, [
    empresa,
    pontos,
    alvoId,
    cabecalho,
    rodape,
    drafts,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
    onClose,
  ])

  return {
    alvoId,
    pontoAtual,
    mudarAlvo,
    drafts,
    cabecalho,
    setCabecalho: handleSetCabecalho,
    rodape,
    setRodape: handleSetRodape,
    saving,
    inserirTag,
    inserirEmoji,
    restaurarPadrao,
    salvarConfiguracao,
    textoPreview,
    isCopiaGeralAtiva,
    isCopiaPontoAtiva,
    alternarCopiaGeral,
    alternarCopiaPonto,
  }
}
