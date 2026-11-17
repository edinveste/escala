import { MapPin, Store, Lock } from 'lucide-react'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import CorretorIdentityHeader from './CorretorIdentityHeader'
import CorretorEmpresaCard from './CorretorEmpresaCard'
import CorretorCopyFooter from './CorretorCopyFooter'
import { obterAberturaPonto, formatarDataAberturaCurta } from '../../lib/aberturaHelper'
import { obterLinkGoogleMaps } from '../../lib/mapsHelper'

/**
 * PontoSelectorClassico — Layout original/clássico enxuto da lista de pontos.
 * Preservado para permitir alternância nas configurações da empresa.
 */
export default function PontoSelectorClassico({
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
  onAbrirAgenda = null,
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

  const totalVagasAgendadas = resumoColaborador?.turnosReservados?.length || 0

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
        onAbrirAgenda={onAbrirAgenda}
        mostrarBotaoAgenda={false}
      />

      {/* Card da Empresa com Selo Oficial e Botão de Agenda Integrado */}
      <CorretorEmpresaCard
        empresa={empresa}
        totalVagasAgendadas={totalVagasAgendadas}
        onAbrirAgenda={onAbrirAgenda}
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
          const mapsUrl = obterLinkGoogleMaps(ponto.endereco)

          return (
            <div
              key={ponto.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectPonto(ponto.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectPonto(ponto.id)
                }
              }}
              className="card group w-full text-left hover:border-brand-500/40 hover:bg-surface-700/50 transition-all duration-200 active:scale-[0.99] cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`relative p-2.5 rounded-xl border flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-200 shadow-sm group/maps ${
                      abertura.estaAgendado
                        ? 'bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-400 hover:scale-105 active:scale-95'
                        : 'bg-surface-700/80 border-surface-600/80 hover:bg-surface-600 hover:border-brand-500/50 hover:scale-105 active:scale-95'
                    }`}
                    title={`Abrir no Google Maps:\n${ponto.endereco}`}
                    aria-label={`Abrir ${ponto.nome} no Google Maps: ${ponto.endereco}`}
                  >
                    <GoogleMapsIcon className="w-5 h-5 transition-transform duration-200 group-hover/maps:-translate-y-0.5 drop-shadow-sm" />
                  </a>
                ) : (
                  <div
                    className={`p-2.5 rounded-xl border flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                      abertura.estaAgendado
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-100 text-[15px] truncate">
                    {ponto.nome}
                  </h3>
                  {ponto.endereco && (
                    <p
                      className="text-[11px] text-gray-400 truncate mt-0.5"
                      title={`Endereço: ${ponto.endereco}`}
                    >
                      {ponto.endereco}
                    </p>
                  )}
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
            </div>
          )
        })}
      </div>

      {podeCopiar && (
        <CorretorCopyFooter onCopiar={onCopiar} copied={copied} />
      )}
    </>
  )
}
