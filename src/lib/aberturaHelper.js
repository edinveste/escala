/**
 * Helper com regras de negócio e cálculo de Abertura Programada
 * com suporte a Escopo Global, Grupos de Pontos e Ponto Individual.
 */

/**
 * Formata a data/hora alvo de abertura em string concisa e legível.
 * Ex: "Hoje às 18:00", "Amanhã às 08:00", "Sex (14/11) às 14:00".
 */
export function formatarDataAberturaCurta(isoDate) {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return ''

    const agora = new Date()
    const mesmoDia =
      d.getDate() === agora.getDate() &&
      d.getMonth() === agora.getMonth() &&
      d.getFullYear() === agora.getFullYear()

    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (mesmoDia) {
      return `Hoje às ${hora}`
    }

    const amanha = new Date(agora)
    amanha.setDate(amanha.getDate() + 1)
    const ehAmanha =
      d.getDate() === amanha.getDate() &&
      d.getMonth() === amanha.getMonth() &&
      d.getFullYear() === amanha.getFullYear()

    if (ehAmanha) {
      return `Amanhã às ${hora}`
    }

    const diaSemanaCurto = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    const diaMes = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const diaCapitalizado = diaSemanaCurto.charAt(0).toUpperCase() + diaSemanaCurto.slice(1)
    return `${diaCapitalizado} (${diaMes}) às ${hora}`
  } catch {
    return ''
  }
}

/**
 * Resolve a data efetiva de abertura para um determinado ponto, considerando:
 * 1. Prioridade 1: Agendamento individual específico do ponto (`ponto.escala_abre_em` ou fallback em termos).
 * 2. Prioridade 2: Agendamento geral da empresa, desde que o ponto esteja no escopo (`escala_abre_pontos_ids`).
 *
 * @param {object} ponto - Objeto do ponto
 * @param {object} empresa - Objeto da empresa
 * @returns {object} { estaAgendado: boolean, dataAbertura: string|null, escopo: 'individual'|'empresa'|null }
 */
export function obterAberturaPonto(ponto, empresa) {
  if (!ponto) {
    return { estaAgendado: false, dataAbertura: null, escopo: null }
  }

  const agoraMs = Date.now()

  // 1. Prioridade 1: Agendamento individual específico deste ponto
  const pontoAbreEm =
    ponto.escala_abre_em !== undefined && ponto.escala_abre_em !== null
      ? ponto.escala_abre_em
      : empresa?.termos?.aberturaPontos?.[ponto.id] || null

  if (pontoAbreEm) {
    const targetMs = new Date(pontoAbreEm).getTime()
    if (!isNaN(targetMs) && targetMs > agoraMs) {
      return {
        estaAgendado: true,
        dataAbertura: pontoAbreEm,
        escopo: 'individual',
      }
    }
  }

  // 2. Prioridade 2: Agendamento da empresa (se o ponto estiver no escopo)
  const empresaAbreEm =
    empresa?.escala_abre_em !== undefined && empresa?.escala_abre_em !== null
      ? empresa?.escala_abre_em
      : empresa?.termos?.escala_abre_em || null

  if (empresaAbreEm) {
    const targetMs = new Date(empresaAbreEm).getTime()
    if (!isNaN(targetMs) && targetMs > agoraMs) {
      const pontosIdsEscopo =
        empresa?.escala_abre_pontos_ids !== undefined && empresa?.escala_abre_pontos_ids !== null
          ? empresa?.escala_abre_pontos_ids
          : empresa?.termos?.escala_abre_pontos_ids || null

      // Se pontosIds for null ou vazio, aplica a TODOS os pontos
      const aplicaNestePonto =
        !pontosIdsEscopo ||
        (Array.isArray(pontosIdsEscopo) &&
          (pontosIdsEscopo.length === 0 || pontosIdsEscopo.includes(ponto.id)))

      if (aplicaNestePonto) {
        return {
          estaAgendado: true,
          dataAbertura: empresaAbreEm,
          escopo: 'empresa',
        }
      }
    }
  }

  return {
    estaAgendado: false,
    dataAbertura: null,
    escopo: null,
  }
}

/**
 * Calcula o resumo do status de abertura de uma lista de pontos.
 */
export function calcularStatusGeralPontos(pontos = [], empresa = null) {
  const pontosAtivos = (pontos || []).filter((p) => p.ativo !== false)
  const agendados = []
  const abertos = []

  for (const ponto of pontosAtivos) {
    const info = obterAberturaPonto(ponto, empresa)
    if (info.estaAgendado) {
      agendados.push({ ponto, ...info })
    } else {
      abertos.push(ponto)
    }
  }

  const total = pontosAtivos.length
  return {
    totalPontos: total,
    totalAgendados: agendados.length,
    totalAbertos: abertos.length,
    pontosAgendados: agendados,
    pontosAbertos: abertos,
    todosAgendados: total > 0 && agendados.length === total,
    algunsAgendados: agendados.length > 0 && agendados.length < total,
    nenhumAgendado: agendados.length === 0,
  }
}

