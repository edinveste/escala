import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [minhasEmpresas, setMinhasEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const currentUserIdRef = useRef(null)

  // ─── Carrega perfil e empresas do usuário autenticado ────────
  const fetchUserData = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null)
      setMinhasEmpresas([])
      return
    }

    try {
      // 1. Busca perfil do usuário
      const { data: perfilData, error: perfilErr } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (perfilErr) {
        console.warn('Aviso ao carregar perfil:', perfilErr.message)
      }

      setPerfil((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(perfilData)) return prev
        return perfilData || null
      })

      // 2. Busca empresas vinculadas usando a RPC get_minhas_empresas
      const { data: empresasData, error: empresasErr } = await supabase.rpc('get_minhas_empresas')

      if (empresasErr) {
        // Fallback: se a RPC ainda não tiver sido criada no banco, tenta buscar diretamente
        console.warn('Aviso na RPC get_minhas_empresas, usando fallback direto:', empresasErr.message)
        const { data: directMemberships } = await supabase
          .from('usuarios_empresas')
          .select('empresa_id, role, empresas(id, nome, slug, status)')
          .eq('user_id', userId)
          .eq('ativo', true)

        if (directMemberships) {
          const formatadas = directMemberships.map((m) => ({
            empresa_id: m.empresa_id,
            empresa_nome: m.empresas?.nome || '',
            empresa_slug: m.empresas?.slug || '',
            empresa_status: m.empresas?.status || 'ativo',
            role: m.role || 'gestor',
          }))
          setMinhasEmpresas((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(formatadas)) return prev
            return formatadas
          })
        }
      } else {
        const formatadas = empresasData || []
        setMinhasEmpresas((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(formatadas)) return prev
          return formatadas
        })
      }
    } catch (err) {
      console.error('Erro ao buscar dados do usuário:', err)
    }
  }, [])

  // ─── Inicialização da sessão e listener Supabase Auth ────────
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      currentUserIdRef.current = initialSession?.user?.id || null

      if (initialSession?.user) {
        fetchUserData(initialSession.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      const newUserId = newSession?.user?.id || null
      const userChanged = newUserId !== currentUserIdRef.current
      currentUserIdRef.current = newUserId

      setSession(newSession)
      setUser(newSession?.user ?? null)

      // Evita recarregar tudo em background em eventos rotineiros de TOKEN_REFRESHED se o usuário não mudou
      if (newSession?.user) {
        if (userChanged || event === 'SIGNED_IN') {
          await fetchUserData(newSession.user.id)
        }
      } else {
        setPerfil(null)
        setMinhasEmpresas([])
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchUserData])

  // ─── Métodos de Autenticação ─────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
    return data
  }, [])

  const signUp = useCallback(async (email, password, nome) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nome: nome?.trim() },
      },
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erro ao deslogar:', err)
    } finally {
      setSession(null)
      setUser(null)
      setPerfil(null)
      setMinhasEmpresas([])
    }
  }, [])

  const resetPassword = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) throw error
    return data
  }, [])

  // ─── Helpers de Permissão (Gestão de Tenants) ────────────────
  // Superadmin desativado no frontend: gestão de plataforma 100% direta via Supabase
  const isSuperadmin = false

  const canManageEmpresa = useCallback(
    (empresaId) => {
      if (!empresaId || !user) return false
      return minhasEmpresas.some(
        (e) => e.empresa_id === empresaId && (e.role === 'admin' || e.role === 'gestor')
      )
    },
    [minhasEmpresas, user]
  )

  const getEmpresaRole = useCallback(
    (empresaId) => {
      if (!empresaId || !user) return null
      const match = minhasEmpresas.find((e) => e.empresa_id === empresaId)
      return match ? match.role : null
    },
    [minhasEmpresas, user]
  )

  const refreshAuth = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id)
    }
  }, [fetchUserData, user?.id])

  const value = useMemo(
    () => ({
      session,
      user,
      perfil,
      isSuperadmin,
      minhasEmpresas,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      canManageEmpresa,
      getEmpresaRole,
      refreshAuth,
    }),
    [
      session,
      user,
      perfil,
      isSuperadmin,
      minhasEmpresas,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      canManageEmpresa,
      getEmpresaRole,
      refreshAuth,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

