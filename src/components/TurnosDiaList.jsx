import { useState, useEffect, useRef, useCallback } from 'react'
import Sortable from 'sortablejs'
import { supabase } from '../lib/supabaseClient'
import {
  Clock,
  Users,
  Copy,
  Trash2,
  UserPlus,
  User,
  X,
  GripVertical,
} from 'lucide-react'

function limparClonesOrfaos() {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.sortable-drag, .sortable-fallback').forEach((el) => {
    if (
      el.parentNode === document.body ||
      el.style.position === 'fixed' ||
      el.style.position === 'absolute'
    ) {
      el.remove()
    }
  })
}

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

  // Listener global de segurança para nunca deixar clones órfãos na tela se soltar fora
  useEffect(() => {
    const handleGlobalDropRelease = () => {
      setTimeout(limparClonesOrfaos, 50)
    }
    window.addEventListener('pointerup', handleGlobalDropRelease)
    window.addEventListener('mouseup', handleGlobalDropRelease)
    window.addEventListener('touchend', handleGlobalDropRelease)
    return () => {
      window.removeEventListener('pointerup', handleGlobalDropRelease)
      window.removeEventListener('mouseup', handleGlobalDropRelease)
      window.removeEventListener('touchend', handleGlobalDropRelease)
      limparClonesOrfaos()
    }
  }, [])

  // ─── SortableJS para Turnos do Dia ────────────────────────────
  useEffect(() => {
    if (!listRef.current) return

    sortableRef.current = Sortable.create(listRef.current, {
      animation: 200,
      handle: '.drag-handle-turno', // arrasta ao clicar no pegador ou no horário
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      forceFallback: true,
      fallbackClass: 'sortable-drag',
      fallbackOnBody: true, // Garante que o clone vai para o document.body
      fallbackTolerance: 3,
      revertOnSpill: true, // Se soltar fora da lista, reverte suavemente
      removeCloneOnHide: true,
      onEnd: (evt) => {
        limparClonesOrfaos()

        const { oldIndex, newIndex, item } = evt
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return

        // Reverte alteração direta no DOM para deixar o React assumir a renderização
        const parent = item.parentNode
        if (parent) {
          const referenceNode =
            oldIndex < parent.children.length ? parent.children[oldIndex] : null
          parent.insertBefore(item, referenceNode)
        }

        // Executa no próximo tick para permitir que o SortableJS finalize sua limpeza de DOM
        setTimeout(() => {
          setListaTurnos((prev) => {
            const novaLista = [...prev]
            const [movedItem] = novaLista.splice(oldIndex, 1)
            novaLista.splice(newIndex, 0, movedItem)
            salvarNovaOrdemRef.current(novaLista)
            return novaLista
          })
        }, 0)
      },
      onSpill: () => {
        limparClonesOrfaos()
      },
    })

    return () => {
      if (sortableRef.current) {
        sortableRef.current.destroy()
        sortableRef.current = null
      }
      limparClonesOrfaos()
    }
  }, [dia])

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
              className="p-3 rounded-xl bg-surface-700/60 border border-surface-600/40 space-y-2.5 transition-colors select-none"
            >
              {/* Linha superior: Pegador/Horário (Arrastável) e botões de ação */}
              <div className="flex items-center justify-between gap-2">
                <div
                  className="drag-handle-turno flex items-center gap-2 min-w-0 flex-1 touch-none cursor-grab active:cursor-grabbing py-1 -my-1 group/handle"
                  title="Segure e arraste para alterar a ordem deste horário"
                >
                  {/* Pegador de Arrastar (GripVertical) */}
                  <div className="p-1 -ml-1 text-gray-500 group-hover/handle:text-brand-400 active:text-brand-300 transition-colors flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <Clock className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <p className="text-sm font-bold text-gray-100 truncate group-hover/handle:text-white transition-colors">
                    {turno.horario}
                  </p>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      lotado
                        ? 'bg-red-500/15 text-red-400 border-red-500/20'
                        : reservasTurno.length > 0
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                        : 'bg-surface-800 text-gray-400 border-surface-600'
                    }`}
                  >
                    {reservasTurno.length}/{turno.capacidade} vagas
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded-lg transition-colors border border-emerald-500/30"
                    title="Incluir corretor neste horário"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Incluir
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

              {/* Lista de pessoas escaladas neste turno */}
              <div className="pt-2 border-t border-surface-600/40">
                <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1 mb-1.5">
                  <Users className="w-3 h-3 text-gray-500" />
                  Corretores escalados:
                </p>

                {reservasTurno.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    Nenhum corretor escalado neste horário.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
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
          )
        })}
      </div>
    </div>
  )
}

