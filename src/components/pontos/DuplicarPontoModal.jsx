import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X } from 'lucide-react'

export default function DuplicarPontoModal({
  modalData,
  onClose,
  onConfirm,
  isDuplicating = false,
  termos = {},
}) {
  const [nomeNovoPonto, setNomeNovoPonto] = useState('')

  useEffect(() => {
    if (modalData?.ponto) {
      setNomeNovoPonto(`${modalData.ponto.nome} (Cópia)`)
    }
  }, [modalData])

  // Bloqueia rolagem do body e fecha no Esc quando modal estiver aberto
  useEffect(() => {
    if (!modalData) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDuplicating) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalData, isDuplicating, onClose])

  if (!modalData) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!nomeNovoPonto.trim() || isDuplicating) return
    onConfirm(nomeNovoPonto)
  }

  const pontoNome = modalData.ponto?.nome || ''
  const totalTurnos = modalData.totalTurnos || 0
  const rotuloPonto = termos.ponto || 'Ponto de Captação'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !isDuplicating && onClose()}
      />

      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Duplicar {rotuloPonto}
              </h3>
              <p className="text-xs text-gray-400">
                Copiando horários de{' '}
                <span className="text-emerald-300 font-medium">{pontoNome}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !isDuplicating && onClose()}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
            disabled={isDuplicating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-surface-900/60 rounded-xl border border-surface-700">
          <p className="text-xs text-gray-300">
            ✨ Serão clonados todos os{' '}
            <strong className="text-emerald-400">{totalTurnos} turnos</strong> (dias,
            horários e capacidades) deste ponto. As reservas iniciarão zeradas para o novo ponto.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              Nome do novo {rotuloPonto.toLowerCase()}:
            </label>
            <input
              type="text"
              value={nomeNovoPonto}
              onChange={(e) => setNomeNovoPonto(e.target.value)}
              placeholder="Ex: Padaria Di Cunto"
              className="input-field text-base font-medium"
              autoFocus
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDuplicating}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isDuplicating || !nomeNovoPonto.trim()}
              className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isDuplicating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Duplicando...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Criar Cópia
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

