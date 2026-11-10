import { LayoutGrid, ScrollText, Check } from 'lucide-react'

export default function LayoutPreferencesCard({ layoutMode, onTrocarLayout }) {
  return (
    <div className="card bg-surface-800/90 border-surface-600 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
          <LayoutGrid className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">Modo de Visualização do Painel</h3>
          <p className="text-xs text-gray-400">
            Escolha como você prefere navegar nas funcionalidades de gestão
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => onTrocarLayout('abas')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
            layoutMode === 'abas'
              ? 'bg-brand-500/15 border-brand-500 text-brand-300 font-bold shadow-sm'
              : 'bg-surface-700/40 border-surface-600 text-gray-400 hover:bg-surface-700/70 hover:text-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Modo em Abas (Recomendado)
            </span>
            {layoutMode === 'abas' && <Check className="w-3.5 h-3.5 text-brand-400 stroke-[3]" />}
          </div>
          <p className="text-[11px] font-normal text-gray-400">
            Organizado em 4 menus limpos. Ideal para agilidade e uso no dia a dia.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onTrocarLayout('continuo')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
            layoutMode === 'continuo'
              ? 'bg-brand-500/15 border-brand-500 text-brand-300 font-bold shadow-sm'
              : 'bg-surface-700/40 border-surface-600 text-gray-400 hover:bg-surface-700/70 hover:text-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" />
              Visão Contínua
            </span>
            {layoutMode === 'continuo' && <Check className="w-3.5 h-3.5 text-brand-400 stroke-[3]" />}
          </div>
          <p className="text-[11px] font-normal text-gray-400">
            Todos os blocos empilhados verticalmente em uma única página com rolagem.
          </p>
        </button>
      </div>
    </div>
  )
}

