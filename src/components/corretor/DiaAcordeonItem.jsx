import { ChevronDown } from 'lucide-react'
import TurnoCard from './TurnoCard'

/**
 * Item de acordeon para um dia da semana na visão do colaborador.
 * Exibe resumo de vagas, alerta discreto se o colaborador já possui vaga,
 * e a lista animada de TurnoCard quando expandido.
 */
export default function DiaAcordeonItem({
  dia,
  turnosDoDia = [],
  reservasPorTurno = {},
  isAberto = false,
  onToggle,
  deviceId,
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  onReservar,
  onCancelar,
  termos = {},
  ocultarNomes = false,
}) {
  const totalCapacidadeDia = turnosDoDia.reduce((sum, t) => sum + t.capacidade, 0)
  const totalReservadosDia = turnosDoDia.reduce(
    (sum, t) => sum + (reservasPorTurno[t.id]?.length || 0),
    0
  )
  const vagasLivresDia = totalCapacidadeDia - totalReservadosDia
  const temVagas = vagasLivresDia > 0

  // Trava Estrita de Dispositivo: exibe "Sua vaga" apenas para quem reservou por este aparelho
  const isMinhaReservaGeral = (r) => Boolean(deviceId && r.device_id === deviceId)
  const usuarioTemVaga = turnosDoDia.some((t) =>
    (reservasPorTurno[t.id] || []).some(isMinhaReservaGeral)
  )

  return (
    <section className="transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="card w-full flex items-center justify-between py-3 px-3.5 sm:px-4 hover:border-brand-500/40 hover:bg-surface-700/50 transition-all duration-200 active:scale-[0.99] select-none text-left min-h-[48px]"
        aria-expanded={isAberto}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-1.5 h-5 rounded-full bg-brand-500 flex-shrink-0" />
          <h2 className="text-sm sm:text-base font-bold text-gray-100 uppercase tracking-wide truncate">
            {dia}
          </h2>
          <span className="text-xs text-gray-400 font-normal flex-shrink-0">
            ({turnosDoDia.length})
          </span>
          {usuarioTemVaga && (
            <span
              className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 sm:hidden"
              title="Você tem vaga neste dia"
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {usuarioTemVaga && (
            <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 rounded-md hidden sm:inline-flex items-center gap-1">
              Sua vaga
            </span>
          )}

          {totalCapacidadeDia > 0 && (
            <span
              className={`text-[11px] sm:text-xs font-medium px-2 py-0.5 rounded-md ${
                temVagas
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20'
              }`}
            >
              {temVagas
                ? `${vagasLivresDia} ${vagasLivresDia === 1 ? 'vaga' : 'vagas'}`
                : 'Lotado'}
            </span>
          )}

          <div
            className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 ${
              isAberto ? 'rotate-180 text-brand-500 dark:text-brand-400 bg-brand-500/20' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {isAberto && (
        <div className="space-y-3 mt-3 animate-fade-in">
          {turnosDoDia.map((turno) => (
            <TurnoCard
              key={turno.id}
              turno={turno}
              reservas={reservasPorTurno[turno.id] || []}
              deviceId={deviceId}
              corretorNome={corretorNome}
              corretorWhatsapp={corretorWhatsapp}
              corretorEmail={corretorEmail}
              onReservar={onReservar}
              onCancelar={onCancelar}
              acaoVaga={termos.acaoVaga}
              acaoCancelar={termos.acaoCancelar}
              ocultarNomes={ocultarNomes}
            />
          ))}
        </div>
      )}
    </section>
  )
}

