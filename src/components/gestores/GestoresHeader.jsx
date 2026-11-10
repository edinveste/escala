import { Shield, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Cabeçalho do módulo de Coordenadores & Gestores.
 * Exibe título, contador de membros com acesso e botão de alternância da sanfona.
 */
export default function GestoresHeader({
  totalMembros = 0,
  isExpanded,
  onToggleExpanded,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-100">
              Coordenadores & Gestores
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {totalMembros} {totalMembros === 1 ? 'membro' : 'membros'}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Controle quem pode acessar o painel administrativo da empresa.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleExpanded}
        className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 self-end sm:self-center bg-surface-700/60 hover:bg-surface-700 px-2.5 py-1.5 rounded-lg border border-surface-600/50 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Recolher equipe de gestores' : 'Gerenciar equipe de gestores'}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Recolher</span>
              <span>Equipe</span>
            </span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Gerenciar</span>
              <span>Equipe</span>
            </span>
          </>
        )}
      </button>
    </div>
  )
}

