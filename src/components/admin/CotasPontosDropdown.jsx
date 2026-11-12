import { useState, useRef, useEffect } from 'react'
import { Globe, MapPin, ChevronDown, Check, X } from 'lucide-react'

/**
 * Menu suspenso multi-seleção para o gestor escolher se as cotas por colaborador
 * serão aplicadas a todos os pontos ou apenas a pontos específicos (1, 2, 3, ...).
 */
export default function CotasPontosDropdown({
  pontos = [],
  selectedIds = null,
  onChange,
  disabled = false,
  termos = {},
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
      onChange(listaSelecionados.filter((id) => id !== pontoId))
    } else {
      onChange([...listaSelecionados, pontoId])
    }
  }

  const handleMarcarTodosEspecificos = () => {
    if (pontos.length === 0) return
    onChange(pontos.map((p) => p.id))
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-gray-300">
          Aplicar cotas em:
        </span>
        {!isTodos && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium"
          >
            Aplicar a todos
          </button>
        )}
      </div>

      {/* Gatilho do Menu Suspenso */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto((prev) => !prev)}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700/70 text-gray-100 border transition-all text-xs sm:text-sm font-medium select-none ${
          aberto
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : !isTodos && selecionadosValidos.length === 0
            ? 'border-amber-500/60'
            : 'border-surface-600 hover:border-brand-500/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isTodos ? (
            <Globe className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <MapPin className="w-4 h-4 text-brand-500 dark:text-brand-400 flex-shrink-0" />
          )}
          <span className="truncate">{getTextoGatilho()}</span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            aberto ? 'rotate-180 text-brand-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Flutuante */}
      {aberto && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 bg-surface-800 border border-surface-600 rounded-2xl shadow-2xl z-40 overflow-hidden animate-fade-in divide-y divide-surface-700"
        >
          {/* Opção Global: Todos os Pontos */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={handleSelecionarTodos}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors min-h-[44px] ${
                isTodos
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'hover:bg-surface-700/70 text-gray-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm truncate">Todos os {pontosLabel.toLowerCase()}</p>
                  <p className="text-[10px] text-gray-400 font-normal truncate">
                    Aplica as cotas a toda a escala (inclusive novos locais)
                  </p>
                </div>
              </div>
              {isTodos && <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />}
            </button>
          </div>

          {/* Lista de Pontos Individuais */}
          <div className="p-1.5 space-y-1">
            <div className="flex items-center justify-between px-2.5 py-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Ou escolha {pontosLabel.toLowerCase()} específicos ({pontos.length})
              </span>
              {pontos.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleMarcarTodosEspecificos}
                    className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    Marcar todos
                  </button>
                  {!isTodos && selecionadosValidos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange([])}
                      className="text-gray-400 hover:text-gray-200 font-medium"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>

            {pontos.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3 text-center italic">
                Nenhum {pontoLabel.toLowerCase()} cadastrado ainda.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5">
                {pontos.map((p) => {
                  const marcado = !isTodos && listaSelecionados.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleTogglePonto(p.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors min-h-[44px] ${
                        marcado
                          ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200 border border-brand-500/30 font-semibold'
                          : 'hover:bg-surface-700/70 text-gray-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                            marcado
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-surface-500 bg-surface-900'
                          }`}
                        >
                          {marcado && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <MapPin className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">{p.nome}</span>
                      </div>

                      {p.ativo === false && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-gray-400 border border-surface-600 flex-shrink-0">
                          Oculto
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Rodapé de confirmação do dropdown */}
          <div className="px-3 py-2 bg-surface-900/60 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400">
              {isTodos
                ? 'Aplicado a todos os locais'
                : `${selecionadosValidos.length} selecionado(s)`}
            </span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* Chips dos pontos específicos selecionados */}
      {!isTodos && selecionadosValidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selecionadosValidos.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/25 text-brand-700 dark:text-brand-300 text-[11px] font-medium"
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[180px]">{pontoMap.get(id)?.nome}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleTogglePonto(id)}
                className="p-0.5 rounded hover:bg-brand-500/20 transition-colors"
                aria-label={`Remover ${pontoMap.get(id)?.nome}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!isTodos && selecionadosValidos.length === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          Selecione pelo menos 1 {pontoLabel.toLowerCase()} no menu acima ou escolha &quot;Todos os {pontosLabel.toLowerCase()}&quot;.
        </p>
      )}
    </div>
  )
}

