import { formatarDiaComData } from '../../../lib/diasSemana'
import {
  processarTagsWhatsapp,
  obterCabecalhoPadrao,
  obterRodapePadrao,
} from '../../corretor/escalaTextoHelper'

/**
 * Gera o texto formatado para a bolha de pré-visualização ao vivo do WhatsApp.
 *
 * @param {Object} params
 * @param {string} params.cabecalho - Texto atual do cabeçalho
 * @param {string} params.rodape - Texto atual do rodapé
 * @param {Object} params.empresa - Dados da empresa ativa
 * @param {Object|null} params.pontoAtual - Ponto selecionado (se alvo !== 'geral')
 * @param {string} params.alvoId - ID do alvo selecionado ('geral' ou UUID do ponto)
 * @returns {string} Texto processado com tags e estrutura da escala
 */
export function gerarTextoPreviewWhatsapp({
  cabecalho = '',
  rodape = '',
  empresa,
  pontoAtual,
  alvoId = 'geral',
}) {
  const nomeEmp = (empresa?.nome || 'Minha Imobiliária').toUpperCase()
  const linkExemplo = typeof window !== 'undefined' ? window.location.origin : 'https://escalafacil.online'
  const nomePonto = pontoAtual ? pontoAtual.nome.toUpperCase() : 'TODOS OS PONTOS'

  let txt = ''
  if (cabecalho.trim()) {
    txt += processarTagsWhatsapp(cabecalho, {
      empresaNome: nomeEmp,
      pontoNome: nomePonto,
      capacidade: '2 por horário',
      shareUrl: linkExemplo,
    })
    txt += '\n\n'
  } else {
    const padrao = obterCabecalhoPadrao({ alvoId, ponto: pontoAtual, empresa })
    txt += processarTagsWhatsapp(padrao, {
      empresaNome: nomeEmp,
      pontoNome: nomePonto,
      capacidade: '2 por horário',
      shareUrl: linkExemplo,
    })
    txt += '\n\n'
  }

  if (
    !pontoAtual &&
    !cabecalho.toLowerCase().includes('plantão principal') &&
    !cabecalho.toLowerCase().includes('ponto')
  ) {
    txt += `📍 *PLANTÃO PRINCIPAL*\n\n`
  }

  const diaExemplo = formatarDiaComData('SEGUNDA-FEIRA')
  txt += `📅 *${diaExemplo}*\n\n`
  txt += `🕐 08:00 às 10:00\n   → CARLOS SILVA / MARIANA SOUZA\n`
  txt += `🕐 10:00 às 12:00\n   → _vago_\n\n`

  // Linha separadora única antes do rodapé
  txt += `━━━━━━━━━━━━━━━━━━\n`

  if (rodape.trim()) {
    txt += processarTagsWhatsapp(rodape, {
      empresaNome: nomeEmp,
      pontoNome: nomePonto,
      capacidade: '2 por horário',
      shareUrl: linkExemplo,
    })
  } else {
    const padraoRod = obterRodapePadrao({ empresa })
    txt += processarTagsWhatsapp(padraoRod, {
      empresaNome: nomeEmp,
      pontoNome: nomePonto,
      capacidade: '2 por horário',
      shareUrl: linkExemplo,
    })
  }

  return txt
}

