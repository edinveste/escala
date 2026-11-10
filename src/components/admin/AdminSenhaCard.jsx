import { Key, Lock } from 'lucide-react'

export default function AdminSenhaCard({ isFullAdmin, onAbrirModalSenha }) {
  if (!isFullAdmin) return null

  return (
    <div className="card flex items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
          <Key className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-200 truncate">
            Senha de Administrador
          </h3>
          <p className="text-xs text-gray-400 truncate">
            Altere a senha de acesso administrativo
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAbrirModalSenha}
        className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-1.5 flex-shrink-0 border border-surface-600 hover:border-amber-500/50 hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/40 dark:hover:text-amber-300 transition-all font-semibold"
      >
        <Lock className="w-3.5 h-3.5" />
        Alterar Senha
      </button>
    </div>
  )
}

