/**
 * mapsHelper.js — Utilitários para integração, formatação e redirecionamento com Google Maps
 */

/**
 * Normaliza e gera a URL canônica para o Google Maps.
 * Se o gestor informar uma URL direta (ex: https://maps.app.goo.gl/... ou https://goo.gl/maps/...),
 * preserva o link original.
 * Se informar um endereço em texto (ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP),
 * gera a URL oficial do Google Maps Search API com encode seguro.
 *
 * @param {string|null} endereco - Endereço ou link do Google Maps
 * @returns {string|null} - URL pronta para navegação ou null se vazio
 */
export function obterLinkGoogleMaps(endereco) {
  if (!endereco || typeof endereco !== 'string') return null
  const limpo = endereco.trim()
  if (!limpo) return null

  // Se já for uma URL (Google Maps, Waze, etc.), retorna direto
  if (/^https?:\/\//i.test(limpo)) {
    return limpo
  }

  // Gera a URL canônica do Google Maps Search API
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(limpo)}`
}

/**
 * Verifica se um ponto possui endereço válido configurado.
 *
 * @param {Object} ponto - Objeto do ponto
 * @returns {boolean}
 */
export function pontoTemEndereco(ponto) {
  return Boolean(
    ponto?.endereco &&
      typeof ponto.endereco === 'string' &&
      ponto.endereco.trim().length > 0
  )
}
