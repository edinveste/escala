import { obterDataDoDiaSemana } from './diasSemana.js'
import { normalizarTimeInput, parseHorarioTexto, cruzaMeiaNoite } from './horarioHelper.js'

/**
 * Escapa caracteres especiais para campos de texto do padrão iCalendar (RFC 5545).
 */
function escapeIcsText(str) {
  if (!str) return ''
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Formata um objeto Date no padrão UTC iCalendar (ex: "20261117T110000Z").
 */
function formatarIcsDateUtc(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Resolve as datas exatas (início e término) de um turno dentro do ciclo da escala.
 *
 * @param {Object} turno - Objeto do turno com dia, horario, hora_inicio, hora_fim
 * @param {Object} [opcoes]
 * @param {Date} [opcoes.dataReferencia=new Date()]
 * @param {Array<string>} [opcoes.diasNaEscala=[]]
 * @returns {{ startDate: Date, endDate: Date, horaInicio: string, horaFim: string, dataDia: Date } | null}
 */
export function resolverDatasTurno(turno, { dataReferencia = new Date(), diasNaEscala = [] } = {}) {
  if (!turno || !turno.dia) return null

  const dataDia = obterDataDoDiaSemana(turno.dia, { dataReferencia, diasNaEscala })
  if (!dataDia) return null

  let ini = normalizarTimeInput(turno.hora_inicio)
  let fim = normalizarTimeInput(turno.hora_fim)

  if (!ini || !fim) {
    const parsed = parseHorarioTexto(turno.horario)
    if (parsed) {
      ini = ini || parsed.horaInicio
      fim = fim || parsed.horaFim
    }
  }

  // Fallbacks seguros se o horário for indefinido
  if (!ini) ini = '08:00'
  if (!fim) fim = '12:00'

  const [h1, m1] = ini.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)

  const startDate = new Date(dataDia)
  startDate.setHours(h1, m1, 0, 0)

  const endDate = new Date(dataDia)
  endDate.setHours(h2, m2, 0, 0)

  // Trata virada de meia-noite (ex: 22:00 às 02:00) ou fim no dia seguinte
  if (cruzaMeiaNoite(ini, fim) || endDate.getTime() <= startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1)
  }

  return {
    startDate,
    endDate,
    horaInicio: ini,
    horaFim: fim,
    dataDia,
  }
}

/**
 * Gera o conteúdo de arquivo `.ics` (iCalendar / RFC 5545) contendo múltiplos turnos.
 * Compatível nativamente com Apple Calendar (iOS/Mac), Google Calendar, Samsung Calendar e Outlook.
 *
 * @param {Object} params
 * @param {Array} params.turnos - Lista de turnos reservados do colaborador
 * @param {Object} [params.empresa] - Dados da empresa/imobiliária
 * @param {string} [params.corretorNome] - Nome do colaborador
 * @returns {string} Texto iCalendar formatado
 */
export function gerarIcsEscala({ turnos = [], empresa = null, corretorNome = '' }) {
  const agoraUtc = formatarIcsDateUtc(new Date())
  const nomeEmpresa = empresa?.nome || 'EscalaFácil'
  const calName = escapeIcsText(`Escala - ${nomeEmpresa}`)

  const diasNaEscala = turnos.map((t) => t.dia).filter(Boolean)

  const eventosIcs = turnos
    .map((turno) => {
      const datas = resolverDatasTurno(turno, { diasNaEscala })
      if (!datas) return null

      const startUtc = formatarIcsDateUtc(datas.startDate)
      const endUtc = formatarIcsDateUtc(datas.endDate)
      const uid = `escala-${turno.reservaId || turno.id || Math.random().toString(36).slice(2)}@escalafacil.online`

      const local = turno.pontoNome || 'Local da Escala'
      const horarioTxt = turno.horario || `${datas.horaInicio} às ${datas.horaFim}`
      const titulo = `${nomeEmpresa}: ${local} (${horarioTxt})`

      const descricao = [
        `Escala confirmada em ${local}`,
        `Horário: ${horarioTxt}`,
        corretorNome ? `Colaborador: ${corretorNome}` : null,
        `Empresa: ${nomeEmpresa}`,
        'Gerado via EscalaFácil',
      ]
        .filter(Boolean)
        .join('\n')

      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${agoraUtc}`,
        `DTSTART:${startUtc}`,
        `DTEND:${endUtc}`,
        `SUMMARY:${escapeIcsText(titulo)}`,
        `DESCRIPTION:${escapeIcsText(descricao)}`,
        `LOCATION:${escapeIcsText(local)}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
      ].join('\r\n')
    })
    .filter(Boolean)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EscalaFacil//Minha Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
    ...eventosIcs,
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}

/**
 * Gera link direto web para adicionar um turno avulso ao Google Calendar.
 *
 * @param {Object} params
 * @param {Object} params.turno
 * @param {Object} [params.empresa]
 * @param {string} [params.corretorNome]
 * @returns {string} URL pronta para redirecionar ou abrir nova aba
 */
export function gerarGoogleCalendarUrl({ turno, empresa = null, corretorNome = '' }) {
  if (!turno) return '#'

  const datas = resolverDatasTurno(turno)
  if (!datas) return '#'

  const startIso = formatarIcsDateUtc(datas.startDate)
  const endIso = formatarIcsDateUtc(datas.endDate)

  const nomeEmpresa = empresa?.nome || 'EscalaFácil'
  const local = turno.pontoNome || 'Local da Escala'
  const horarioTxt = turno.horario || `${datas.horaInicio} às ${datas.horaFim}`
  const titulo = `${nomeEmpresa}: ${local} (${horarioTxt})`

  const detalhes = [
    `Escala confirmada em ${local}`,
    `Horário: ${horarioTxt}`,
    corretorNome ? `Colaborador: ${corretorNome}` : null,
    `Empresa: ${nomeEmpresa}`,
    'Gerado via EscalaFácil',
  ]
    .filter(Boolean)
    .join('\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: `${startIso}/${endIso}`,
    details: detalhes,
    location: local,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Dispara o download nativo do arquivo `.ics` no navegador.
 *
 * @param {string} conteudoIcs - String formatada do iCalendar
 * @param {string} [nomeArquivo='minha-agenda-escala.ics']
 */
export function baixarArquivoIcs(conteudoIcs, nomeArquivo = 'minha-agenda-escala.ics') {
  if (!conteudoIcs) return
  const blob = new Blob([conteudoIcs], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', nomeArquivo)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
