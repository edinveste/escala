import { AlertCircle, Pencil } from 'lucide-react'
import CorretorRegrasBanner from './CorretorRegrasBanner'
import MinhaAgendaCard from './MinhaAgendaCard'

/**
 * Cabeçalho de identificação do colaborador com saudação,
 * card consolidado de "Minha Agenda" (Google Agenda e PDF),
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
}) {
  const temCotasVisiveis = Boolean(
    resumoColaborador?.regras?.temAlgumaCota &&
      (!selectedPontoId || (resumoColaborador?.pontoTemCota?.(selectedPontoId) ?? true))
  )
  const temVagasReservadas = Boolean(resumoColaborador?.turnosReservados?.length > 0)

  if (!corretorNome && !temCotasVisiveis && !temVagasReservadas) return null

  return (
    <div className="mb-4 px-1 space-y-2.5">
      {corretorNome && (
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <span>
            Olá, <strong className="text-gray-200 dark:text-gray-100 font-semibold">{corretorNome}</strong> 👋
          </span>
        </div>
      )}

      {/* Card de Minha Agenda Consolidada com Exportação para Calendário */}
      {temVagasReservadas && onAbrirAgenda && (
        <MinhaAgendaCard
          turnosReservados={resumoColaborador.turnosReservados}
          onAbrirAgenda={onAbrirAgenda}
          termos={termos}
        />
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

