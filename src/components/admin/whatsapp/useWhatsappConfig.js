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

  // Ponto atualmente selecionado (se não for 'geral')
  const pontoAtual = useMemo(
    () => (alvoId !== 'geral' ? pontos.find((p) => p.id === alvoId) : null),
    [alvoId, pontos]
  )

  // Sincroniza campos quando o alvo ou os dados mudam
  const carregarDadosDoAlvo = useCallback(
    (idDoAlvo) => {
      if (idDoAlvo === 'geral') {
        setCabecalho(empresa?.msg_whatsapp_geral || empresa?.termos?.msgWhatsappGeral || '')
        setRodape(empresa?.rodape_whatsapp_geral || empresa?.termos?.rodapeWhatsappGeral || '')
      } else {
        const p = pontos.find((item) => item.id === idDoAlvo)
        setCabecalho(p?.cabecalho_whatsapp || '')
        setRodape(p?.rodape_whatsapp || '')
      }
    },
    [empresa, pontos]
  )

  // Ao montar ou mudar initialAlvoId
  useEffect(() => {
    const id = initialAlvoId || 'geral'
    setAlvoId(id)
    carregarDadosDoAlvo(id)
  }, [initialAlvoId, carregarDadosDoAlvo])

  // Troca de alvo (Escala Completa vs Ponto Individual)
  const mudarAlvo = useCallback(
    (novoAlvoId) => {
      setAlvoId(novoAlvoId)
      carregarDadosDoAlvo(novoAlvoId)
    },
    [carregarDadosDoAlvo]
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
          // Fallback se a coluna ainda não existir no Postgres
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
          // Fallback salvando em empresas.termos
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
  const inserirTag = useCallback((tag, campo = 'cabecalho') => {
    if (campo === 'cabecalho') {
      setCabecalho((prev) => (prev ? `${prev} ${tag}` : tag))
    } else {
      setRodape((prev) => (prev ? `${prev} ${tag}` : tag))
    }
  }, [])

  // Inserir emoji diretamente no campo selecionado
  const inserirEmoji = useCallback((emoji, campo = 'cabecalho') => {
    if (campo === 'cabecalho') {
      setCabecalho((prev) => `${prev || ''}${emoji}`)
    } else {
      setRodape((prev) => `${prev || ''}${emoji}`)
    }
  }, [])

  // Aplica o modelo sugerido profissional de acordo com o escopo selecionado
  const aplicarModeloSugerido = useCallback(() => {
    if (alvoId === 'geral') {
      setCabecalho(MODELO_SUGERIDO_GERAL)
      setRodape(MODELO_RODAPE_GERAL)
    } else {
      const nomePonto = pontoAtual?.nome || 'PONTO DE CAPTAÇÃO'
      setCabecalho(
        `🛑🛑🛑🛑🛑🛑🛑\n` +
        `! ! ! ATENÇÃO ! ! !\n\n` +
        `🏢 EMPREENDIMENTO: \n` +
        `📍 Ponto de Captação: ${nomePonto.toUpperCase()}\n` +
        `📌 Endereço: \n` +
        `⚠️ Capacidade: {capacidade}\n\n` +
        `IMPORTANTE:\n` +
        `Garanta ou consulte sua vaga diretamente pelo app no link abaixo. Não copie e cole!`
      )
      setRodape(
        `⚠️ Em caso de imprevisto, libere sua vaga com antecedência pelo app.`
      )
    }
  }, [alvoId, pontoAtual])

  // Restaura para o padrão automático do sistema
  const restaurarPadrao = useCallback(() => {
    setCabecalho('')
    setRodape('')
  }, [])

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

  // Salvar no Supabase (tanto geral quanto ponto individual)
  const salvarConfiguracao = useCallback(async () => {
    if (!empresa?.id) return

    setSaving(true)
    try {
      if (alvoId === 'geral') {
        const payload = {
          msg_whatsapp_geral: cabecalho.trim() || null,
          rodape_whatsapp_geral: rodape.trim() || null,
        }

        const { error: updateErr } = await supabase
          .from('empresas')
          .update(payload)
          .eq('id', empresa.id)

        if (updateErr) {
          const { error: rpcErr } = await supabase.rpc('atualizar_whatsapp_empresa', {
            p_empresa_id: empresa.id,
            p_cabecalho: payload.msg_whatsapp_geral,
            p_rodape: payload.rodape_whatsapp_geral,
          })
          if (rpcErr) throw rpcErr
        }

        if (onEmpresaUpdated) {
          onEmpresaUpdated({
            ...empresa,
            ...payload,
          })
        }

        showToast?.('Texto da Escala Geral salvo com sucesso! 💬', 'success')
      } else {
        // Ponto específico
        const payload = {
          cabecalho_whatsapp: cabecalho.trim() || null,
          rodape_whatsapp: rodape.trim() || null,
        }

        const { error: updateErr } = await supabase
          .from('pontos')
          .update(payload)
          .eq('id', alvoId)

        if (updateErr) {
          const { error: rpcErr } = await supabase.rpc('atualizar_whatsapp_ponto', {
            p_ponto_id: alvoId,
            p_empresa_id: empresa.id,
            p_cabecalho: payload.cabecalho_whatsapp,
            p_rodape: payload.rodape_whatsapp,
          })
          if (rpcErr) throw rpcErr
        }

        // Atualiza a lista em memória caso pontos tenha sido passado
        const pIndex = pontos.findIndex((p) => p.id === alvoId)
        if (pIndex !== -1) {
          pontos[pIndex].cabecalho_whatsapp = payload.cabecalho_whatsapp
          pontos[pIndex].rodape_whatsapp = payload.rodape_whatsapp
        }

        onDataChanged?.()
        showToast?.(`Texto do WhatsApp de "${pontoAtual?.nome || 'Ponto'}" salvo! 💬`, 'success')
      }

      onClose?.()
    } catch (err) {
      console.error('Erro ao salvar texto do WhatsApp:', err)
      showToast?.('Erro ao salvar: ' + (err.message || err), 'error')
    } finally {
      setSaving(false)
    }
  }, [
    empresa,
    pontos,
    alvoId,
    pontoAtual,
    cabecalho,
    rodape,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
    onClose,
  ])

  return {
    alvoId,
    pontoAtual,
    mudarAlvo,
    cabecalho,
    setCabecalho,
    rodape,
    setRodape,
    saving,
    inserirTag,
    inserirEmoji,
    aplicarModeloSugerido,
    restaurarPadrao,
    salvarConfiguracao,
    textoPreview,
    isCopiaGeralAtiva,
    isCopiaPontoAtiva,
    alternarCopiaGeral,
    alternarCopiaPonto,
  }
}
