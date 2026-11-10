import { useMemo } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { formatarNomeDia, compararDias } from '../../lib/diasSemana'
import TurnosDiaList from './TurnosDiaList'

/**
 * Item sanfona de um ponto de captação na lista de turnos cadastrados.
 * Exibe status de ocupação, total de horários e agrupa os turnos por dia da semana.
 */
export default function PontoTurnosAcordeon({
  ponto,
  turnosDoPonto = [],
  info = {},
  isExpandido = true,
  onToggleExpandir,
  reservas = [],
  onAbrirIncluirPessoa,
  onEditarTurno,
  onDeleteTurno,
  onRemoverReserva,
  onAbrirDuplicar,
  onDataChanged,
  showToast,
}) {
  const temVagas = (info.vagasLivres || 0) > 0

  // Agrupamento dos turnos por dia da semana
  const { turnosPorDia, diasOrdenados } = useMemo(() => {
    const porDia = {}
    const ordenados = [...turnosDoPonto].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

    for (const t of ordenados) {
      const diaFormatado = formatarNomeDia(t.dia)
      if (!porDia[diaFormatado]) porDia[diaFormatado] = []
      porDia[diaFormatado].push(t)
    }

    const dias = Object.keys(porDia).sort(compararDias)
    return { turnosPorDia: porDia, diasOrdenados: dias }
  }, [turnosDoPonto])

  return (
    <div className="border border-surface-700/80 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 bg-surface-900/40 transition-colors">
      {/* Botão de Toggle do Acordeon do Ponto */}
      <button
        type="button"
        onClick={onToggleExpandir}
        className="w-full flex items-center justify-between p-1.5 sm:p-2 rounded-xl hover:bg-surface-700/40 transition-colors text-left select-none"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="p-2 sm:p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-100 text-[15px] truncate">
              {ponto.nome}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                {info.totalTurnos || 0} turno{info.totalTurnos !== 1 ? 's' : ''}
              </span>
              {info.totalCapacidade > 0 && (
                <span
                  className={`text-xs font-medium ${
                    temVagas
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-red-600 dark:text-red-400 font-semibold'
                  }`}
                >
                  {temVagas
                    ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${
                        info.vagasLivres !== 1 ? 's' : ''
                      }`
                    : 'Lotado'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              info.totalCapacidade === 0
                ? 'bg-gray-600'
                : temVagas
                ? 'bg-emerald-400 animate-pulse-soft'
                : 'bg-red-500'
            }`}
            title={
              info.totalCapacidade === 0
                ? 'Sem turnos/capacidade'
                : temVagas
                ? `${info.vagasLivres} vagas livres`
                : 'Lotado'
            }
          />

          <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
            {isExpandido ? 'Recolher' : 'Expandir'}
          </span>
          <div
            className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 ${
              isExpandido ? 'rotate-180' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Conteúdo Expandido com Agrupamento por Dia */}
      {isExpandido && (
        <div className="mt-3 pt-3 border-t border-surface-700/60 space-y-3">
          {turnosDoPonto.length === 0 ? (
            <p className="text-xs text-gray-500 py-3 text-center italic">
              Nenhum turno cadastrado para este ponto ainda.
            </p>
          ) : (
            diasOrdenados.map((dia) => (
              <TurnosDiaList
                key={dia}
                dia={dia}
                turnos={turnosPorDia[dia]}
                ponto={ponto}
                reservas={reservas}
                onAbrirIncluirPessoa={onAbrirIncluirPessoa}
                onEditarTurno={onEditarTurno}
                onDeleteTurno={onDeleteTurno}
                onRemoverReserva={onRemoverReserva}
                onAbrirDuplicar={() =>
                  onAbrirDuplicar(ponto.id, ponto.nome, dia, turnosPorDia[dia])
                }
                onDataChanged={onDataChanged}
                showToast={showToast}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

