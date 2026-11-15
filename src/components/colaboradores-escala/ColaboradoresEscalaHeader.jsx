import { Users, ChevronDown, ChevronUp, CalendarCheck } from 'lucide-react'

/**
 * Cabeçalho do módulo de Colaboradores na Escala.
 * Exibe título contextual, total de colaboradores e vagas preenchidas, e controle da sanfona.
 */
export default function ColaboradoresEscalaHeader({
  totalColaboradores = 0,
  totalVagas = 0,
  isExpanded,
  onToggleExpanded,
  termos = {},
}) {
  const rotuloPessoas = termos.pessoas || 'Colaboradores'
  const rotuloPessoa = termos.pessoa || 'Colaborador'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Identidade: Ícone, Título e Badges */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex-shrink-0">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-gray-100">
              {rotuloPessoas} na Escala
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {totalColaboradores}{' '}
              {totalColaboradores === 1
                ? rotuloPessoa.toLowerCase()
                : rotuloPessoas.toLowerCase()}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {totalVagas} {totalVagas === 1 ? 'vaga preenchida' : 'vagas preenchidas'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Quem está agendado nos turnos
          </p>
        </div>
      </div>

      {/* Botão de Expansão / Sanfona */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 self-end sm:self-center bg-surface-700/60 hover:bg-surface-700 px-2.5 py-1.5 rounded-lg border border-surface-600/50 transition-colors text-left flex-shrink-0"
        aria-expanded={isExpanded}
        aria-label={
          isExpanded
            ? 'Recolher colaboradores da escala'
            : 'Ver colaboradores da escala'
        }
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Recolher</span>
              <span>Lista</span>
            </span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Ver</span>
              <span>Horários</span>
            </span>
          </>
        )}
      </button>
    </div>
  )
}
