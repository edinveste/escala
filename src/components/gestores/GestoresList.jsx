import GestorItem from './GestorItem'

/**
 * Lista de membros que possuem acesso de gestão ou convites pendentes.
 */
export default function GestoresList({
  gestores = [],
  loading = false,
  currentUserId,
  onRemoveGestor,
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-gray-400">
        Membros com Acesso de Gestão ({gestores.length}):
      </p>

      {loading ? (
        <div className="text-center py-6 text-xs text-gray-500 animate-pulse flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          <span>Carregando membros da equipe...</span>
        </div>
      ) : gestores.length === 0 ? (
        <div className="text-center py-6 rounded-xl bg-surface-800/40 border border-surface-700/50 text-xs text-gray-500">
          Nenhum gestor ou coordenador vinculado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {gestores.map((g) => {
            const isCurrent = Boolean(g.user_id && g.user_id === currentUserId)
            return (
              <GestorItem
                key={g.id || g.user_id || g.email}
                gestor={g}
                isCurrent={isCurrent}
                onRemove={onRemoveGestor}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

