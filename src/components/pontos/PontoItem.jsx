import { useState } from 'react'
import {
  GripVertical,
  Check,
  X,
  Eye,
  EyeOff,
  Pencil,
  Copy,
  AlertTriangle,
  Trash2,
  MoreVertical,
  MessageSquare,
} from 'lucide-react'
import PontoMobileMenu from './PontoMobileMenu'

export default function PontoItem({
  ponto,
  index,
  qtdTurnos = 0,
  info = {},
  isFullAdmin = true,
  onToggleAtivo,
  onRename,
  onDelete,
  onDuplicar,
  onLimparEscala,
  onConfigWhatsapp,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingNome, setEditingNome] = useState(ponto.nome)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  const temVagas = (info.vagasLivres || 0) > 0

  const handleStartEditing = () => {
    setEditingNome(ponto.nome)
    setIsEditing(true)
  }

  const handleSaveRename = async () => {
    if (!editingNome.trim()) return
    const sucesso = await onRename(editingNome)
    if (sucesso) {
      setIsEditing(false)
    }
  }

  const handleCancelEditing = () => {
    setIsEditing(false)
    setEditingNome(ponto.nome)
  }

  return (
    <div
      data-id={ponto.id}
      className="relative flex items-center justify-between gap-1.5 sm:gap-2 py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl bg-surface-700/50 border border-surface-600/30 hover:border-surface-600 transition-colors select-none"
    >
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2 py-0.5">
          <input
            type="text"
            value={editingNome}
            onChange={(e) => setEditingNome(e.target.value)}
            className="input-field py-1.5 px-3 text-sm flex-1 min-h-[40px]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename()
              if (e.key === 'Escape') handleCancelEditing()
            }}
          />
          <button
            type="button"
            onClick={handleSaveRename}
            className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            title="Salvar"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelEditing}
            className="p-2 rounded-lg bg-surface-600 text-gray-400 hover:text-gray-200 transition-colors"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Pegador de Arrastar Dedicado (Apenas no ícone ⠿) */}
          <div
            className="drag-handle p-1.5 -ml-1 text-gray-500 hover:text-brand-400 active:text-brand-300 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            title="Segure e arraste pelo ícone para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Informações do Ponto (Livre para rolagem normal da página) */}
          <div className="flex-1 min-w-0 pr-1 select-none">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {ponto.nome}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-xs text-gray-400">
                {qtdTurnos} turno{qtdTurnos !== 1 ? 's' : ''}
              </span>
              {info.totalCapacidade > 0 && (
                <span
                  className={`text-xs font-medium ${
                    temVagas
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-red-600 dark:text-red-400 font-semibold'
                  }`}
                >
                  •{' '}
                  {temVagas
                    ? `${info.vagasLivres} vaga${
                        info.vagasLivres !== 1 ? 's' : ''
                      } livre${info.vagasLivres !== 1 ? 's' : ''}`
                    : 'Lotado'}
                </span>
              )}
              <span className="text-[11px] font-semibold text-gray-400 bg-surface-800/80 px-1.5 py-0.5 rounded border border-surface-600/40">
                #{index + 1}
              </span>
            </div>
          </div>

          {/* Botões Inline em Desktop / Telas maiores */}
          <div className="hidden sm:flex items-center gap-0.5 flex-shrink-0">
            {/* Botão de Visibilidade / Olho (Desktop) */}
            <button
              type="button"
              onClick={onToggleAtivo}
              className="p-2 rounded-lg hover:bg-brand-500/10 text-gray-400 hover:text-brand-400 transition-colors"
              title={
                ponto.ativo !== false
                  ? 'Ponto visível aos corretores (clique para ocultar)'
                  : 'Ponto oculto aos corretores (clique para publicar)'
              }
            >
              {ponto.ativo !== false ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Ações Destrutivas / Estruturais (Apenas Administrador) */}
            {isFullAdmin && (
              <>
                {onConfigWhatsapp && (
                  <button
                    type="button"
                    onClick={onConfigWhatsapp}
                    className="p-2 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors"
                    title="Personalizar texto do WhatsApp para este ponto"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="p-2 rounded-lg hover:bg-brand-500/10 text-gray-400 hover:text-brand-400 transition-colors"
                  title="Renomear ponto"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onDuplicar}
                  className="p-2 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors"
                  title={`Duplicar ponto e seus ${qtdTurnos} turnos`}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onLimparEscala}
                  className="p-2 rounded-lg hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-colors"
                  title="Limpar reservas deste ponto"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onDelete}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                  title="Excluir ponto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Ações no Celular (Mobile): Menu ou Botão Direto */}
          {!isFullAdmin ? (
            <button
              type="button"
              onClick={onToggleAtivo}
              className="sm:hidden p-2 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-surface-600/60 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title={
                ponto.ativo !== false
                  ? 'Ponto visível (clique para ocultar)'
                  : 'Ponto oculto (clique para publicar)'
              }
            >
              {ponto.ativo !== false ? (
                <Eye className="w-4 h-4 text-emerald-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-amber-400" />
              )}
            </button>
          ) : (
            <div className="sm:hidden relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setMenuMobileAberto((prev) => !prev)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-surface-600/60 active:bg-surface-600 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Mais opções"
                aria-label="Mais opções"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <PontoMobileMenu
                isOpen={menuMobileAberto}
                onClose={() => setMenuMobileAberto(false)}
                ponto={ponto}
                qtdTurnos={qtdTurnos}
                onToggleAtivo={onToggleAtivo}
                onStartEditing={handleStartEditing}
                onDuplicar={onDuplicar}
                onLimparEscala={onLimparEscala}
                onDelete={onDelete}
                onConfigWhatsapp={onConfigWhatsapp}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

