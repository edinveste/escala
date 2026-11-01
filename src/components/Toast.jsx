import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES = {
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  error: 'bg-red-500/15 border-red-500/30 text-red-300',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  info: 'bg-brand-500/15 border-brand-500/30 text-brand-300',
}

export default function Toast({ message, type = 'success', onClose }) {
  const Icon = ICONS[type] || ICONS.info
  const style = STYLES[type] || STYLES.info

  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] flex justify-center pointer-events-none">
      <div
        className={`animate-slide-up pointer-events-auto max-w-md w-full flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg ${style}`}
        onClick={onClose}
        role="alert"
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{message}</p>
      </div>
    </div>
  )
}

