import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { executarPublicoSeguro, isRpcAusenteError } from '../lib/supabasePublicHelper'
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

const PUBLIC_EMPRESA_COLUMNS =
  'id, nome, slug, codigo_escala, logo_url, cor_primaria, plano, status, exigir_cadastro_previo, tipo_validacao_equipe, termos, msg_whatsapp_geral, rodape_whatsapp_geral, copia_whatsapp_geral_ativa, ocultar_nomes_escala, created_at'

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
  const usandoRpcEmpresaRef = useRef(false)
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
          } catch { }

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

        // Busca prioritária via RPC pública sanitizada (não expõe lista de empresas nem dados financeiros)
        let empresaEncontrada = null
        const { data: rpcEmpresa, error: rpcErr } = await executarPublicoSeguro(() =>
          supabase.rpc('get_empresa_publica', { p_identificador: target })
        )

        if (!rpcErr) {
          usandoRpcEmpresaRef.current = true
          empresaEncontrada = rpcEmpresa || null
        } else if (isRpcAusenteError(rpcErr)) {
          // Fallback transitório enquanto a migração SQL da Fase 14 não for aplicada
          usandoRpcEmpresaRef.current = false
          if (isToken12Chars(target)) {
            const { data: dataCod, error: errCod } = await executarPublicoSeguro(() =>
              supabase
                .from('empresas')
                .select(PUBLIC_EMPRESA_COLUMNS)
                .eq('codigo_escala', target)
                .maybeSingle()
            )
            if (errCod && !errCod.message?.includes('does not exist')) throw errCod
            if (dataCod) empresaEncontrada = dataCod
          }

          if (!empresaEncontrada) {
            const slugNormalizado = slugify(target)
            const { data: dataSlug, error: errSlug } = await executarPublicoSeguro(() =>
              supabase
                .from('empresas')
                .select(PUBLIC_EMPRESA_COLUMNS)
                .ilike('slug', slugNormalizado)
                .maybeSingle()
            )
            if (errSlug && !errSlug.message?.includes('does not exist')) throw errSlug
            if (dataSlug) empresaEncontrada = dataSlug
          }
        } else {
          throw rpcErr
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

    // Em modo público protegido (RPC), escuta sinalização sem PII em `escala_sync`
    if (!isApp && usandoRpcEmpresaRef.current) {
      let debounceTimer = null
      const identificadorAtual = empresa.codigo_escala || empresa.slug
      const channel = supabase
        .channel(`realtime-empresa-sync-${empresa.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'escala_sync',
            filter: `empresa_id=eq.${empresa.id}`,
          },
          () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(async () => {
              const { data } = await executarPublicoSeguro(() =>
                supabase.rpc('get_empresa_publica', { p_identificador: identificadorAtual })
              )
              if (data) {
                setEmpresa((prev) => ({ ...prev, ...data }))
                if (data.nome) {
                  document.title = `${data.nome} — EscalaFácil`
                }
              }
            }, 120)
          }
        )
        .subscribe()

      return () => {
        clearTimeout(debounceTimer)
        supabase.removeChannel(channel)
      }
    }

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
            document.title = `${payload.new.nome} ${isApp ? '[Gestão] ' : ''}— EscalaFácil`
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresa?.id, empresa?.codigo_escala, empresa?.slug, isApp])

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
