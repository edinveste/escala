import { Smartphone } from 'lucide-react'

/**
 * Subcomponente para exibição e desvinculação do celular cadastrado
 * ao colaborador (trava de aparelho device_id_vinculado).
 */
export default function MembroDeviceVinculado({
  colaborador,
  onDesvincular,
  onClose,
}) {
  if (!colaborador?.device_id) return null

  return (
    <div className="p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/80 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Smartphone className="w-3.5 h-3.5 text-brand-400 shrink-0" />
        <span className="text-[11px] text-gray-300 truncate">
          Celular vinculado ao colaborador
        </span>
      </div>
      {onDesvincular && (
        <button
          type="button"
          onClick={() => {
            onDesvincular(colaborador)
            onClose?.()
          }}
          className="text-[10px] text-brand-300 hover:text-brand-200 hover:underline shrink-0"
        >
          Desvincular
        </button>
      )}
    </div>
  )
}

