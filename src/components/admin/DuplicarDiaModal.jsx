import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X, Check } from 'lucide-react'
import {
  DIAS_SEMANA,
  DIAS_UTEIS,
  DIAS_FIM_DE_SEMANA,
  formatarNomeDia,
} from '../../lib/diasSemana'
import { supabase } from '../../lib/supabaseClient'

const DIAS_OPCOES = DIAS_SEMANA

export default function DuplicarDiaModal({
  modalDuplicar,
  onClose,
  empresaId,
  onDataChanged,
  showToast,
}) {
  const diaOrigem = modalDuplicar?.diaOrigem
  const [diasDestino, setDiasDestino] = useState([])
  const [duplicando, setDuplicando] = useState(false)

  // Inicializa com todos os outros dias marcados ao abrir
  useEffect(() => {
    if (modalDuplicar && diaOrigem) {
      setDiasDestino(DIAS_OPCOES.filter((d) => d !== diaOrigem))
    }
  }, [modalDuplicar, diaOrigem])

  // Trata tecla Escape e trava scroll
  useEffect(() => {
    if (!modalDuplicar) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !duplicando) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalDuplicar, duplicando, onClose])

  const toggleDiaDestino = useCallback((dia) => {
    const diaNorm = formatarNomeDia(dia)
    setDiasDestino((prev) =>
      prev.includes(diaNorm) ? prev.filter((d) => d !== diaNorm) : [...prev, diaNorm]
    )
  }, [])

  const selecionarPresetDias = useCallback(
    (tipo) => {
      if (!modalDuplicar) return
      if (tipo === 'todos') {
        const outros = DIAS_OPCOES.filter((d) => d !== diaOrigem)
        setDiasDestino(diasDestino.length === outros.length ? [] : outros)
      } else if (tipo === 'uteis') {
        const uteis = DIAS_UTEIS.filter((d) => d !== diaOrigem)
        setDiasDestino(uteis)
      } else if (tipo === 'fimdesemana') {
        const fds = DIAS_FIM_DE_SEMANA.filter((d) => d !== diaOrigem)
        setDiasDestino(fds)
      }
    },
    [modalDuplicar, diaOrigem, diasDestino]
  )

  const executarDuplicacao = useCallback(async () => {
    if (!modalDuplicar || diasDestino.length === 0) {
      showToast?.('Selecione pelo menos um dia de destino.', 'warning')
      return
    }

    setDuplicando(true)
    try {
      const novosTurnos = []
      for (const dia of diasDestino) {
        for (const t of modalDuplicar.turnos) {
          novosTurnos.push({
            ponto_id: modalDuplicar.pontoId,
            dia: formatarNomeDia(dia),
            horario: t.horario,
            capacidade: t.capacidade,
            ordem: t.ordem,
            ...(empresaId ? { empresa_id: empresaId } : {}),
          })
        }
      }

      const { error } = await supabase.from('turnos').insert(novosTurnos)
      if (error) throw error

      showToast?.(
        `Turnos de ${modalDuplicar.diaOrigem} duplicados para ${diasDestino.length} dia(s)! ✅`,
        'success'
      )
      onClose()
      onDataChanged?.()
    } catch (err) {
      console.error('Erro ao duplicar turnos:', err)
      showToast?.('Erro ao duplicar turnos.', 'error')
    } finally {
      setDuplicando(false)
    }
  }, [modalDuplicar, diasDestino, empresaId, onDataChanged, showToast, onClose])

  if (!modalDuplicar) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !duplicando && onClose()}
      />

      <div className="relative w-full max-w-lg bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Duplicar Horários de {modalDuplicar.diaOrigem}
              </h3>
              <p className="text-xs text-gray-400">
                Ponto:{' '}
                <span className="text-brand-600 dark:text-brand-300 font-semibold">
                  {modalDuplicar.pontoNome}
                </span>{' '}
                ({modalDuplicar.turnos.length} turno{modalDuplicar.turnos.length !== 1 ? 's' : ''})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !duplicando && onClose()}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
            disabled={duplicando}
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pré-visualização dos horários que serão copiados */}
        <div className="mb-4 p-3 bg-surface-900/60 rounded-xl border border-surface-700">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Horários que serão replicados:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {modalDuplicar.turnos.map((t) => (
              <span
                key={t.id}
                className="text-xs bg-surface-700 text-gray-300 px-2.5 py-1 rounded-lg border border-surface-600 font-medium"
              >
                {t.horario} ({t.capacidade} vaga{t.capacidade !== 1 ? 's' : ''})
              </span>
            ))}
          </div>
        </div>

        {/* Atalhos rápidos de seleção */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-300 mb-2">
            Para quais dias deseja duplicar?
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => selecionarPresetDias('todos')}
              className="text-xs bg-surface-700 hover:bg-surface-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-medium border border-surface-600"
            >
              {diasDestino.length ===
              DIAS_OPCOES.filter((d) => d !== modalDuplicar.diaOrigem).length
                ? 'Desmarcar Todos'
                : 'Marcar Todos'}
            </button>
            <button
              type="button"
              onClick={() => selecionarPresetDias('uteis')}
              className="text-xs bg-surface-700 hover:bg-surface-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-medium border border-surface-600"
            >
              Seg a Sex
            </button>
            <button
              type="button"
              onClick={() => selecionarPresetDias('fimdesemana')}
              className="text-xs bg-surface-700 hover:bg-surface-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-medium border border-surface-600"
            >
              Fim de Semana
            </button>
          </div>
        </div>

        {/* Lista de dias para seleção */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {DIAS_OPCOES.filter((dia) => dia !== modalDuplicar.diaOrigem).map((dia) => {
            const isSelected = diasDestino.includes(dia)
            return (
              <button
                key={dia}
                type="button"
                onClick={() => toggleDiaDestino(dia)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                  isSelected
                    ? 'bg-brand-500/15 border-brand-500/50 text-brand-700 dark:text-brand-200 font-semibold'
                    : 'bg-surface-700/50 border-surface-600 text-gray-400 hover:bg-surface-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    isSelected
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-surface-500 bg-surface-800'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{dia}</span>
              </button>
            )
          })}
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={duplicando}
            className="btn-ghost flex-1 py-3 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={executarDuplicacao}
            disabled={duplicando || diasDestino.length === 0}
            className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
          >
            {duplicando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Duplicar para {diasDestino.length} dia{diasDestino.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

