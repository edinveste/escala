import { Infinity as InfinityIcon, Minus, Plus, RotateCcw } from 'lucide-react'

/**
 * Controle touch-friendly horizontal para definição de cotas numéricas ou modo "Ilimitado" (`null`).
 * Evita truncamento de títulos longos (como "Máx. por Ponto de Captação") em telas estreitas.
 */
export default function CotaStepperField({
  label,
  icon: Icon,
  value,
  onChange,
  disabled = false,
  max = 50,
}) {
  const isIlimitado = value === null || value === undefined

  const decrementar = () => {
    if (disabled || isIlimitado) return
    if (value <= 1) {
      onChange(null)
    } else {
      onChange(value - 1)
    }
  }

  const incrementar = () => {
    if (disabled) return
    if (isIlimitado) {
      onChange(1)
    } else if (value < max) {
      onChange(value + 1)
    }
  }

  const handleInputChange = (e) => {
    const raw = e.target.value
    if (raw === '') {
      onChange(null)
      return
    }
    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed) || parsed <= 0) {
      onChange(null)
      return
    }
    onChange(Math.min(max, parsed))
  }

  return (
    <div className="p-3 rounded-xl bg-surface-900/50 border border-surface-600/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-semibold text-gray-200 flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-brand-400 flex-shrink-0" />}
          <span className="truncate">{label}</span>
        </span>

        {!isIlimitado && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="sm:hidden text-[11px] text-gray-400 hover:text-brand-400 inline-flex items-center gap-1 transition-colors flex-shrink-0 disabled:opacity-50"
            title="Voltar para ilimitado"
          >
            <RotateCcw className="w-3 h-3" />
            Ilimitado
          </button>
        )}
      </div>

      {isIlimitado ? (
        <div className="flex items-center gap-2 min-h-[44px] flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-surface-800 border border-surface-600 px-3 py-2 rounded-lg flex-1 sm:flex-initial justify-center min-h-[44px]">
            <InfinityIcon className="w-4 h-4 text-gray-400" />
            Ilimitado
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={incrementar}
            className="min-h-[44px] min-w-[44px] px-3 rounded-lg bg-brand-500/15 hover:bg-brand-500/25 text-brand-600 dark:text-brand-300 border border-brand-500/30 font-semibold text-xs inline-flex items-center justify-center gap-1 transition-colors active:scale-95 disabled:opacity-50"
            title={`Definir limite (${label})`}
          >
            <Plus className="w-4 h-4" />
            <span>Limitar</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-h-[44px] flex-shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-400 mr-1.5 transition-colors disabled:opacity-50"
            title="Voltar para ilimitado"
          >
            <RotateCcw className="w-3 h-3" />
            Ilimitado
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={decrementar}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-500/60 text-gray-200 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
            aria-label={`Diminuir ${label}`}
            title={value <= 1 ? 'Remover limite (Ilimitado)' : 'Diminuir 1'}
          >
            <Minus className="w-4 h-4" />
          </button>

          <input
            type="number"
            min={1}
            max={max}
            disabled={disabled}
            value={value}
            onChange={handleInputChange}
            className="w-16 min-h-[44px] text-center font-bold text-sm bg-surface-800 border border-brand-500/40 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={label}
          />

          <button
            type="button"
            disabled={disabled || value >= max}
            onClick={incrementar}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-500/60 text-gray-200 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
            aria-label={`Aumentar ${label}`}
            title="Aumentar 1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
