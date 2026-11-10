import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Hook customizado para gerenciar o estado dos acordeons de dias da semana
 * com suporte a persistência no localStorage isolada por empresa.
 */
export function useDiasAcordeon(selectedPontoId, diasOrdenados = [], empresaId = null) {
  const storageKey = empresaId
    ? `escala_corretor_dias_expandidos_${empresaId}`
    : 'escala_corretor_dias_expandidos'

  const [diasExpandidos, setDiasExpandidos] = useState(() => {
    try {
      const salvo = localStorage.getItem(storageKey)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de dias expandidos:', err)
    }
    return {}
  })

  // Salva no localStorage sempre que houver alteração
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(diasExpandidos))
    } catch (err) {
      console.error('Erro ao salvar preferência de dias expandidos:', err)
    }
  }, [diasExpandidos, storageKey])

  const isDiaAberto = useCallback(
    (dia) => {
      if (!selectedPontoId) return false
      return Boolean(diasExpandidos[`${selectedPontoId}_${dia}`])
    },
    [selectedPontoId, diasExpandidos]
  )

  const toggleDia = useCallback(
    (dia) => {
      if (!selectedPontoId) return
      const chave = `${selectedPontoId}_${dia}`
      setDiasExpandidos((prev) => ({
        ...prev,
        [chave]: !prev[chave],
      }))
    },
    [selectedPontoId]
  )

  const recolherTodosDias = useCallback(() => {
    if (!selectedPontoId) return
    setDiasExpandidos((prev) => {
      const novo = { ...prev }
      for (const dia of diasOrdenados) {
        novo[`${selectedPontoId}_${dia}`] = false
      }
      return novo
    })
  }, [selectedPontoId, diasOrdenados])

  const expandirTodosDias = useCallback(() => {
    if (!selectedPontoId) return
    setDiasExpandidos((prev) => {
      const novo = { ...prev }
      for (const dia of diasOrdenados) {
        novo[`${selectedPontoId}_${dia}`] = true
      }
      return novo
    })
  }, [selectedPontoId, diasOrdenados])

  const algumDiaExpandido = useMemo(() => {
    if (!selectedPontoId) return false
    return diasOrdenados.some((dia) => Boolean(diasExpandidos[`${selectedPontoId}_${dia}`]))
  }, [selectedPontoId, diasOrdenados, diasExpandidos])

  const toggleTodosDias = useCallback(() => {
    if (algumDiaExpandido) {
      recolherTodosDias()
    } else {
      expandirTodosDias()
    }
  }, [algumDiaExpandido, recolherTodosDias, expandirTodosDias])

  return {
    isDiaAberto,
    toggleDia,
    toggleTodosDias,
    algumDiaExpandido,
  }
}

