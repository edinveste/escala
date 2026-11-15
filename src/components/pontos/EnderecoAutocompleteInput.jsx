import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2, X, Check } from 'lucide-react'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import { buscarSugestoesEndereco } from '../../lib/mapsHelper'

/**
 * EnderecoAutocompleteInput — Campo de endereço com autocompletar inteligente
 * gratuito via OpenStreetMap Nominatim Brasil, sem chaves de API pagas ou cartão.
 *
 * Permite:
 * 1. Digitar e receber sugestões instantâneas de endereços e locais do Brasil.
 * 2. Digitar livremente ou colar URLs de compartilhamento do Google Maps.
 * 3. Navegar com teclado (setas para cima/baixo, Enter e Esc).
 */
export default function EnderecoAutocompleteInput({
  value = '',
  onChange,
  placeholder = 'Ex: Av. Paulista, 1000 ou Shopping Morumbi',
  className = '',
  inputClassName = '',
  maxLength = 250,
  autoFocus = false,
  onKeyDown,
}) {
  const [query, setQuery] = useState(value || '')
  const [sugestoes, setSugestoes] = useState([])
  const [loading, setLoading] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)

  const containerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // Sincroniza query se a prop externa mudar
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
        setIndiceAtivo(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Limpeza de timers e requisições pendentes ao desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  // Dispara busca debounced (350ms)
  const dispararBusca = useCallback((texto) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (abortControllerRef.current) abortControllerRef.current.abort()

    const limpo = (texto || '').trim()
    if (limpo.length < 3 || /^https?:\/\//i.test(limpo)) {
      setSugestoes([])
      setAberto(false)
      setLoading(false)
      setIndiceAtivo(-1)
      return
    }

    setLoading(true)

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const resultados = await buscarSugestoesEndereco(limpo, controller.signal)
        setSugestoes(resultados)
        setAberto(resultados.length > 0)
        setIndiceAtivo(-1)
      } catch {
        setSugestoes([])
        setAberto(false)
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [])

  const handleChange = (e) => {
    const novoValor = e.target.value
    setQuery(novoValor)
    onChange?.(novoValor)
    dispararBusca(novoValor)
  }

  const handleSelecionar = (sugestao) => {
    const enderecoFormatado = sugestao.completo || sugestao.principal
    setQuery(enderecoFormatado)
    onChange?.(enderecoFormatado)
    setSugestoes([])
    setAberto(false)
    setIndiceAtivo(-1)
  }

  const handleLimpar = () => {
    setQuery('')
    onChange?.('')
    setSugestoes([])
    setAberto(false)
    setIndiceAtivo(-1)
  }

  const handleKeyDownInternal = (e) => {
    if (aberto && sugestoes.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndiceAtivo((prev) => (prev < sugestoes.length - 1 ? prev + 1 : 0))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndiceAtivo((prev) => (prev > 0 ? prev - 1 : sugestoes.length - 1))
        return
      }

      if (e.key === 'Enter' && indiceAtivo >= 0) {
        e.preventDefault()
        e.stopPropagation()
        handleSelecionar(sugestoes[indiceAtivo])
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setAberto(false)
        setIndiceAtivo(-1)
        return
      }
    }

    onKeyDown?.(e)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        {/* Ícone no início do input */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <GoogleMapsIcon className="w-4 h-4" />
        </div>

        {/* Campo de texto */}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (sugestoes.length > 0) setAberto(true)
          }}
          onKeyDown={handleKeyDownInternal}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={`input-field w-full text-sm pl-9 pr-9 ${inputClassName}`}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Ícones de ação à direita (Spinner ou Limpar) */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleLimpar}
              className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-surface-700/60 transition-colors"
              title="Limpar campo"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown de sugestões inteligentes */}
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-scale-in">
          <div className="max-h-56 overflow-y-auto divide-y divide-surface-700/60 scrollbar-thin">
            {sugestoes.map((sugestao, idx) => {
              const estaAtivo = idx === indiceAtivo
              return (
                <button
                  key={sugestao.id || idx}
                  type="button"
                  onClick={() => handleSelecionar(sugestao)}
                  onMouseEnter={() => setIndiceAtivo(idx)}
                  className={`w-full text-left p-2.5 px-3 flex items-start gap-2.5 transition-colors ${
                    estaAtivo
                      ? 'bg-brand-500/15 border-l-2 border-brand-500 text-gray-100'
                      : 'hover:bg-surface-700/70 text-gray-200'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold truncate text-gray-100">
                      {sugestao.principal}
                    </p>
                    {sugestao.secundaria && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {sugestao.secundaria}
                      </p>
                    )}
                  </div>
                  {estaAtivo && (
                    <Check className="w-3.5 h-3.5 text-brand-400 mt-1 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Rodapé informativo discreto */}
          <div className="px-3 py-1 text-[10px] text-gray-400 bg-surface-900/70 border-t border-surface-700/60 flex items-center justify-between">
            <span>Sugestões automáticas</span>
            <span className="text-gray-500">OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  )
}
