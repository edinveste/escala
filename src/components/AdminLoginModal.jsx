import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { Shield, X } from 'lucide-react'
import { validarSenhaForte } from '../lib/validacaoHelper'

import AuthFeedback from './admin-login/AuthFeedback'
import AcessoRestritoView from './admin-login/AcessoRestritoView'
import LoginForm from './admin-login/LoginForm'
import CadastroForm from './admin-login/CadastroForm'
import RecuperarSenhaForm from './admin-login/RecuperarSenhaForm'
import PinLegadoForm from './admin-login/PinLegadoForm'

/**
 * Modal central de autenticação e acesso do Gestor.
 * Orquestra os fluxos de Login (Supabase Auth), Cadastro, Recuperação de Senha,
 * Contingência via PIN Legado e Gestão de Acesso Restrito para usuários logados.
 */
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
  const targetEmpresaNome = empresaNome || empresa?.nome || 'Empresa'

  // Modos de exibição: 'login' | 'cadastro' | 'recuperar' | 'pin_legado'
  const [modo, setModo] = useState('login')

  // Estado compartilhado dos formulários
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [empresaNomeInput, setEmpresaNomeInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')

  // Alterna o modo limpando mensagens de feedback
  const switchModo = useCallback((novoModo) => {
    setModo(novoModo)
    setErroMsg('')
    setSucessoMsg('')
  }, [])

  // Gerenciamento de ciclo de vida e atalhos do modal
  useEffect(() => {
    if (!isOpen) return

    setErroMsg('')
    setSucessoMsg('')
    setEnviando(false)

    // Se já estiver autenticado e tiver permissão, aciona onSuccess imediatamente
    if (user && targetEmpresaId && canManageEmpresa(targetEmpresaId)) {
      onSuccess()
      showToast(`Bem-vindo de volta, ${perfil?.nome || user.email}! 🛡️`, 'success')
      onClose()
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !enviando) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, enviando, onClose, user, targetEmpresaId, canManageEmpresa, onSuccess, showToast, perfil?.nome])

  if (!isOpen) return null

  // ─── Submissão: Login com E-mail e Senha ─────────────────────
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

  // ─── Submissão: Cadastro de Gestor ───────────────────────────
  const handleCadastro = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim() || !senha || !nome.trim() || !empresaNomeInput.trim()) {
      setErroMsg('Preencha todos os campos para criar seu acesso.')
      return
    }

    if (empresaNomeInput.trim().length < 2) {
      setErroMsg('O nome da empresa deve ter pelo menos 2 caracteres.')
      return
    }

    const erroSenha = validarSenhaForte(senha)
    if (erroSenha) {
      setErroMsg(erroSenha)
      return
    }

    setEnviando(true)
    try {
      const data = await signUp(email, senha, nome, empresaNomeInput)
      if (data?.session) {
        try {
          await supabase.rpc('criar_nova_empresa', {
            p_nome: empresaNomeInput.trim(),
          })
        } catch (rpcErr) {
          console.warn('Empresa já provisionada ou aviso RPC:', rpcErr)
        }
        await refreshAuth?.()
        showToast('Conta e empresa criadas com sucesso! 🚀', 'success')
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

  // ─── Submissão: Recuperação de Senha ─────────────────────────
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-admin-title"
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
            <h2 id="modal-admin-title" className="text-lg font-bold text-gray-100 leading-snug">
              Painel do Gestor
            </h2>
            <p className="text-xs text-gray-400 truncate max-w-[240px]">
              {targetEmpresaNome}
            </p>
          </div>
        </div>

        {/* Caso o usuário já esteja autenticado mas sem permissão nesta empresa */}
        {user && !canManageEmpresa(targetEmpresaId) ? (
          <AcessoRestritoView
            user={user}
            targetEmpresaId={targetEmpresaId}
            targetEmpresaNome={targetEmpresaNome}
            minhasEmpresas={minhasEmpresas}
            signOut={signOut}
            refreshAuth={refreshAuth}
            onSuccess={onSuccess}
            onClose={onClose}
            showToast={showToast}
          />
        ) : (
          <>
            {/* Feedback de Mensagens */}
            <AuthFeedback erroMsg={erroMsg} sucessoMsg={sucessoMsg} />

            {/* Subformulários conforme o modo ativo */}
            {modo === 'login' && (
              <LoginForm
                email={email}
                setEmail={setEmail}
                senha={senha}
                setSenha={setSenha}
                enviando={enviando}
                onSubmit={handleLogin}
                onForgotPassword={() => switchModo('recuperar')}
                onGoToCadastro={() => switchModo('cadastro')}
                onGoToPinLegado={() => switchModo('pin_legado')}
              />
            )}

            {modo === 'cadastro' && (
              <CadastroForm
                nome={nome}
                setNome={setNome}
                empresaNome={empresaNomeInput}
                setEmpresaNome={setEmpresaNomeInput}
                email={email}
                setEmail={setEmail}
                senha={senha}
                setSenha={setSenha}
                enviando={enviando}
                onSubmit={handleCadastro}
                onVoltarLogin={() => switchModo('login')}
              />
            )}

            {modo === 'recuperar' && (
              <RecuperarSenhaForm
                email={email}
                setEmail={setEmail}
                enviando={enviando}
                onSubmit={handleRecuperar}
                onVoltarLogin={() => switchModo('login')}
              />
            )}

            {modo === 'pin_legado' && (
              <PinLegadoForm
                targetEmpresaId={targetEmpresaId}
                user={user}
                refreshAuth={refreshAuth}
                onSuccess={onSuccess}
                onClose={onClose}
                showToast={showToast}
                setErroMsg={setErroMsg}
                setSucessoMsg={setSucessoMsg}
                onVoltarLogin={() => switchModo('login')}
              />
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
