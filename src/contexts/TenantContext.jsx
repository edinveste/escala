import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import {
  extractTenantIdentifier,
  setTenantUrl,
  slugify,
  isToken12Chars,
  isAppPortal,
  isLandingPage,
  isDemoRoute,
} from '../lib/tenantHelper'
import { DEMO_EMPRESA } from '../lib/demoData'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const { user, minhasEmpresas, loading: authLoading } = useAuth()
  const [identifier, setIdentifier] = useState(() => extractTenantIdentifier())
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  const isApp = isAppPortal()
  const empresaRef = useRef(empresa)
  useEffect(() => {
    empresaRef.current = empresa
  }, [empresa])

  // ─── Carrega os dados da empresa por Código Seguro, Slug ou ID ────
  const carregarEmpresa = useCallback(
    async (alvoIdentificador, isSilent = false) => {
      const rawTarget = (alvoIdentificador || '').trim()

      // Só ativa loading bloqueante de tela se NÃO tivermos uma empresa carregada ainda
      if (!isSilent && !empresaRef.current) {
        setLoading(true)
      }
      setError(null)
      setNotFound(false)

      try {
        // Cenário 0: Modo Demonstração 100% Isolado (/demo) — Zero chamadas ao Supabase
        if (isDemoRoute() || rawTarget.toLowerCase() === 'demo') {
          setEmpresa(DEMO_EMPRESA)
          setIdentifier('demo')
          setLoading(false)
          setNotFound(false)
          setError(null)
          document.title = 'Demonstração Interativa — EscalaFácil'
          return
        }

        // Cenário A: Portal do Gestor (app.escalafacil.online)
        if (isApp) {
          // Se o usuário ainda não estiver logado no portal do gestor,
          // não há empresa ativa carregada previamente nem erro de 404
          if (!user) {
            setEmpresa(null)
            setLoading(false)
            setNotFound(false)
            document.title = 'EscalaFácil — Portal do Gestor'
            return
          }

          // Se estiver logado, resolve a empresa vinculada
          let targetId = null

          // 1. Tenta recuperar preferência salva no localStorage
          try {
            const savedId = localStorage.getItem('escala_gestor_empresa_id')
            if (savedId && minhasEmpresas.some((m) => m.empresa_id === savedId)) {
              targetId = savedId
            }
          } catch {}

          // 2. Se foi passado um ID ou slug específico no alvo
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTarget)
          if (isUuid && minhasEmpresas.some((m) => m.empresa_id === rawTarget)) {
            targetId = rawTarget
          } else if (rawTarget) {
            const foundBySlug = minhasEmpresas.find(
              (m) => slugify(m.empresa_slug) === slugify(rawTarget)
            )
            if (foundBySlug) targetId = foundBySlug.empresa_id
          }

          // 3. Fallback: primeira empresa da lista de permissões
          if (!targetId && minhasEmpresas.length > 0) {
            targetId = minhasEmpresas[0].empresa_id
          }

          if (targetId) {
            const { data: empData, error: empErr } = await supabase
              .from('empresas')
              .select('*')
              .eq('id', targetId)
              .maybeSingle()

            if (empErr) throw empErr

            if (empData) {
              setEmpresa(empData)
              setIdentifier(empData.codigo_escala || empData.slug)
              localStorage.setItem('escala_gestor_empresa_id', empData.id)
              document.title = `${empData.nome} [Gestão] — EscalaFácil`
              setLoading(false)
              return
            }
          }

          // Usuário logado mas ainda sem empresa vinculada
          setEmpresa(null)
          setLoading(false)
          return
        }

        // Cenário B: Página Inicial / Landing Page de Vendas (escalafacil.online/)
        if (isLandingPage()) {
          setEmpresa(null)
          setLoading(false)
          setNotFound(false)
          document.title = 'EscalaFácil — Gestão de Escalas e Plantões em Tempo Real'
          return
        }

        // Cenário C: Área Pública da Escala (escalafacil.online/[codigo12] ou [slug])
        const target = rawTarget
        if (!target) {
          setEmpresa(null)
          setNotFound(true)
          setLoading(false)
          return
        }

        // ── Helper: Busca empresa tratando JWT expirado ──────────────
        // Se houver um JWT expirado "grudado" no browser, as queries públicas
        // retornam 401/PGRST303. Nesse caso, fazemos signOut local (limpa o token
        // do storage) e reconstruímos a query — que agora passa com role anon.
        // Recebe uma factory function que constrói a query do zero (Supabase
        // query builders são consumidos após a primeira execução).
        const queryEmpresaSegura = async (buildQuery) => {
          const { data, error: qErr } = await buildQuery()
          if (qErr && (qErr.code === 'PGRST303' || qErr.message?.includes('JWT expired'))) {
            // Limpa sessão corrompida
            try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
            // Retenta com query limpa (sem JWT no header)
            return await buildQuery()
          }
          return { data, error: qErr }
        }

        // 1. Tenta buscar primeiro pelo Código Seguro de 12 caracteres (exato / case-sensitive)
        let empresaEncontrada = null

        if (isToken12Chars(target)) {
          const { data: dataCod, error: errCod } = await queryEmpresaSegura(
            () => supabase.from('empresas').select('*').eq('codigo_escala', target).maybeSingle()
          )

          if (errCod && !errCod.message?.includes('does not exist')) {
            throw errCod
          }
          if (dataCod) {
            empresaEncontrada = dataCod
          }
        }

        // 2. Se não encontrou por código ou não tem 12 chars, tenta por slug (retrocompatibilidade)
        if (!empresaEncontrada) {
          const slugNormalizado = slugify(target)
          const { data: dataSlug, error: errSlug } = await queryEmpresaSegura(
            () => supabase.from('empresas').select('*').ilike('slug', slugNormalizado).maybeSingle()
          )

          if (errSlug && !errSlug.message?.includes('does not exist')) {
            throw errSlug
          }
          if (dataSlug) {
            empresaEncontrada = dataSlug
          }
        }

        if (empresaEncontrada) {
          setEmpresa(empresaEncontrada)
          const tokenFinal = empresaEncontrada.codigo_escala || empresaEncontrada.slug
          setIdentifier(tokenFinal)
          setTenantUrl(tokenFinal)
          document.title = `${empresaEncontrada.nome} — EscalaFácil`
        } else {
          setEmpresa(null)
          setNotFound(true)
        }
      } catch (err) {
        console.error('Erro ao carregar tenant:', err)
        setError('Erro ao carregar informações da imobiliária.')
      } finally {
        setLoading(false)
      }
    },
    [isApp, user, minhasEmpresas]
  )

  const prevTargetRef = useRef(null)

  // Recarrega quando auth, identificador ou empresas vinculadas mudarem
  useEffect(() => {
    if (authLoading) {
      if (isApp) {
        setLoading(true)
      }
      return
    }

    const empresasIdsKey = minhasEmpresas.map((m) => m.empresa_id).sort().join(',')
    const targetKey = `${isApp ? 'app' : 'public'}_${user?.id || 'anon'}_${identifier || ''}_${empresasIdsKey}`
    const jaCarregouMesmoAlvo = prevTargetRef.current === targetKey && Boolean(empresaRef.current)

    if (!jaCarregouMesmoAlvo) {
      prevTargetRef.current = targetKey
      carregarEmpresa(identifier, Boolean(empresaRef.current))
    }
  }, [identifier, authLoading, isApp, user?.id, minhasEmpresas, carregarEmpresa])

  // Escuta histórico de navegação (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const current = extractTenantIdentifier()
      setIdentifier(current)
      prevTargetRef.current = null
      carregarEmpresa(current)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [carregarEmpresa])

  // ─── Realtime: Escuta atualizações da empresa ativa ────────────
  useEffect(() => {
    if (!empresa?.id || empresa.id === DEMO_EMPRESA.id) return

    const channel = supabase
      .channel(`realtime-empresa-${empresa.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'empresas',
          filter: `id=eq.${empresa.id}`,
        },
        (payload) => {
          setEmpresa((prev) => ({ ...prev, ...payload.new }))
          if (payload.new.nome) {
            document.title = `${payload.new.nome} — EscalaFácil`
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresa?.id])

  // Troca para outra empresa (aceita UUID de empresa, código de 12 chars ou slug)
  const switchTenant = useCallback(
    (novoAlvo) => {
      const raw = (novoAlvo || '').trim()
      setTenantUrl(raw)
      setIdentifier(raw)
      prevTargetRef.current = null
      carregarEmpresa(raw)
    },
    [carregarEmpresa]
  )

  const refreshEmpresa = useCallback(() => {
    return carregarEmpresa(identifier)
  }, [identifier, carregarEmpresa])

  return (
    <TenantContext.Provider
      value={{
        slug: identifier,
        identifier,
        empresa,
        loading,
        notFound,
        error,
        switchTenant,
        refreshEmpresa,
        isAppPortal: isApp,
        isLandingPage: isLandingPage(),
        isDemo: isDemoRoute() || identifier === 'demo',
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider')
  }
  return context
}
