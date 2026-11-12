import { useMemo } from 'react'
import { Clock, Users, CheckCircle2, XCircle, User, Lock, AlertTriangle } from 'lucide-react'

export default function TurnoCard({
  turno,
  reservas,
  deviceId,
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  onReservar,
  onCancelar,
  acaoVaga,
  acaoCancelar,
  ocultarNomes = false,
  bloqueioRegra = null,
}) {
  const vagasOcupadas = reservas.length
  const vagasTotal = turno.capacidade
  const vagasRestantes = vagasTotal - vagasOcupadas
  const esgotado = vagasRestantes <= 0

  const cleanZap = (corretorWhatsapp || '').replace(/\D/g, '').replace(/^55(\d{10,11})$/, '$1')
  const cleanEmail = (corretorEmail || '').trim().toLowerCase()
  const nomeLower = (corretorNome || '').trim().toLowerCase()

  // Trava Estrita de Dispositivo: apenas quem reservou por ESTE aparelho físico pode cancelá-la
  // Suporta tanto `eh_minha` (vindo da RPC pública sanitizada) quanto `device_id` (gestor / demo)
  const isMinhaReservaItem = (r) => Boolean(r.eh_minha || (deviceId && r.device_id === deviceId))

  // Verifica se o usuário atual tem reserva neste turno
  const minhaReserva = useMemo(
    () => reservas.find((r) => Boolean(r.eh_minha || (deviceId && r.device_id === deviceId))),
    [reservas, deviceId]
  )

  // Calcula a porcentagem de ocupação para a barra de progresso
  const porcentagem = Math.min((vagasOcupadas / vagasTotal) * 100, 100)

  // Cor da barra baseada na ocupação
  const barColor = esgotado
    ? 'bg-red-500'
    : porcentagem >= 66
    ? 'bg-amber-500'
    : 'bg-emerald-500'

  const badgeColor = esgotado
    ? 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
    : porcentagem >= 66
    ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
    : 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'

  return (
    <div className={`card transition-all duration-200 ${minhaReserva ? 'ring-2 ring-brand-500 shadow-brand-500/10' : ''}`}>
      {/* Header do card */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-surface-700">
            <Clock className="w-4.5 h-4.5 text-brand-500 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100 text-[15px] leading-tight">
              {turno.horario}
            </h3>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
          {vagasOcupadas}/{vagasTotal}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-1.5 bg-surface-700 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>

      {/* Lista de corretores */}
      {reservas.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {reservas.map((reserva) => {
            const ehMinha = isMinhaReservaItem(reserva)
            const deveOcultar = ocultarNomes && !ehMinha

            return (
              <div
                key={reserva.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  ehMinha
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20'
                    : 'bg-surface-700/60 text-gray-400'
                }`}
              >
                {deveOcultar ? (
                  <Lock className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                ) : (
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span
                  className={`truncate font-medium ${
                    deveOcultar ? 'italic text-gray-400 dark:text-gray-400 select-none' : ''
                  }`}
                >
                  {deveOcultar ? 'Reservado' : reserva.corretor_nome}
                </span>
                {ehMinha && (
                  <span className="ml-auto text-[10px] bg-brand-500/20 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded font-bold">
                    VOCÊ
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Aviso visual de Conflito de Horário ou Limite/Cota Atingida */}
      {!minhaReserva && !esgotado && bloqueioRegra?.bloqueado && (
        <div
          className={`mb-3 px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
            bloqueioRegra.tipo === 'conflito'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-surface-700/80 border-surface-500/70 text-gray-300'
          }`}
        >
          {bloqueioRegra.tipo === 'conflito' ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          )}
          <span className="leading-snug font-medium">{bloqueioRegra.motivo}</span>
        </div>
      )}

      {/* Botão de ação */}
      {minhaReserva ? (
        <button
          onClick={() => onCancelar(minhaReserva.id)}
          className="btn-danger w-full flex items-center justify-center gap-2 text-sm"
        >
          <XCircle className="w-4.5 h-4.5" />
          {acaoCancelar || 'Cancelar Minha Vaga'}
        </button>
      ) : esgotado ? (
        <button
          disabled
          className="btn-ghost w-full flex items-center justify-center gap-2 text-sm opacity-50 cursor-not-allowed"
        >
          <Users className="w-4.5 h-4.5" />
          Esgotado
        </button>
      ) : bloqueioRegra?.bloqueado ? (
        <button
          disabled
          className="btn-ghost w-full flex items-center justify-center gap-2 text-sm opacity-75 cursor-not-allowed border border-surface-600"
          title={bloqueioRegra.motivo}
        >
          {bloqueioRegra.tipo === 'conflito' ? (
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" />
          ) : (
            <Lock className="w-4.5 h-4.5" />
          )}
          {bloqueioRegra.labelCurta || 'Indisponível'}
        </button>
      ) : (
        <button
          onClick={() => onReservar(turno.id)}
          className="btn-success w-full flex items-center justify-center gap-2 text-sm"
        >
          <CheckCircle2 className="w-4.5 h-4.5" />
          {acaoVaga || 'Garantir Vaga'}
        </button>
      )}
    </div>
  )
}

