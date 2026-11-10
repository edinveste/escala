import { formatarNomeDia, compararDias } from '../../lib/diasSemana'

/**
 * Substitui tags dinâmicas no template do WhatsApp.
 * Suporta: {empresa}, {ponto}, {capacidade}, {link}
 */
export function processarTagsWhatsapp(template, { empresaNome = '', pontoNome = '', capacidade = '', shareUrl = '' } = {}) {
  if (!template) return ''
  return template
    .replace(/\{empresa\}/gi, empresaNome)
    .replace(/\{ponto\}/gi, pontoNome)
    .replace(/\{capacidade\}/gi, capacidade)
    .replace(/\{link\}/gi, shareUrl)
}

/**
 * Gera texto formatado da escala para compartilhamento em grupos de WhatsApp.
 * Suporta cabeçalho e rodapé customizados tanto para pontos individuais quanto para a escala completa.
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

  const pontoUnico = selectedPontoId
    ? pontos.find((p) => p.id === selectedPontoId)
    : null

  const cabecalhoPontoCustom = pontoUnico?.cabecalho_whatsapp?.trim()
  const cabecalhoEmpresaCustom = (empresa?.msg_whatsapp_geral || empresa?.termos?.msgWhatsappGeral || '').trim()

  let texto = ''

  // ─── 1. CABEÇALHO DA MENSAGEM ──────────────────────────────────
  if (pontoUnico && cabecalhoPontoCustom) {
    // Ponto individual com cabeçalho personalizado
    const processado = processarTagsWhatsapp(cabecalhoPontoCustom, {
      empresaNome: empresa?.nome || '',
      pontoNome: pontoUnico.nome,
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto = `${processado}\n\n━━━━━━━━━━━━━━━━━━\n\n`
  } else if (!pontoUnico && cabecalhoEmpresaCustom) {
    // Escala completa com cabeçalho geral personalizado
    const processado = processarTagsWhatsapp(cabecalhoEmpresaCustom, {
      empresaNome: empresa?.nome || '',
      pontoNome: 'Todos os Pontos',
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto = `${processado}\n\n━━━━━━━━━━━━━━━━━━\n\n`
  } else {
    // Cabeçalho padrão automático
    texto = `📋 *${tituloZap}${nomeEmpresaUpper} (${capTexto})*\n`
    texto += '━━━━━━━━━━━━━━━━━━\n\n'
  }

  // ─── 2. LISTAGEM DOS PONTOS E DIAS ────────────────────────────
  for (const ponto of pontosParaCopiar) {
    const turnosDoPonto = turnos
      .filter((t) => t.ponto_id === ponto.id)
      .sort((a, b) => a.ordem - b.ordem)

    if (turnosDoPonto.length === 0) continue

    // Só exibe o título do ponto caso não estejamos em ponto único já com cabeçalho personalizado que contenha o nome
    const pularTituloPonto = pontoUnico && cabecalhoPontoCustom && cabecalhoPontoCustom.toLowerCase().includes(ponto.nome.toLowerCase())
    if (!pularTituloPonto) {
      texto += `📍 *${ponto.nome.toUpperCase()}*\n\n`
    }

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

  // ─── 3. RODAPÉ PERSONALIZADO (SE HOUVER) ──────────────────────
  const rodapePontoCustom = pontoUnico?.rodape_whatsapp?.trim()
  const rodapeEmpresaCustom = (empresa?.rodape_whatsapp_geral || empresa?.termos?.rodapeWhatsappGeral || '').trim()

  if (pontoUnico && rodapePontoCustom) {
    const processado = processarTagsWhatsapp(rodapePontoCustom, {
      empresaNome: empresa?.nome || '',
      pontoNome: pontoUnico.nome,
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto += `━━━━━━━━━━━━━━━━━━\n${processado}\n\n`
  } else if (!pontoUnico && rodapeEmpresaCustom) {
    const processado = processarTagsWhatsapp(rodapeEmpresaCustom, {
      empresaNome: empresa?.nome || '',
      pontoNome: 'Todos os Pontos',
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto += `━━━━━━━━━━━━━━━━━━\n${processado}\n\n`
  }

  // ─── 4. LINK DE RESERVA E FINALIZAÇÃO ─────────────────────────
  texto += '━━━━━━━━━━━━━━━━━━\n'
  const acaoTextoUpper = (termos.acaoVaga || 'GARANTA SUA VAGA').toUpperCase()
  if (empresaShareUrl) {
    texto += `🔗 *${acaoTextoUpper}*: ${empresaShareUrl}`
  } else {
    texto += `🔗 *${acaoTextoUpper}*`
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

