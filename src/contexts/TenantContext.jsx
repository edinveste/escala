import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import {
  extractTenantIdentifier,
  setTenantUrl,
  slugify,
  isToken12Chars,
  isAppPortal,
} from '../lib/tenantHelper'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const { user, minhasEmpresas, loading: authLoading } = useAuth()
  const [identifier, setIdentifier] = useState(() => extractTenantIdentifier())
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  const isApp = isAppPortal()

  // ─── Carrega os dados da empresa por Código Seguro, Slug ou ID ────
  const carregarEmpresa = useCallback(
    async (alvoIdentificador) => {
      const rawTarget = (alvoIdentificador || '').trim()

      setLoading(true)
      setError(null)
      setNotFound(false)

      try {
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

        // Cenário B: Área Pública do Corretor (escalafacil.online/[codigo12] ou [slug])
        const target = rawTarget || 'demo'

        // 1. Tenta buscar primeiro pelo Código Seguro de 12 caracteres (exato / case-sensitive)
        let empresaEncontrada = null

        if (isToken12Chars(target)) {
          const { data: dataCod, error: errCod } = await supabase
            .from('empresas')
            .select('*')
            .eq('codigo_escala', target)
            .maybeSingle()

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
          const { data: dataSlug, error: errSlug } = await supabase
            .from('empresas')
            .select('*')
            .ilike('slug', slugNormalizado)
            .maybeSingle()

          if (errSlug && !errSlug.message?.includes('does not exist')) {
            throw errSlug
          }
          if (dataSlug) {
            empresaEncontrada = dataSlug
          }
        }

        // 3. Se for 'demo' e não encontrou, busca a primeira empresa ativa como fallback
        if (!empresaEncontrada && (slugify(target) === 'demo' || !target)) {
          const { data: listaEmpresas } = await supabase
            .from('empresas')
            .select('*')
            .eq('status', 'ativo')
            .limit(1)

          if (listaEmpresas && listaEmpresas.length > 0) {
            empresaEncontrada = listaEmpresas[0]
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

  // Recarrega quando auth ou identificador mudarem
  useEffect(() => {
    if (authLoading) return
    carregarEmpresa(identifier)
  }, [identifier, authLoading, carregarEmpresa])

  // Escuta histórico de navegação (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const current = extractTenantIdentifier()
      setIdentifier(current)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ─── Realtime: Escuta atualizações da empresa ativa ────────────
  useEffect(() => {
    if (!empresa?.id) return

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
