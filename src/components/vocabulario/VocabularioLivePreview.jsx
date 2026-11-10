import { Eye } from 'lucide-react'

/**
 * Card de pré-visualização ao vivo dos termos selecionados.
 * Mostra exatamente como a equipe verá na tela mobile do corretor/colaborador.
 */
export default function VocabularioLivePreview({
  tituloEscala,
  pontos,
  pessoa,
  pessoas,
  acaoVaga,
}) {
  return (
    <div className="mb-6 p-4 rounded-xl bg-surface-elevated/70 border border-border/80">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-brand-500" /> Como sua equipe verá no celular:
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-medium">
          Ao Vivo
        </span>
      </div>

      <div className="space-y-2 text-xs sm:text-sm">
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-text-muted">Título da Escala:</span>
          <span className="font-semibold text-text">{tituloEscala || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-text-muted">Seus Locais / Unidades:</span>
          <span className="font-semibold text-brand-400">{pontos || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-text-muted">Identificação da Pessoa:</span>
          <span className="font-semibold text-text">{pessoa || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-text-muted">Sua Equipe / Grupo:</span>
          <span className="font-semibold text-text">{pessoas || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-text-muted">Botão de Confirmação:</span>
          <span className="px-2.5 py-1 rounded bg-brand-500 text-white font-medium text-xs">
            {acaoVaga || 'Garantir Vaga'}
          </span>
        </div>
      </div>
    </div>
  )
}

