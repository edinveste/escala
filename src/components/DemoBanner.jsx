import { Lightbulb, ArrowLeft, ArrowRight } from 'lucide-react'

export default function DemoBanner({ onBackToSite, onCadastrar }) {
  return (
    <aside
      aria-label="Aviso de Modo Demonstração"
      className="bg-gradient-to-r from-amber-500/15 via-brand-500/10 to-amber-500/15 border-b border-amber-500/30 text-text px-3 sm:px-4 py-2.5 transition-colors"
    >
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
        {/* Mensagem e Ícone */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </span>
          <p className="text-xs sm:text-sm text-text leading-tight">
            <strong className="text-amber-400 font-semibold">Modo Demonstração Interativo</strong>
            <span className="hidden sm:inline"> — </span>
            <span className="block sm:inline text-text-muted mt-0.5 sm:mt-0">
              Experimente garantir uma vaga como se fosse um colaborador da equipe.
            </span>
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center flex-wrap justify-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text bg-surface-elevated hover:bg-surface-elevated/80 border border-border shadow-sm transition-all active:scale-95 min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para o Site</span>
          </button>

          <button
            type="button"
            onClick={onCadastrar}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/20 transition-all active:scale-95 min-h-[36px]"
          >
            <span>Criar Escala da Minha Empresa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

