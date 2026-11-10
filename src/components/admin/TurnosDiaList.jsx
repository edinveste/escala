import { useState, useEffect, useRef, useCallback } from 'react'
import Sortable from 'sortablejs'
import { Copy } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatarNomeDia } from '../../lib/diasSemana'
import AdminTurnoCard from './AdminTurnoCard'

/**
 * Lista de turnos de um dia específico na visão do administrador.
 * Suporta reordenação com drag-and-drop (SortableJS) touch-friendly e duplicação de horários para outros dias.
 */
export default function TurnosDiaList({
  dia,
  turnos = [],
  ponto,
  reservas = [],
  onAbrirIncluirPessoa,
  onEditarTurno,
  onDeleteTurno,
  onRemoverReserva,
  onAbrirDuplicar,
  onDataChanged,
  showToast,
}) {
  const [listaTurnos, setListaTurnos] = useState(() =>
    [...turnos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  )

  const listRef = useRef(null)
  const sortableRef = useRef(null)

  // Sincroniza lista quando os turnos externos forem atualizados
  useEffect(() => {
    setListaTurnos([...turnos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
  }, [turnos])

  // ─── Salvar Nova Ordem dos Turnos no Supabase ─────────────────
  const salvarNovaOrdemTurnos = useCallback(
    async (novaLista) => {
      try {
        await Promise.all(
          novaLista.map((t, idx) =>
            supabase.from('turnos').update({ ordem: idx }).eq('id', t.id)
          )
        )
        showToast?.(`Ordem dos horários de ${formatarNomeDia(dia)} atualizada! ↕️`, 'success')
        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao salvar nova ordem dos turnos:', err)
        showToast?.('Erro ao salvar ordem dos turnos.', 'error')
        setListaTurnos([...turnos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
      }
    },
    [dia, turnos, onDataChanged, showToast]
  )

  const salvarNovaOrdemRef = useRef(salvarNovaOrdemTurnos)
  useEffect(() => {
    salvarNovaOrdemRef.current = salvarNovaOrdemTurnos
  })

  // ─── SortableJS para Turnos do Dia (Fluido e sem bloquear scroll) ─
  useEffect(() => {
    if (!listRef.current) return

    if (sortableRef.current) {
      sortableRef.current.destroy()
      sortableRef.current = null
    }

    sortableRef.current = Sortable.create(listRef.current, {
      animation: 150,
      handle: '.drag-handle-turno', // arrasta exclusivamente pelo ícone de 6 pontos
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      delay: 150, // No celular: exige segurar 150ms no pegador antes de arrastar
      delayOnTouchOnly: true, // No mouse desktop: arrasto imediato
      touchStartThreshold: 5, // Se o dedo mover mais de 5px, cancela e permite scroll normal
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return

        setListaTurnos((prev) => {
          const novaLista = [...prev]
          const [movedItem] = novaLista.splice(oldIndex, 1)
          novaLista.splice(newIndex, 0, movedItem)
          salvarNovaOrdemRef.current(novaLista)
          return novaLista
        })
      },
    })

    return () => {
      if (sortableRef.current) {
        sortableRef.current.destroy()
        sortableRef.current = null
      }
    }
  }, [dia, listaTurnos.length > 0])

  return (
    <div className="mb-4">
      {/* Cabeçalho do dia */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            {formatarNomeDia(dia)}
          </p>
          <span className="text-[11px] text-gray-500 font-medium">
            ({listaTurnos.length} horário{listaTurnos.length !== 1 ? 's' : ''})
          </span>
        </div>

        <button
          type="button"
          onClick={onAbrirDuplicar}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100/90 border border-brand-200 hover:border-brand-300 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 dark:text-brand-300 dark:hover:text-brand-200 dark:border-brand-500/20 px-2.5 py-1 rounded-lg transition-all"
          title={`Copiar turnos de ${formatarNomeDia(dia)} para outros dias da semana`}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar horários
        </button>
      </div>

      {/* Lista arrastável de turnos */}
      <div ref={listRef} className="space-y-2">
        {listaTurnos.map((turno) => {
          const reservasTurno = reservas.filter((r) => r.turno_id === turno.id)

          return (
            <AdminTurnoCard
              key={turno.id}
              turno={turno}
              dia={dia}
              ponto={ponto}
              reservasTurno={reservasTurno}
              onEditarTurno={onEditarTurno}
              onAbrirIncluirPessoa={onAbrirIncluirPessoa}
              onDeleteTurno={onDeleteTurno}
              onRemoverReserva={onRemoverReserva}
            />
          )
        })}
      </div>
    </div>
  )
}

