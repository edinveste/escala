import { MapPin } from 'lucide-react'

export default function PontosHeader({ isSavingOrder, termos = {} }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-brand-400" />
        {termos.pontos || 'Pontos de Captação'}
      </h2>
      {isSavingOrder && (
        <span className="text-[11px] font-medium text-brand-400 animate-pulse flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-ping" />
          Salvando ordem...
        </span>
      )}
    </div>
  )
}

