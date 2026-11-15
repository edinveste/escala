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
  CalendarClock,
  Clock,
  MapPin,
} from 'lucide-react'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import PontoMobileMenu from './PontoMobileMenu'
import { obterAberturaPonto, formatarDataAberturaCurta } from '../../lib/aberturaHelper'
import { obterLinkGoogleMaps } from '../../lib/mapsHelper'

export default function PontoItem({
  ponto,
  index,
  qtdTurnos = 0,
  info = {},
  empresa = null,
  isFullAdmin = true,
  onToggleAtivo,
  onRename,
  onDelete,
  onDuplicar,
  onLimparEscala,
  onConfigWhatsapp,
  onAgendarAbertura,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingNome, setEditingNome] = useState(ponto.nome)
  const [editingEndereco, setEditingEndereco] = useState(ponto.endereco || '')
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  const temVagas = (info.vagasLivres || 0) > 0
  const infoAbertura = obterAberturaPonto(ponto, empresa)
  const mapsUrl = obterLinkGoogleMaps(ponto.endereco)
  const mapsEditingUrl = obterLinkGoogleMaps(editingEndereco)

  const handleStartEditing = () => {
    setEditingNome(ponto.nome)
    setEditingEndereco(ponto.endereco || '')
    setIsEditing(true)
  }

  const handleSaveRename = async () => {
    if (!editingNome.trim()) return
    const sucesso = await onRename(editingNome, editingEndereco)
    if (sucesso) {
      setIsEditing(false)
    }
  }

  const handleCancelEditing = () => {
    setIsEditing(false)
    setEditingNome(ponto.nome)
    setEditingEndereco(ponto.endereco || '')
  }

  return (
    <div
      data-id={ponto.id}
      className="relative flex items-center justify-between gap-1.5 sm:gap-2 py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl bg-surface-700/50 border border-surface-600/30 hover:border-surface-600 transition-colors select-none"
    >
      {isEditing ? (
        <div className="flex-1 space-y-2 py-1 px-1">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-0.5">
              Nome do Ponto *
            </label>
            <input
              type="text"
              value={editingNome}
              onChange={(e) => setEditingNome(e.target.value)}
              className="input-field py-1.5 px-3 text-sm w-full min-h-[38px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename()
                if (e.key === 'Escape') handleCancelEditing()
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="block text-[11px] font-medium text-gray-400">
                Endereço ou Link do Google Maps (Opcional)
              </label>
              {mapsEditingUrl && (
                <a
                  href={mapsEditingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
                >
                  <GoogleMapsIcon className="w-3 h-3" />
                  Testar no Maps
                </a>
              )}
            </div>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={editingEndereco}
                onChange={(e) => setEditingEndereco(e.target.value)}
                placeholder="Ex: Av. Paulista, 1000 ou link do Maps"
                className="input-field py-1.5 pl-8 pr-3 text-xs w-full min-h-[36px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename()
                  if (e.key === 'Escape') handleCancelEditing()
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancelEditing}
              className="p-1.5 px-2.5 rounded-lg bg-surface-600 text-gray-300 hover:text-gray-100 text-xs flex items-center gap-1 transition-colors"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveRename}
              className="p-1.5 px-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium flex items-center gap-1 transition-colors"
              title="Salvar alterações"
            >
              <Check className="w-3.5 h-3.5" />
              Salvar
            </button>
          </div>
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
              {ponto.endereco && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-gray-200 bg-surface-700/80 hover:bg-surface-600 border border-surface-600/80 hover:border-brand-500/40 px-1.5 py-0.5 rounded-lg inline-flex items-center gap-1.5 transition-colors max-w-[170px] sm:max-w-[240px] truncate shadow-xs"
                  title={`Google Maps: ${ponto.endereco} (clique para testar)`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <GoogleMapsIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{ponto.endereco}</span>
                </a>
              )}
              {infoAbertura.estaAgendado && (
                <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Abre {formatarDataAberturaCurta(infoAbertura.dataAbertura)}
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
                {onAgendarAbertura && (
                  <button
                    type="button"
                    onClick={onAgendarAbertura}
                    className={`p-2 rounded-lg transition-colors ${
                      infoAbertura.estaAgendado
                        ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                        : 'hover:bg-amber-500/10 text-gray-400 hover:text-amber-400'
                    }`}
                    title={
                      infoAbertura.estaAgendado
                        ? `Abertura programada: ${formatarDataAberturaCurta(infoAbertura.dataAbertura)} (clique para alterar)`
                        : 'Programar data e hora de abertura para este ponto'
                    }
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                  </button>
                )}

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
                onAgendarAbertura={onAgendarAbertura}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

