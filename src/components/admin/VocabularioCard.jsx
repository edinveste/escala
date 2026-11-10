import { Sparkles, SlidersHorizontal } from 'lucide-react'

export default function VocabularioCard({ isFullAdmin, termos = {}, onAbrirModalVocabulario }) {
  if (!isFullAdmin) return null

  return (
    <div className="card flex items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-200 truncate flex items-center gap-2">
            Nicho & Vocabulário
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20 capitalize">
              {termos.preset || 'Personalizado'}
            </span>
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {termos.ponto} • {termos.pessoa} • {termos.tituloEscala}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAbrirModalVocabulario}
        className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-1.5 flex-shrink-0 border border-surface-600 hover:border-brand-500/50 hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-500/10 dark:hover:border-brand-500/40 dark:hover:text-brand-300 transition-all font-semibold"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Personalizar
      </button>
    </div>
  )
}

