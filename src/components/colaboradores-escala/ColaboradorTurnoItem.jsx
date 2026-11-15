import { MapPin, Calendar, Clock, Trash2 } from 'lucide-react'

/**
 * Item individual de turno agendado por um colaborador na escala.
 * Exibe dia da semana, horário e ponto de captação, com ação para desmarcar.
 */
export default function ColaboradorTurnoItem({
  turno,
  colaboradorNome,
  onRemoverReserva,
  isFullAdmin = true,
}) {
  const turnoDesc = `${turno.dia} - ${turno.horario} (${turno.pontoNome})`

  return (
    <div className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/60 hover:border-surface-600/80 transition-colors text-xs">
      {/* Informações do Horário Agendado */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {/* Dia */}
        <span className="inline-flex items-center gap-1 font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{turno.dia}</span>
        </span>

        {/* Horário */}
        <span className="inline-flex items-center gap-1 font-medium text-surface-200 bg-surface-800 px-2 py-0.5 rounded border border-surface-700">
          <Clock className="w-3 h-3 text-surface-400 flex-shrink-0" />
          <span>{turno.horario}</span>
        </span>

        {/* Ponto / Local */}
        <span className="inline-flex items-center gap-1 text-surface-300">
          <MapPin className="w-3 h-3 text-surface-400 flex-shrink-0" />
          <span className="truncate max-w-[160px] sm:max-w-[220px]" title={turno.pontoNome}>
            {turno.pontoNome}
          </span>
        </span>
      </div>

      {/* Ação de Remoção do Horário */}
      {onRemoverReserva && isFullAdmin && (
        <button
          type="button"
          onClick={() =>
            onRemoverReserva(turno.reservaId, colaboradorNome, turnoDesc)
          }
          className="p-1 rounded text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          title={`Remover "${colaboradorNome}" deste horário (${turnoDesc})`}
          aria-label={`Remover horário ${turnoDesc}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
