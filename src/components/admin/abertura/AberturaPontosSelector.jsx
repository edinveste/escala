import { useState, useRef, useEffect } from 'react'
import { Globe, MapPin, ChevronDown, Check, X } from 'lucide-react'

/**
 * AberturaPontosSelector — Seletor de escopo de pontos para a Abertura Programada:
 * Permite ao gestor aplicar o agendamento a todos os pontos da empresa ou
 * selecionar pontos específicos.
 */
export default function AberturaPontosSelector({
  pontos = [],
  selectedIds = null,
  onChange,
  disabled = false,
  termos = {},
  pontoFixoNome = null, // Caso esteja agendando para 1 ponto específico do gerenciador
}) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef(null)

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

  // Se estiver fixado em 1 ponto específico do gerenciador
  if (pontoFixoNome) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
          Local da Escala
        </label>
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-surface-600 bg-surface-800/80 text-gray-200 text-sm">
          <MapPin className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span className="font-semibold">{pontoFixoNome}</span>
          <span className="text-[11px] ml-auto text-brand-400 font-bold bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
            Abertura Individual
          </span>
        </div>
      </div>
    )
  }

  const isTodos = selectedIds === null
  const listaSelecionados = Array.isArray(selectedIds) ? selectedIds : []
  const pontoMap = new Map(pontos.map((p) => [p.id, p]))
  const selecionadosValidos = listaSelecionados.filter((id) => pontoMap.has(id))

  const pontosLabel = termos.pontos || 'Pontos'
  const pontoLabel = termos.ponto || 'Ponto'

  const getTextoGatilho = () => {
    if (isTodos) {
      return pontos.length > 0
        ? `Todos os ${pontosLabel.toLowerCase()} (${pontos.length})`
        : `Todos os ${pontosLabel.toLowerCase()}`
    }
    if (selecionadosValidos.length === 0) {
      return `Nenhum ${pontoLabel.toLowerCase()} selecionado`
    }
    if (selecionadosValidos.length === 1) {
      return `Somente: ${pontoMap.get(selecionadosValidos[0])?.nome || pontoLabel}`
    }
    return `${selecionadosValidos.length} de ${pontos.length} ${pontosLabel.toLowerCase()} selecionados`
  }

  const handleSelecionarTodos = () => {
    onChange(null)
    setAberto(false)
  }

  const handleTogglePonto = (pontoId) => {
    if (isTodos) {
      onChange([pontoId])
      return
    }

    if (listaSelecionados.includes(pontoId)) {
      const novaLista = listaSelecionados.filter((id) => id !== pontoId)
      // Se desmarcou todos, pode manter array vazio (nenhum) ou o gestor escolhe
      onChange(novaLista)
    } else {
      onChange([...listaSelecionados, pontoId])
    }
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
          Onde aplicar a contagem regressiva:
        </label>
        {!isTodos && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleSelecionarTodos}
            className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-semibold"
          >
            Aplicar a todos
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto((prev) => !prev)}
        className="w-full h-11 px-3.5 rounded-xl border border-surface-600 bg-surface-800 hover:bg-surface-700/80 text-gray-100 text-sm flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <div className="flex items-center gap-2 truncate">
          {isTodos ? (
            <Globe className="w-4 h-4 text-brand-400 shrink-0" />
          ) : (
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="font-semibold text-xs sm:text-sm truncate">
            {getTextoGatilho()}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
            aberto ? 'rotate-180 text-brand-400' : ''
          }`}
        />
      </button>

      {/* Menu dropdown suspenso */}
      {aberto && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-surface-600 bg-surface-800 shadow-xl overflow-hidden animate-scale-up">
          <div className="p-2 border-b border-surface-700/80 bg-surface-850 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Escopo de Bloqueio
            </span>
            <span className="text-[11px] text-gray-400">
              {isTodos ? 'Geral' : `${selecionadosValidos.length} selecionado(s)`}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
            {/* Opção Todos */}
            <button
              type="button"
              onClick={handleSelecionarTodos}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs sm:text-sm transition-colors ${
                isTodos
                  ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                  : 'hover:bg-surface-700 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-brand-400" />
                <span>Todos os {pontosLabel.toLowerCase()} da empresa</span>
              </div>
              {isTodos && <Check className="w-4 h-4 text-brand-400 shrink-0" />}
            </button>

            {/* Separador */}
            {pontos.length > 0 && (
              <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-t border-surface-700/50 mt-1">
                Ou selecione pontos específicos:
              </div>
            )}

            {/* Lista individual por Ponto */}
            {pontos.map((ponto) => {
              const selecionado = !isTodos && listaSelecionados.includes(ponto.id)
              return (
                <button
                  key={ponto.id}
                  type="button"
                  onClick={() => handleTogglePonto(ponto.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs sm:text-sm transition-colors ${
                    selecionado
                      ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                      : 'hover:bg-surface-700 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        selecionado
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'border-surface-500 bg-surface-900'
                      }`}
                    >
                      {selecionado && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">{ponto.nome}</span>
                  </div>

                  {ponto.escala_abre_em && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0 ml-2">
                      Individual
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-2 border-t border-surface-700/80 bg-surface-850 flex justify-end">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-brand-400 hover:text-brand-300 font-bold px-3 py-1 rounded hover:bg-surface-700 transition-colors"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

