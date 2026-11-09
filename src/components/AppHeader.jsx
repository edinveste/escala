import { ArrowLeft, CalendarCheck, LogOut } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

/**
 * AppHeader — Barra de navegação superior responsiva da aplicação.
 * Exibe logo, identificador de portal de gestão, alternador de tema e controles de acesso.
 */
export default function AppHeader({
  view,
  isPortalDomain,
  onVoltar,
  onLogout,
}) {
  return (
    <header className="sticky top-0 z-40 bg-surface-900 border-b border-surface-700">
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {view === 'admin' && !isPortalDomain && (
            <button
              onClick={onVoltar}
              className="p-2 -ml-2 rounded-xl hover:bg-surface-700 transition-colors flex-shrink-0"
              aria-label="Voltar para a escala pública"
              title="Voltar para a escala do colaborador (sessão continua ativa)"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
          )}

          <CalendarCheck className="w-6 h-6 text-brand-400 flex-shrink-0" />

          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-100 leading-tight flex items-center gap-1.5">
              <span>
                Escala<span className="text-brand-400">Fácil</span>
              </span>
              {isPortalDomain && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20 select-none">
                  Gestão
                </span>
              )}
            </h1>
          </div>
        </div>

        {view === 'corretor' && (
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <ThemeToggle />
          </div>
        )}

        {view === 'admin' && (
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <ThemeToggle />

            {/* Botão Sair */}
            <button
              onClick={onLogout}
              className="p-2 sm:p-2.5 rounded-xl text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Sair do modo administrador"
              aria-label="Sair do modo administrador"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

