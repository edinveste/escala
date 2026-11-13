import { formatarDiaComData } from './diasSemana.js'

/**
 * Gera o documento HTML formatado e pronto para impressão/PDF de alta qualidade
 * da agenda da semana do colaborador.
 */
export function gerarHtmlAgendaPdf({ turnos = [], empresa = null, corretorNome = '' }) {
  const nomeEmpresa = empresa?.nome || 'EscalaFácil'
  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const linhasTabela = turnos
    .map((turno) => {
      const diaFormatado = formatarDiaComData(turno.dia)
      const horario = turno.horario || 'Horário a definir'
      const local = turno.pontoNome || 'Local da Escala'

      return `
        <tr>
          <td class="dia-cell">
            <strong>${diaFormatado}</strong>
          </td>
          <td class="horario-cell">
            <span class="badge-horario">${horario}</span>
          </td>
          <td class="local-cell">
            ${local}
          </td>
        </tr>
      `
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Minha Agenda - ${nomeEmpresa}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .empresa-nome {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .titulo {
      font-size: 13px;
      font-weight: 600;
      color: #2563eb;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .meta strong {
      color: #0f172a;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .info-colaborador {
      font-size: 13px;
      color: #334155;
    }
    .info-colaborador strong {
      font-size: 14px;
      color: #0f172a;
    }
    .total-badge {
      font-size: 12px;
      font-weight: 700;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 4px 10px;
      border-radius: 9999px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 10px 14px;
      text-align: left;
      border-top: 1px solid #e2e8f0;
      border-bottom: 2px solid #cbd5e1;
    }
    tbody td {
      padding: 12px 14px;
      font-size: 13px;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .badge-horario {
      font-weight: 700;
      color: #1d4ed8;
      background: #eff6ff;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
      font-size: 12px;
      border: 1px solid #dbeafe;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="empresa-nome">${nomeEmpresa}</div>
      <div class="titulo">Minha Agenda da Semana</div>
    </div>
    <div class="meta">
      Emitido em: <strong>${dataEmissao} às ${horaEmissao}</strong>
    </div>
  </div>

  <div class="info-card">
    <div class="info-colaborador">
      Colaborador: <strong>${corretorNome || 'Confirmado'}</strong>
    </div>
    <div class="total-badge">
      ${turnos.length} ${turnos.length === 1 ? 'vaga garantida' : 'vagas garantidas'}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35%;">Dia / Data</th>
        <th style="width: 30%;">Horário</th>
        <th style="width: 35%;">Local / Ponto</th>
      </tr>
    </thead>
    <tbody>
      ${linhasTabela}
    </tbody>
  </table>

  <div class="footer">
    Documento emitido via <strong>EscalaFácil</strong> • Sistema de Gestão de Escalas
  </div>
</body>
</html>`
}

/**
 * Aciona a geração e download/impressão do PDF através de iframe oculto.
 * Abre nativamente a janela de impressão do navegador com opção "Salvar como PDF".
 */
export function baixarAgendaPdf({ turnos = [], empresa = null, corretorNome = '' }) {
  if (!turnos || turnos.length === 0) return

  const html = gerarHtmlAgendaPdf({ turnos, empresa, corretorNome })

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document || iframe.contentDocument
  if (!doc) {
    // Fallback caso iframe falhe
    const printWin = window.open('', '_blank')
    if (printWin) {
      printWin.document.open()
      printWin.document.write(html)
      printWin.document.close()
      printWin.focus()
      setTimeout(() => printWin.print(), 300)
    }
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Erro ao imprimir PDF via iframe:', e)
      const printWin = window.open('', '_blank')
      if (printWin) {
        printWin.document.open()
        printWin.document.write(html)
        printWin.document.close()
        printWin.focus()
        setTimeout(() => printWin.print(), 300)
      }
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe)
        } catch {}
      }, 2000)
    }
  }, 400)
}

