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
  const refreshingRef = useRef(false) // Guard contra múltiplos refreshes simultâneos

  // ─── Helper: verifica se um erro Supabase é JWT expirado ──────
  const isJwtExpiredError = (err) => {
    if (!err) return false
    const msg = err.message || err.code || ''
    return err.code === 'PGRST303' || msg.includes('JWT expired') || msg.includes('401')
  }

  // ─── Carrega perfil e empresas do usuário autenticado ────────
  // Retorna { data: [...], jwtExpired: boolean } para que o caller
  // saiba se precisa tentar refresh
  const fetchUserData = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null)
      setMinhasEmpresas([])
      return { data: [], jwtExpired: false }
    }

    try {
      // 1. Busca perfil do usuário
      const { data: perfilData, error: perfilErr } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      // Se JWT expirou, retorna sinal sem fazer mais queries desnecessárias
      if (isJwtExpiredError(perfilErr)) {
        console.warn('Aviso ao carregar perfil: JWT expired — aguardando refresh da sessão')
        return { data: [], jwtExpired: true }
      }

      if (perfilErr) {
        console.warn('Aviso ao carregar perfil:', perfilErr.message)
      }

      setPerfil((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(perfilData)) return prev
        return perfilData || null
      })

      // 2. Busca empresas vinculadas usando a RPC get_minhas_empresas
      const { data: empresasData, error: empresasErr } = await supabase.rpc('get_minhas_empresas')

      // JWT expirou no meio do fluxo
      if (isJwtExpiredError(empresasErr)) {
        console.warn('JWT expired ao buscar empresas — aguardando refresh da sessão')
        return { data: [], jwtExpired: true }
      }

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

        if (isJwtExpiredError(directErr)) {
          return { data: [], jwtExpired: true }
        }

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

      return { data: formatadas, jwtExpired: false }
    } catch (err) {
      console.error('Erro ao buscar dados do usuário:', err)
      return { data: [], jwtExpired: isJwtExpiredError(err) }
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

      // ── Sessão null: Supabase removeu (refresh_token expirou ou logout) ──
      // Apenas limpa o estado do React. NÃO faz signOut novamente (Supabase já limpou).
      if (!newSession) {
        if (currentUserIdRef.current) {
          currentUserIdRef.current = null
          setSession(null)
          setUser(null)
          setPerfil(null)
          setMinhasEmpresas([])
        }
        if (mounted) setLoading(false)
        return
      }

      // ── Access token expirado: tenta refresh silencioso ──
      // NÃO faz signOut (que destruiria o refresh_token). Em vez disso,
      // pede ao Supabase para renovar a sessão. Se funcionar, onAuthStateChange
      // dispara novamente com TOKEN_REFRESHED e sessão válida. Se falhar,
      // o Supabase emite sessão null e o bloco acima limpa o estado.
      if (newSession.expires_at && Date.now() > newSession.expires_at * 1000) {
        if (!refreshingRef.current) {
          refreshingRef.current = true
          supabase.auth.refreshSession()
            .then(({ error }) => {
              if (error && mounted) {
                // Refresh falhou definitivamente — sessão irrecuperável
                currentUserIdRef.current = null
                setSession(null)
                setUser(null)
                setPerfil(null)
                setMinhasEmpresas([])
                setLoading(false)
              }
            })
            .catch(() => {})
            .finally(() => { refreshingRef.current = false })
        }
        // Retorna sem fazer fetchUserData — espera o refresh completar
        return
      }

      const userChanged = newUserId !== currentUserIdRef.current

      currentUserIdRef.current = newUserId
      setSession(newSession)
      setUser(newUser)

      if (newUser) {
        if (userChanged || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          const result = await fetchUserData(newUser.id)

          // Se JWT expirou durante o fetch (race condition), tenta refresh
          if (result.jwtExpired && !refreshingRef.current) {
            refreshingRef.current = true
            supabase.auth.refreshSession()
              .then(async ({ data: refreshData, error: refreshErr }) => {
                if (!refreshErr && refreshData?.session && mounted) {
                  // Refresh funcionou — retenta o fetch com token renovado
                  await fetchUserData(newUser.id)
                } else if (mounted) {
                  // Refresh falhou — sessão morta
                  currentUserIdRef.current = null
                  setSession(null)
                  setUser(null)
                  setPerfil(null)
                  setMinhasEmpresas([])
                }
              })
              .catch(() => {})
              .finally(() => {
                refreshingRef.current = false
                if (mounted) setLoading(false)
              })
            return // Loading será definido no .finally acima
          }

          if (mounted) setLoading(false)
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
          const result = await fetchUserData(data.user.id)
          return { ...data, empresas: result.data || result }
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
          const result = await fetchUserData(data.user.id)
          return { ...data, empresas: result.data || result }
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
      const result = await fetchUserData(user.id)
      // Se JWT expirou durante o refresh manual, tenta renovar a sessão
      if (result.jwtExpired) {
        await supabase.auth.refreshSession()
      }
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

