import { MessageSquare, SlidersHorizontal, Check } from 'lucide-react'

export default function WhatsappConfigCard({
  empresa,
  isFullAdmin,
  onAbrirModalWhatsapp,
}) {
  if (!isFullAdmin) return null

  const isCustomizado = Boolean(
    empresa?.msg_whatsapp_geral?.trim() || empresa?.termos?.msgWhatsappGeral?.trim()
  )

  return (
    <div className="card flex items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-200 truncate flex items-center gap-2">
            Mensagens do WhatsApp
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isCustomizado
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                  : 'bg-surface-700 text-gray-400 border-surface-600'
              }`}
            >
              {isCustomizado ? '● Personalizado' : 'Automático'}
            </span>
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {isCustomizado
              ? 'Cabeçalho e avisos customizados da escala completa'
              : 'Personalize o cabeçalho e avisos da escala de WhatsApp'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAbrirModalWhatsapp}
        className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-1.5 flex-shrink-0 border border-surface-600 hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300 transition-all font-semibold"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Personalizar
      </button>
    </div>
  )
}

