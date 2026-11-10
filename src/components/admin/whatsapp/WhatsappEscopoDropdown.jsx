import { useState, useRef, useEffect } from 'react'
import {
  Globe,
  MapPin,
  ChevronDown,
  Eye,
  EyeOff,
  Check,
  Sparkles,
} from 'lucide-react'

/**
 * WhatsappEscopoDropdown — Menu suspenso customizado para seleção do escopo da mensagem
 * com alternador integrado de visibilidade do botão "Copiar Escala" para cada item (Geral e Pontos).
 */
export default function WhatsappEscopoDropdown({
  alvoId,
  pontoAtual,
  pontos = [],
  onSelecionarAlvo,
  isCopiaGeralAtiva,
  isCopiaPontoAtiva,
  onToggleCopiaGeral,
  onToggleCopiaPonto,
}) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef(null)

  // Fecha o dropdown ao clicar fora ou apertar Escape
  useEffect(() => {
    function handleClickFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setAberto(false)
      }
    }

    if (aberto) {
      document.addEventListener('mousedown', handleClickFora)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickFora)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [aberto])

  const isGeral = alvoId === 'geral'
  const statusCopiaAtual = isGeral ? isCopiaGeralAtiva : isCopiaPontoAtiva(alvoId)

  const handleEscolher = (id) => {
    onSelecionarAlvo(id)
    setAberto(false)
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      {/* Botão Gatilho (Trigger do Menu Suspenso) */}
      <button
        type="button"
        onClick={() => setAberto((prev) => !prev)}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        className="w-full sm:w-auto min-w-[280px] max-w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-surface-800 hover:bg-surface-750 text-gray-100 border border-surface-600 hover:border-emerald-500/50 shadow-sm transition-all text-xs sm:text-sm font-semibold select-none group"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isGeral ? (
            <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span className="truncate">
            {isGeral
              ? 'Escala Completa (Todos os Pontos)'
              : pontoAtual?.nome || 'Ponto de Captação'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Indicador de Status da Cópia no Gatilho */}
          <span
            title={
              statusCopiaAtual
                ? 'Botão "Copiar Escala" visível aos corretores'
                : 'Botão "Copiar Escala" oculto aos corretores'
            }
            className={`p-1 rounded-md text-[11px] flex items-center ${
              statusCopiaAtual
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-amber-400 bg-amber-500/10'
            }`}
          >
            {statusCopiaAtual ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </span>

          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              aberto ? 'rotate-180 text-emerald-400' : 'group-hover:text-gray-200'
            }`}
          />
        </div>
      </button>

      {/* Menu Suspenso Flutuante (Dropdown) */}
      {aberto && (
        <div
          role="listbox"
          className="absolute right-0 left-0 sm:left-auto top-full mt-1.5 sm:w-88 w-full max-w-sm bg-surface-850/98 backdrop-blur-md border border-surface-600 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in divide-y divide-surface-700/60"
        >
          {/* Seção 1: Escala Completa (Geral) */}
          <div className="p-1.5">
            <div
              onClick={() => handleEscolher('geral')}
              className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                isGeral
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'hover:bg-surface-700/60 text-gray-200 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm truncate">
                    Escala Completa (Geral)
                  </p>
                  <p className="text-[10px] text-gray-400 font-normal">
                    Todos os pontos consolidados
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Botão de Olho para a Escala Geral */}
                <button
                  type="button"
                  onClick={(e) => onToggleCopiaGeral(e)}
                  title={
                    isCopiaGeralAtiva
                      ? 'Botão "Copiar Escala Completa" visível aos corretores (clique para ocultar)'
                      : 'Botão "Copiar Escala Completa" oculto aos corretores (clique para exibir)'
                  }
                  className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                    isCopiaGeralAtiva
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {isCopiaGeralAtiva ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Seção 2: Pontos de Captação Individuais */}
          {pontos.length > 0 && (
            <div className="p-1.5 space-y-0.5">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Pontos de Captação ({pontos.length})
              </div>

              <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
                {pontos.map((p) => {
                  const isSelecionado = alvoId === p.id
                  const copiaAtiva = isCopiaPontoAtiva(p.id)
                  const temTextoCustom = Boolean(p.cabecalho_whatsapp?.trim())

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleEscolher(p.id)}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        isSelecionado
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'hover:bg-surface-700/60 text-gray-200 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm truncate">
                            {p.nome}
                          </p>
                          {temTextoCustom && (
                            <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                              ✓ Personalizado
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Botão de Olho para este Ponto Individual */}
                        <button
                          type="button"
                          onClick={(e) => onToggleCopiaPonto(p.id, e)}
                          title={
                            copiaAtiva
                              ? `Botão "Copiar Escala — ${p.nome}" visível aos corretores (clique para ocultar)`
                              : `Botão "Copiar Escala — ${p.nome}" oculto aos corretores (clique para exibir)`
                          }
                          className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                            copiaAtiva
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {copiaAtiva ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rodapé explicativo do Dropdown */}
          <div className="px-3 py-2 bg-surface-900/80 text-[10px] text-gray-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-emerald-400" /> Cópia liberada
            </span>
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3 h-3 text-amber-400" /> Cópia oculta no app
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

