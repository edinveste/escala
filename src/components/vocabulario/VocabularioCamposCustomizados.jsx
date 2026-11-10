import { SlidersHorizontal } from 'lucide-react'

/**
 * Seção sanfona de ajuste fino e campos manuais de vocabulário.
 */
export default function VocabularioCamposCustomizados({
  modoCustomizado,
  onToggleModoCustomizado,
  ponto,
  setPonto,
  pontos,
  setPontos,
  pessoa,
  setPessoa,
  pessoas,
  setPessoas,
  tituloEscala,
  setTituloEscala,
  acaoVaga,
  setAcaoVaga,
  acaoCancelar,
  setAcaoCancelar,
  disabled = false,
}) {
  return (
    <>
      {/* Botão de Toggle para Ajuste Fino */}
      <div className="mb-5">
        <button
          type="button"
          onClick={onToggleModoCustomizado}
          disabled={disabled}
          className="flex items-center gap-2 text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors disabled:opacity-50"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>
            {modoCustomizado
              ? 'Ocultar campos personalizados'
              : 'Quer ajustar as palavras manualmente? Clique aqui'}
          </span>
        </button>
      </div>

      {/* Formulário de Campos Manuais */}
      {modoCustomizado && (
        <div className="space-y-3.5 mb-6 p-4 rounded-xl bg-surface border border-border/60 animate-fade-in">
          {/* Locais (Singular / Plural) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Local no Singular (ex: Stand, Ala, Loja)
              </label>
              <input
                type="text"
                value={ponto}
                onChange={(e) => setPonto(e.target.value)}
                disabled={disabled}
                placeholder="ex: Ponto de Escala"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Locais no Plural (ex: Stands, Alas, Lojas)
              </label>
              <input
                type="text"
                value={pontos}
                onChange={(e) => setPontos(e.target.value)}
                disabled={disabled}
                placeholder="ex: Pontos de Escala"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Pessoas (Singular / Plural) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Pessoa no Singular (ex: Corretor, Médico, Freela)
              </label>
              <input
                type="text"
                value={pessoa}
                onChange={(e) => setPessoa(e.target.value)}
                disabled={disabled}
                placeholder="ex: Colaborador(a)"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Pessoas no Plural (ex: Corretores, Plantonistas)
              </label>
              <input
                type="text"
                value={pessoas}
                onChange={(e) => setPessoas(e.target.value)}
                disabled={disabled}
                placeholder="ex: Equipe"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Título Geral da Escala */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Título Geral da Escala (ex: Controle de Plantões)
            </label>
            <input
              type="text"
              value={tituloEscala}
              onChange={(e) => setTituloEscala(e.target.value)}
              disabled={disabled}
              placeholder="ex: Gestão de Escalas"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            />
          </div>

          {/* Botões de Ação da Vaga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Texto do Botão de Reserva
              </label>
              <input
                type="text"
                value={acaoVaga}
                onChange={(e) => setAcaoVaga(e.target.value)}
                disabled={disabled}
                placeholder="ex: Garantir Vaga"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Texto do Botão de Cancelamento
              </label>
              <input
                type="text"
                value={acaoCancelar}
                onChange={(e) => setAcaoCancelar(e.target.value)}
                disabled={disabled}
                placeholder="ex: Cancelar Minha Vaga"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

