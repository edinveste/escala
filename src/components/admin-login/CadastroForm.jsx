import { useState, useRef, useEffect } from 'react'
import { User, Building2, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'

/**
 * Formulário de cadastro de novo gestor via Supabase Auth.
 */
export default function CadastroForm({
  nome,
  setNome,
  empresaNome,
  setEmpresaNome,
  email,
  setEmail,
  senha,
  setSenha,
  enviando,
  onSubmit,
  onVoltarLogin,
}) {
  const [showSenha, setShowSenha] = useState(false)
  const nomeInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      nomeInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-3">
        {/* Campo Nome */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Seu Nome</label>
          <div className="relative">
            <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={nomeInputRef}
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

        {/* Campo Nome da Imobiliária / Empresa */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Nome da Imobiliária / Empresa
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={empresaNome || ''}
              onChange={(e) => setEmpresaNome?.(e.target.value)}
              placeholder="Ex: Prime Imóveis, Direcional"
              disabled={enviando}
              className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
              required
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Nome oficial para identificar suas escalas e relatórios.
          </p>
        </div>

        {/* Campo E-mail */}
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
              placeholder="carlos@suaempresa.com.br"
              disabled={enviando}
              className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
              required
            />
          </div>
        </div>

        {/* Campo Senha */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Crie uma Senha
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mín. 8 caracteres (A-Z, a-z, 0-9)"
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
          <p className="text-[11px] text-gray-400 mt-1">
            Mínimo de 8 caracteres contendo letras maiúsculas, minúsculas e números.
          </p>
        </div>
      </div>

      {/* Botão Cadastrar */}
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

      {/* Link para voltar ao Login */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onVoltarLogin}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Já possui conta? <strong className="text-brand-400 font-semibold">Fazer login</strong>
        </button>
      </div>
    </form>
  )
}

