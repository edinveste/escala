import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ThemeToggle from './ThemeToggle'
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

export default function PortalGestorLogin({ onSuccess, showToast, empresaId, empresaNome }) {
  const {
    user,
    perfil,
    signIn,
    signUp,
    resetPassword,
  } = useAuth()

  // Modos: 'login' | 'cadastro' | 'recuperar' | 'pin_legado'
  const [modo, setModo] = useState('login')

  // Formulário E-mail / Senha
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')

  // Formulário de PIN Legado
  const [pinLegado, setPinLegado] = useState('')
  const [showPinLegado, setShowPinLegado] = useState(false)

  const emailInputRef = useRef(null)
  const pinInputRef = useRef(null)

  useEffect(() => {
    setErroMsg('')
    setSucessoMsg('')
    if (modo === 'pin_legado') {
      pinInputRef.current?.focus()
    } else {
      emailInputRef.current?.focus()
    }
  }, [modo])

  // Submissão de Login
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
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Erro no login:', err)
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setErroMsg('E-mail ou senha incorretos. Verifique suas credenciais.')
      } else if (msg.includes('Email not confirmed')) {
        setErroMsg('E-mail ainda não confirmado. Verifique sua caixa de entrada.')
      } else {
        setErroMsg('Falha ao autenticar. Verifique sua conexão e tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  // Submissão de Cadastro
  const handleCadastro = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!nome.trim() || !email.trim() || !senha) {
      setErroMsg('Preencha todos os campos obrigatórios.')
      return
    }

    if (senha.length < 6) {
      setErroMsg('A senha deve conter no mínimo 6 caracteres.')
      return
    }

    setEnviando(true)
    try {
      const { user: newUser, session } = await signUp(email, senha, nome)

      if (session) {
        showToast(`Conta criada com sucesso! Bem-vindo(a), ${nome}! 🎉`, 'success')
        if (onSuccess) onSuccess()
      } else if (newUser) {
        setSucessoMsg(
          'Conta cadastrada com sucesso! Um e-mail de confirmação foi enviado para você ativar seu acesso.'
        )
        setModo('login')
      }
    } catch (err) {
      console.error('Erro no cadastro:', err)
      const msg = err.message || ''
      if (msg.includes('already registered')) {
        setErroMsg('Este e-mail já está cadastrado. Tente fazer login ou redefinir sua senha.')
      } else {
        setErroMsg('Erro ao criar conta: ' + (err.message || 'Tente novamente.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  // Recuperação de Senha
  const handleRecuperarSenha = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim()) {
      setErroMsg('Digite seu e-mail cadastrado.')
      return
    }

    setEnviando(true)
    try {
      await resetPassword(email)
      setSucessoMsg('Enviamos um link de recuperação para seu e-mail! Verifique sua caixa de entrada.')
      setModo('login')
    } catch (err) {
      console.error('Erro ao recuperar senha:', err)
      setErroMsg('Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.')
    } finally {
      setEnviando(false)
    }
  }

  // Validação de PIN de contingência legado
  const handlePinLegado = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!pinLegado.trim()) {
      setErroMsg('Digite o PIN de acesso da empresa.')
      return
    }

    setEnviando(true)
    try {
      // 1. Tenta RPC segura verificar_admin_pin se houver empresaId
      if (empresaId) {
        const { data: pinValido, error: errRpc } = await supabase.rpc('verificar_admin_pin', {
          p_empresa_id: empresaId,
          p_pin_informado: pinLegado.trim(),
        })

        if (!errRpc && pinValido) {
          showToast('Acesso de contingência autorizado via PIN! 🛡️', 'success')
          if (onSuccess) onSuccess('pin')
          return
        }
      }

      // 2. Busca direta da empresa pelo PIN (modo genérico para portal)
      const { data: emp, error: errEmp } = await supabase
        .from('empresas')
        .select('id, nome, slug, admin_pin')
        .eq('admin_pin', pinLegado.trim())
        .maybeSingle()

      if (!errEmp && emp) {
        showToast(`Acesso autorizado para "${emp.nome}" via PIN! 🛡️`, 'success')
        if (onSuccess) onSuccess('pin', emp)
        return
      }

      setErroMsg('PIN de administrador incorreto ou não localizado.')
    } catch (err) {
      console.error('Erro ao verificar PIN legado:', err)
      setErroMsg('Erro ao validar PIN. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-900 text-gray-100 selection:bg-brand-500/30">
      {/* Topo do Portal */}
      <header className="border-b border-surface-800 bg-surface-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <CalendarCheck className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-100 flex items-center gap-2">
                Escala<span className="text-brand-400">Fácil</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 select-none">
                  Portal do Gestor
                </span>
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Área Central de Autenticação */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-8">
        <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-scale-in">
          {/* Brilho decorativo */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Ícone e Título */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center shadow-inner">
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-100">
              {modo === 'login' && 'Painel de Gestão'}
              {modo === 'cadastro' && 'Criar Acesso de Gestor'}
              {modo === 'recuperar' && 'Recuperar Senha'}
              {modo === 'pin_legado' && 'Acesso por PIN de Contingência'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xs mx-auto">
              {modo === 'login' && 'Área restrita para administradores e gestores de plantão.'}
              {modo === 'cadastro' && 'Cadastre-se para gerenciar as escalas da sua empresa.'}
              {modo === 'recuperar' && 'Informe seu e-mail para receber as instruções de redefinição.'}
              {modo === 'pin_legado' && 'Acesse utilizando o código numérico PIN da sua empresa.'}
            </p>
          </div>

          {/* Mensagens de Erro ou Sucesso */}
          {erroMsg && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{erroMsg}</span>
            </div>
          )}

          {sucessoMsg && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{sucessoMsg}</span>
            </div>
          )}

          {/* Formulário: Login com E-mail e Senha */}
          {modo === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  E-mail do Gestor
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@suaempresa.com.br"
                    required
                    className="input-field pl-10 text-sm"
                    disabled={enviando}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300 block">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setModo('recuperar')}
                    className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha secreta"
                    required
                    className="input-field pl-10 pr-10 text-sm"
                    disabled={enviando}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
                    title={showSenha ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {enviando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 flex flex-col items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModo('cadastro')}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Não tem uma conta de gestor?{' '}
                  <span className="text-brand-400 font-semibold hover:underline">Cadastre-se</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModo('pin_legado')}
                  className="text-gray-500 hover:text-gray-300 text-[11px] flex items-center gap-1 transition-colors mt-1"
                >
                  <KeyRound className="w-3 h-3 text-gray-400" />
                  <span>Acessar via PIN de contingência</span>
                </button>
              </div>
            </form>
          )}

          {/* Formulário: Cadastro de Gestor */}
          {modo === 'cadastro' && (
            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    required
                    className="input-field pl-10 text-sm"
                    disabled={enviando}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  E-mail Profissional
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@suaempresa.com.br"
                    required
                    className="input-field pl-10 text-sm"
                    disabled={enviando}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  Criar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    required
                    className="input-field pl-10 pr-10 text-sm"
                    disabled={enviando}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {enviando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Criando acesso...</span>
                  </>
                ) : (
                  <>
                    <span>Criar Minha Conta</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModo('login')}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Já possui uma conta?{' '}
                  <span className="text-brand-400 font-semibold hover:underline">Fazer login</span>
                </button>
              </div>
            </form>
          )}

          {/* Formulário: Recuperar Senha */}
          {modo === 'recuperar' && (
            <form onSubmit={handleRecuperarSenha} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@suaempresa.com.br"
                    required
                    className="input-field pl-10 text-sm"
                    disabled={enviando}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {enviando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Link de Recuperação</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModo('login')}
                  className="text-brand-400 font-semibold hover:underline transition-colors"
                >
                  ← Voltar para o Login
                </button>
              </div>
            </form>
          )}

          {/* Formulário: PIN Legado */}
          {modo === 'pin_legado' && (
            <form onSubmit={handlePinLegado} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  PIN Numérico da Empresa
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={pinInputRef}
                    type={showPinLegado ? 'text' : 'password'}
                    value={pinLegado}
                    onChange={(e) => setPinLegado(e.target.value)}
                    placeholder="Ex: 1234"
                    maxLength={10}
                    required
                    className="input-field pl-10 pr-10 text-sm text-center font-mono tracking-widest"
                    disabled={enviando}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinLegado(!showPinLegado)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
                  >
                    {showPinLegado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {enviando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando PIN...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar via PIN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModo('login')}
                  className="text-brand-400 font-semibold hover:underline transition-colors"
                >
                  ← Voltar para o Login com E-mail
                </button>
              </div>
            </form>
          )}

          {/* Rodapé de Segurança */}
          <div className="pt-3 border-t border-surface-700/60 text-[11px] text-gray-500 text-center flex items-center justify-center gap-1.5 select-none">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Ambiente blindado e isolado • Supabase Auth RBAC</span>
          </div>
        </div>
      </main>
    </div>
  )
}

