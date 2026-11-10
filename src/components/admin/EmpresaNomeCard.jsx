import { Building2, Pencil } from 'lucide-react'

/**
 * Card exibido na aba Configurações do painel administrativo
 * apresentando o nome atual da empresa cadastrada e o atalho para edição.
 */
export default function EmpresaNomeCard({ empresa, isFullAdmin, onAbrirModalNome }) {
  if (!isFullAdmin) return null

  return (
    <div className="card flex items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-200 truncate flex items-center gap-2">
            Nome da Empresa
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 truncate max-w-[160px] sm:max-w-[220px]">
              {empresa?.nome || 'Minha Imobiliária'}
            </span>
          </h3>
          <p className="text-xs text-gray-400 truncate">
            Exibido nas mensagens de WhatsApp, na escala e no topo do painel
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAbrirModalNome}
        className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-1.5 flex-shrink-0 border border-surface-600 hover:border-blue-500/50 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-500/10 dark:hover:border-blue-500/40 dark:hover:text-blue-300 transition-all font-semibold"
      >
        <Pencil className="w-3.5 h-3.5" />
        Alterar Nome
      </button>
    </div>
  )
}

