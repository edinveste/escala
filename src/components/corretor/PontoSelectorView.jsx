import { MapPin, Store, Lock } from 'lucide-react'
import CorretorIdentityHeader from './CorretorIdentityHeader'
import CorretorCopyFooter from './CorretorCopyFooter'
import { obterAberturaPonto, formatarDataAberturaCurta } from '../../lib/aberturaHelper'

/**
 * Visualização pública inicial do colaborador para seleção do ponto de escala.
 */
export default function PontoSelectorView({
  pontos = [],
  vagasPorPonto = {},
  termos = {},
  empresa = null,
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  cadastroNaoAutorizado = false,
  onEditarPerfil,
  onSelectPonto,
  onCopiar,
  copied = false,
  podeCopiar = true,
  resumoColaborador = null,
}) {
  if (pontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Store className="w-16 h-16 text-gray-700" />
        <div>
          <h2 className="text-lg font-semibold text-gray-400">
            Nenhum {termos.ponto?.toLowerCase() || 'local'} cadastrado
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {empresa?.nome
              ? `Nenhum ${termos.ponto?.toLowerCase() || 'local'} ativo cadastrado para ${empresa.nome}.`
              : `O administrador precisa cadastrar os ${termos.pontos?.toLowerCase() || 'locais'}.`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Identificação do participante com suporte a edição e resumo de regras */}
      <CorretorIdentityHeader
        corretorNome={corretorNome}
        corretorWhatsapp={corretorWhatsapp}
        corretorEmail={corretorEmail}
        cadastroNaoAutorizado={cadastroNaoAutorizado}
        onEditarPerfil={onEditarPerfil}
        termos={termos}
        resumoColaborador={resumoColaborador}
      />

      <div className="mb-4 px-1">
        <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-brand-400" />
          Escolha o {termos.ponto || 'Ponto de Escala'}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Selecione {termos.artigoPonto || 'o'}{' '}
          {termos.ponto?.toLowerCase() || 'local'} para ver horários e{' '}
          {termos.acaoVaga?.toLowerCase() || 'garantir vagas'}.
        </p>
      </div>

      <div className="space-y-3">
        {pontos.map((ponto) => {
          const info = vagasPorPonto[ponto.id] || {}
          const temVagas = info.vagasLivres > 0
          const cotaRestritaNestePonto = Boolean(
            resumoColaborador?.regras?.temAlgumaCota &&
            resumoColaborador?.regras?.cotasPontosIds &&
            resumoColaborador?.pontoTemCota?.(ponto.id)
          )
          const abertura = obterAberturaPonto(ponto, empresa)

          return (
            <button
              key={ponto.id}
              type="button"
              onClick={() => onSelectPonto(ponto.id)}
              className="card w-full text-left hover:border-brand-500/40 hover:bg-surface-700/50 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border flex-shrink-0 ${
                    abertura.estaAgendado
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                      : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-100 text-[15px] truncate">
                    {ponto.nome}
                  </h3>
                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {info.totalTurnos || 0} turno{info.totalTurnos !== 1 ? 's' : ''}
                    </span>

                    {abertura.estaAgendado ? (
                      <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Abre {formatarDataAberturaCurta(abertura.dataAbertura)}
                      </span>
                    ) : info.totalCapacidade > 0 ? (
                      <span
                        className={`text-xs font-medium ${
                          temVagas
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-red-600 dark:text-red-400 font-semibold'
                        }`}
                      >
                        {temVagas
                          ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${info.vagasLivres !== 1 ? 's' : ''}`
                          : 'Lotado'}
                      </span>
                    ) : null}

                    {cotaRestritaNestePonto && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                        Com limite
                      </span>
                    )}
                  </div>
                </div>

                {/* Indicador visual de disponibilidade */}
                {abertura.estaAgendado ? (
                  <div
                    className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 flex-shrink-0"
                    title={`Abertura programada: ${formatarDataAberturaCurta(abertura.dataAbertura)}`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      info.totalCapacidade === 0
                        ? 'bg-gray-600'
                        : temVagas
                        ? 'bg-emerald-400 animate-pulse-soft'
                        : 'bg-red-500'
                    }`}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {podeCopiar && (
        <CorretorCopyFooter onCopiar={onCopiar} copied={copied} />
      )}
    </>
  )
}

