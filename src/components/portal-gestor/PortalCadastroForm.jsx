import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

/**
 * Formulário de Cadastro de novo Gestor no Portal.
 */
export default function PortalCadastroForm({
  nome,
  setNome,
  email,
  setEmail,
  senha,
  setSenha,
  showSenha,
  setShowSenha,
  enviando,
  onSubmit,
  onVoltarLogin,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Campo Nome Completo */}
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
            autoComplete="name"
            required
            className="input-field pl-10 text-sm"
            disabled={enviando}
          />
        </div>
      </div>

      {/* Campo E-mail */}
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
            autoComplete="email"
            required
            className="input-field pl-10 text-sm"
            disabled={enviando}
          />
        </div>
      </div>

      {/* Campo Senha */}
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
            placeholder="Mín. 8 caracteres (A-Z, a-z, 0-9)"
            autoComplete="new-password"
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
        <p className="text-[11px] text-gray-400">
          Mínimo de 8 caracteres contendo letras maiúsculas, minúsculas e números.
        </p>
      </div>

      {/* Botão de Criação */}
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

      {/* Ação de Retorno */}
      <div className="text-center pt-2 text-xs">
        <button
          type="button"
          onClick={onVoltarLogin}
          disabled={enviando}
          className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Já possui uma conta?{' '}
          <span className="text-brand-400 font-semibold hover:underline">Fazer login</span>
        </button>
      </div>
    </form>
  )
}

