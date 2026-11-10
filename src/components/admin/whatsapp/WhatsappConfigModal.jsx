import { MessageSquare, Sparkles, RotateCcw, Save, X, MapPin } from 'lucide-react'
import WhatsappPreviewBubble from './WhatsappPreviewBubble'
import WhatsappEscopoDropdown from './WhatsappEscopoDropdown'
import { useWhatsappConfig } from './useWhatsappConfig'

export default function WhatsappConfigModal({
  isOpen,
  onClose,
  empresa,
  pontos = [],
  initialAlvoId = 'geral',
  onEmpresaUpdated,
  onDataChanged,
  showToast,
}) {
  const {
    alvoId,
    pontoAtual,
    mudarAlvo,
    cabecalho,
    setCabecalho,
    rodape,
    setRodape,
    saving,
    inserirTag,
    inserirEmoji,
    aplicarModeloSugerido,
    restaurarPadrao,
    salvarConfiguracao,
    textoPreview,
    isCopiaGeralAtiva,
    isCopiaPontoAtiva,
    alternarCopiaGeral,
    alternarCopiaPonto,
  } = useWhatsappConfig({
    empresa,
    pontos,
    initialAlvoId,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
    onClose,
  })

  if (!isOpen) return null

  const isGeral = alvoId === 'geral'
  const tituloEscopo = isGeral
    ? 'Escala Completa (Todos os Pontos)'
    : pontoAtual?.nome || 'Ponto de Captação'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl overflow-visible my-auto">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-700 bg-surface-800/90 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-100 truncate flex items-center gap-2">
                Personalizar WhatsApp — {tituloEscopo}
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {isGeral
                  ? 'Texto exibido no topo e rodapé ao copiar a escala de todos os pontos'
                  : 'Endereço, regras e orientações exclusivas ao copiar este ponto'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Seleção de Escopo com Dropdown Customizado e Botões de Visibilidade */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-5 py-3 bg-surface-900/70 border-b border-surface-700/60 relative z-30">
          <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 flex-shrink-0">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Editar mensagem de:</span>
          </label>
          <WhatsappEscopoDropdown
            alvoId={alvoId}
            pontoAtual={pontoAtual}
            pontos={pontos}
            onSelecionarAlvo={mudarAlvo}
            isCopiaGeralAtiva={isCopiaGeralAtiva}
            isCopiaPontoAtiva={isCopiaPontoAtiva}
            onToggleCopiaGeral={alternarCopiaGeral}
            onToggleCopiaPonto={alternarCopiaPonto}
          />
        </div>

        {/* Corpo do Modal com Rolagem */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Botões de Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-900/40 border border-surface-700/50">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Sugestão Rápida:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={aplicarModeloSugerido}
                className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1"
              >
                Inserir Modelo {isGeral ? 'Geral' : 'do Ponto'}
              </button>
              <button
                type="button"
                onClick={restaurarPadrao}
                className="px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-gray-200 bg-surface-700/50 hover:bg-surface-700 rounded-lg transition-colors flex items-center gap-1"
                title="Voltar ao formato padrão automático do sistema"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Padrão
              </button>
            </div>
          </div>

          {/* Campo: Cabeçalho Personalizado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>1. Cabeçalho / Mensagem de Abertura</span>
                <span className="text-gray-500 text-[11px] font-normal">(topo da mensagem)</span>
              </label>
              <span className="text-[11px] text-gray-500">{cabecalho.length} caracteres</span>
            </div>

            {/* Barra de Emojis e Tags Clicáveis */}
            <div className="space-y-1.5 pb-1">
              {/* Emojis Rápidos */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-gray-400 font-semibold mr-0.5">Emojis:</span>
                {['🛑', '⚠️', '📍', '🏢', '📌', '🕐', '📋', '🚀', '👉', '🔥', '📅', '🚨', '✅', '✨'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => inserirEmoji(emoji, 'cabecalho')}
                    className="w-7 h-7 flex items-center justify-center text-sm hover:scale-125 hover:bg-surface-700 active:scale-95 transition-all rounded select-none cursor-pointer"
                    title={`Inserir ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <span className="text-[10px] text-gray-500 font-mono ml-auto hidden sm:inline" title="No Windows, aperte tecla Windows + ponto (.)">
                  💡 Teclado: <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-gray-300">Win</kbd> + <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-gray-300">.</kbd>
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold mr-0.5">Tags:</span>
                <button
                  type="button"
                  onClick={() => inserirTag('{ponto}', 'cabecalho')}
                  className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
                  title="Insere o nome do ponto"
                >
                  {'{ponto}'}
                </button>
                <button
                  type="button"
                  onClick={() => inserirTag('{empresa}', 'cabecalho')}
                  className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
                  title="Insere o nome da empresa"
                >
                  {'{empresa}'}
                </button>
                <button
                  type="button"
                  onClick={() => inserirTag('{capacidade}', 'cabecalho')}
                  className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
                  title="Insere a quantidade de vagas por horário"
                >
                  {'{capacidade}'}
                </button>
                <button
                  type="button"
                  onClick={() => inserirTag('{link}', 'cabecalho')}
                  className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
                  title="Insere o link seguro do app"
                >
                  {'{link}'}
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={cabecalho}
              onChange={(e) => setCabecalho(e.target.value)}
              placeholder={
                isGeral
                  ? 'Ex: 🛑 ATENÇÃO EQUIPE: Escala da semana liberada! Garanta sua vaga pelo app...'
                  : `Ex: Cole aqui o endereço, regras e referências específicas de ${pontoAtual?.nome || 'deste ponto'}...`
              }
              className="input-field text-xs sm:text-sm font-sans w-full py-2.5 px-3 leading-relaxed resize-y min-h-[100px]"
            />
            <p className="text-[11px] text-gray-500">
              Dica: Você pode usar quebras de linha normais e emojis à vontade. Se deixar em branco, usaremos o cabeçalho padrão.
            </p>
          </div>

          {/* Campo: Rodapé / Avisos Extras */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>2. Rodapé / Avisos Finais</span>
                <span className="text-emerald-400 text-[11px] font-normal">(opcional)</span>
              </label>
              <div className="flex items-center gap-1">
                {['⚠️', '🚀', '👉', '📌', 'ℹ️', '✅'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => inserirEmoji(emoji, 'rodape')}
                    className="w-6 h-6 flex items-center justify-center text-xs hover:scale-125 hover:bg-surface-700 transition-all rounded select-none cursor-pointer"
                    title={`Inserir ${emoji} no rodapé`}
                  >
                    {emoji}
                  </button>
                ))}
                <span className="text-[11px] text-gray-500 ml-1">{rodape.length} chars</span>
              </div>
            </div>

            <textarea
              rows={2}
              value={rodape}
              onChange={(e) => setRodape(e.target.value)}
              placeholder="Ex: ⚠️ Em caso de imprevisto, libere sua vaga com antecedência pelo app..."
              className="input-field text-xs sm:text-sm font-sans w-full py-2.5 px-3 leading-relaxed resize-y min-h-[60px]"
            />
          </div>

          {/* Live Preview no WhatsApp */}
          <WhatsappPreviewBubble texto={textoPreview} />
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-surface-700 bg-surface-800/90">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-surface-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvarConfiguracao}
            disabled={saving}
            className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
