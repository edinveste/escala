import { useState, useCallback } from 'react'
import { ShieldCheck, Copy, Check, Share2, ExternalLink } from 'lucide-react'

export default function AdminQuickLinkBar({
  shareUrl,
  empresa,
  termos,
  showToast,
  onIrConfiguracoes,
}) {
  const [copiadoRapido, setCopiadoRapido] = useState(false)

  const handleCopiarLinkRapido = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiadoRapido(true)
      showToast?.('Link seguro copiado com sucesso! 📋', 'success')
      setTimeout(() => setCopiadoRapido(false), 2500)
    } catch (err) {
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiadoRapido(true)
      showToast?.('Link seguro copiado com sucesso! 📋', 'success')
      setTimeout(() => setCopiadoRapido(false), 2500)
    }
  }, [shareUrl, showToast])

  const handleCompartilharWhatsAppRapido = useCallback(() => {
    if (!shareUrl || !empresa) return
    const titulo = (termos?.textoWhatsapp || 'ESCALA').replace('📋', '').trim()
    const texto = encodeURIComponent(
      `📋 *${titulo} — ${empresa.nome}*\n\n` +
      `Garanta ou consulte sua vaga em tempo real no nosso link oficial:\n` +
      `👉 ${shareUrl}\n\n` +
      `_Acesso exclusivo para os membros autorizados da equipe._`
    )
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank')
  }, [shareUrl, empresa, termos])

  if (!shareUrl) return null

  return (
    <div className="card bg-surface-800/90 border-surface-700 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 sm:p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs sm:text-sm font-bold text-gray-200 truncate">
              Link Seguro da Escala
            </p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              ● Ativo
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5 select-all">
            {shareUrl}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
        {/* Botão Copiar (Apenas Ícone) */}
        <button
          type="button"
          onClick={handleCopiarLinkRapido}
          className={`p-2.5 rounded-xl border active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0 shadow-sm ${
            copiadoRapido
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-surface-700/60 hover:bg-surface-700 text-gray-200 border-surface-600 hover:border-brand-500/50 hover:text-brand-300'
          }`}
          title={copiadoRapido ? 'Link copiado!' : 'Copiar link da escala'}
          aria-label={copiadoRapido ? 'Link copiado!' : 'Copiar link da escala'}
        >
          {copiadoRapido ? (
            <Check className="w-4 h-4 text-white stroke-[2.5]" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>

        {/* Botão Compartilhar WhatsApp (Apenas Ícone) */}
        <button
          type="button"
          onClick={handleCompartilharWhatsAppRapido}
          className="p-2.5 rounded-xl bg-surface-700/60 hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 border border-surface-600 hover:border-emerald-500/40 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0 shadow-sm"
          title="Compartilhar no WhatsApp da equipe"
          aria-label="Compartilhar no WhatsApp da equipe"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Botão Detalhes / Configurações */}
        {onIrConfiguracoes && (
          <button
            type="button"
            onClick={onIrConfiguracoes}
            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-200 bg-surface-700/60 hover:bg-surface-700 border border-surface-600 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
            title="Gerenciar link seguro nas configurações"
            aria-label="Gerenciar link seguro nas configurações"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

