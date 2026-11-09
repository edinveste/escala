/**
 * validacaoHelper.js — Utilitários de Validação e Normalização de Identidade
 * Suporte a múltiplos tipos de validação de equipe:
 * - 'whatsapp': Apenas WhatsApp com DDD
 * - 'email': Apenas E-mail Corporativo
 * - 'ambos': WhatsApp e E-mail Corporativo obrigatórios
 */

export const TIPOS_VALIDACAO = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  AMBOS: 'ambos',
}

export const OPCOES_VALIDACAO = [
  {
    id: TIPOS_VALIDACAO.WHATSAPP,
    label: 'Apenas WhatsApp',
    shortLabel: 'WhatsApp',
    icone: 'Phone',
    badge: 'Padrão',
    descricao: 'Colaborador se identifica apenas com o número de celular/WhatsApp com DDD.',
    dicaFormulario: 'Informe seu WhatsApp com DDD para identificação.',
  },
  {
    id: TIPOS_VALIDACAO.EMAIL,
    label: 'Apenas E-mail Corporativo',
    shortLabel: 'E-mail',
    icone: 'Mail',
    badge: 'Corporativo',
    descricao: 'Colaborador se identifica através do seu e-mail institucional/corporativo.',
    dicaFormulario: 'Informe seu e-mail corporativo cadastrado na coordenação.',
  },
  {
    id: TIPOS_VALIDACAO.AMBOS,
    label: 'WhatsApp e E-mail Corporativo',
    shortLabel: 'Ambos',
    icone: 'Repeat',
    badge: 'Proteção Máxima',
    descricao: 'Exige confirmação dupla: o colaborador deve informar WhatsApp e E-mail coincidentes.',
    dicaFormulario: 'Informe seu WhatsApp e E-mail corporativo cadastrados.',
  },
]

/**
 * Normaliza um endereço de e-mail (minúsculas e sem espaços)
 */
export function normalizarEmail(email) {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

/**
 * Valida a sintaxe básica de um endereço de e-mail
 */
export function isEmailValido(email) {
  const limpo = normalizarEmail(email)
  if (!limpo || limpo.length < 5) return false
  // Regex compatível com RFC 5322 simplificada
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return regex.test(limpo)
}

/**
 * Formata telefone brasileiro com máscara: (99) 99999-9999 ou (99) 9999-9999
 */
export function formatarWhatsApp(valor) {
  if (!valor || typeof valor !== 'string') return ''
  const digits = valor.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Remove formatação e DDI 55 de telefones com 12 ou 13 dígitos
 */
export function limparWhatsApp(valor) {
  if (!valor || typeof valor !== 'string') return ''
  let digits = valor.replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  return digits
}

/**
 * Valida se um número de WhatsApp possui quantidade válida de dígitos (10 ou 11)
 */
export function isWhatsAppValido(valor) {
  const limpo = limparWhatsApp(valor)
  return limpo.length >= 10 && limpo.length <= 11
}

/**
 * Retorna o tipo de validação da empresa ('whatsapp' como fallback seguro)
 */
export function obterTipoValidacao(empresa) {
  const tipo = empresa?.tipo_validacao_equipe
  if (tipo === TIPOS_VALIDACAO.EMAIL || tipo === TIPOS_VALIDACAO.AMBOS) {
    return tipo
  }
  return TIPOS_VALIDACAO.WHATSAPP
}

/**
 * Retorna se o tipo de validação exige WhatsApp
 */
export function exigeWhatsApp(tipo) {
  return tipo === TIPOS_VALIDACAO.WHATSAPP || tipo === TIPOS_VALIDACAO.AMBOS
}

/**
 * Retorna se o tipo de validação exige E-mail
 */
export function exigeEmail(tipo) {
  return tipo === TIPOS_VALIDACAO.EMAIL || tipo === TIPOS_VALIDACAO.AMBOS
}

