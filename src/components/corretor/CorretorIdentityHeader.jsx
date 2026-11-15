import { AlertCircle, Pencil, ChevronRight } from 'lucide-react'
import AgendaCalendarIcon from '../icons/AgendaCalendarIcon'
import CorretorRegrasBanner from './CorretorRegrasBanner'

/**
 * Cabeçalho de identificação do colaborador com saudação,
 * botão discreto na mesma linha para ver os horários ("Minha Agenda"),
 * barra discreta de cotas/regras ativas e alerta contextual de autorização.
 */
export default function CorretorIdentityHeader({
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  cadastroNaoAutorizado,
  onEditarPerfil,
  termos,
  resumoColaborador,
  selectedPontoId = null,
  onAbrirAgenda = null,
  mostrarBotaoAgenda = true,
  mostrarSaudacao = true,
  acoesDireita = null,
}) {
  const temCotasVisiveis = Boolean(
    resumoColaborador?.regras?.temAlgumaCota &&
      (!selectedPontoId || (resumoColaborador?.pontoTemCota?.(selectedPontoId) ?? true))
  )
  const totalVagas = resumoColaborador?.turnosReservados?.length || 0
  const temVagasReservadas = totalVagas > 0
  const podeMostrarBotao = Boolean(mostrarBotaoAgenda && temVagasReservadas && onAbrirAgenda)
  const podeMostrarLinhaTopo = Boolean(
    (mostrarSaudacao && corretorNome) || podeMostrarBotao || acoesDireita
  )

  if (!podeMostrarLinhaTopo && !temCotasVisiveis && !cadastroNaoAutorizado) return null

  return (
    <div className="mb-3 px-1 space-y-2.5">
      {/* Linha com Saudação ao Colaborador e Ações na Mesma Linha */}
      {podeMostrarLinhaTopo && (
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 flex-nowrap min-w-0">
          {mostrarSaudacao && corretorNome ? (
            <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 min-w-0 flex-1 overflow-hidden">
              <span
                className="truncate block max-w-full select-none"
                title={`Olá, ${corretorNome} 👋`}
              >
                Olá, <strong className="text-gray-200 dark:text-gray-100 font-semibold">{corretorNome}</strong> 👋
              </span>
            </div>
          ) : (
            <div />
          )}

          {/* Ações alinhadas à direita na mesma linha (PC e Celular) */}
          {acoesDireita ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {acoesDireita}
            </div>
          ) : (
            podeMostrarBotao && (
              <button
                type="button"
                onClick={onAbrirAgenda}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 active:bg-brand-500/25 border border-brand-500/30 hover:border-brand-500/50 text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 text-xs font-semibold transition-all shadow-sm shrink-0 active:scale-95 group select-none min-h-[32px]"
                title={`Ver meus ${totalVagas} ${totalVagas === 1 ? 'horário agendado' : 'horários agendados'}`}
                aria-label={`Ver meus ${totalVagas} ${totalVagas === 1 ? 'horário agendado' : 'horários agendados'}`}
              >
                <AgendaCalendarIcon className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 group-hover:scale-110 transition-transform" />
                <span>
                  {totalVagas} {totalVagas === 1 ? 'horário' : 'horários'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-brand-500/70 dark:text-brand-400/70 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )
          )}
        </div>
      )}

      {temCotasVisiveis && (
        <CorretorRegrasBanner
          resumoColaborador={resumoColaborador}
          selectedPontoId={selectedPontoId}
        />
      )}

      {cadastroNaoAutorizado && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300 animate-scale-in shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-200">
              Identificação não autorizada na equipe
            </p>
            <p className="text-[11px] text-red-300/80 mt-0.5 leading-relaxed">
              O contato{' '}
              {corretorWhatsapp ? (
                <strong className="font-mono text-red-200">{corretorWhatsapp}</strong>
              ) : corretorEmail ? (
                <strong className="text-red-200">{corretorEmail}</strong>
              ) : (
                'informado'
              )}{' '}
              não foi encontrado na lista autorizada de{' '}
              {termos?.pessoas?.toLowerCase() || 'colaboradores'}. Se você digitou errado, clique no botão abaixo para corrigir.
            </p>
            {onEditarPerfil && (
              <button
                type="button"
                onClick={onEditarPerfil}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium text-xs transition-colors active:scale-95 min-h-[32px]"
              >
                <Pencil className="w-3.5 h-3.5" />
                Corrigir meus dados agora
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

