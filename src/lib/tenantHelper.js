// ============================================================
// Utilitários de Resolução e Roteamento de Tenant (Multi-Tenant)
// ============================================================

/**
 * Normaliza um texto para slug amigável de URL
 * Ex: "Imobiliária Alpha Prime!" -> "imobiliaria-alpha-prime"
 */
export function slugify(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove caracteres especiais
    .replace(/\s+/g, '-') // substitui espaços por traços
    .replace(/-+/g, '-') // remove múltiplos traços
}

/**
 * Detecta o slug da empresa atual a partir de:
 * 1. Query parameter: ?empresa=alphaville ou ?tenant=alphaville
 * 2. Subdomínio: alphaville.meusaas.com (exceto localhost, app, www)
 * 3. Pathname: /alphaville
 * 4. LocalStorage memorizado
 * 5. Fallback padrão: 'demo'
 */
export function extractTenantSlug() {
  if (typeof window === 'undefined') return 'demo'

  const searchParams = new URLSearchParams(window.location.search)
  const querySlug = searchParams.get('empresa') || searchParams.get('tenant')
  if (querySlug && querySlug.trim()) {
    return slugify(querySlug)
  }

  // Detecção por subdomínio
  const hostname = window.location.hostname
  const hostParts = hostname.split('.')
  if (
    hostParts.length > 2 &&
    !hostname.includes('localhost') &&
    !hostname.includes('127.0.0.1') &&
    hostParts[0] !== 'www' &&
    hostParts[0] !== 'app' &&
    hostParts[0] !== 'preview'
  ) {
    return slugify(hostParts[0])
  }

  // Detecção por pathname: /alphaville
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (pathname) {
    const firstSegment = pathname.split('/')[0]
    // Ignora rotas de sistema conhecidas se houver
    if (firstSegment && !['index.html', 'assets', 'api', 'admin'].includes(firstSegment)) {
      return slugify(firstSegment)
    }
  }

  // Fallback por memória do navegador
  try {
    const saved = localStorage.getItem('escala_tenant_slug')
    if (saved && saved.trim()) {
      return slugify(saved)
    }
  } catch (e) {
    console.error('Erro ao ler tenant do localStorage:', e)
  }

  return 'demo'
}

/**
 * Gera URL compartilhável completa para uma empresa
 * Ex: https://meusaas.com/direcional
 */
export function getTenantShareUrl(slug) {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const s = slugify(slug || 'demo')
  return `${origin}/${s}`
}

/**
 * Troca de tenant sem recarregar a página (SPA Navigation)
 */
export function setTenantUrl(slug) {
  if (typeof window === 'undefined') return
  const clean = slugify(slug)
  try {
    localStorage.setItem('escala_tenant_slug', clean)
  } catch (e) {}

  const newPath = `/${clean}`
  if (window.location.pathname !== newPath) {
    window.history.pushState({ tenant: clean }, '', newPath)
  }
}

