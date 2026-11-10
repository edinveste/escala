import { useEffect } from 'react'
import { X, Sparkles, Save } from 'lucide-react'
import { useVocabularioModal } from './useVocabularioModal'
import VocabularioPresetSelector from './VocabularioPresetSelector'
import VocabularioLivePreview from './VocabularioLivePreview'
import VocabularioCamposCustomizados from './VocabularioCamposCustomizados'

/**
 * Modal orquestrador de personalização de nicho e vocabulário da empresa.
 * Permite adaptar dinamicamente os termos do sistema (Stands, Alas, Corretores, Plantonistas, etc.).
 */
export default function VocabularioModal({
  isOpen,
  onClose,
  empresa,
  onUpdateEmpresa,
  showToast,
}) {
  const {
    presetSelecionado,
    modoCustomizado,
    setModoCustomizado,
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
    saving,
    handleTrocaPreset,
    handleSalvar,
  } = useVocabularioModal({
    isOpen,
    empresa,
    onUpdateEmpresa,
    onClose,
    showToast,
  })

  // Bloqueio de scroll e atalho ESC
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, saving, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={() => !saving && onClose?.()}
    >
      <div
        className="card max-w-xl w-full max-h-[90vh] overflow-y-auto border border-border/80 shadow-2xl p-6 sm:p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-elevated transition-colors disabled:opacity-50"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Nicho & Vocabulário</h2>
            <p className="text-xs sm:text-sm text-text-muted">
              Adapte os nomes da plataforma para a linguagem da sua equipe e segmento
            </p>
          </div>
        </div>

        {/* Seletor de Segmento / Preset */}
        <VocabularioPresetSelector
          presetSelecionado={presetSelecionado}
          onTrocaPreset={handleTrocaPreset}
          disabled={saving}
        />

        {/* Card de Pré-visualização ao Vivo */}
        <VocabularioLivePreview
          tituloEscala={tituloEscala}
          pontos={pontos}
          pessoa={pessoa}
          pessoas={pessoas}
          acaoVaga={acaoVaga}
        />

        {/* Campos de Ajuste Fino Customizado */}
        <VocabularioCamposCustomizados
          modoCustomizado={modoCustomizado}
          onToggleModoCustomizado={() => setModoCustomizado(!modoCustomizado)}
          ponto={ponto}
          setPonto={setPonto}
          pontos={pontos}
          setPontos={setPontos}
          pessoa={pessoa}
          setPessoa={setPessoa}
          pessoas={pessoas}
          setPessoas={setPessoas}
          tituloEscala={tituloEscala}
          setTituloEscala={setTituloEscala}
          acaoVaga={acaoVaga}
          setAcaoVaga={setAcaoVaga}
          acaoCancelar={acaoCancelar}
          setAcaoCancelar={setAcaoCancelar}
          disabled={saving}
        />

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-border text-xs sm:text-sm font-medium text-text-muted hover:text-text hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs sm:text-sm transition-all shadow-md shadow-brand-500/20 flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <span>Salvando...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Vocabulário</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

