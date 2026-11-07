import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { extractTenantSlug, setTenantUrl, slugify } from '../lib/tenantHelper'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [slug, setSlug] = useState(() => extractTenantSlug())
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  // ─── Carrega os dados da empresa pelo slug ─────────────────────
  const carregarEmpresa = useCallback(async (slugAlvo) => {
    const slugNormalizado = slugify(slugAlvo || 'demo')
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      // 1. Busca empresa pelo slug
      const { data, error: errSelect } = await supabase
        .from('empresas')
        .select('*')
        .ilike('slug', slugNormalizado)
        .maybeSingle()

      if (errSelect) {
        // Se a tabela 'empresas' ainda não existir (migração pendente), sinaliza erro
        if (errSelect.message?.includes('does not exist') || errSelect.code === '42P01') {
          setError('Tabela "empresas" não encontrada no banco. Execute o script supabase_migration_multitenant.sql no Supabase.')
          setLoading(false)
          return
        }
        throw errSelect
      }

      if (data) {
        setEmpresa(data)
        setSlug(data.slug)
        setTenantUrl(data.slug)
        document.title = `${data.nome} — EscalaFácil`
      } else {
        // Se não encontrou pelo slug digitado
        // Tenta ver se existe alguma empresa cadastrada como fallback caso seja 'demo' ou primeira visita
        const { data: listaEmpresas } = await supabase
          .from('empresas')
          .select('*')
          .eq('status', 'ativo')
          .limit(1)

        if (slugNormalizado === 'demo' && listaEmpresas && listaEmpresas.length > 0) {
          const fallback = listaEmpresas[0]
          setEmpresa(fallback)
          setSlug(fallback.slug)
          setTenantUrl(fallback.slug)
          document.title = `${fallback.nome} — EscalaFácil`
        } else {
          setEmpresa(null)
          setNotFound(true)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar tenant:', err)
      setError('Erro ao carregar informações da imobiliária.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carrega ao montar ou quando o slug mudar
  useEffect(() => {
    carregarEmpresa(slug)
  }, [slug, carregarEmpresa])

  // Escuta botões Voltar / Avançar do navegador
  useEffect(() => {
    const handlePopState = () => {
      const current = extractTenantSlug()
      setSlug(current)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ─── Realtime: escuta atualizações na empresa ativa ────────────
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

  // Troca para outra empresa
  const switchTenant = useCallback(
    (novoSlug) => {
      const clean = slugify(novoSlug)
      setTenantUrl(clean)
      setSlug(clean)
    },
    []
  )

  const refreshEmpresa = useCallback(() => {
    return carregarEmpresa(slug)
  }, [slug, carregarEmpresa])

  return (
    <TenantContext.Provider
      value={{
        slug,
        empresa,
        loading,
        notFound,
        error,
        switchTenant,
        refreshEmpresa,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant deve ser utilizado dentro de um TenantProvider')
  }
  return context
}

