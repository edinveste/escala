import { useState, useEffect, useMemo } from 'react'
import {
  X,
  CalendarClock,
  Clock,
  Sparkles,
  Unlock,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  useAgendamentoAbertura,
  dateToInputValue,
  inputValueToIso,
  gerarDatasAtalhos,
} from './useAgendamentoAbertura'
import AberturaPontosSelector from './AberturaPontosSelector'

/**
 * AgendamentoModal — Modal administrativo para programar a data e hora futura de liberação da escala,
 * com suporte a escopo Global, Grupos de Pontos ou Ponto Individual, input datetime-local touch-friendly,
 * atalhos inteligentes de 1 clique e botão de liberação imediata.
 */
export default function AgendamentoModal({
  isOpen,
  onClose,
  empresa,
  pontos = [],
  alvoPontoId = null,
  termos = {},
  onEmpresaUpdated,
  onDataChanged,
  showToast,
}) {
  const {
    salvando,
    dataInput,
    setDataInput,
    pontosIds,
    setPontosIds,
    pontoAlvo,
    statusAgendamento,
    salvarAgendamento,
    liberarImediatamente,
  } = useAgendamentoAbertura({
    empresa,
    pontos,
    alvoPontoId,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
    onCloseModal: onClose,
  })

  // Fecha ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvando) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, salvando, onClose])

  const atalhos = useMemo(() => (isOpen ? gerarDatasAtalhos() : []), [isOpen])

  // Data mínima permitida para o input: minuto atual
  const minDateTime = useMemo(() => {
    const agora = new Date()
    return dateToInputValue(agora)
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmeter = (e) => {
    e.preventDefault()
    if (!dataInput) {
      showToast?.('Selecione uma data e horário de abertura ou use um dos atalhos.', 'warning')
      return
    }

    const isoDate = inputValueToIso(dataInput)
    salvarAgendamento(isoDate, pontosIds)
  }

  const handleAplicarAtalho = (atalhoDate) => {
    const formatado = dateToInputValue(atalhoDate)
    setDataInput(formatado)
  }

  const dataInputEhFutura = Boolean(
    dataInput && new Date(dataInput).getTime() > Date.now()
  )

  const pontoLabel = termos.ponto || 'Local'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onClose?.()
      }}
    >
      <div className="card w-full max-w-lg bg-surface-900 border-surface-700 shadow-2xl p-5 sm:p-6 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-surface-700/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-500 dark:text-brand-400">
              <CalendarClock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {pontoAlvo ? `Abertura: ${pontoAlvo.nome}` : 'Abertura Programada da Escala'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {pontoAlvo
                  ? `Defina quando as vagas de "${pontoAlvo.nome}" serão liberadas para os corretores`
                  : 'Defina quando as vagas serão liberadas para os corretores'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status atual */}
        {statusAgendamento.agendado ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2.5 text-amber-700 dark:text-amber-300">
            <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-bold">Agendamento ativo:</span> Abertura programada para{' '}
              <span className="font-semibold underline">
                {new Date(statusAgendamento.targetDate).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              . As vagas deste escopo estão bloqueadas para o público no momento.
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300">
            <Unlock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-bold">Escala aberta:</span> As reservas estão liberadas
              imediatamente para todos os colaboradores.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmeter} className="space-y-4">
          {/* Seletor de Escopo de Pontos (Todos vs Específicos vs Fixo) */}
          <AberturaPontosSelector
            pontos={pontos}
            selectedIds={pontosIds}
            onChange={setPontosIds}
            disabled={salvando}
            termos={termos}
            pontoFixoNome={pontoAlvo?.nome}
          />

          {/* Seletor nativo datetime-local adaptado para mobile */}
          <div>
            <label
              htmlFor="escala-datetime-input"
              className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5"
            >
              Data e Hora da Liberação
            </label>
            <div className="relative">
              <input
                id="escala-datetime-input"
                type="datetime-local"
                value={dataInput}
                min={minDateTime}
                onChange={(e) => setDataInput(e.target.value)}
                disabled={salvando}
                className="w-full h-12 px-3.5 rounded-xl border border-surface-600 bg-surface-800 text-gray-100 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-sans"
                required
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Fuso horário do seu dispositivo ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
          </div>

          {/* Atalhos rápidos de 1 clique */}
          <div>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              Atalhos Rápidos de Abertura:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {atalhos.map((at) => (
                <button
                  key={at.id}
                  type="button"
                  onClick={() => handleAplicarAtalho(at.date)}
                  disabled={salvando}
                  className="px-3 py-2.5 rounded-xl border border-surface-600 hover:border-brand-500/50 bg-surface-800/80 hover:bg-surface-700 text-xs font-semibold text-gray-200 transition-all text-center min-h-[44px] flex items-center justify-center active:scale-[0.98]"
                >
                  {at.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botão de Liberação Imediata */}
          {statusAgendamento.agendado && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => liberarImediatamente()}
                disabled={salvando}
                className="w-full py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Unlock className="w-4 h-4" />
                {salvando ? 'Liberando...' : 'Liberar Imediatamente (Cancelar Agendamento)'}
              </button>
            </div>
          )}

          {/* Ações do Formulário */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-surface-700/80">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="btn-ghost w-full sm:w-auto text-sm min-h-[44px] px-4"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando || !dataInputEhFutura}
              className="btn-primary w-full sm:w-auto text-sm min-h-[44px] px-5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar Agendamento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

