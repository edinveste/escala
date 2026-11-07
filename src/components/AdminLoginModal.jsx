import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { setTenantUrl } from '../lib/tenantHelper'
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  KeyRound,
  X,
  AlertCircle,
  CheckCircle2,
  Building2,
  ChevronRight,
  Sparkles,
  LogOut,
} from 'lucide-react'

export default function AdminLoginModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
  empresaId,
  empresaNome,
}) {
  const {
    user,
    perfil,
    minhasEmpresas,
    signIn,
    signUp,
    signOut,
    resetPassword,
    canManageEmpresa,
    refreshAuth,
  } = useAuth()
  const { empresa } = useTenant()

  const targetEmpresaId = empresaId || empresa?.id
  const targetEmpresaNome = empresaNome || empresa?.nome || 'Imobiliária'

  // Modos: 'login' | 'cadastro' | 'recuperar' | 'pin_legado'
  const [modo, setModo] = useState('login')

  // Formulário de E-mail / Senha
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')

  // Formulário de Auto-Vinculação com PIN quando o usuário já está logado
  const [pinVinculo, setPinVinculo] = useState('')
  const [vinculandoPin, setVinculandoPin] = useState(false)

  // Formulário de PIN Legado (fallback de contingência)
  const [pinLegado, setPinLegado] = useState('')
  const [showPinLegado, setShowPinLegado] = useState(false)

  const emailInputRef = useRef(null)
  const pinInputRef = useRef(null)

  // Reseta estados ao abrir/fechar
  useEffect(() => {
    if (!isOpen) return

    setErroMsg('')
    setSucessoMsg('')
    setEnviando(false)
    setPinLegado('')

    // Se já estiver autenticado e tiver permissão, aciona onSuccess imediatamente
    if (user && targetEmpresaId && canManageEmpresa(targetEmpresaId)) {
      onSuccess()
      showToast(`Bem-vindo de volta, ${perfil?.nome || user.email}! 🛡️`, 'success')
      onClose()
      return
    }

    const timer = setTimeout(() => {
      if (modo === 'pin_legado') {
        pinInputRef.current?.focus()
      } else {
        emailInputRef.current?.focus()
      }
    }, 150)

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !enviando) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, modo, enviando, onClose, user, targetEmpresaId, canManageEmpresa, onSuccess, showToast, perfil?.nome])

  if (!isOpen) return null

  // ─── Submissão de Login (Supabase Auth) ───────────────────────
  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim() || !senha) {
      setErroMsg('Preencha seu e-mail e senha para continuar.')
      return
    }

    setEnviando(true)
    try {
      await signIn(email, senha)
      showToast('Login realizado com sucesso! 🛡️', 'success')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Erro no login:', err)
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setErroMsg('E-mail ou senha incorretos. Verifique suas credenciais.')
      } else if (msg.includes('Email not confirmed')) {
        setErroMsg('E-mail ainda não confirmado. Verifique sua caixa de entrada.')
      } else {
        setErroMsg(msg || 'Erro ao realizar login. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  // ─── Submissão de Cadastro ────────────────────────────────────
  const handleCadastro = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim() || !senha || !nome.trim()) {
      setErroMsg('Preencha todos os campos para criar seu acesso.')
      return
    }

    if (senha.length < 6) {
      setErroMsg('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setEnviando(true)
    try {
      const data = await signUp(email, senha, nome)
      // Se não necessitar de confirmação de e-mail e já logou
      if (data?.session) {
        showToast('Conta de gestor criada com sucesso! 🚀', 'success')
        onSuccess()
        onClose()
      } else {
        setSucessoMsg('Conta criada! Verifique seu e-mail para confirmar seu acesso.')
      }
    } catch (err) {
      console.error('Erro no cadastro:', err)
      setErroMsg(err.message || 'Erro ao criar conta de gestor.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Submissão de Recuperação de Senha ────────────────────────
  const handleRecuperar = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim()) {
      setErroMsg('Informe seu e-mail cadastrado.')
      return
    }

    setEnviando(true)
    try {
      await resetPassword(email)
      setSucessoMsg('Enviamos um link de recuperação para o seu e-mail!')
    } catch (err) {
      console.error('Erro ao recuperar senha:', err)
      setErroMsg(err.message || 'Erro ao solicitar recuperação de senha.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Desconectar conta atual (Logout explícito no modal) ─────
  const handleDesconectar = async () => {
    setEnviando(true)
    try {
      await signOut()
      setErroMsg('')
      setSucessoMsg('')
      setPinVinculo('')
      showToast('Você desconectou da conta.', 'info')
    } catch (err) {
      console.error('Erro ao deslogar:', err)
      setErroMsg('Erro ao desconectar.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Auto-Vinculação com PIN quando o usuário já tem conta ───
  const handleVincularComPin = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    const pinLimpo = pinVinculo.trim()
    if (!pinLimpo) {
      setErroMsg('Digite o PIN de administrador desta imobiliária.')
      return
    }

    setVinculandoPin(true)
    try {
      // 1. Tenta vincular via RPC vincular_com_pin
      const { data: vincOk, error: vincErr } = await supabase.rpc('vincular_com_pin', {
        p_empresa_id: targetEmpresaId,
        p_pin: pinLimpo,
      })

      if (!vincErr && vincOk === true) {
        await refreshAuth()
        onSuccess()
        showToast('Conta vinculada como administradora com sucesso! 🛡️', 'success')
        onClose()
        return
      }

      // 2. Fallback: verificar_admin_pin legado
      const { data: rpcValido, error: rpcError } = await supabase.rpc('verificar_admin_pin', {
        p_empresa_id: targetEmpresaId,
        p_pin: pinLimpo,
      })

      if (!rpcError && rpcValido === true) {
        if (user) {
          try {
            await supabase.from('usuarios_empresas').upsert({
              user_id: user.id,
              empresa_id: targetEmpresaId,
              role: 'admin',
              ativo: true,
            })
            await refreshAuth()
          } catch (e) {
            console.warn('Aviso no upsert de usuarios_empresas:', e)
          }
        }
        onSuccess()
        showToast('Acesso de administrador concedido via PIN! 🛡️', 'success')
        onClose()
        return
      }

      setErroMsg('PIN incorreto para esta imobiliária.')
      setPinVinculo('')
    } catch (err) {
      console.error('Erro ao verificar PIN para vinculação:', err)
      setErroMsg('Erro ao verificar PIN.')
    } finally {
      setVinculandoPin(false)
    }
  }

  // ─── Submissão via PIN Legado (Transição suave) ───────────────
  const handlePinLegado = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')

    const pinLimpo = pinLegado.trim()
    if (!pinLimpo) {
      setErroMsg('Digite o PIN de administrador.')
      return
    }

    setEnviando(true)
    try {
      if (targetEmpresaId) {
        // Se houver usuário logado, tenta vincular com o PIN
        if (user) {
          const { data: vincOk, error: vincErr } = await supabase.rpc('vincular_com_pin', {
            p_empresa_id: targetEmpresaId,
            p_pin: pinLimpo,
          })
          if (!vincErr && vincOk === true) {
            await refreshAuth()
            onSuccess()
            showToast('Conta vinculada como administradora com sucesso! 🛡️', 'success')
            onClose()
            return
          }
        }

        const { data: rpcValido, error: rpcError } = await supabase.rpc('verificar_admin_pin', {
          p_empresa_id: targetEmpresaId,
          p_pin: pinLimpo,
        })

        if (!rpcError && rpcValido === true) {
          if (user) {
            try {
              await supabase.from('usuarios_empresas').upsert({
                user_id: user.id,
                empresa_id: targetEmpresaId,
                role: 'admin',
                ativo: true,
              })
              await refreshAuth()
            } catch (e) {
              console.warn('Aviso no upsert:', e)
            }
          }
          onSuccess()
          showToast('Acesso de administrador concedido via PIN! 🛡️', 'success')
          onClose()
          return
        }
      }

      setErroMsg('PIN incorreto para esta imobiliária.')
      setPinLegado('')
      pinInputRef.current?.focus()
    } catch (err) {
      console.error('Erro ao verificar PIN legado:', err)
      setErroMsg('Erro ao verificar PIN.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Troca de empresa direta se o usuário pertencer a outra ──
  const navegarParaEmpresa = (slug) => {
    setTenantUrl(slug)
    window.location.reload()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-surface-800 border border-surface-700/80 rounded-3xl shadow-2xl p-6 sm:p-7 relative space-y-5 animate-scale-up max-h-[92vh] overflow-y-auto">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={enviando}
          className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-surface-700 transition-colors disabled:opacity-50"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-400 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100 leading-snug">Painel do Gestor</h2>
            <p className="text-xs text-gray-400 truncate max-w-[240px]">
              {targetEmpresaNome}
            </p>
          </div>
        </div>

        {/* Alerta caso o usuário já esteja autenticado mas sem permissão nesta empresa */}
        {user && !canManageEmpresa(targetEmpresaId) ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-gray-100">Acesso Restrito a Esta Imobiliária</p>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Você está conectado como <strong className="text-gray-100 font-semibold">{user.email}</strong>, mas esta conta ainda não foi vinculada à imobiliária{' '}
                    <strong className="text-amber-300 font-semibold">{targetEmpresaNome}</strong>.
                  </p>
                </div>
              </div>

              {minhasEmpresas.length > 0 && (
                <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                  <p className="text-[11px] text-gray-300 font-medium">Suas imobiliárias autorizadas:</p>
                  {minhasEmpresas.map((emp) => (
                    <button
                      key={emp.empresa_id}
                      type="button"
                      onClick={() => navegarParaEmpresa(emp.empresa_slug)}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-surface-900/60 hover:bg-surface-700 text-left transition-colors text-xs text-gray-200"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-brand-400" />
                        {emp.empresa_nome}
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        Ir para escala <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mensagens de Erro ou Sucesso */}
            {erroMsg && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{erroMsg}</span>
              </div>
            )}

            {sucessoMsg && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{sucessoMsg}</span>
              </div>
            )}

            {/* Opção 1: Validar e Vincular com o PIN da Imobiliária */}
            <form
              onSubmit={handleVincularComPin}
              className="p-4 rounded-2xl bg-surface-900/60 border border-surface-700/80 space-y-3"
            >
              <div>
                <p className="text-xs font-bold text-gray-200 flex items-center gap-1.5 mb-1">
                  <KeyRound className="w-4 h-4 text-brand-400" />
                  Vincular Conta com PIN de Administrador
                </p>
                <p className="text-[11px] text-gray-400">
                  Possui a senha/PIN desta imobiliária? Digite abaixo para vincular sua conta ({user.email}) como administradora:
                </p>
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={pinVinculo}
                  onChange={(e) => setPinVinculo(e.target.value)}
                  placeholder="Digite o PIN da imobiliária"
                  className="input-field text-center font-mono tracking-widest text-sm"
                  maxLength={20}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={vinculandoPin || !pinVinculo.trim()}
                className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                {vinculandoPin ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Validando PIN...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Validar PIN e Acessar Gestão</span>
                  </>
                )}
              </button>
            </form>

            {/* Opção 2: Desconectar desta conta */}
            <div className="pt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDesconectar}
                disabled={enviando}
                className="w-full py-2.5 px-3 rounded-xl bg-surface-700 hover:bg-surface-650 hover:text-red-400 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-surface-600"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Sair desta conta ({user.email})</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mensagens de Sucesso e Erro */}
            {erroMsg && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{erroMsg}</span>
              </div>
            )}

            {sucessoMsg && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{sucessoMsg}</span>
              </div>
            )}

            {/* ─── MODO: LOGIN (Supabase Auth) ───────────────────────── */}
        {modo === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  E-mail institucional
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@imobiliaria.com.br"
                    disabled={enviando}
                    className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300">Senha</label>
                  <button
                    type="button"
                    onClick={() => {
                      setModo('recuperar')
                      setErroMsg('')
                      setSucessoMsg('')
                    }}
                    className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Esqueceu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha secreta"
                    disabled={enviando}
                    className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-11 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    tabIndex="-1"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full btn-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {enviando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Acessando...</span>
                </>
              ) : (
                <>
                  <span>Entrar como Gestor</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Alternadores e Links Secundários */}
            <div className="pt-2 flex flex-col gap-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setModo('cadastro')
                  setErroMsg('')
                  setSucessoMsg('')
                }}
                className="text-xs text-gray-400 hover:text-brand-400 transition-colors"
              >
                Primeiro acesso? <strong className="text-brand-400 font-semibold">Cadastre-se</strong>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModo('pin_legado')
                  setErroMsg('')
                  setSucessoMsg('')
                }}
                className="text-[11px] text-gray-500 hover:text-gray-400 flex items-center justify-center gap-1 transition-colors"
              >
                <KeyRound className="w-3 h-3" />
                Acessar com PIN da Imobiliária (Legado)
              </button>
            </div>
          </form>
        )}

        {/* ─── MODO: CADASTRO DE GESTOR ──────────────────────────── */}
        {modo === 'cadastro' && (
          <form onSubmit={handleCadastro} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Seu Nome</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    disabled={enviando}
                    className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  E-mail de Trabalho
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos@imobiliaria.com.br"
                    disabled={enviando}
                    className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Crie uma Senha (mínimo 6 dígitos)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    disabled={enviando}
                    className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-11 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    tabIndex="-1"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full btn-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {enviando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Criando conta...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Cadastrar e Acessar</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setModo('login')
                  setErroMsg('')
                  setSucessoMsg('')
                }}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Já possui conta? <strong className="text-brand-400 font-semibold">Fazer login</strong>
              </button>
            </div>
          </form>
        )}

        {/* ─── MODO: RECUPERAR SENHA ─────────────────────────────── */}
        {modo === 'recuperar' && (
          <form onSubmit={handleRecuperar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Digite seu e-mail cadastrado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gestor@imobiliaria.com.br"
                  disabled={enviando}
                  className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full btn-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {enviando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando link...</span>
                </>
              ) : (
                <span>Enviar link de recuperação</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setModo('login')
                  setErroMsg('')
                  setSucessoMsg('')
                }}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Lembrou a senha? <strong className="text-brand-400 font-semibold">Voltar ao login</strong>
              </button>
            </div>
          </form>
        )}

        {/* ─── MODO: PIN LEGADO ──────────────────────────────────── */}
        {modo === 'pin_legado' && (
          <form onSubmit={handlePinLegado} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  PIN de Acesso da Imobiliária
                </label>
                <span className="text-[10px] text-gray-500">Padrão inicial: 1234</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={pinInputRef}
                  type={showPinLegado ? 'text' : 'password'}
                  value={pinLegado}
                  onChange={(e) => setPinLegado(e.target.value)}
                  placeholder="Digite o PIN"
                  disabled={enviando}
                  className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-11 py-3 text-sm text-gray-100 placeholder-gray-500 tracking-wider focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPinLegado(!showPinLegado)}
                  tabIndex="-1"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showPinLegado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full btn-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {enviando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando PIN...</span>
                </>
              ) : (
                <span>Validar PIN</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setModo('login')
                  setErroMsg('')
                  setSucessoMsg('')
                }}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Voltar para <strong className="text-brand-400 font-semibold">Login com E-mail</strong>
              </button>
            </div>
          </form>
        )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
