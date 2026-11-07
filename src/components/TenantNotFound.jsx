import { useState } from 'react'
import { Building2, ArrowRight, Search, Sparkles } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

export default function TenantNotFound() {
  const { slug, switchTenant } = useTenant()
  const [buscaSlug, setBuscaSlug] = useState('')

  const handleBuscar = (e) => {
    e.preventDefault()
    if (buscaSlug.trim()) {
      switchTenant(buscaSlug.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
      <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
          <Building2 className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            Empresa não encontrada
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mt-3">
            Nenhuma escala com o slug "{slug}"
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Verifique o link enviado pelo seu gestor ou comece um novo ambiente agora mesmo.
          </p>
        </div>

        {/* Busca por slug existente */}
        <form onSubmit={handleBuscar} className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 block text-left">
            Buscar outra imobiliária:
          </label>
          <div className="relative">
            <input
              type="text"
              value={buscaSlug}
              onChange={(e) => setBuscaSlug(e.target.value)}
              placeholder="Ex: demo ou nome-da-imobiliaria"
              className="input-field pr-10 text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-brand-400 transition-colors"
              title="Acessar"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="pt-2 space-y-3">
          <button
            onClick={() => switchTenant('demo')}
            className="w-full btn-secondary py-3 text-sm flex items-center justify-center gap-2"
          >
            Acessar Imobiliária Padrão (Demo)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-4 border-t border-surface-700/60 text-xs text-gray-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          EscalaFácil SaaS • Multi-tenant
        </div>
      </div>
    </div>
  )
}

