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

