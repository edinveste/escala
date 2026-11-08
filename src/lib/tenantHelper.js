// ============================================================
// Utilitários de Resolução e Roteamento de Tenant & Links Seguros
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
 * Verifica se um identificador possui exatamente o formato de token seguro (12 chars alfanuméricos)
 * Ex: "A7bjs92Rlzm6" -> true
 */
export function isToken12Chars(str) {
  if (!str || typeof str !== 'string') return false
  return /^[a-zA-Z0-9]{12}$/.test(str.trim())
}

/**
 * Verifica se a sessão atual deve exibir a Landing Page (Página de Vendas):
 * 1. Não está no portal do gestor (app.*)
 * 2. Não possui query params de tenant (?codigo=, ?empresa=, etc.)
 * 3. Não possui segmento de tenant no pathname (ex: /A7bjs92Rlzm6 ou /demo)
 * 4. Não possui subdomínio de tenant personalizado (ex: imobiliaria.escalafacil.online)
 * 5. Ou possui rota explícita /landing ou /inicio
 */
export function isLandingPage() {
  if (typeof window === 'undefined') return false

  // Se estiver no portal do gestor, nunca é landing page
  if (isAppPortal()) return false

  const searchParams = new URLSearchParams(window.location.search)
  const hasTokenQuery =
    searchParams.get('codigo') ||
    searchParams.get('token') ||
    searchParams.get('empresa') ||
    searchParams.get('tenant')

  if (hasTokenQuery) return false

  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (pathname === 'landing' || pathname === 'inicio') return true
  if (pathname) {
    // Se o usuário digitou /demo, /A7bjs92Rlzm6 ou qualquer rota, NÃO é landing page
    return false
  }

  // Verifica subdomínio customizado (ex: cliente.escalafacil.online)
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
    return false
  }

  // Se chegou aqui com rota raiz vazia '/', é a Landing Page!
  return true
}

/**
 * Verifica se a sessão atual está no Portal Exclusivo do Gestor / Administrador
 * 1. Subdomínio app.escalafacil.online
 * 2. Subdomínio app.* (ex: app.localhost)
 * 3. Query param de simulação/desenvolvimento: ?portal=app ou ?mode=admin
 */
export function isAppPortal() {
  if (typeof window === 'undefined') return false

  const hostname = window.location.hostname.toLowerCase()
  if (hostname === 'app.escalafacil.online') return true
  if (hostname.startsWith('app.')) return true

  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.get('portal') === 'app' || searchParams.get('mode') === 'admin') {
    return true
  }

  return false
}

/**
 * Detecta o identificador da escala (código aleatório de 12 chars ou slug legado) a partir de:
 * 1. Query param: ?codigo=..., ?token=..., ?empresa=..., ?tenant=...
 * 2. Pathname: /A7bjs92Rlzm6 ou /direcional
 * 3. Subdomínio (exceto localhost, app, www, preview)
 * 4. LocalStorage memorizado
 * 5. Fallback padrão: 'demo'
 * 
 * IMPORTANTE: Tokens de 12 caracteres preservam estritamente o case-sensitive (maiúsculas e minúsculas).
 */
