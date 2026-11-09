import { Building2, ArrowRight, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'
import { getAppPortalUrl } from '../lib/tenantHelper'

export default function TenantNotFound() {
  const { switchTenant } = useTenant()
  const appPortalUrl = getAppPortalUrl()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100 selection:bg-brand-500/30">
      <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-scale-in relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Building2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-block">
            Link Não Encontrado
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100">
            Escala Indisponível ou Link Expirado
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            O endereço acessado não corresponde a nenhuma empresa ativa ou foi recentemente redefinido pelo seu coordenador.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-surface-900/70 border border-surface-700/60 text-xs text-left text-gray-300 space-y-1.5">
          <p className="font-semibold text-gray-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            O que você deve fazer?
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Se você é corretor, solicite ao gestor da sua equipe o link seguro de 12 caracteres atualizado no grupo do WhatsApp.
          </p>
        </div>

        <div className="pt-2 space-y-2.5">
          <button
            onClick={() => switchTenant('demo')}
            className="w-full btn-primary py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
          >
            <span>Ver Escala Demonstrativa (Demo)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href={appPortalUrl}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-gray-300 hover:text-white bg-surface-700/50 hover:bg-surface-700 border border-surface-600 transition-all flex items-center justify-center gap-1.5"
          >
            <span>Você é gestor? Acessar Portal do Gestor</span>
            <ExternalLink className="w-3.5 h-3.5 text-brand-400" />
          </a>
        </div>

        <div className="pt-4 border-t border-surface-700/60 text-[11px] text-gray-500 flex items-center justify-center gap-1.5 select-none">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          EscalaFácil SaaS • Plataforma Blindada Anti-Espionagem
        </div>
      </div>
    </div>
  )
}
