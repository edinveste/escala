import { formatarDiaComData } from './diasSemana.js'

/**
 * Gera e dispara o download direto de um arquivo PDF real (.pdf)
 * da agenda da semana do colaborador utilizando jsPDF e jspdf-autotable.
 *
 * O carregamento da biblioteca é sob demanda (dynamic import) para
 * manter o carregamento inicial da aplicação com zero impacto de peso.
 *
 * @param {Object} params
 * @param {Array} params.turnos - Lista de turnos reservados
 * @param {Object} [params.empresa] - Dados da empresa/imobiliária
 * @param {string} [params.corretorNome] - Nome do colaborador
 */
export async function baixarAgendaPdf({ turnos = [], empresa = null, corretorNome = '' }) {
  if (!turnos || turnos.length === 0) return

  // Importação dinâmica sob demanda: só baixa os módulos quando o usuário clica no botão
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default || autoTableModule

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const nomeEmpresa = empresa?.nome || 'EscalaFácil'
  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const horaEmissao = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // ─── 1. CABEÇALHO SUPERIOR ──────────────────────────────────────
  // Nome da Empresa
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42) // #0f172a
  doc.text(nomeEmpresa, 15, 16)

  // Subtítulo
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235) // #2563eb
  doc.text('MINHA AGENDA DA SEMANA', 15, 22)

  // Data e hora de emissão (alinhado à direita)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139) // #64748b
  doc.text(`Emitido em: ${dataEmissao} às ${horaEmissao}`, 195, 22, { align: 'right' })

  // Linha divisória azul
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.6)
  doc.line(15, 26, 195, 26)

  // ─── 2. CARD INFORMATIVO DO COLABORADOR ────────────────────────
  // Caixa com cantos arredondados e fundo suave
  doc.setFillColor(248, 250, 252) // #f8fafc
  doc.setDrawColor(226, 232, 240) // #e2e8f0
  doc.setLineWidth(0.3)
  doc.roundedRect(15, 30, 180, 12, 2, 2, 'FD')

  // Texto do Colaborador
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(51, 65, 85) // #334155
  doc.text('Colaborador: ', 20, 37.5)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(corretorNome || 'Confirmado', 41, 37.5)

  // Total de vagas garantidas
  const textoTotal = `${turnos.length} ${turnos.length === 1 ? 'vaga garantida' : 'vagas garantidas'}`
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(textoTotal, 190, 37.5, { align: 'right' })

  // ─── 3. TABELA DOS HORÁRIOS ────────────────────────────────────
  const linhasTabela = turnos.map((turno) => [
    formatarDiaComData(turno.dia),
    turno.horario || 'Horário a definir',
    turno.pontoNome || 'Local da Escala',
  ])

  autoTable(doc, {
    startY: 46,
    margin: { left: 15, right: 15, bottom: 20 },
    head: [['DIA / DATA', 'HORÁRIO', 'LOCAL / PONTO']],
    body: linhasTabela,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // #2563eb
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59], // #1e293b
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #f8fafc
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 60 },
      1: { fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 50 },
      2: { cellWidth: 70 },
    },
    didDrawPage: (data) => {
      // Rodapé da página
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184) // #94a3b8
      doc.text(
        'Documento emitido via EscalaFácil • Sistema de Gestão de Escalas',
        105,
        pageHeight - 10,
        { align: 'center' }
      )
    },
  })

  // ─── 4. DOWNLOAD NATIVO DO ARQUIVO PDF ──────────────────────────
  const slug = empresa?.slug || 'escala'
  const nomeArquivo = `minha-agenda-${slug}.pdf`
  doc.save(nomeArquivo)
}
