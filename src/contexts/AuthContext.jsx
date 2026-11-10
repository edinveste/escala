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
      return []
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

      let formatadas = []

      // Se a RPC respondeu com empresas válidas (> 0), utiliza
      if (!empresasErr && Array.isArray(empresasData) && empresasData.length > 0) {
        formatadas = empresasData
      } else {
        // Fallback resiliente: se a RPC retornou vazio ou deu erro (ex: transição de token auth.uid() no Supabase),
        // consulta diretamente a tabela de vínculos usuarios_empresas filtrando pelo userId
        const { data: directMemberships, error: directErr } = await supabase
          .from('usuarios_empresas')
          .select('empresa_id, role, empresas(id, nome, slug, status)')
          .eq('user_id', userId)
          .eq('ativo', true)

        if (!directErr && directMemberships && directMemberships.length > 0) {
          formatadas = directMemberships.map((m) => ({
            empresa_id: m.empresa_id,
            empresa_nome: m.empresas?.nome || '',
            empresa_slug: m.empresas?.slug || '',
            empresa_status: m.empresas?.status || 'ativo',
            role: m.role || 'gestor',
            is_superadmin: false,
          }))
        } else if (!empresasErr && Array.isArray(empresasData)) {
          formatadas = empresasData
        }
      }

      setMinhasEmpresas((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(formatadas)) return prev
        return formatadas
      })

      return formatadas
    } catch (err) {
      console.error('Erro ao buscar dados do usuário:', err)
      return []
    }
  }, [])

  // ─── Inicialização da sessão e listener Supabase Auth ────────
  useEffect(() => {
    let mounted = true
    let initialized = false

    const handleSessionChange = async (event, newSession) => {
      if (!mounted) return

      const newUser = newSession?.user ?? null
      const newUserId = newUser?.id ?? null
      const userChanged = newUserId !== currentUserIdRef.current

      currentUserIdRef.current = newUserId
      setSession(newSession)
      setUser(newUser)

      if (newUser) {
        if (userChanged || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          try {
            await fetchUserData(newUser.id)
          } finally {
            if (mounted) setLoading(false)
          }
        } else {
          if (mounted) setLoading(false)
        }
      } else {
        setPerfil(null)
        setMinhasEmpresas([])
        if (mounted) setLoading(false)
      }
    }

    // 1. Listener oficial do Supabase Auth para eventos de sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      initialized = true
      await handleSessionChange(event, newSession)
    })

    // 2. Garantia de inicialização imediata via getSession
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return
      if (!initialized) {
        await handleSessionChange('INITIAL_SESSION', initialSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchUserData])

  // ─── Métodos de Autenticação ─────────────────────────────────
  const signIn = useCallback(
    async (email, password) => {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error

        if (data?.user) {
          currentUserIdRef.current = data.user.id
          setSession(data.session)
          setUser(data.user)
          const empresas = await fetchUserData(data.user.id)
          return { ...data, empresas }
        }
        return { ...data, empresas: [] }
      } finally {
        setLoading(false)
      }
    },
    [fetchUserData]
  )

  const signUp = useCallback(
    async (email, password, nome, empresaNome) => {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nome: nome?.trim(),
              empresa_nome: empresaNome?.trim(),
            },
          },
        })
        if (error) throw error

        if (data?.user && data?.session) {
          currentUserIdRef.current = data.user.id
          setSession(data.session)
          setUser(data.user)
          const empresas = await fetchUserData(data.user.id)
          return { ...data, empresas }
        }
        return data
      } finally {
        setLoading(false)
      }
    },
    [fetchUserData]
  )

  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erro ao deslogar:', err)
    } finally {
      currentUserIdRef.current = null
      setSession(null)
      setUser(null)
      setPerfil(null)
      setMinhasEmpresas([])
      try {
        localStorage.removeItem('escala_gestor_empresa_id')
      } catch {}
      setLoading(false)
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

