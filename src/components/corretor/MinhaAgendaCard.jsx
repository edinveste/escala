import { useMemo } from 'react'
import { Calendar, ChevronRight } from 'lucide-react'
import { compararDias, formatarDiaComData } from '../../lib/diasSemana'

/**
 * MinhaAgendaCard — Card compacto e elegante no topo da escala pública.
 * Informa quantas vagas o colaborador possui garantidas na semana
 * e oferece atalho de 1 toque para abrir a agenda detalhada e exportar para o calendário.
 */
export default function MinhaAgendaCard({
  turnosReservados = [],
  onAbrirAgenda,
  termos = {},
}) {
  const total = turnosReservados.length
  if (total === 0) return null

  // Ordena os turnos cronologicamente para identificar o primeiro
  const turnosOrdenados = useMemo(() => {
    return [...turnosReservados].sort((a, b) => {
      const cmpDia = compararDias(a.dia, b.dia)
      if (cmpDia !== 0) return cmpDia
      return (a.ordem ?? 0) - (b.ordem ?? 0)
    })
  }, [turnosReservados])

  const primeiroTurno = turnosOrdenados[0]
  const diaComData = primeiroTurno ? formatarDiaComData(primeiroTurno.dia) : ''

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrirAgenda}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAbrirAgenda?.()
        }
      }}
      className="card p-3 sm:p-3.5 bg-gradient-to-r from-brand-500/10 via-surface-800 to-surface-800 border border-brand-500/30 hover:border-brand-500/50 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.99] select-none group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-400 group-hover:bg-brand-500/30 transition-colors shrink-0">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-gray-100">
                Minha Agenda
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {total} {total === 1 ? 'horário' : 'horários'}
              </span>
            </div>
            {primeiroTurno && (
              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                <span className="text-gray-300 font-medium">{diaComData}</span>
                {' • '}
                <span>{primeiroTurno.horario}</span>
                {primeiroTurno.pontoNome && (
                  <span className="text-gray-500"> ({primeiroTurno.pontoNome})</span>
                )}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAbrirAgenda?.()
          }}
          className="btn-primary text-xs py-1.5 px-3 min-h-[36px] shrink-0 flex items-center gap-1 shadow-none"
        >
          <span>Ver horários</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

