import { MapPin, Store } from 'lucide-react'
import CorretorIdentityHeader from './CorretorIdentityHeader'
import CorretorCopyFooter from './CorretorCopyFooter'

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
      {/* Identificação do participante com suporte a edição */}
      <CorretorIdentityHeader
        corretorNome={corretorNome}
        corretorWhatsapp={corretorWhatsapp}
        corretorEmail={corretorEmail}
        cadastroNaoAutorizado={cadastroNaoAutorizado}
        onEditarPerfil={onEditarPerfil}
        termos={termos}
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

          return (
            <button
              key={ponto.id}
              type="button"
              onClick={() => onSelectPonto(ponto.id)}
              className="card w-full text-left hover:border-brand-500/40 hover:bg-surface-700/50 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
                  <MapPin className="w-5 h-5 text-brand-400" />
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
                          ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${info.vagasLivres !== 1 ? 's' : ''}`
                          : 'Lotado'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Indicador visual de disponibilidade */}
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    info.totalCapacidade === 0
                      ? 'bg-gray-600'
                      : temVagas
                      ? 'bg-emerald-400 animate-pulse-soft'
                      : 'bg-red-500'
                  }`}
                />
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

