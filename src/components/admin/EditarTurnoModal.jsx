import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, Check, AlertTriangle } from 'lucide-react'
import { formatarNomeDia } from '../../lib/diasSemana'
import { supabase } from '../../lib/supabaseClient'

export default function EditarTurnoModal({
  modalEditarTurno,
  onClose,
  onDataChanged,
  showToast,
}) {
  const [editHorario, setEditHorario] = useState('')
  const [editCapacidade, setEditCapacidade] = useState(2)
  const [salvandoTurno, setSalvandoTurno] = useState(false)

  useEffect(() => {
    if (modalEditarTurno) {
      setEditHorario(modalEditarTurno.horario || '')
      setEditCapacidade(modalEditarTurno.capacidade || 2)
    }
  }, [modalEditarTurno])

  // Trata tecla Escape e trava scroll do body
  useEffect(() => {
    if (!modalEditarTurno) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvandoTurno) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalEditarTurno, salvandoTurno, onClose])

  const handleConfirmEditarTurno = async (e) => {
    e.preventDefault()
    if (!modalEditarTurno || !editHorario.trim()) return

    const novaCap = Math.max(1, parseInt(editCapacidade, 10) || 1)
    setSalvandoTurno(true)
    try {
      const { error } = await supabase
        .from('turnos')
        .update({
          horario: editHorario.trim(),
          capacidade: novaCap,
        })
        .eq('id', modalEditarTurno.turnoId)

      if (error) throw error

      showToast?.('Horário atualizado com sucesso! ✅', 'success')
      onClose()
      onDataChanged?.()
    } catch (err) {
      console.error('Erro ao editar turno:', err)
      showToast?.('Erro ao atualizar horário.', 'error')
    } finally {
      setSalvandoTurno(false)
    }
  }

  if (!modalEditarTurno) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !salvandoTurno && onClose()}
      />

      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Editar Horário do Turno
              </h3>
              <p className="text-xs text-gray-400">
                <span className="text-brand-600 dark:text-brand-300 font-semibold">
                  {modalEditarTurno.pontoNome}
                </span>{' '}
                • {formatarNomeDia(modalEditarTurno.dia)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !salvandoTurno && onClose()}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
            disabled={salvandoTurno}
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmEditarTurno} className="space-y-4">
          {/* Horário */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              Horário do Turno:
            </label>
            <input
              type="text"
              value={editHorario}
              onChange={(e) => setEditHorario(e.target.value)}
              placeholder="Ex: 08:00 às 12:00"
              className="input-field text-base font-medium"
              autoFocus
              required
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Ex: "08:00 às 12:00", "13h às 17h", "Plantão Manhã"
            </p>
          </div>

          {/* Capacidade */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Capacidade de Vagas neste Horário:
              </label>
              {modalEditarTurno.reservasCount > 0 && (
                <span className="text-[11px] text-amber-400 font-medium">
                  {modalEditarTurno.reservasCount} vaga{modalEditarTurno.reservasCount !== 1 ? 's' : ''} ocupada{modalEditarTurno.reservasCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              max="50"
              value={editCapacidade}
              onChange={(e) => setEditCapacidade(parseInt(e.target.value, 10) || 1)}
              className="input-field text-base font-medium"
              required
            />
            {modalEditarTurno.reservasCount > editCapacidade && (
              <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-medium animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Aviso: A capacidade informada ({editCapacidade}) é menor que o número atual de reservas ({modalEditarTurno.reservasCount}).
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvandoTurno}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoTurno || !editHorario.trim()}
              className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
            >
              {salvandoTurno ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar Alterações
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

