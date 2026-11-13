import { useState, useCallback, useMemo, useRef } from 'react'
import { useWhatsappDrafts } from './useWhatsappDrafts'
import { useTextareaCursor } from './useTextareaCursor'
import { useWhatsappVisibility } from './useWhatsappVisibility'
import { persistirWhatsappConfiguracoes } from './whatsappService'
import { gerarTextoPreviewWhatsapp } from './whatsappPreviewHelper'

/**
 * Hook orquestrador (Facade) de personalização do WhatsApp da escala.
 *
 * Compõe submódulos especializados:
 * - `useWhatsappDrafts`: buffer em memória, alvos e troca sem perda de dados
 * - `useTextareaCursor`: seleção, scroll e inserção inteligente no cursor
 * - `useWhatsappVisibility`: visibilidade dos botões de cópia no painel e escala
 * - `whatsappService`: persistência atômica no Supabase e contingência JSONB
 * - `whatsappPreviewHelper`: formatação e tags do balão ao vivo
 *
 * Mantém 100% de compatibilidade com os consumidores da interface.
 */
export function useWhatsappConfig({
  isOpen = true,
  empresa,
  pontos = [],
  initialAlvoId = 'geral',
  onEmpresaUpdated,
  onDataChanged,
  showToast,
  onClose,
}) {
  const [saving, setSaving] = useState(false)

  // Ponte estável para resetar cursores sem acoplamento circular
  const onClearSelectionsRef = useRef(null)
  const handleClearSelections = useCallback(() => {
    onClearSelectionsRef.current?.()
  }, [])

  // 1. Gestão de rascunhos, buffer multi-alvo e textos ativos
  const {
    alvoId,
    pontoAtual,
    cabecalho,
    setCabecalho,
    rodape,
    setRodape,
    drafts,
    mudarAlvo,
    restaurarPadrao,
  } = useWhatsappDrafts({
    isOpen,
    initialAlvoId,
    empresa,
    pontos,
    onClearSelections: handleClearSelections,
    showToast,
  })

  // 2. Manipulação de seleção, inserção no cursor e scroll dos textareas
  const {
    cabecalhoRef,
    rodapeRef,
    limparSelecoes,
    registrarSelecao,
    inserirTag,
    inserirEmoji,
  } = useTextareaCursor({
    cabecalho,
    rodape,
    setCabecalho,
    setRodape,
  })

  onClearSelectionsRef.current = limparSelecoes

  // 3. Controle de visibilidade dos botões de cópia (Geral e Pontos)
  const {
    isCopiaGeralAtiva,
    isCopiaPontoAtiva,
    alternarCopiaGeral,
    alternarCopiaPonto,
  } = useWhatsappVisibility({
    empresa,
    pontos,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
  })

  // 4. Pré-visualização ao vivo do WhatsApp
  const textoPreview = useMemo(
    () =>
      gerarTextoPreviewWhatsapp({
        cabecalho,
        rodape,
        empresa,
        pontoAtual,
        alvoId,
      }),
    [cabecalho, rodape, empresa, pontoAtual, alvoId]
  )

  // 5. Orquestração de salvamento no Supabase
  const salvarConfiguracao = useCallback(async () => {
    if (!empresa?.id) return

    setSaving(true)
    try {
      const draftsFinais = {
        ...drafts,
        [alvoId]: {
          cabecalho,
          rodape,
          modificado: true,
        },
      }

      const alvosParaSalvar = Object.keys(draftsFinais).filter(
        (id) => draftsFinais[id]?.modificado !== false
      )

      if (alvosParaSalvar.length === 0) {
        onClose?.()
        return
      }

      const { payloadGeral, novosTermos } = await persistirWhatsappConfiguracoes({
        empresa,
        pontos,
        draftsFinais,
        alvosParaSalvar,
      })

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
    cabecalhoRef,
    rodapeRef,
    registrarSelecao,
    alvoId,
    pontoAtual,
    mudarAlvo,
    drafts,
    cabecalho,
    setCabecalho,
    rodape,
    setRodape,
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
