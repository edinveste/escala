import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, Check, AlertTriangle, Clock, RotateCcw } from 'lucide-react'
import { formatarNomeDia } from '../../lib/diasSemana'
import { supabase } from '../../lib/supabaseClient'
import { isMissingColumnError } from '../../lib/supabasePublicHelper'
import {
  normalizarTimeInput,
  normalizarTimeSql,
  parseHorarioTexto,
  formatarHorarioTurno,
  cruzaMeiaNoite,
} from '../../lib/horarioHelper'

export default function EditarTurnoModal({
  modalEditarTurno,
  onClose,
  onDataChanged,
  showToast,
}) {
  const [editHoraInicio, setEditHoraInicio] = useState('')
  const [editHoraFim, setEditHoraFim] = useState('')
  const [editHorario, setEditHorario] = useState('')
  const [personalizarTexto, setPersonalizarTexto] = useState(false)
  const [editCapacidade, setEditCapacidade] = useState(2)
  const [salvandoTurno, setSalvandoTurno] = useState(false)

  useEffect(() => {
    if (modalEditarTurno) {
      let ini = normalizarTimeInput(modalEditarTurno.hora_inicio)
      let fim = normalizarTimeInput(modalEditarTurno.hora_fim)
      const textoOriginal = (modalEditarTurno.horario || '').trim()

      if (!ini || !fim) {
        const parsed = parseHorarioTexto(textoOriginal)
        if (parsed) {
          ini = parsed.horaInicio
          fim = parsed.horaFim
        }
      }

      setEditHoraInicio(ini)
      setEditHoraFim(fim)
      setEditHorario(textoOriginal)
      setEditCapacidade(modalEditarTurno.capacidade || 2)

      // Se não foi possível extrair horários ou o rótulo contém texto extra (ex: "Plantão Manhã"),
      // mantém o campo de texto visível para o usuário editar livremente
      const padraoAuto = formatarHorarioTurno(ini, fim)
      const temTextoDiferente = Boolean(
        !ini || !fim || (textoOriginal && padraoAuto && textoOriginal !== padraoAuto && !/^(\d{1,2})([:h.]\d{0,2})?\s*(às|as|a|até|ate|-|–|—|~|\/)\s*(\d{1,2})([:h.]\d{0,2})?\s*(h|hs|hr|hrs)?$/i.test(textoOriginal))
      )
      setPersonalizarTexto(temTextoDiferente)
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

  const horarioGerado = formatarHorarioTurno(editHoraInicio, editHoraFim)
  const horarioFinal = personalizarTexto
    ? editHorario.trim() || horarioGerado
    : horarioGerado || editHorario.trim()
  const horasIguais = Boolean(editHoraInicio && editHoraFim && editHoraInicio === editHoraFim)
  const viraMadrugada = Boolean(
    editHoraInicio && editHoraFim && !horasIguais && cruzaMeiaNoite(editHoraInicio, editHoraFim)
  )
  const horasIncompletas = Boolean((editHoraInicio && !editHoraFim) || (!editHoraInicio && editHoraFim))

  const handleConfirmEditarTurno = async (e) => {
    e.preventDefault()
    if (!modalEditarTurno || !horarioFinal || horasIguais || horasIncompletas) return

    const novaCap = Math.max(1, parseInt(editCapacidade, 10) || 1)
    setSalvandoTurno(true)
    try {
      const baseUpdate = {
        horario: horarioFinal,
        capacidade: novaCap,
      }

      const updateComHoras = {
        ...baseUpdate,
        hora_inicio: normalizarTimeSql(editHoraInicio),
        hora_fim: normalizarTimeSql(editHoraFim),
      }

      let { error } = await supabase
        .from('turnos')
        .update(updateComHoras)
        .eq('id', modalEditarTurno.turnoId)

      if (error && isMissingColumnError(error)) {
        const fallbackRes = await supabase
          .from('turnos')
          .update(baseUpdate)
          .eq('id', modalEditarTurno.turnoId)
        error = fallbackRes.error
      }

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
          {/* Seleção de Hora Início e Hora Fim */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  Hora Início
                </label>
                <input
                  type="time"
                  value={editHoraInicio}
                  onChange={(e) => setEditHoraInicio(e.target.value)}
                  className="input-field text-sm sm:text-base font-medium"
                  autoFocus
                  required={!personalizarTexto}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  Hora Fim
                </label>
                <input
                  type="time"
                  value={editHoraFim}
                  onChange={(e) => setEditHoraFim(e.target.value)}
                  className="input-field text-sm sm:text-base font-medium"
                  required={!personalizarTexto}
                />
              </div>
            </div>

            {horasIguais && (
              <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">
                A hora de fim deve ser diferente da hora de início.
              </p>
            )}

            {horasIncompletas && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Preencha tanto a hora de início quanto a de fim para validar conflitos de horário.
              </p>
            )}

            {viraMadrugada && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Turno noturno: encerra às {editHoraFim} (virada de madrugada).
              </p>
            )}

            {/* Texto exibido na escala */}
            {personalizarTexto ? (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300">
                    Texto Exibido na Escala:
                  </label>
                  {horarioGerado && (
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalizarTexto(false)
                        setEditHorario(horarioGerado)
                      }}
                      className="text-[11px] text-brand-500 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Usar automático
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editHorario}
                  onChange={(e) => setEditHorario(e.target.value)}
                  placeholder={horarioGerado || 'Ex: 08:00 às 12:00'}
                  className="input-field text-sm font-medium"
                  required
                />
              </div>
            ) : (
              horarioGerado && (
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                  <span>
                    Exibição: <strong className="text-gray-300">{horarioGerado}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditHorario(horarioGerado)
                      setPersonalizarTexto(true)
                    }}
                    className="text-brand-500 dark:text-brand-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <Pencil className="w-3 h-3" />
                    Personalizar rótulo
                  </button>
                </div>
              )
            )}
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
              disabled={salvandoTurno || !horarioFinal || horasIguais || horasIncompletas}
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
