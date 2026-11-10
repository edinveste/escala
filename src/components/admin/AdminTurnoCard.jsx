import { Clock, GripVertical, User, X, Pencil, UserPlus, Trash2 } from 'lucide-react'

/**
 * Card individual de turno na visão do administrador.
 * Exibe o pegador de drag-and-drop, horário, lista de colaboradores escalados (com remoção individual),
 * badge de ocupação de vagas e botões contextuais de ação (editar, incluir membro, excluir turno).
 */
export default function AdminTurnoCard({
  turno,
  dia,
  ponto,
  reservasTurno = [],
  onEditarTurno,
  onAbrirIncluirPessoa,
  onDeleteTurno,
  onRemoverReserva,
}) {
  const lotado = reservasTurno.length >= turno.capacidade

  return (
    <div
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
                  <User className="w-3 h-3 text-brand-500 dark:text-brand-400" />
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

      {/* Lado Direito: Vagas à esquerda e 3 Ações Verticais (Lápis, Incluir, Lixeira) */}
      <div className="flex items-start gap-2 flex-shrink-0 pl-2.5 border-l border-surface-600/30">
        {/* Contagem de vagas */}
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap select-none mt-0.5 ${
            lotado
              ? 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
              : reservasTurno.length > 0
              ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
              : 'bg-surface-800 text-gray-400 border-surface-600'
          }`}
        >
          {reservasTurno.length}/{turno.capacidade} vagas
        </span>

        {/* 3 Botões de ação alinhados na vertical */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onEditarTurno?.({
                turnoId: turno.id,
                horario: turno.horario,
                capacidade: turno.capacidade,
                dia,
                pontoNome: ponto.nome,
                reservasCount: reservasTurno.length,
              })
            }
            className="p-1.5 rounded-lg hover:bg-brand-500/15 text-gray-500 hover:text-brand-400 transition-colors"
            title="Editar horário e vagas deste turno"
            aria-label="Editar turno"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

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
}

