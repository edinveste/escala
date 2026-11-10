import { Lock } from 'lucide-react'

/**
 * Rodapé institucional de segurança do Card de Autenticação do Portal.
 */
export default function PortalSecurityFooter() {
  return (
    <div className="pt-3 border-t border-surface-700/60 text-[11px] text-gray-500 text-center flex items-center justify-center gap-1.5 select-none">
      <Lock className="w-3 h-3 text-emerald-400" />
      <span>Ambiente blindado e isolado • Supabase Auth RBAC</span>
    </div>
  )
}