export function extractTenantIdentifier() {
  if (typeof window === 'undefined') return 'demo'

  // Se for a página inicial / landing page, não força carregamento de tenant
  if (isLandingPage()) {
    return ''
  }

  const searchParams = new URLSearchParams(window.location.search)
  const queryToken =
    searchParams.get('codigo') ||
    searchParams.get('token') ||
    searchParams.get('empresa') ||
    searchParams.get('tenant')

  if (queryToken && queryToken.trim()) {
    const raw = queryToken.trim()
    return isToken12Chars(raw) ? raw : slugify(raw)
  }

  // Se estiver no portal do gestor e sem parâmetros de rota, não força um tenant de corretor
  if (isAppPortal()) {
    try {
      const saved = localStorage.getItem('escala_tenant_identifier') || localStorage.getItem('escala_tenant_slug')
      if (saved && saved.trim()) {
        const rawSaved = saved.trim()
        return isToken12Chars(rawSaved) ? rawSaved : slugify(rawSaved)
      }
    } catch {}
    return ''
  }

  // Detecção por pathname: /A7bjs92Rlzm6 ou /alphaville
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (pathname) {
    const firstSegment = pathname.split('/')[0]?.trim()
    const rotasReservadas = ['index.html', 'assets', 'api', 'admin', 'favicon.ico', 'robots.txt']

    if (firstSegment && !rotasReservadas.includes(firstSegment.toLowerCase())) {
      // Se tiver formato de token seguro de 12 caracteres, preserva exato
      if (isToken12Chars(firstSegment)) {
        return firstSegment
      }
      return slugify(firstSegment)
    }
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

  // Fallback por memória do navegador
  try {
    const saved = localStorage.getItem('escala_tenant_identifier') || localStorage.getItem('escala_tenant_slug')
    if (saved && saved.trim()) {
      const rawSaved = saved.trim()
      return isToken12Chars(rawSaved) ? rawSaved : slugify(rawSaved)
    }
  } catch (e) {
    console.error('Erro ao ler tenant do localStorage:', e)
  }

  return 'demo'
}

/**
 * Mantém retrocompatibilidade com a assinatura antiga extractTenantSlug
 */
export function extractTenantSlug() {
  return extractTenantIdentifier()
}

/**
 * Gera a URL segura oficial dos Corretores (Anti-Espionagem)
 * Formato padrão: https://escalafacil.online/[codigo12] (ou slug de fallback)
 * 
 * @param {Object|string} empresaOuToken Objeto da empresa ou token/slug
 */
export function getPublicShareUrl(empresaOuToken) {
  if (typeof window === 'undefined') return ''

  let token = 'demo'
  if (typeof empresaOuToken === 'string') {
    token = empresaOuToken.trim()
  } else if (empresaOuToken && typeof empresaOuToken === 'object') {
    token = empresaOuToken.codigo_escala || empresaOuToken.slug || 'demo'
  }

  const hostname = window.location.hostname.toLowerCase()

  // Em produção no domínio oficial escalafacil.online (ou app.escalafacil.online)
  if (hostname.includes('escalafacil.online')) {
    return `https://escalafacil.online/${token}`
  }

  // Em ambiente local ou outros hosts de teste
  const protocol = window.location.protocol
  const hostSemApp = window.location.host.replace(/^app\./i, '')
  return `${protocol}//${hostSemApp}/${token}`
}

/**
 * Mantém retrocompatibilidade com getTenantShareUrl(slug)
 */
export function getTenantShareUrl(slugOuEmpresa) {
  return getPublicShareUrl(slugOuEmpresa)
}

/**
 * Gera a URL do Portal do Gestor (app.escalafacil.online)
 */
export function getAppPortalUrl() {
  if (typeof window === 'undefined') return ''

  const hostname = window.location.hostname.toLowerCase()
  if (hostname.includes('escalafacil.online')) {
    return 'https://app.escalafacil.online'
  }

  // Em ambiente de desenvolvimento
  const protocol = window.location.protocol
  const host = window.location.host
  if (!host.startsWith('app.')) {
    return `${protocol}//app.${host}`
  }
  return `${protocol}//${host}`
}

/**
 * Troca de tenant sem recarregar a página (SPA Navigation)
 */
export function setTenantUrl(tokenOrSlug) {
  if (typeof window === 'undefined') return
  const raw = (tokenOrSlug || '').trim()
  const clean = isToken12Chars(raw) ? raw : slugify(raw)

  try {
    localStorage.setItem('escala_tenant_identifier', clean)
    localStorage.setItem('escala_tenant_slug', clean)
  } catch (e) {}

  // Apenas altera pathname se NÃO estiver no portal do gestor
  if (!isAppPortal()) {
    const newPath = `/${clean}`
    if (window.location.pathname !== newPath) {
      window.history.pushState({ tenant: clean }, '', newPath)
    }
  }
}
