import { useState, useEffect, useRef, useCallback } from 'react'
import Sortable from 'sortablejs'
import { supabase } from '../lib/supabaseClient'
import {
  Clock,
  Copy,
  Trash2,
  UserPlus,
  User,
  X,
  GripVertical,
} from 'lucide-react'

export default function TurnosDiaList({
  dia,
  turnos,
  ponto,
  reservas,
  onAbrirIncluirPessoa,
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
        showToast(`Ordem dos horários de ${dia} atualizada! ↕️`, 'success')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao salvar nova ordem dos turnos:', err)
        showToast('Erro ao salvar ordem dos turnos.', 'error')
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
            {dia}
          </p>
          <span className="text-[11px] text-gray-500 font-medium">
            ({listaTurnos.length} horário{listaTurnos.length !== 1 ? 's' : ''})
          </span>
        </div>

        <button
          type="button"
          onClick={onAbrirDuplicar}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-300 hover:text-brand-200 bg-brand-500/15 hover:bg-brand-500/25 px-2.5 py-1 rounded-lg transition-colors border border-brand-500/20"
          title={`Copiar turnos de ${dia} para outros dias da semana`}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar horários
        </button>
      </div>

      {/* Lista arrastável de turnos */}
      <div ref={listRef} className="space-y-2">
        {listaTurnos.map((turno) => {
          const reservasTurno = reservas.filter((r) => r.turno_id === turno.id)
          const lotado = reservasTurno.length >= turno.capacidade

          return (
            <div
              key={turno.id}
              data-id={turno.id}
              className="p-2.5 sm:p-3 rounded-xl bg-surface-700/60 border border-surface-600/40 flex gap-2.5 transition-colors select-none"
            >
              {/* Lado Esquerdo: Horário e Lista de Corretores */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                {/* Linha do Horário */}
                <div className="flex items-center gap-2 py-0.5">
                  {/* Pegador de Arrastar Dedicado (Apenas no ícone ⠿) */}
                  <div
                    className="drag-handle-turno p-1.5 -ml-1 text-gray-500 hover:text-brand-400 active:text-brand-300 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
                    title="Segure e arraste pelo ícone para alterar a ordem deste horário"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <Clock className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <p className="text-sm font-bold text-gray-100 select-none truncate">
                    {turno.horario}
                  </p>
                </div>

                {/* Lista de pessoas escaladas neste turno */}
                <div className="pt-2 mt-1.5 border-t border-surface-600/40">
                  {reservasTurno.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-0.5">
                      Nenhum corretor escalado neste horário.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 py-0.5">
                      {reservasTurno.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-1.5 bg-surface-800 text-gray-200 text-xs px-2.5 py-1 rounded-lg border border-surface-600/70 shadow-sm"
                        >
                          <User className="w-3 h-3 text-brand-400" />
                          <span className="font-medium">{r.corretor_nome}</span>
                          <button
                            type="button"
                            onClick={() =>
                              onRemoverReserva(
                                r.id,
                                r.corretor_nome,
                                `${dia} ${turno.horario}`
                              )
                            }
                            className="ml-1 p-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                            title={`Excluir ${r.corretor_nome} deste turno`}
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Lado Direito Vertical: Vagas no topo, Incluir no meio, Lixeira embaixo */}
              <div className="flex flex-col items-end justify-between flex-shrink-0 pl-2.5 border-l border-surface-600/30">
                {/* 0/2 vagas no canto superior direito */}
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap select-none ${
                    lotado
                      ? 'bg-red-500/15 text-red-400 border-red-500/20'
                      : reservasTurno.length > 0
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      : 'bg-surface-800 text-gray-400 border-surface-600'
                  }`}
                >
                  {reservasTurno.length}/{turno.capacidade} vagas
                </span>

                {/* Ações verticais: Incluir (ícone) e Lixeira (ícone) */}
                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAbrirIncluirPessoa(
                        turno.id,
                        turno.horario,
                        dia,
                        ponto.nome
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-gray-500 hover:text-emerald-400 transition-colors"
                    title="Incluir corretor neste horário"
                    aria-label="Incluir corretor"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onDeleteTurno(
                        turno.id,
                        `${ponto.nome} — ${dia} ${turno.horario}`
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors"
                    title="Excluir este turno inteiro"
                    aria-label="Excluir turno"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

