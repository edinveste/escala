import { useState, useRef, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

/**
 * Formulário de autenticação de Gestores via Supabase Auth (E-mail e Senha).
 */
export default function LoginForm({
  email,
  setEmail,
  senha,
  setSenha,
  enviando,
  onSubmit,
  onForgotPassword,
  onGoToCadastro,
}) {
  const [showSenha, setShowSenha] = useState(false)
  const emailInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-3">
        {/* Campo E-mail */}
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
              placeholder="gestor@suaempresa.com.br"
              disabled={enviando}
              className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
              required
            />
          </div>
        </div>

        {/* Campo Senha */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-300">Senha</label>
            <button
              type="button"
              onClick={onForgotPassword}
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
              onClick={() => setShowSenha((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200 transition-colors"
              aria-label={showSenha ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Botão de Entrar */}
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
          onClick={onGoToCadastro}
          className="text-xs text-gray-400 hover:text-brand-400 transition-colors"
        >
          Primeiro acesso? <strong className="text-brand-400 font-semibold">Cadastre-se</strong>
        </button>
      </div>
    </form>
  )
}

