import { useRef, useEffect } from 'react'
import { Mail } from 'lucide-react'

/**
 * Formulário para solicitação de redefinição de senha por e-mail.
 */
export default function RecuperarSenhaForm({
  email,
  setEmail,
  enviando,
  onSubmit,
  onVoltarLogin,
}) {
  const emailInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-300 mb-1.5">
          Digite seu e-mail cadastrado
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
          onClick={onVoltarLogin}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Lembrou a senha? <strong className="text-brand-400 font-semibold">Voltar ao login</strong>
        </button>
      </div>
    </form>
  )
}

