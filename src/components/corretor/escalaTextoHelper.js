import { formatarNomeDia, compararDias } from '../../lib/diasSemana'

/**
 * Gera texto formatado da escala para compartilhamento em grupos de WhatsApp.
 */
export function gerarTextoEscala({
  pontos = [],
  turnos = [],
  reservasPorTurno = {},
  selectedPontoId = null,
  empresa = null,
  empresaShareUrl = '',
  termos = {},
}) {
  const pontosParaCopiar = selectedPontoId
    ? pontos.filter((p) => p.id === selectedPontoId)
    : pontos

  const turnosParaCopiar = turnos.filter((t) =>
    pontosParaCopiar.some((p) => p.id === t.ponto_id)
  )
  const capacidades = [
    ...new Set(turnosParaCopiar.map((t) => t.capacidade).filter(Boolean)),
  ]
  let capTexto = '2 por horário'
  if (capacidades.length === 1) {
    capTexto = `${capacidades[0]} por horário`
  } else if (capacidades.length > 1) {
    capTexto = `${Math.min(...capacidades)} a ${Math.max(...capacidades)} por horário`
  }

  const nomeEmpresaUpper = empresa?.nome ? ` — ${empresa.nome.toUpperCase()}` : ''
  const tituloZap = (termos.textoWhatsapp || 'ESCALA SEMANAL').replace('📋', '').trim()
  let texto = `📋 *${tituloZap}${nomeEmpresaUpper} (${capTexto})*\n`
  texto += '━━━━━━━━━━━━━━━━━━\n\n'

  for (const ponto of pontosParaCopiar) {
    const turnosDoPonto = turnos
      .filter((t) => t.ponto_id === ponto.id)
      .sort((a, b) => a.ordem - b.ordem)

    if (turnosDoPonto.length === 0) continue

    texto += `📍 *${ponto.nome.toUpperCase()}*\n\n`

    const porDia = {}
    for (const t of turnosDoPonto) {
      const diaFormatado = formatarNomeDia(t.dia)
      if (!porDia[diaFormatado]) porDia[diaFormatado] = []
      porDia[diaFormatado].push(t)
    }

    const diasOrd = Object.keys(porDia).sort(compararDias)

    for (const dia of diasOrd) {
      texto += `📅 *${dia}*\n\n`
      for (const turno of porDia[dia]) {
        const reservasTurno = reservasPorTurno[turno.id] || []
        const nomes = reservasTurno.map((r) => r.corretor_nome.toUpperCase()).join(' / ')

        if (nomes) {
          texto += `🕐 ${turno.horario}\n   → ${nomes}\n`
        } else {
          texto += `🕐 ${turno.horario}\n   → _vago_\n`
        }
      }
      texto += '\n'
    }
  }

  texto += '━━━━━━━━━━━━━━━━━━\n'
  if (empresaShareUrl) {
    texto += `🔗 ${termos.acaoVaga || 'Garanta sua vaga'}: ${empresaShareUrl}`
  } else {
    texto += '🔗 Reservas em tempo real no app'
  }

  return texto
}

/**
 * Copia texto para a área de transferência usando Clipboard API com fallback seguro para execCommand.
 */
export async function copiarTextoParaClipboard(texto) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
    throw new Error('Clipboard API indisponível')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const sucesso = document.execCommand('copy')
    document.body.removeChild(ta)
    return sucesso
  }
}

