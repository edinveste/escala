import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Exibe banners de mensagens de erro e sucesso com animações e acessibilidade.
 */
export default function AuthFeedback({ erroMsg, sucessoMsg }) {
  if (!erroMsg && !sucessoMsg) return null

  return (
    <div className="space-y-2" aria-live="polite">
      {erroMsg && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{erroMsg}</span>
        </div>
      )}

      {sucessoMsg && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{sucessoMsg}</span>
        </div>
      )}
    </div>
  )
}

