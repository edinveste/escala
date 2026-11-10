import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Componente de feedback visual para mensagens de erro e sucesso no Portal do Gestor.
 */
export default function PortalFeedback({ erroMsg, sucessoMsg }) {
  return (
    <>
      {erroMsg && (
        <div
          role="alert"
          className="p-3 sm:p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5 animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{erroMsg}</span>
        </div>
      )}

      {sucessoMsg && (
        <div
          role="status"
          className="p-3 sm:p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5 animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{sucessoMsg}</span>
        </div>
      )}
    </>
  )
}

