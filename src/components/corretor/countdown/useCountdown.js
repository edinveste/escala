import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Calcula os componentes de tempo restantes até a data alvo.
 * @param {number|null} targetMs - Timestamp em milissegundos da data alvo
 * @returns {object} { dias, horas, minutos, segundos, isFinalizado, totalSegundosRestantes }
 */
function calcularTempoRestante(targetMs) {
  if (!targetMs || isNaN(targetMs)) {
    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      isFinalizado: true,
      totalSegundosRestantes: 0,
    }
  }

  const agora = Date.now()
  const diferencaMs = targetMs - agora

  if (diferencaMs <= 0) {
    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      isFinalizado: true,
      totalSegundosRestantes: 0,
    }
  }

  const totalSegundosRestantes = Math.floor(diferencaMs / 1000)
  const dias = Math.floor(totalSegundosRestantes / 86400)
  const horas = Math.floor((totalSegundosRestantes % 86400) / 3600)
  const minutos = Math.floor((totalSegundosRestantes % 3600) / 60)
  const segundos = totalSegundosRestantes % 60

  return {
    dias,
    horas,
    minutos,
    segundos,
    isFinalizado: false,
    totalSegundosRestantes,
  }
}

/**
 * Hook customizado de contagem regressiva em tempo real com alta precisão (1s).
 *
 * @param {string|number|Date|null} targetDate - Data alvo de abertura
 * @param {function} [onFinish] - Callback opcional disparado no segundo exato do término
 * @returns {object} { dias, horas, minutos, segundos, isFinalizado, totalSegundosRestantes }
 */
export function useCountdown(targetDate, onFinish) {
  const targetMs = targetDate ? new Date(targetDate).getTime() : null
  const [tempo, setTempo] = useState(() => calcularTempoRestante(targetMs))

  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  const jaDisparouFinishRef = useRef(false)

  // Reseta estado e flags quando a data alvo mudar
  useEffect(() => {
    jaDisparouFinishRef.current = false
    const estadoInicial = calcularTempoRestante(targetMs)
    setTempo(estadoInicial)

    if (estadoInicial.isFinalizado) {
      return
    }

    const intervalId = setInterval(() => {
      const proximo = calcularTempoRestante(targetMs)
      setTempo(proximo)

      if (proximo.isFinalizado && !jaDisparouFinishRef.current) {
        jaDisparouFinishRef.current = true
        clearInterval(intervalId)
        if (typeof onFinishRef.current === 'function') {
          onFinishRef.current()
        }
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [targetMs])

  return tempo
}

