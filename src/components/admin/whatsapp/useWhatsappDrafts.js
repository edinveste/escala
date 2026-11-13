import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  obterCabecalhoPadrao,
  obterRodapePadrao,
} from '../../corretor/escalaTextoHelper'

/**
 * Hook especializado na gestão de rascunhos, buffers de edição em memória,
 * chaveamento entre diferentes alvos (Geral e Pontos) e restauração para o padrão.
 *
 * @param {Object} params
 * @param {boolean} params.isOpen - Se o modal está aberto
 * @param {string} params.initialAlvoId - Alvo inicial selecionado ('geral' ou id de um ponto)
 * @param {Object} params.empresa - Empresa ativa
 * @param {Array} params.pontos - Lista de pontos de captação
 * @param {Function} [params.onClearSelections] - Limpa as seleções de cursor salvas
 * @param {Function} [params.showToast] - Notificador visual de feedback
 */
export function useWhatsappDrafts({
  isOpen = true,
  initialAlvoId = 'geral',
  empresa,
  pontos = [],
  onClearSelections,
  showToast,
}) {
  const [alvoId, setAlvoId] = useState(initialAlvoId || 'geral')
  const [cabecalho, setCabecalho] = useState('')
  const [rodape, setRodape] = useState('')

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

  // Ao abrir o modal ou mudar initialAlvoId, inicializa os campos com valores salvos ou padrões
  useEffect(() => {
    if (!isOpen) return
    const id = initialAlvoId || 'geral'
    setAlvoId(id)
    const inicial = getValorSalvo(id)
    const pAtual = id !== 'geral' ? pontos.find((p) => p.id === id) : null

    const cabPadrao = obterCabecalhoPadrao({ alvoId: id, ponto: pAtual, empresa })
    const rodPadrao = obterRodapePadrao({ empresa })

    setCabecalho(inicial.cabecalho?.trim() ? inicial.cabecalho : cabPadrao)
    setRodape(inicial.rodape?.trim() ? inicial.rodape : rodPadrao)
    setDrafts({})
    onClearSelections?.()
  }, [isOpen, initialAlvoId, getValorSalvo, pontos, empresa, onClearSelections])

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

  // Troca de alvo com buffer de rascunho: preserva as edições do alvo anterior
  const mudarAlvo = useCallback(
    (novoAlvoId) => {
      if (novoAlvoId === alvoId) return

      onClearSelections?.()

      setDrafts((prev) => {
        const valorOriginalAtual = getValorSalvo(alvoId)
        const pAtual = alvoId !== 'geral' ? pontos.find((p) => p.id === alvoId) : null
        const cabPadraoAtual = obterCabecalhoPadrao({ alvoId, ponto: pAtual, empresa })
        const rodPadraoAtual = obterRodapePadrao({ empresa })

        const valorBaseCab = valorOriginalAtual.cabecalho || cabPadraoAtual
        const valorBaseRod = valorOriginalAtual.rodape || rodPadraoAtual

        const foiModificado =
          prev[alvoId]?.modificado ||
          cabecalho !== valorBaseCab ||
          rodape !== valorBaseRod

        const novosDrafts = {
          ...prev,
          [alvoId]: {
            cabecalho,
            rodape,
            modificado: foiModificado,
          },
        }

        // Recupera o rascunho do novo alvo ou o valor salvo original ou o padrão inicial
        const novoPonto = novoAlvoId !== 'geral' ? pontos.find((p) => p.id === novoAlvoId) : null
        const dadosNovoSalvo = getValorSalvo(novoAlvoId)
        const novoCabPadrao = obterCabecalhoPadrao({ alvoId: novoAlvoId, ponto: novoPonto, empresa })
        const novoRodPadrao = obterRodapePadrao({ empresa })

        const dadosNovo = novosDrafts[novoAlvoId] || {
          cabecalho: dadosNovoSalvo.cabecalho?.trim() ? dadosNovoSalvo.cabecalho : novoCabPadrao,
          rodape: dadosNovoSalvo.rodape?.trim() ? dadosNovoSalvo.rodape : novoRodPadrao,
        }

        setCabecalho(dadosNovo.cabecalho || '')
        setRodape(dadosNovo.rodape || '')

        return novosDrafts
      })

      setAlvoId(novoAlvoId)
    },
    [alvoId, cabecalho, rodape, getValorSalvo, pontos, empresa, onClearSelections]
  )

  // Restaura para o padrão automático do sistema para o alvo atual
  const restaurarPadrao = useCallback(() => {
    const cabPadrao = obterCabecalhoPadrao({ alvoId, ponto: pontoAtual, empresa })
    const rodPadrao = obterRodapePadrao({ empresa })
    onClearSelections?.()
    handleSetCabecalho(cabPadrao)
    handleSetRodape(rodPadrao)
    showToast?.('Campos restaurados com o modelo padrão do sistema! ✨', 'info')
  }, [alvoId, pontoAtual, empresa, onClearSelections, handleSetCabecalho, handleSetRodape, showToast])

  return {
    alvoId,
    pontoAtual,
    cabecalho,
    setCabecalho: handleSetCabecalho,
    rodape,
    setRodape: handleSetRodape,
    drafts,
    mudarAlvo,
    restaurarPadrao,
    getValorSalvo,
  }
}

