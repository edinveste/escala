import { AlertTriangle, Trash2 } from 'lucide-react'

export default function AdminZonaPerigo({ isFullAdmin, onLimparEscala }) {
  if (!isFullAdmin) return null

  return (
    <div className="card border-red-500/20 bg-red-500/5">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-red-400">Zona de Perigo</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Limpar todas as reservas desta escala. Esta ação não afeta outros locais.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onLimparEscala?.(null)}
        className="btn-danger w-full flex items-center justify-center gap-2"
      >
        <Trash2 className="w-4.5 h-4.5" />
        Limpar Todas as Reservas da Escala
      </button>
    </div>
  )
}

