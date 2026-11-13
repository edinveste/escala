import { supabase } from './supabaseClient'

/**
 * Constantes e utilitários para dias da semana completos.
 * Padrão de negócio: 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA',
 * 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO'.
 */

export const DIAS_SEMANA = [
  'SEGUNDA-FEIRA',
  'TERÇA-FEIRA',
  'QUARTA-FEIRA',
  'QUINTA-FEIRA',
  'SEXTA-FEIRA',
  'SÁBADO',
  'DOMINGO',
]

export const DIAS_UTEIS = [
  'SEGUNDA-FEIRA',
  'TERÇA-FEIRA',
  'QUARTA-FEIRA',
  'QUINTA-FEIRA',
  'SEXTA-FEIRA',
]

export const DIAS_FIM_DE_SEMANA = ['SÁBADO', 'DOMINGO']

// Mapa de compatibilidade e normalização
const MAPA_NORMALIZACAO = {
  SEGUNDA: 'SEGUNDA-FEIRA',
  'SEGUNDA-FEIRA': 'SEGUNDA-FEIRA',
  TERÇA: 'TERÇA-FEIRA',
  TERCA: 'TERÇA-FEIRA',
  'TERÇA-FEIRA': 'TERÇA-FEIRA',
  'TERCA-FEIRA': 'TERÇA-FEIRA',
  QUARTA: 'QUARTA-FEIRA',
  'QUARTA-FEIRA': 'QUARTA-FEIRA',
  QUINTA: 'QUINTA-FEIRA',
  'QUINTA-FEIRA': 'QUINTA-FEIRA',
  SEXTA: 'SEXTA-FEIRA',
  'SEXTA-FEIRA': 'SEXTA-FEIRA',
  SÁBADO: 'SÁBADO',
  SABADO: 'SÁBADO',
  DOMINGO: 'DOMINGO',
}

/**
 * Normaliza qualquer formato de dia para o nome completo e oficial.
 * @param {string} dia
 * @returns {string} Nome completo em maiúsculas (ex: 'SEGUNDA-FEIRA')
 */
export function formatarNomeDia(dia) {
  if (!dia || typeof dia !== 'string') return ''
  const chave = dia.trim().toUpperCase()
  return MAPA_NORMALIZACAO[chave] || chave
}

/**
 * Comparador cronológico para ordenação (Segunda a Domingo).
 * @param {string} diaA
 * @param {string} diaB
 * @returns {number}
 */
export function compararDias(diaA, diaB) {
  const normA = formatarNomeDia(diaA)
  const normB = formatarNomeDia(diaB)
  const idxA = DIAS_SEMANA.indexOf(normA)
  const idxB = DIAS_SEMANA.indexOf(normB)
  return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
}

/**
 * Retorna o índice base 0 do dia da semana (0 para SEGUNDA-FEIRA até 6 para DOMINGO).
 * Retorna -1 se o dia não for reconhecido.
 * @param {string} dia
 * @returns {number}
 */
export function obterIndiceDiaSemana(dia) {
  const norm = formatarNomeDia(dia)
  return DIAS_SEMANA.indexOf(norm)
}

/**
 * Retorna a data (objeto Date) correspondente à Segunda-feira do ciclo semanal da escala.
 *
 * Regra de Negócio Inteligente:
 * - De Segunda a Sábado: a escala refere-se ao ciclo semanal corrente (a Segunda-feira mais recente).
 * - No Domingo:
 *   - Se a escala contém apenas 'DOMINGO', refere-se ao plantão de hoje (Domingo atual).
 *   - Se a escala contém dias da semana completa (ex: 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', etc.),
 *     uma escala compartilhada no Domingo refere-se à nova semana que começa amanhã (Segunda-feira).
 *
 * @param {Date} [dataReferencia=new Date()]
 * @param {Array<string>} [diasNaEscala=[]]
 * @returns {Date}
 */
