import { CalendarCheck } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'

/**
 * Cabeçalho superior institucional da página do Portal do Gestor.
 */
export default function PortalHeader() {
  return (
    <header className="border-b border-surface-800 bg-surface-900/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <CalendarCheck className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100 flex items-center gap-2">
              Escala<span className="text-brand-400">Fácil</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 select-none">
                Portal do Gestor
              </span>
            </h1>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}

