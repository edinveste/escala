import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

/**
 * Formulário de Login (E-mail e Senha) do Portal do Gestor.
 */
export default function PortalLoginForm({
  email,
  setEmail,
  senha,
  setSenha,
  showSenha,
  setShowSenha,
  enviando,
  emailInputRef,
  onSubmit,
  onEsqueceuSenha,
  onCadastrar,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Campo E-mail */}
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
            autoComplete="email"
            required
            className="input-field pl-10 text-sm"
            disabled={enviando}
          />
        </div>
      </div>

      {/* Campo Senha */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300 block">
            Senha
          </label>
          <button
            type="button"
            onClick={onEsqueceuSenha}
            disabled={enviando}
            className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
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
            autoComplete="current-password"
            required
            className="input-field pl-10 pr-10 text-sm"
            disabled={enviando}
          />
          <button
            type="button"
            onClick={() => setShowSenha(!showSenha)}
            disabled={enviando}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
            title={showSenha ? 'Ocultar senha' : 'Exibir senha'}
            aria-label={showSenha ? 'Ocultar senha' : 'Exibir senha'}
          >
            {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Botão de Submissão */}
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

      {/* Ações Secundárias */}
      <div className="pt-2 flex flex-col items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onCadastrar}
          disabled={enviando}
          className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Não tem uma conta de gestor?{' '}
          <span className="text-brand-400 font-semibold hover:underline">Cadastre-se</span>
        </button>
      </div>
    </form>
  )
}