export function obterSegundaFeiraReferencia(dataReferencia = new Date(), diasNaEscala = []) {
  const ref =
    dataReferencia instanceof Date && !Number.isNaN(dataReferencia.getTime())
      ? new Date(dataReferencia.getTime())
      : new Date()

  ref.setHours(0, 0, 0, 0)

  // getDay(): 0 = Domingo, 1 = Segunda, 2 = Terça, ..., 6 = Sábado
  const diaSemanaJs = ref.getDay()
  // Mapeia para índice 0 = Segunda-feira .. 6 = Domingo
  const indiceHoje = diaSemanaJs === 0 ? 6 : diaSemanaJs - 1

  const segunda = new Date(ref)

  if (indiceHoje === 6) {
    // Hoje é Domingo
    const diasNorm = (diasNaEscala || []).map((d) => formatarNomeDia(d))
    const temDiasAnteriores = diasNorm.some((d) => {
      const idx = DIAS_SEMANA.indexOf(d)
      return idx >= 0 && idx < 6
    })

    if (temDiasAnteriores) {
      // Escala semanal completa no Domingo: projeta para a semana que começa amanhã
      segunda.setDate(ref.getDate() + 1)
    } else {
      // Escala apenas de Domingo: refere-se ao domingo de hoje
      segunda.setDate(ref.getDate() - 6)
    }
  } else {
    // Segunda a Sábado: Segunda-feira desta semana
    segunda.setDate(ref.getDate() - indiceHoje)
  }

  return segunda
}

/**
 * Calcula a data exata (Date) de um determinado dia da semana dentro do ciclo da escala.
 *
 * @param {string} dia - Nome do dia (ex: 'SEGUNDA-FEIRA', 'QUARTA-FEIRA')
 * @param {Object} [opcoes]
 * @param {Date} [opcoes.dataReferencia=new Date()]
 * @param {Array<string>} [opcoes.diasNaEscala=[]]
 * @returns {Date|null}
 */
export function obterDataDoDiaSemana(dia, { dataReferencia = new Date(), diasNaEscala = [] } = {}) {
  const idx = obterIndiceDiaSemana(dia)
  if (idx === -1) return null

  const segunda = obterSegundaFeiraReferencia(dataReferencia, diasNaEscala)
  const dataDia = new Date(segunda)
  dataDia.setDate(segunda.getDate() + idx)
  return dataDia
}

/**
 * Formata um objeto Date no padrão "DD/MM" (ex: "17/11", "24/02").
 *
 * @param {Date} data
 * @returns {string}
 */
export function formatarDataDdMm(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return ''
  const dd = String(data.getDate()).padStart(2, '0')
  const mm = String(data.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

/**
 * Retorna o nome do dia acompanhado da sua data real no formato:
 * "SEGUNDA-FEIRA (17/11)"
 *
 * Se o dia já contiver uma data em parênteses ou não for reconhecido, preserva o formato seguro.
 *
 * @param {string} dia
 * @param {Object} [opcoes]
 * @param {Date} [opcoes.dataReferencia=new Date()]
 * @param {Array<string>} [opcoes.diasNaEscala=[]]
 * @returns {string}
 */
export function formatarDiaComData(dia, { dataReferencia = new Date(), diasNaEscala = [] } = {}) {
  if (!dia || typeof dia !== 'string') return ''
  const diaFormatado = formatarNomeDia(dia)

  // Se já possui data entre parênteses (ex: "SEGUNDA-FEIRA (17/11)"), não duplica
  if (/\(\s*\d{1,2}\/\d{1,2}\s*\)/.test(dia)) {
    return diaFormatado
  }

  const dataDia = obterDataDoDiaSemana(diaFormatado, { dataReferencia, diasNaEscala })
  if (!dataDia) return diaFormatado

  const ddMm = formatarDataDdMm(dataDia)
  return `${diaFormatado} (${ddMm})`
}

/**
 * Migra em background registros legados no Supabase (ex: 'SEGUNDA' -> 'SEGUNDA-FEIRA').
 * Executa silenciosamente sem bloquear a UI.
 * @param {Array} turnos
 */
export async function migrarDiasLegados(turnos) {
  if (!Array.isArray(turnos) || turnos.length === 0) return

  // Identifica turnos que possuem formato antigo
  const turnosLegados = turnos.filter((t) => {
    if (!t.dia) return false
    const norm = formatarNomeDia(t.dia)
    return norm !== t.dia
  })

  if (turnosLegados.length === 0) return

  try {
    // Agrupa IDs por novo nome para fazer updates em lote
    const porNovoDia = {}
    for (const t of turnosLegados) {
      const novoDia = formatarNomeDia(t.dia)
      if (!porNovoDia[novoDia]) porNovoDia[novoDia] = []
      porNovoDia[novoDia].push(t.id)
    }

    await Promise.all(
      Object.entries(porNovoDia).map(([novoDia, ids]) =>
        supabase.from('turnos').update({ dia: novoDia }).in('id', ids)
      )
    )
  } catch (err) {
    // Log silencioso para não interromper navegação do usuário
    console.warn('Migração automática de dias legados:', err)
  }
}

