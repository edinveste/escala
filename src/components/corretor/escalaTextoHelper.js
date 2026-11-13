import { formatarNomeDia, compararDias, formatarDiaComData } from '../../lib/diasSemana'
import { obterTermos } from '../../lib/vocabularioHelper'

/**
 * Retorna o modelo padrão do cabeçalho de WhatsApp com tags dinâmicas.
 * Para Escala Geral: título + empresa + capacidade + linha separadora.
 * Para Ponto específico: inclui também o nome do ponto com ícone de localização.
 */
export function obterCabecalhoPadrao({ alvoId = 'geral', ponto = null, empresa = null } = {}) {
  const termos = obterTermos(empresa)
  const tituloZap = (termos.textoWhatsapp || '📋 ESCALA DE CAPTAÇÃO').trim()
  const tituloLimpo = tituloZap.replace(/^📋\s*/, '').trim()

  if (alvoId === 'geral' || !ponto) {
    return `📋 *${tituloLimpo} — {empresa} ({capacidade})*\n━━━━━━━━━━━━━━━━━━`
  }

  return `📋 *${tituloLimpo} — {empresa} ({capacidade})*\n━━━━━━━━━━━━━━━━━━\n\n📍 *{ponto}*`
}

/**
 * Retorna o modelo padrão do rodapé de WhatsApp com tag dinâmica do link.
 */
export function obterRodapePadrao({ empresa = null } = {}) {
  const termos = obterTermos(empresa)
  const acaoTextoUpper = (termos.acaoVaga || 'GARANTA SUA VAGA').toUpperCase()
  return `🔗 *${acaoTextoUpper}*: {link}`
}

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

  const empresaNomeFormatada = (empresa?.nome || '').toUpperCase()
  const pontoUnico = selectedPontoId
    ? pontos.find((p) => p.id === selectedPontoId)
    : null

  const cabecalhoPontoCustom = (
    pontoUnico?.cabecalho_whatsapp ||
    empresa?.termos?.whatsappPontos?.[pontoUnico?.id]?.cabecalho ||
    ''
  ).trim()
  const cabecalhoEmpresaCustom = (empresa?.msg_whatsapp_geral || empresa?.termos?.msgWhatsappGeral || '').trim()

  let texto = ''

  // ─── 1. CABEÇALHO DA MENSAGEM ──────────────────────────────────
  if (pontoUnico && cabecalhoPontoCustom) {
    const processado = processarTagsWhatsapp(cabecalhoPontoCustom, {
      empresaNome: empresaNomeFormatada,
      pontoNome: pontoUnico.nome.toUpperCase(),
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto = `${processado}\n\n`
  } else if (!pontoUnico && cabecalhoEmpresaCustom) {
    const processado = processarTagsWhatsapp(cabecalhoEmpresaCustom, {
      empresaNome: empresaNomeFormatada,
      pontoNome: 'TODOS OS PONTOS',
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto = `${processado}\n\n`
  } else {
    // Cabeçalho padrão automático
    const padrao = obterCabecalhoPadrao({
      alvoId: pontoUnico ? pontoUnico.id : 'geral',
      ponto: pontoUnico,
      empresa,
    })
    texto = `${processarTagsWhatsapp(padrao, {
      empresaNome: empresaNomeFormatada,
      pontoNome: pontoUnico ? pontoUnico.nome.toUpperCase() : 'TODOS OS PONTOS',
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })}\n\n`
  }

  // ─── 2. LISTAGEM DOS PONTOS E DIAS ────────────────────────────
  for (const ponto of pontosParaCopiar) {
    const turnosDoPonto = turnos
      .filter((t) => t.ponto_id === ponto.id)
      .sort((a, b) => a.ordem - b.ordem)

    if (turnosDoPonto.length === 0) continue

    // Só exibe o título do ponto caso não estejamos em ponto único já com cabeçalho que contenha o nome
    const pularTituloPonto = pontoUnico && (
      !cabecalhoPontoCustom ||
      cabecalhoPontoCustom.toLowerCase().includes(ponto.nome.toLowerCase()) ||
      cabecalhoPontoCustom.includes('{ponto}')
    )
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
    const ocultarNomes = Boolean(empresa?.ocultar_nomes_escala || empresa?.termos?.ocultarNomesEscala)

    for (const dia of diasOrd) {
      const diaComData = formatarDiaComData(dia, { diasNaEscala: diasOrd })
      texto += `📅 *${diaComData}*\n\n`
      for (const turno of porDia[dia]) {
        const reservasTurno = reservasPorTurno[turno.id] || []
        const nomes = reservasTurno
          .map((r) => (ocultarNomes ? 'RESERVADO' : r.corretor_nome.toUpperCase()))
          .join(' / ')

        if (nomes) {
          texto += `🕐 ${turno.horario}\n   → ${nomes}\n`
        } else {
          texto += `🕐 ${turno.horario}\n   → _vago_\n`
        }
      }
      texto += '\n'
    }
  }

  // ─── 3. RODAPÉ (COM APENAS UMA LINHA SEPARADORA) ───────────────
  texto += '━━━━━━━━━━━━━━━━━━\n'

  const rodapePontoCustom = (
    pontoUnico?.rodape_whatsapp ||
    empresa?.termos?.whatsappPontos?.[pontoUnico?.id]?.rodape ||
    ''
  ).trim()
  const rodapeEmpresaCustom = (empresa?.rodape_whatsapp_geral || empresa?.termos?.rodapeWhatsappGeral || '').trim()

  const rodapeTexto = pontoUnico
    ? (rodapePontoCustom || rodapeEmpresaCustom)
    : rodapeEmpresaCustom

  const acaoTextoUpper = (termos.acaoVaga || 'GARANTA SUA VAGA').toUpperCase()

  if (rodapeTexto) {
    const processado = processarTagsWhatsapp(rodapeTexto, {
      empresaNome: empresaNomeFormatada,
      pontoNome: pontoUnico ? pontoUnico.nome.toUpperCase() : 'TODOS OS PONTOS',
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })
    texto += `${processado}`

    // Retrocompatibilidade: caso algum rodapé salvo antigamente não tenha {link} nem a URL, anexa sem linha extra
    const jaTemLink =
      processado.toLowerCase().includes('http') ||
      (empresaShareUrl && processado.toLowerCase().includes(empresaShareUrl.toLowerCase())) ||
      rodapeTexto.includes('{link}')

    if (!jaTemLink && empresaShareUrl) {
      texto += `\n\n🔗 *${acaoTextoUpper}*: ${empresaShareUrl}`
    }
  } else {
    // Rodapé padrão automático com o link oficial
    const padrao = obterRodapePadrao({ empresa })
    texto += `${processarTagsWhatsapp(padrao, {
      empresaNome: empresaNomeFormatada,
      pontoNome: pontoUnico ? pontoUnico.nome.toUpperCase() : 'TODOS OS PONTOS',
      capacidade: capTexto,
      shareUrl: empresaShareUrl,
    })}`
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


