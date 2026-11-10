import { useEffect, useRef } from 'react'
import Sortable from 'sortablejs'
import { GripVertical } from 'lucide-react'
import PontoItem from './PontoItem'

export default function PontosList({
  listaPontos = [],
  setListaPontos,
  turnosPorPonto = {},
  vagasPorPonto = {},
  isFullAdmin = true,
  salvarNovaOrdem,
  onToggleAtivo,
  onRename,
  onDelete,
  onDuplicar,
  onLimparEscala,
}) {
  const listRef = useRef(null)
  const sortableRef = useRef(null)
  const salvarNovaOrdemRef = useRef(salvarNovaOrdem)

  useEffect(() => {
    salvarNovaOrdemRef.current = salvarNovaOrdem
  })

  // ─── Inicialização do SortableJS (Suave, sem travar scroll mobile) ──
  useEffect(() => {
    if (!listRef.current) return

    if (sortableRef.current) {
      sortableRef.current.destroy()
      sortableRef.current = null
    }

    sortableRef.current = Sortable.create(listRef.current, {
      animation: 150,
      handle: '.drag-handle', // arrasta exclusivamente pelo pegador de 6 pontos
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      delay: 150, // No celular: exige segurar 150ms no pegador antes de arrastar
      delayOnTouchOnly: true, // No mouse desktop: arrasto imediato
      touchStartThreshold: 5, // Se o dedo deslizar mais de 5px, cancela e permite rolagem normal
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return

        setListaPontos((prev) => {
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
  }, [listaPontos.length > 0, setListaPontos])

  if (listaPontos.length === 0) return null

  return (
    <div className="space-y-2 border-t border-surface-600 pt-4">
      <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
        Arraste pelo ícone de 6 pontos para alterar a ordem:
      </p>

      <div ref={listRef} className="space-y-2">
        {listaPontos.map((ponto, index) => {
          const qtdTurnos = turnosPorPonto?.[ponto.id]?.length || 0
          const info = vagasPorPonto?.[ponto.id] || {}

          return (
            <PontoItem
              key={ponto.id}
              ponto={ponto}
              index={index}
              qtdTurnos={qtdTurnos}
              info={info}
              isFullAdmin={isFullAdmin}
              onToggleAtivo={() =>
                onToggleAtivo(ponto.id, ponto.ativo !== false, ponto.nome)
              }
              onRename={(novoNome) => onRename(ponto.id, novoNome)}
              onDelete={() => onDelete(ponto.id, ponto.nome)}
              onDuplicar={() => onDuplicar(ponto, qtdTurnos)}
              onLimparEscala={() => onLimparEscala(ponto.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

