import { formatarNomeDia } from './diasSemana.js'

/**
 * Normaliza um valor de hora (ex: "08:00:00", "8:00", "08:00") para "HH:MM"
 * compatível com inputs `<input type="time">` e exibição.
 */
export function normalizarTimeInput(valor) {
  if (!valor || typeof valor !== 'string') return ''
  const match = valor.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const hh = parseInt(match[1], 10)
  const mm = parseInt(match[2], 10)
  if (hh === 24 && mm === 0) return '00:00'
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return ''
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Converte "HH:MM" para "HH:MM:00" para persistência segura em coluna TIME do PostgreSQL.
 */
export function normalizarTimeSql(valor) {
  const hhmm = normalizarTimeInput(valor)
  return hhmm ? `${hhmm}:00` : null
}

/**
 * Formata um par (horaInicio, horaFim) em texto amigável padrão (ex: "08:00 às 12:00").
 */
export function formatarHorarioTurno(horaInicio, horaFim) {
  const ini = normalizarTimeInput(horaInicio)
  const fim = normalizarTimeInput(horaFim)
  if (!ini || !fim) return ''
  return `${ini} às ${fim}`
}

/**
 * Extrai horaInicio e horaFim ("HH:MM") a partir de textos legados variados:
 * Ex: "08:00 às 12:00", "8 as 10 hs", "11:30 às 14hrs", "14h às 16h", "8h30 - 12h".
 */
export function parseHorarioTexto(horario) {
  if (!horario || typeof horario !== 'string') return null
  const txt = horario.trim()
  if (!txt) return null

  const padraoExplicito =
    /(\d{1,2})\s*(?:(?::|[hH]\.?)\s*(\d{2})|[hH](?:rs?|s)?)\s*(?:às|as|até|ate|a|-|–|—|~|\/)\s*(\d{1,2})\s*(?:(?::|[hH]\.?)\s*(\d{2})|[hH](?:rs?|s)?)?/i
  const padraoSimples =
    /(\d{1,2})\s*(?:às|as|até|ate|a|-|–|—|~|\/)\s*(\d{1,2})\s*(?:(?::|[hH]\.?)\s*(\d{2})|[hH](?:rs?|s)?)?/i

  let h1
  let m1
  let h2
  let m2

  const match1 = txt.match(padraoExplicito)
  if (match1) {
    h1 = parseInt(match1[1], 10)
    m1 = match1[2] ? parseInt(match1[2], 10) : 0
    h2 = parseInt(match1[3], 10)
    m2 = match1[4] ? parseInt(match1[4], 10) : 0
  } else {
    const match2 = txt.match(padraoSimples)
    if (!match2) return null
    h1 = parseInt(match2[1], 10)
    m1 = 0
    h2 = parseInt(match2[2], 10)
    m2 = match2[3] ? parseInt(match2[3], 10) : 0
  }

  if (h1 < 0 || h1 > 23 || m1 < 0 || m1 > 59) return null
  if (!((h2 >= 0 && h2 <= 23 && m2 >= 0 && m2 <= 59) || (h2 === 24 && m2 === 0))) {
    return null
  }

  const h2Final = h2 === 24 ? 0 : h2
  const ini = `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`
  const fim = `${String(h2Final).padStart(2, '0')}:${String(m2).padStart(2, '0')}`
  if (ini === fim && h2 !== 24) return null

  return { horaInicio: ini, horaFim: fim }
}

/**
 * Indica se o intervalo entre horaInicio e horaFim atravessa a meia-noite (ex: 22:00 às 02:00).
 */
export function cruzaMeiaNoite(horaInicio, horaFim) {
  const ini = normalizarTimeInput(horaInicio)
  const fim = normalizarTimeInput(horaFim)
  if (!ini || !fim) return false
  const [h1, m1] = ini.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  return h2 * 60 + m2 <= h1 * 60 + m1
}

/**
 * Converte um turno em intervalo numérico de minutos [inicioMin, fimMin].
 * Trata virada de meia-noite (ex: 22:00–02:00 -> [1320, 1560], 20:00–00:00 -> [1200, 1440]).
 */
export function obterIntervaloTurno(turno) {
  if (!turno) return null

  let ini = normalizarTimeInput(turno.hora_inicio)
  let fim = normalizarTimeInput(turno.hora_fim)

  // Suporte caso coluna do banco esteja com '24:00:00'
  const rawFim24 = typeof turno.hora_fim === 'string' && /^24:00/.test(turno.hora_fim.trim())

  if (!ini || (!fim && !rawFim24)) {
    const parsed = parseHorarioTexto(turno.horario)
    if (!parsed) return null
    ini = parsed.horaInicio
    fim = parsed.horaFim
  }

  const [h1, m1] = ini.split(':').map(Number)
  const inicioMin = h1 * 60 + m1

  let fimMin
  if (rawFim24) {
    fimMin = 1440
  } else {
    const [h2, m2] = fim.split(':').map(Number)
    fimMin = h2 * 60 + m2
    if (fimMin <= inicioMin) {
      fimMin += 1440
    }
  }

  return { inicioMin, fimMin }
}

/**
 * Verifica se dois turnos se sobrepõem no mesmo dia da semana normalizado.
 */
export function turnosConflitam(turnoA, turnoB) {
  if (!turnoA || !turnoB || turnoA.id === turnoB.id) return false
  if (formatarNomeDia(turnoA.dia) !== formatarNomeDia(turnoB.dia)) return false

  const intA = obterIntervaloTurno(turnoA)
  const intB = obterIntervaloTurno(turnoB)
  if (!intA || !intB) return false

  return intA.inicioMin < intB.fimMin && intA.fimMin > intB.inicioMin
}

function normalizarInteiroPositivo(val) {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isInteger(num) && num >= 1 ? num : null
}

function normalizarListaIds(val) {
  if (!Array.isArray(val) || val.length === 0) return null
  const unicos = Array.from(new Set(val.filter((id) => typeof id === 'string' && id.trim())))
  return unicos.length > 0 ? unicos : null
}

/**
 * Extrai as regras inteligentes da empresa com fallback seguro para `termos.regrasEscala`
 * caso a migração SQL da Fase 15 ainda não tenha sido aplicada.
 */
export function obterRegrasEmpresa(empresa) {
  const fallback = empresa?.termos?.regrasEscala || {}

  const bloquearConflito =
    empresa?.bloquear_conflito_horario !== undefined
      ? Boolean(empresa.bloquear_conflito_horario)
      : Boolean(fallback.bloquear_conflito_horario)

  const limiteSemana =
    empresa?.limite_vagas_semana !== undefined
      ? normalizarInteiroPositivo(empresa.limite_vagas_semana)
      : normalizarInteiroPositivo(fallback.limite_vagas_semana)

  const limiteDia =
    empresa?.limite_vagas_dia !== undefined
      ? normalizarInteiroPositivo(empresa.limite_vagas_dia)
      : normalizarInteiroPositivo(fallback.limite_vagas_dia)

  const limitePonto =
    empresa?.limite_vagas_ponto !== undefined
      ? normalizarInteiroPositivo(empresa.limite_vagas_ponto)
      : normalizarInteiroPositivo(fallback.limite_vagas_ponto)

  const cotasPontosIds =
    empresa?.cotas_pontos_ids !== undefined
      ? normalizarListaIds(empresa.cotas_pontos_ids)
      : normalizarListaIds(fallback.cotas_pontos_ids)

  const temAlgumaCota = Boolean(
    limiteSemana !== null || limiteDia !== null || limitePonto !== null
  )

  const temAlgumaRegra = Boolean(bloquearConflito || temAlgumaCota)

  return {
    bloquearConflito,
    limiteSemana,
    limiteDia,
    limitePonto,
    cotasPontosIds,
    temAlgumaCota,
    temAlgumaRegra,
  }
}

/**
 * Calcula métricas de reservas do colaborador atual e avalia bloqueios preventivos
 * (conflito de horário e cotas por semana/dia/local) para exibição na UI pública e no /demo.
 */
export function calcularResumoColaborador({
  empresa,
  pontos = [],
  turnos = [],
  reservas = [],
  deviceId = '',
}) {
  const regras = obterRegrasEmpresa(empresa)
  const pontoMap = new Map((pontos || []).map((p) => [p.id, p]))
  const turnoMap = new Map((turnos || []).map((t) => [t.id, t]))

  const pontoTemCota = (pontoId) => {
    if (!pontoId) return false
    if (!regras.cotasPontosIds || regras.cotasPontosIds.length === 0) return true
    return regras.cotasPontosIds.includes(pontoId)
  }

  const isMinha = (r) => Boolean(r?.eh_minha || (deviceId && r?.device_id === deviceId))

  const porDia = {}
  const porPonto = {}
  const turnosReservados = []
  let totalSemana = 0

  for (const r of reservas || []) {
    if (!isMinha(r)) continue
    const turno = turnoMap.get(r.turno_id)
    if (!turno) continue
    const ponto = pontoMap.get(turno.ponto_id)
    if (!ponto) continue

    turnosReservados.push({
      ...turno,
      reservaId: r.id,
      dataReserva: r.created_at,
      pontoNome: ponto.nome,
    })

    porPonto[turno.ponto_id] = (porPonto[turno.ponto_id] || 0) + 1

    if (pontoTemCota(turno.ponto_id)) {
      totalSemana += 1
      const diaNorm = formatarNomeDia(turno.dia)
      porDia[diaNorm] = (porDia[diaNorm] || 0) + 1
    }
  }

  const analisarTurno = (turnoAlvo) => {
    if (!turnoAlvo) {
      return { bloqueado: false, tipo: null, motivo: '', labelCurta: '' }
    }

    const jaTemNesteTurno = turnosReservados.some((t) => t.id === turnoAlvo.id)
    if (jaTemNesteTurno) {
      return { bloqueado: false, tipo: null, motivo: '', labelCurta: '' }
    }

    // 1. Conflito de horário (mesmo dia, horários sobrepostos em qualquer ponto ativo)
    if (regras.bloquearConflito) {
      const conflitante = turnosReservados.find((tRes) => turnosConflitam(turnoAlvo, tRes))
      if (conflitante) {
        return {
          bloqueado: true,
          tipo: 'conflito',
          motivo: `Conflito de horário: você já está escalado em ${conflitante.pontoNome} (${conflitante.horario}).`,
          labelCurta: 'Conflito de Horário',
          conflitoTurno: conflitante,
          conflitoPontoNome: conflitante.pontoNome,
        }
      }
    }

    // As cotas se aplicam somente se o ponto do turno alvo estiver no escopo configurado
    if (!pontoTemCota(turnoAlvo.ponto_id)) {
      return { bloqueado: false, tipo: null, motivo: '', labelCurta: '' }
    }

    // 2. Cota semanal
    if (regras.limiteSemana !== null && totalSemana >= regras.limiteSemana) {
      return {
        bloqueado: true,
        tipo: 'cota_semana',
        motivo: `Você atingiu seu limite semanal de vagas (${totalSemana}/${regras.limiteSemana}). Cancele outra vaga para pegar esta.`,
        labelCurta: 'Limite Semanal Atingido',
      }
    }

    // 3. Cota por dia
    const diaNorm = formatarNomeDia(turnoAlvo.dia)
    const qtdDia = porDia[diaNorm] || 0
    if (regras.limiteDia !== null && qtdDia >= regras.limiteDia) {
      return {
        bloqueado: true,
        tipo: 'cota_dia',
        motivo: `Você atingiu seu limite de vagas na ${diaNorm} (${qtdDia}/${regras.limiteDia}).`,
        labelCurta: 'Limite do Dia Atingido',
      }
    }

    // 4. Cota por ponto/local
    const qtdPonto = porPonto[turnoAlvo.ponto_id] || 0
    if (regras.limitePonto !== null && qtdPonto >= regras.limitePonto) {
      const pontoNome = pontoMap.get(turnoAlvo.ponto_id)?.nome || 'este ponto'
      return {
        bloqueado: true,
        tipo: 'cota_ponto',
        motivo: `Você atingiu seu limite de vagas por ponto em ${pontoNome} (${qtdPonto}/${regras.limitePonto}).`,
        labelCurta: 'Limite por ponto atingido',
      }
    }

    return { bloqueado: false, tipo: null, motivo: '', labelCurta: '' }
  }

  return {
    regras,
    totalSemana,
    porDia,
    porPonto,
    turnosReservados,
    pontoTemCota,
    analisarTurno,
  }
}

