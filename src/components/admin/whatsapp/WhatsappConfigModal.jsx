import { useState, useEffect } from 'react'
import { MessageSquare, RotateCcw, Save, X, MapPin } from 'lucide-react'
import WhatsappPreviewBubble from './WhatsappPreviewBubble'
import WhatsappEscopoDropdown from './WhatsappEscopoDropdown'
import { useWhatsappConfig } from './useWhatsappConfig'
import { TAGS_WHATSAPP } from './whatsappTextHelper'

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
  const [showModalHelpEmojis, setShowModalHelpEmojis] = useState(false)
  const [campoFoco, setCampoFoco] = useState('cabecalho')

  const {
    cabecalhoRef,
    rodapeRef,
    registrarSelecao,
    alvoId,
    pontoAtual,
    mudarAlvo,
    drafts,
    cabecalho,
    setCabecalho,
    rodape,
    setRodape,
    saving,
    inserirTag,
    restaurarPadrao,
    salvarConfiguracao,
    textoPreview,
    isCopiaGeralAtiva,
    isCopiaPontoAtiva,
    alternarCopiaGeral,
    alternarCopiaPonto,
  } = useWhatsappConfig({
    isOpen,
    empresa,
    pontos,
    initialAlvoId,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
    onClose,
  })

  useEffect(() => {
    if (isOpen) {
      setCampoFoco('cabecalho')
    }
  }, [isOpen])

  if (!isOpen) return null

  const getTextareaBinding = (campo, ref, value, onChangeValue) => ({
    ref,
    value,
    onFocus: (e) => {
      setCampoFoco(campo)
      registrarSelecao(campo, e.target)
    },
    onClick: (e) => registrarSelecao(campo, e.target),
    onKeyUp: (e) => registrarSelecao(campo, e.target),
    onSelect: (e) => registrarSelecao(campo, e.target),
    onBlur: (e) => registrarSelecao(campo, e.target),
    onChange: (e) => {
      onChangeValue(e.target.value)
      registrarSelecao(campo, e.target)
    },
  })

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
            empresa={empresa}
            drafts={drafts}
            onSelecionarAlvo={mudarAlvo}
            isCopiaGeralAtiva={isCopiaGeralAtiva}
            isCopiaPontoAtiva={isCopiaPontoAtiva}
            onToggleCopiaGeral={alternarCopiaGeral}
            onToggleCopiaPonto={alternarCopiaPonto}
          />
        </div>

        {/* Corpo do Modal com Rolagem */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Campo: Cabeçalho Personalizado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>1. Cabeçalho / Mensagem de Abertura</span>
                <span className="text-gray-500 text-[11px] font-normal">(topo da mensagem)</span>
              </label>
              <span className="text-[11px] text-gray-500">{cabecalho.length} caracteres</span>
            </div>

            {/* Tags Clicáveis, Botão de Emojis para PC & Botão Restaurar Padrão */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-[10px] text-gray-400 font-semibold mr-0.5">Inserir Tag:</span>
              {TAGS_WHATSAPP.map(({ tag, title }) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => inserirTag(tag, campoFoco)}
                  className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
                  title={title}
                >
                  {tag}
                </button>
              ))}

              {/* Botão de Emojis exclusivo para PC (oculto no celular) */}
              <button
                type="button"
                onClick={() => setShowModalHelpEmojis(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 transition-all active:scale-95 ml-1"
                title="Ver como abrir a janela de emojis no teclado do computador"
              >
                <span>😀</span>
                <span>Emojis no PC</span>
              </button>

              {/* Botão Restaurar Padrão */}
              <button
                type="button"
                onClick={restaurarPadrao}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-gray-300 hover:text-gray-100 bg-surface-700/60 hover:bg-surface-700 rounded border border-surface-600 transition-all active:scale-95 ml-auto sm:ml-1"
                title="Restaurar campos para o modelo padrão do sistema"
              >
                <RotateCcw className="w-3 h-3 text-gray-400" />
                <span>Restaurar Padrão</span>
              </button>
            </div>

            <textarea
              rows={5}
              {...getTextareaBinding('cabecalho', cabecalhoRef, cabecalho, setCabecalho)}
              placeholder={
                isGeral
                  ? 'Ex: 📋 *ESCALA DE CAPTAÇÃO — {empresa} ({capacidade})*\n━━━━━━━━━━━━━━━━━━'
                  : `Ex: 📋 *ESCALA DE CAPTAÇÃO — {empresa} ({capacidade})*\n━━━━━━━━━━━━━━━━━━\n\n📍 *{ponto}*`
              }
              className="input-field text-xs sm:text-sm font-sans w-full py-2.5 px-3 leading-relaxed resize-y min-h-[100px]"
            />
            <p className="text-[11px] text-gray-400">
              💡 O cabeçalho já vem preenchido com o modelo padrão. Você pode editar os dizeres, adicionar o endereço ou regras do ponto à vontade.
            </p>
          </div>

          {/* Campo: Rodapé / Final da Mensagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>2. Rodapé / Final da Mensagem</span>
                <span className="text-emerald-400 text-[11px] font-normal">(com link de reserva)</span>
              </label>
              <span className="text-[11px] text-gray-500">{rodape.length} caracteres</span>
            </div>

            <textarea
              rows={3}
              {...getTextareaBinding('rodape', rodapeRef, rodape, setRodape)}
              placeholder="Ex: 🔗 *GARANTA SUA VAGA*: {link}"
              className="input-field text-xs sm:text-sm font-sans w-full py-2.5 px-3 leading-relaxed resize-y min-h-[70px]"
            />
            <p className="text-[11px] text-gray-400">
              💡 O rodapé já inclui a tag <code className="text-emerald-400 font-mono font-semibold">{'{link}'}</code> com o link oficial da sua escala. Você pode escrever avisos adicionais acima ou abaixo dela.
            </p>
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

      {/* Modal Explicativo: Como Inserir Emojis no PC */}
      {showModalHelpEmojis && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModalHelpEmojis(false)
          }}
        >
          <div className="w-full max-w-sm bg-surface-800 border border-surface-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl select-none">
                  😀
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-100">Emojis no Computador</h4>
                  <p className="text-xs text-gray-400">Atalhos rápidos do teclado</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModalHelpEmojis(false)}
                className="p-1 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo Explicativo */}
            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="p-3 rounded-2xl bg-surface-900 border border-surface-700/80 space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                  <span>💻 Teclado Windows</span>
                  <span className="text-[11px] text-amber-400 font-mono">Win + .</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Pressione a tecla <kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-gray-200 font-mono border border-surface-600 font-semibold shadow-xs">Windows</kbd> junto com o ponto final <kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-gray-200 font-mono border border-surface-600 font-semibold shadow-xs">.</kbd>
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-surface-900 border border-surface-700/80 space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                  <span>🍎 Teclado Mac (Apple)</span>
                  <span className="text-[11px] text-amber-400 font-mono">Ctrl + Cmd + Espaço</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Pressione <kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-gray-200 font-mono border border-surface-600 font-semibold shadow-xs">Control</kbd> + <kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-gray-200 font-mono border border-surface-600 font-semibold shadow-xs">Command ⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-surface-800 rounded text-gray-200 font-mono border border-surface-600 font-semibold shadow-xs">Espaço</kbd>
                </p>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                💡 O seu próprio computador abrirá a tela nativa com todos os emojis para você escolher e inserir no texto.
              </p>
            </div>

            {/* Ação */}
            <button
              type="button"
              onClick={() => setShowModalHelpEmojis(false)}
              className="w-full btn-secondary py-2.5 text-xs font-semibold rounded-xl"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
