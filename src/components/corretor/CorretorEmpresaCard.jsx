import { ChevronRight } from 'lucide-react'
import AgendaCalendarIcon from '../icons/AgendaCalendarIcon'

/**
 * CorretorEmpresaCard — Card de identificação da empresa na escala pública.
 * Exibe logo/avatar, nome da empresa com selo oficial, status em tempo real
 * e integra o botão de acesso rápido à agenda do colaborador no próprio card.
 */
export default function CorretorEmpresaCard({
  empresa,
  totalVagasAgendadas = 0,
  onAbrirAgenda = null,
  mostrarBotaoAgenda = true,
}) {
  if (!empresa?.nome) return null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-800 via-surface-800/90 to-surface-900 border border-surface-700/80 p-3.5 sm:p-4 shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-2.5 sm:gap-3">
        {/* Lado Esquerdo: Identidade da Empresa */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={empresa.nome}
              className="w-10 h-10 rounded-xl object-contain bg-surface-900 border border-surface-700 p-1 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 text-brand-400 flex items-center justify-center font-bold text-base flex-shrink-0 shadow-inner select-none">
              {empresa.nome.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-gray-100 truncate">
                {empresa.nome}
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 select-none">
                Escala Oficial
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate mt-0.5 flex items-center gap-1.5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>Atualização em tempo real</span>
            </p>
          </div>
        </div>

        {/* Lado Direito: Botão Minha Agenda embutido no próprio card (Modo Clássico) */}
        {mostrarBotaoAgenda && totalVagasAgendadas > 0 && onAbrirAgenda && (
          <button
            type="button"
            onClick={onAbrirAgenda}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 active:bg-brand-500/25 border border-brand-500/30 hover:border-brand-500/50 text-brand-300 hover:text-brand-200 text-xs font-semibold transition-all shadow-sm shrink-0 active:scale-95 group select-none min-h-[36px]"
            title={`Ver meus ${totalVagasAgendadas} ${
              totalVagasAgendadas === 1 ? 'horário agendado' : 'horários agendados'
            }`}
            aria-label={`Ver meus ${totalVagasAgendadas} horários`}
          >
            <AgendaCalendarIcon className="w-3.5 h-3.5 text-brand-400 group-hover:scale-110 transition-transform flex-shrink-0" />
            <span>
              {totalVagasAgendadas}{' '}
              <span className="hidden xs:inline">
                {totalVagasAgendadas === 1 ? 'horário' : 'horários'}
              </span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-brand-400/70 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}
