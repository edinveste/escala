import { useRef, useCallback, useLayoutEffect } from 'react'
import { inserirTextoNoCursor } from './whatsappTextHelper'

/**
 * Hook especializado na gestão de cursor, seleção e scroll de textareas controlados.
 * Garante que a inserção de tags ou emojis preserve a posição correta do cursor e do scroll,
 * inclusive após perda temporária de foco no clique de botões da interface.
 *
 * @param {Object} params
 * @param {string} params.cabecalho - Valor controlado do cabeçalho
 * @param {string} params.rodape - Valor controlado do rodapé
 * @param {Function} params.setCabecalho - Setter com sincronização de rascunho
 * @param {Function} params.setRodape - Setter com sincronização de rascunho
 */
export function useTextareaCursor({
  cabecalho,
  rodape,
  setCabecalho,
  setRodape,
}) {
  const cabecalhoRef = useRef(null)
  const rodapeRef = useRef(null)
  const selectionsRef = useRef({ cabecalho: null, rodape: null })
  const pendingSelectionRef = useRef({ cabecalho: null, rodape: null })
  const scrollRestoreRef = useRef({ cabecalho: null, rodape: null })

  const limparSelecoes = useCallback(() => {
    selectionsRef.current = { cabecalho: null, rodape: null }
    pendingSelectionRef.current = { cabecalho: null, rodape: null }
    scrollRestoreRef.current = { cabecalho: null, rodape: null }
  }, [])

  // Registra a posição atual do cursor/seleção para sobreviver à perda de foco
  const registrarSelecao = useCallback((campo, target) => {
    if (!target) return
    selectionsRef.current[campo] = {
      start: target.selectionStart ?? 0,
      end: target.selectionEnd ?? 0,
    }
  }, [])

  // Obtém a seleção viva do elemento focado ou o último cursor registrado do campo
  const obterSelecaoAtual = useCallback((campo) => {
    const ref = campo === 'cabecalho' ? cabecalhoRef.current : rodapeRef.current
    if (ref && document.activeElement === ref) {
      return {
        start: ref.selectionStart ?? 0,
        end: ref.selectionEnd ?? 0,
      }
    }
    return selectionsRef.current[campo]
  }, [])

  // Restaura foco, scroll e posição do cursor após o React atualizar o valor controlado
  const aplicarCursorPendente = useCallback((campo) => {
    const pos = pendingSelectionRef.current[campo]
    const el = campo === 'cabecalho' ? cabecalhoRef.current : rodapeRef.current
    if (pos === null || !el) return

    pendingSelectionRef.current[campo] = null
    const savedScroll = scrollRestoreRef.current[campo]
    scrollRestoreRef.current[campo] = null

    if (document.activeElement !== el) {
      el.focus()
    }
    if (savedScroll !== null) {
      el.scrollTop = savedScroll
    }
    el.setSelectionRange(pos, pos)
  }, [])

  useLayoutEffect(() => {
    aplicarCursorPendente('cabecalho')
  }, [cabecalho, aplicarCursorPendente])

  useLayoutEffect(() => {
    aplicarCursorPendente('rodape')
  }, [rodape, aplicarCursorPendente])

  // Insere texto (tag ou emoji) na posição exata do cursor do campo selecionado
  const inserirNoCampo = useCallback(
    (textoParaInserir, campo = 'cabecalho', { espacamentoInteligente = false } = {}) => {
      const isCabecalho = campo === 'cabecalho'
      const textoAtual = isCabecalho ? cabecalho : rodape
      const el = isCabecalho ? cabecalhoRef.current : rodapeRef.current
      const selecao = obterSelecaoAtual(campo)

      if (el) {
        scrollRestoreRef.current[campo] = el.scrollTop
      }

      const { novoTexto, novaPosicaoCursor } = inserirTextoNoCursor(
        textoAtual,
        textoParaInserir,
        selecao,
        { espacamentoInteligente }
      )

      selectionsRef.current[campo] = {
        start: novaPosicaoCursor,
        end: novaPosicaoCursor,
      }

      if (novoTexto === textoAtual) {
        if (el) {
          if (document.activeElement !== el) el.focus()
          el.setSelectionRange(novaPosicaoCursor, novaPosicaoCursor)
        }
        return
      }

      pendingSelectionRef.current[campo] = novaPosicaoCursor

      if (isCabecalho) {
        setCabecalho(novoTexto)
      } else {
        setRodape(novoTexto)
      }
    },
    [cabecalho, rodape, obterSelecaoAtual, setCabecalho, setRodape]
  )

  const inserirTag = useCallback(
    (tag, campo = 'cabecalho') => {
      inserirNoCampo(tag, campo, { espacamentoInteligente: true })
    },
    [inserirNoCampo]
  )

  const inserirEmoji = useCallback(
    (emoji, campo = 'cabecalho') => {
      inserirNoCampo(emoji, campo, { espacamentoInteligente: false })
    },
    [inserirNoCampo]
  )

  return {
    cabecalhoRef,
    rodapeRef,
    limparSelecoes,
    registrarSelecao,
    inserirTag,
    inserirEmoji,
  }
}

