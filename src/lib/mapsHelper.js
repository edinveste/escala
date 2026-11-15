/**
 * mapsHelper.js — Utilitários para integração, formatação, busca e redirecionamento com Google Maps
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

/**
 * Extrai o número do imóvel digitado pelo usuário na busca, caso exista.
 * Trata casos como:
 * - "Avenida Alcântara Machado 2078" -> "2078"
 * - "Avenida Alcântara Machado, 2078" -> "2078"
 * - "Rua Augusta, 500 apto 4" -> "500"
 * - "Avenida 7 de Setembro" -> null (não confunde o 7 do nome com o número do imóvel)
 * - "Avenida 7 de Setembro 500" -> "500"
 *
 * @param {string} query
 * @returns {string|null}
 */
export function extrairNumeroDaQuery(query) {
  if (!query || typeof query !== 'string') return null
  const match = query.match(
    /(?:,\s*|\s+)(\d{1,6})(?:\s*(?:apto|bloco|sala|casa|andar|[a-zA-Z])\s*\d*)?$/i
  )
  return match ? match[1] : null
}

/**
 * Formata os detalhes do endereço retornado pela API pública do Nominatim
 * no formato padrão brasileiro: "Rua, Número - Bairro, Cidade - UF".
 * Caso o OpenStreetMap não possua o número da porta mapeado, injeta o número
 * digitado pelo usuário para não perder a informação.
 *
 * @param {Object} item - Item retornado pela API Nominatim
 * @param {string|null} [numUsuario=null] - Número digitado pelo usuário no input
 * @returns {string}
 */
export function formatarEnderecoNominatim(item, numUsuario = null) {
  if (!item) return ''
  const addr = item.address || {}

  // 1. Título principal (POI / Estabelecimento ou Rua + Número)
  const poi = item.name || addr.amenity || addr.shop || addr.building || addr.office
  const rua = addr.road || addr.street || addr.pedestrian || addr.footway || ''
  const numero = addr.house_number || numUsuario || ''

  let linha1 = ''
  if (poi && poi !== rua) {
    linha1 = poi
    if (rua) {
      linha1 += ` - ${rua}`
      if (numero) linha1 += `, ${numero}`
    }
  } else if (rua) {
    linha1 = rua
    if (numero) linha1 += `, ${numero}`
  } else if (item.display_name) {
    linha1 = item.display_name.split(',')[0].trim()
    if (numero && !linha1.includes(numero)) {
      linha1 += `, ${numero}`
    }
  }

  // 2. Complemento (Bairro, Cidade - UF)
  const bairro = addr.suburb || addr.neighbourhood || addr.city_district || addr.district || ''
  const cidade = addr.city || addr.town || addr.municipality || addr.village || ''
  const ufRaw = addr['ISO3166-2-lvl4'] || ''
  const uf = ufRaw.startsWith('BR-') ? ufRaw.replace('BR-', '') : (addr.state || '')

  const partesLinha2 = []
  if (bairro) partesLinha2.push(bairro)
  if (cidade) {
    if (uf) partesLinha2.push(`${cidade} - ${uf}`)
    else partesLinha2.push(cidade)
  } else if (uf) {
    partesLinha2.push(uf)
  }

  const linha2 = partesLinha2.join(', ')

  if (linha1 && linha2) {
    return `${linha1} - ${linha2}`
  }
  return linha1 || linha2 || item.display_name || ''
}

/**
 * Extrai linha principal (destaque) e linha secundária para exibição no dropdown.
 *
 * @param {Object} item - Item retornado pela API Nominatim
 * @param {string|null} [numUsuario=null] - Número digitado pelo usuário no input
 * @returns {{ principal: string, secundaria: string, completo: string }}
 */
export function extrairLinhasSugestao(item, numUsuario = null) {
  const addr = item.address || {}
  const poi = item.name || addr.amenity || addr.shop || addr.building || addr.office
  const rua = addr.road || addr.street || ''
  const numero = addr.house_number || numUsuario || ''

  let principal = ''
  if (poi && poi !== rua) {
    principal = poi
    if (rua) principal += ` (${rua}${numero ? `, ${numero}` : ''})`
  } else if (rua) {
    principal = rua + (numero ? `, ${numero}` : '')
  } else {
    principal = (item.display_name || '').split(',')[0].trim()
    if (numero && !principal.includes(numero)) {
      principal += `, ${numero}`
    }
  }

  const bairro = addr.suburb || addr.neighbourhood || addr.city_district || ''
  const cidade = addr.city || addr.town || addr.municipality || ''
  const ufRaw = addr['ISO3166-2-lvl4'] || ''
  const uf = ufRaw.startsWith('BR-') ? ufRaw.replace('BR-', '') : (addr.state || '')

  const secundaria = [bairro, cidade ? (uf ? `${cidade} - ${uf}` : cidade) : uf]
    .filter(Boolean)
    .join(', ')

  return {
    principal: principal || item.display_name || 'Localização',
    secundaria,
    completo: formatarEnderecoNominatim(item, numUsuario),
  }
}

/**
 * Consulta a API pública gratuita do OpenStreetMap Nominatim
 * com restrição geográfica para o Brasil (countrycodes=br),
 * preservação inteligente do número digitado e deduplicação de vias.
 *
 * @param {string} query - Texto digitado pelo usuário
 * @param {AbortSignal} [signal] - Sinal para cancelamento de requisições anteriores
 * @returns {Promise<Array<{ id: string|number, principal: string, secundaria: string, completo: string, lat: string, lon: string }>>}
 */
export async function buscarSugestoesEndereco(query, signal) {
  if (!query || typeof query !== 'string') return []
  const textoLimpo = query.trim()
  if (textoLimpo.length < 3) return []

  // Se já for link do Google Maps ou outra URL, não pesquisa no Nominatim
  if (/^https?:\/\//i.test(textoLimpo)) {
    return []
  }

  const numUsuario = extrairNumeroDaQuery(textoLimpo)

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      textoLimpo
    )}&countrycodes=br&addressdetails=1&limit=8`

    const res = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    })

    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []

    // Deduplicação inteligente de trechos idênticos da mesma avenida/bairro
    const vistos = new Set()
    const resultados = []

    for (const item of data) {
      const { principal, secundaria, completo } = extrairLinhasSugestao(item, numUsuario)
      const chave = `${principal.toLowerCase()}|${secundaria.toLowerCase()}`
      if (!vistos.has(chave)) {
        vistos.add(chave)
        resultados.push({
          id: item.place_id,
          principal,
          secundaria,
          completo,
          lat: item.lat,
          lon: item.lon,
        })
      }
      if (resultados.length >= 5) break
    }

    return resultados
  } catch (err) {
    if (err.name === 'AbortError') return []
    return []
  }
}
