import { useState, useEffect, useCallback, useMemo } from 'react'
import { MessageSquare, Sparkles, RotateCcw, Save, X } from 'lucide-react'
import WhatsappPreviewBubble from '../admin/whatsapp/WhatsappPreviewBubble'
import { processarTagsWhatsapp } from '../corretor/escalaTextoHelper'

export default function PontoWhatsappModal({
  isOpen,
  onClose,
  ponto,
  empresa,
  onSave,
}) {
  const [cabecalho, setCabecalho] = useState('')
  const [rodape, setRodape] = useState('')
  const [saving, setSaving] = useState(false)

  // Sincroniza dados do ponto ao abrir
  useEffect(() => {
    if (isOpen && ponto) {
      setCabecalho(ponto.cabecalho_whatsapp || '')
      setRodape(ponto.rodape_whatsapp || '')
    }
  }, [isOpen, ponto])

  // Inserir tag no campo selecionado
  const inserirTag = useCallback((tag, campo = 'cabecalho') => {
    if (campo === 'cabecalho') {
      setCabecalho((prev) => (prev ? `${prev} ${tag}` : tag))
    } else {
      setRodape((prev) => (prev ? `${prev} ${tag}` : tag))
    }
  }, [])

  // Modelo sugerido inspirado no caso de uso real de plantão imobiliário
  const aplicarModeloSugerido = useCallback(() => {
    const nomePonto = ponto?.nome || 'PONTO DE CAPTAÇÃO'
    setCabecalho(
      `🛑🛑🛑🛑🛑🛑🛑\n` +
      `! ! ! ATENÇÃO ! ! !\n\n` +
      `🏢 EMPREENDIMENTO: \n` +
      `📍 Ponto de Captação: ${nomePonto.toUpperCase()}\n` +
      `📌 Endereço: \n` +
      `⚠️ Capacidade: {capacidade}\n\n` +
      `IMPORTANTE:\n` +
      `Garanta ou consulte sua vaga diretamente pelo app no link abaixo. Não copie e cole!`
    )
    setRodape(
      `⚠️ Em caso de imprevisto, libere sua vaga com antecedência pelo app.`
    )
  }, [ponto])

  // Restaura o formato automático
  const restaurarPadrao = useCallback(() => {
    setCabecalho('')
    setRodape('')
  }, [])

  // Texto simulado para prévia em tempo real
  const textoPreview = useMemo(() => {
    if (!ponto) return ''
    const nomeEmp = empresa?.nome || 'Minha Imobiliária'
    const linkExemplo = window.location.origin

    let txt = ''
    if (cabecalho.trim()) {
      txt += processarTagsWhatsapp(cabecalho, {
        empresaNome: nomeEmp,
        pontoNome: ponto.nome,
        capacidade: '2 por horário',
        shareUrl: linkExemplo,
      })
      txt += '\n\n━━━━━━━━━━━━━━━━━━\n\n'
    } else {
      txt += `📋 *ESCALA DE CAPTAÇÃO — ${nomeEmp.toUpperCase()} (2 por horário)*\n`
      txt += '━━━━━━━━━━━━━━━━━━\n\n'
      txt += `📍 *${ponto.nome.toUpperCase()}*\n\n`
    }

    txt += `📅 *SEGUNDA-FEIRA*\n\n`
    txt += `🕐 08:00 às 10:00\n   → CARLOS SILVA / MARIANA SOUZA\n`
    txt += `🕐 10:00 às 12:00\n   → _vago_\n\n`

    if (rodape.trim()) {
      txt += `━━━━━━━━━━━━━━━━━━\n`
      txt += `${processarTagsWhatsapp(rodape, {
        empresaNome: nomeEmp,
        pontoNome: ponto.nome,
        capacidade: '2 por horário',
        shareUrl: linkExemplo,
      })}\n\n`
    }

    txt += `━━━━━━━━━━━━━━━━━━\n`
    txt += `🔗 *GARANTA SUA VAGA*: ${linkExemplo}`

    return txt
  }, [cabecalho, rodape, ponto, empresa])

  const handleSalvar = async () => {
    if (!ponto?.id) return
    setSaving(true)
    try {
      const ok = await onSave(ponto.id, cabecalho, rodape)
      if (ok) {
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !ponto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-700 bg-surface-800/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                Texto do WhatsApp — {ponto.nome}
              </h3>
              <p className="text-xs text-gray-400">
                Endereço, regras e orientações exclusivas ao copiar este ponto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Rolagem */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-900/40 border border-surface-700/50">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Sugestão de Plantão:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={aplicarModeloSugerido}
                className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1"
              >
                Inserir Modelo Completo
              </button>
              <button
                type="button"
                onClick={restaurarPadrao}
                className="px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-gray-200 bg-surface-700/50 hover:bg-surface-700 rounded-lg transition-colors flex items-center gap-1"
                title="Limpar e usar o cabeçalho padrão do sistema"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Padrão
              </button>
            </div>
          </div>

          {/* Campo: Cabeçalho do Ponto */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>Cabeçalho do Ponto</span>
                <span className="text-gray-500 text-[11px] font-normal">(topo da mensagem)</span>
              </label>
              <span className="text-[11px] text-gray-500">{cabecalho.length} caracteres</span>
            </div>

            {/* Tags Clicáveis */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-[10px] text-gray-400">Inserir tag:</span>
              <button
                type="button"
                onClick={() => inserirTag('{ponto}', 'cabecalho')}
                className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
              >
                {'{ponto}'}
              </button>
              <button
                type="button"
                onClick={() => inserirTag('{empresa}', 'cabecalho')}
                className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
              >
                {'{empresa}'}
              </button>
              <button
                type="button"
                onClick={() => inserirTag('{capacidade}', 'cabecalho')}
                className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
              >
                {'{capacidade}'}
              </button>
              <button
                type="button"
                onClick={() => inserirTag('{link}', 'cabecalho')}
                className="px-2 py-0.5 text-[11px] font-mono bg-surface-700 hover:bg-brand-500/20 hover:text-brand-300 text-gray-300 rounded border border-surface-600 transition-colors"
              >
                {'{link}'}
              </button>
            </div>

            <textarea
              rows={5}
              value={cabecalho}
              onChange={(e) => setCabecalho(e.target.value)}
              placeholder="Cole aqui o texto com emojis, endereço do ponto, referências e orientações da equipe..."
              className="input-field text-xs sm:text-sm font-sans w-full py-2.5 px-3 leading-relaxed resize-y min-h-[110px]"
            />
          </div>

          {/* Campo: Rodapé do Ponto */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>Rodapé / Avisos Extras</span>
                <span className="text-emerald-400 text-[11px] font-normal">(opcional)</span>
              </label>
              <span className="text-[11px] text-gray-500">{rodape.length} caracteres</span>
            </div>

            <textarea
              rows={2}
              value={rodape}
              onChange={(e) => setRodape(e.target.value)}
              placeholder="Ex: Em caso de chuva ou imprevistos, avisar o coordenador..."
              className="input-field text-xs sm:text-sm font-sans w-full py-2.5 px-3 leading-relaxed resize-y min-h-[60px]"
            />
          </div>

          {/* Prévia no WhatsApp */}
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
            onClick={handleSalvar}
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

