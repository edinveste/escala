import { useMemo } from 'react'
import { Clock, Users, CheckCircle2, XCircle, User } from 'lucide-react'

export default function TurnoCard({ turno, reservas, deviceId, onReservar, onCancelar }) {
  const vagasOcupadas = reservas.length
  const vagasTotal = turno.capacidade
  const vagasRestantes = vagasTotal - vagasOcupadas
  const esgotado = vagasRestantes <= 0

  // Verifica se o device atual tem reserva neste turno
  const minhaReserva = useMemo(
    () => reservas.find((r) => r.device_id === deviceId),
    [reservas, deviceId]
  )

  // Calcula a porcentagem de ocupação para a barra de progresso
  const porcentagem = Math.min((vagasOcupadas / vagasTotal) * 100, 100)

  // Cor da barra baseada na ocupação
  const barColor = esgotado
    ? 'bg-red-500'
    : porcentagem >= 66
    ? 'bg-amber-500'
    : 'bg-emerald-500'

  const badgeColor = esgotado
    ? 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
    : porcentagem >= 66
    ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
    : 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'

  return (
    <div className={`card transition-all duration-200 ${minhaReserva ? 'ring-2 ring-brand-500 shadow-brand-500/10' : ''}`}>
      {/* Header do card */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-surface-700">
            <Clock className="w-4.5 h-4.5 text-brand-500 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100 text-[15px] leading-tight">
              {turno.horario}
            </h3>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
          {vagasOcupadas}/{vagasTotal}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-1.5 bg-surface-700 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>

      {/* Lista de corretores */}
      {reservas.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {reservas.map((reserva) => (
            <div
              key={reserva.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                reserva.device_id === deviceId
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20'
                  : 'bg-surface-700/60 text-gray-400'
              }`}
            >
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate font-medium">{reserva.corretor_nome}</span>
              {reserva.device_id === deviceId && (
                <span className="ml-auto text-[10px] bg-brand-500/20 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded font-bold">
                  VOCÊ
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botão de ação */}
      {minhaReserva ? (
        <button
          onClick={() => onCancelar(minhaReserva.id)}
          className="btn-danger w-full flex items-center justify-center gap-2 text-sm"
        >
          <XCircle className="w-4.5 h-4.5" />
          Cancelar Minha Vaga
        </button>
      ) : esgotado ? (
        <button
          disabled
          className="btn-ghost w-full flex items-center justify-center gap-2 text-sm opacity-50 cursor-not-allowed"
        >
          <Users className="w-4.5 h-4.5" />
          Esgotado
        </button>
      ) : (
        <button
          onClick={() => onReservar(turno.id)}
          className="btn-success w-full flex items-center justify-center gap-2 text-sm"
        >
          <CheckCircle2 className="w-4.5 h-4.5" />
          Garantir Vaga
        </button>
      )}
    </div>
  )
}
