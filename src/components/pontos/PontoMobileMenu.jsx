import { Eye, EyeOff, Pencil, Copy, AlertTriangle, Trash2 } from 'lucide-react'

export default function PontoMobileMenu({
  isOpen,
  onClose,
  ponto,
  qtdTurnos,
  onToggleAtivo,
  onStartEditing,
  onDuplicar,
  onLimparEscala,
  onDelete,
}) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop invisível para fechar ao tocar fora */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div className="absolute right-0 top-10 z-40 w-48 py-1.5 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl shadow-black/80 animate-scale-in">
        {/* Alternar visibilidade no menu */}
        <button
          type="button"
          onClick={() => {
            onClose()
            onToggleAtivo()
          }}
          className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
        >
          {ponto.ativo !== false ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              Ocultar dos Corretores
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              Publicar para Corretores
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onClose()
            onStartEditing()
          }}
          className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-brand-400" />
          Renomear
        </button>

        <button
          type="button"
          onClick={() => {
            onClose()
            onDuplicar()
          }}
          className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-emerald-400" />
          Duplicar Ponto
        </button>

        <button
          type="button"
          onClick={() => {
            onClose()
            onLimparEscala()
          }}
          className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Limpar Reservas
        </button>

        <div className="my-1 border-t border-surface-700/80" />

        <button
          type="button"
          onClick={() => {
            onClose()
            onDelete()
          }}
          className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 active:bg-red-500/20 flex items-center gap-2.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir Ponto
        </button>
      </div>
    </>
  )
}

