import { Shield, UserCheck, Trash2, Clock } from 'lucide-react'

/**
 * Card individual representando um Administrador, Coordenador ou Convite Pendente.
 */
export default function GestorItem({
  gestor,
  isCurrent = false,
  onRemove,
}) {
  const isPendente = Boolean(gestor.pendente)
  const isAdmin = gestor.role === 'admin'
  const inicial = (gestor.nome || gestor.email || 'U').charAt(0).toUpperCase()

  return (
    <div
      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
        isPendente
          ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30'
          : 'bg-surface-800/60 border-surface-700/70 hover:border-surface-600'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar com a inicial do membro */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border select-none ${
            isPendente
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : isAdmin
              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {inicial}
        </div>

        {/* Dados e Badges de Identificação */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {gestor.nome || gestor.email}
            </p>

            {isCurrent && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-700 text-gray-300 border border-surface-600 select-none">
                Você
              </span>
            )}

            {isPendente ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 select-none">
                <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                Convite Pendente (Aguardando Cadastro)
              </span>
            ) : isAdmin ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1 select-none">
                <Shield className="w-3 h-3 text-brand-400 flex-shrink-0" />
                Administrador
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 select-none">
                <UserCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                Gestor da Escala
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 truncate mt-0.5">
            {gestor.email}
          </p>
        </div>
      </div>

      {/* Ação de remoção / cancelamento (desabilitado para si mesmo para evitar lock-out) */}
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onRemove?.(gestor)}
          className="p-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all flex-shrink-0"
          title={isPendente ? 'Cancelar este convite' : 'Remover acesso deste gestor'}
          aria-label={isPendente ? 'Cancelar convite' : 'Remover gestor'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

