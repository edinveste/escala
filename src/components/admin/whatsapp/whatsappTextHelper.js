/**
 * Tags dinâmicas disponíveis para inserção nos templates de WhatsApp.
 */
export const TAGS_WHATSAPP = [
  { tag: '{ponto}', title: 'Insere o nome do ponto' },
  { tag: '{empresa}', title: 'Insere o nome da empresa' },
  { tag: '{capacidade}', title: 'Insere a quantidade de vagas por horário' },
  { tag: '{link}', title: 'Insere o link seguro do app' },
]

/**
 * Verifica se é necessário inserir espaço antes do trecho inserido para evitar
 * colagem com palavras/pontuação final, preservando espaços existentes e
 * marcadores de abertura de formatação do WhatsApp (*, _, ~, (, [, etc.).
 */
function precisaEspacoAntes(antes) {
  if (!antes) return false
  if (/[\s(\[{/@#]$/.test(antes)) return false
  // Preserva abertura de negrito/itálico/tachado ou aspas (ex.: "*{ponto}*" ou '"{empresa}"')
  if (/(?:^|[\s(\[{/@#"'])[*_~"']$/.test(antes)) return false
  return true
}

/**
 * Verifica se é necessário inserir espaço após o trecho inserido para evitar
 * colagem com texto subsequente, preservando pontuações e fechamentos (*, _, ~, ), etc.).
 */
function precisaEspacoDepois(depois) {
  if (!depois) return false
  if (/^[\s)\]}",.;:!?/]/.test(depois)) return false
  // Preserva fechamento de formatação do WhatsApp (ex.: "*{ponto}*")
  if (/^[*_~"'](?:$|[\s)\]}",.;:!?/])/.test(depois)) return false
  return true
}

/**
 * Insere um texto na posição exata do cursor/seleção de um campo de texto,
 * substituindo eventual trecho selecionado e retornando o novo valor e a
 * nova posição do cursor logo após o trecho inserido.
 *
 * Quando não há seleção conhecida (`selecao` nula), insere ao final do texto.
 */
export function inserirTextoNoCursor(
  textoAtual = '',
  textoParaInserir = '',
  selecao = null,
  { espacamentoInteligente = false } = {}
) {
  const texto = String(textoAtual ?? '')
  const insercao = String(textoParaInserir ?? '')

  const temSelecaoValida =
    selecao &&
    typeof selecao.start === 'number' &&
    !Number.isNaN(selecao.start)

  const start = temSelecaoValida
    ? Math.max(0, Math.min(selecao.start, texto.length))
    : texto.length

  const endBruto =
    temSelecaoValida && typeof selecao.end === 'number' && !Number.isNaN(selecao.end)
      ? selecao.end
      : start

  const end = Math.max(start, Math.min(endBruto, texto.length))

  const antes = texto.slice(0, start)
  const depois = texto.slice(end)

  const prefixo = espacamentoInteligente && precisaEspacoAntes(antes) ? ' ' : ''
  const sufixo = espacamentoInteligente && precisaEspacoDepois(depois) ? ' ' : ''

  const novoTexto = `${antes}${prefixo}${insercao}${sufixo}${depois}`
  const novaPosicaoCursor = antes.length + prefixo.length + insercao.length

  return { novoTexto, novaPosicaoCursor }
}

