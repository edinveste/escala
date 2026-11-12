import { ShieldCheck } from 'lucide-react'

/**
 * Barra compacta e discreta exibindo as cotas ativas da escala
 * e o saldo atual de vagas do colaborador, respeitando o escopo por ponto quando configurado.
 */
export default function CorretorRegrasBanner({
  resumoColaborador,
  selectedPontoId = null,
}) {
  const regras = resumoColaborador?.regras
  if (!regras?.temAlgumaCota) return null

  const pontoTemCota = selectedPontoId
    ? resumoColaborador?.pontoTemCota?.(selectedPontoId) ?? true
    : true

  if (!pontoTemCota) return null

  const totalSemana = resumoColaborador.totalSemana || 0
  const totalPonto = selectedPontoId ? resumoColaborador.porPonto?.[selectedPontoId] || 0 : 0

  const semanaAtingida = regras.limiteSemana !== null && totalSemana >= regras.limiteSemana
  const pontoAtingido =
    selectedPontoId && regras.limitePonto !== null && totalPonto >= regras.limitePonto

  const temFiltroPontos = Boolean(regras.cotasPontosIds && regras.cotasPontosIds.length > 0)

  return (
    <div className="p-2.5 rounded-xl bg-surface-800/80 border border-surface-600/80 flex flex-wrap items-center gap-1.5 text-[11px] animate-fade-in">
      {regras.limiteSemana !== null && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-semibold ${
            semanaAtingida
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-brand-500/10 border-brand-500/25 text-brand-700 dark:text-brand-300'
          }`}
        >
          <ShieldCheck className="w-3 h-3 shrink-0" />
          Suas vagas: {totalSemana}/{regras.limiteSemana} na semana
          {!selectedPontoId && temFiltroPontos
            ? ` (${regras.cotasPontosIds.length} ${regras.cotasPontosIds.length === 1 ? 'ponto' : 'pontos'})`
            : ''}
        </span>
      )}

      {selectedPontoId && regras.limitePonto !== null ? (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
            pontoAtingido
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-surface-700/80 border-surface-600 text-gray-300'
          }`}
        >
          Suas vagas neste ponto: {totalPonto}/{regras.limitePonto}
        </span>
      ) : (
        regras.limitePonto !== null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border bg-surface-700/80 border-surface-600 text-gray-300 font-medium">
            Máx. {regras.limitePonto}/ponto
          </span>
        )
      )}

      {regras.limiteDia !== null && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border bg-surface-700/80 border-surface-600 text-gray-300 font-medium">
          Máx. {regras.limiteDia}/dia
        </span>
      )}
    </div>
  )
}
