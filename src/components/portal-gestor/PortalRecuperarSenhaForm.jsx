import { Mail, ArrowRight } from 'lucide-react'

/**
 * Formulário de Recuperação de Senha no Portal do Gestor.
 */
export default function PortalRecuperarSenhaForm({
  email,
  setEmail,
  enviando,
  onSubmit,
  onVoltarLogin,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Campo E-mail */}
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
            autoComplete="email"
            required
            className="input-field pl-10 text-sm"
            disabled={enviando}
          />
        </div>
      </div>

      {/* Botão de Envio */}
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

      {/* Ação de Retorno */}
      <div className="text-center pt-2 text-xs">
        <button
          type="button"
          onClick={onVoltarLogin}
          disabled={enviando}
          className="text-brand-400 font-semibold hover:underline transition-colors disabled:opacity-50"
        >
          ← Voltar para o Login
        </button>
      </div>
    </form>
  )
}

