import { useMemo, useState } from 'react'
import TurnoCard from './TurnoCard'
import { Copy, ClipboardCheck, Calendar, MapPin, ArrowLeft, Store } from 'lucide-react'

export default function CorretorView({
  pontos,
  turnos,
  reservas,
  deviceId,
  corretorNome,
  onReservar,
  onCancelar,
  showToast,
}) {
  const [copied, setCopied] = useState(false)
  const [selectedPontoId, setSelectedPontoId] = useState(null)

  // Ponto selecionado
  const selectedPonto = useMemo(
    () => pontos.find((p) => p.id === selectedPontoId),
    [pontos, selectedPontoId]
  )

  // Turnos filtrados pelo ponto selecionado
  const turnosFiltrados = useMemo(
    () => (selectedPontoId ? turnos.filter((t) => t.ponto_id === selectedPontoId) : []),
    [turnos, selectedPontoId]
  )

  // Agrupar turnos por dia
  const turnosPorDia = useMemo(() => {
    const grupos = {}
    for (const turno of turnosFiltrados) {
      if (!grupos[turno.dia]) {
        grupos[turno.dia] = []
      }
      grupos[turno.dia].push(turno)
    }
    for (const dia of Object.keys(grupos)) {
      grupos[dia].sort((a, b) => a.ordem - b.ordem)
    }
    return grupos
  }, [turnosFiltrados])

  // Mapa de reservas por turno
  const reservasPorTurno = useMemo(() => {
    const mapa = {}
    for (const reserva of reservas) {
      if (!mapa[reserva.turno_id]) {
        mapa[reserva.turno_id] = []
      }
      mapa[reserva.turno_id].push(reserva)
    }
    return mapa
  }, [reservas])

  // Contagem de vagas por ponto (para mostrar nos cards de seleção)
  const vagasPorPonto = useMemo(() => {
    const mapa = {}
    for (const ponto of pontos) {
      const turnosDoPonto = turnos.filter((t) => t.ponto_id === ponto.id)
      const totalCapacidade = turnosDoPonto.reduce((sum, t) => sum + t.capacidade, 0)
      const totalReservados = turnosDoPonto.reduce(
        (sum, t) => sum + (reservasPorTurno[t.id]?.length || 0),
        0
      )
      mapa[ponto.id] = {
        totalTurnos: turnosDoPonto.length,
        totalCapacidade,
        totalReservados,
        vagasLivres: totalCapacidade - totalReservados,
      }
    }
    return mapa
  }, [pontos, turnos, reservasPorTurno])

  // Ordem fixa dos dias
  const ordensDia = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO']
  const diasOrdenados = Object.keys(turnosPorDia).sort(
    (a, b) => {
      const idxA = ordensDia.indexOf(a.toUpperCase())
      const idxB = ordensDia.indexOf(b.toUpperCase())
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
    }
  )

  // Gerar texto para copiar
  const gerarTextoEscala = () => {
    // Se tem ponto selecionado, copia só dele; senão copia todos
    const pontosParaCopiar = selectedPontoId
      ? pontos.filter((p) => p.id === selectedPontoId)
      : pontos

    // Identificar capacidade dos turnos para exibir no cabeçalho
    const turnosParaCopiar = turnos.filter((t) =>
      pontosParaCopiar.some((p) => p.id === t.ponto_id)
    )
    const capacidades = [
      ...new Set(turnosParaCopiar.map((t) => t.capacidade).filter(Boolean)),
    ]
    let capTexto = '2 por horário'
    if (capacidades.length === 1) {
      capTexto = `${capacidades[0]} por horário`
    } else if (capacidades.length > 1) {
      capTexto = `${Math.min(...capacidades)} a ${Math.max(...capacidades)} por horário`
    }

    let texto = `📋 *ESCALA DE CAPTAÇÃO (${capTexto})*\n`
    texto += '━━━━━━━━━━━━━━━━━━\n\n'

    for (const ponto of pontosParaCopiar) {
      const turnosDoPonto = turnos
        .filter((t) => t.ponto_id === ponto.id)
        .sort((a, b) => a.ordem - b.ordem)

      if (turnosDoPonto.length === 0) continue

      texto += `📍 *${ponto.nome.toUpperCase()}*\n\n`

      // Agrupar por dia
      const porDia = {}
      for (const t of turnosDoPonto) {
        if (!porDia[t.dia]) porDia[t.dia] = []
        porDia[t.dia].push(t)
      }

      const diasOrd = Object.keys(porDia).sort((a, b) => {
        const idxA = ordensDia.indexOf(a.toUpperCase())
        const idxB = ordensDia.indexOf(b.toUpperCase())
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
      })

      for (const dia of diasOrd) {
        texto += `📅 *${dia}*\n\n`
        for (const turno of porDia[dia]) {
          const reservasTurno = reservasPorTurno[turno.id] || []
          const nomes = reservasTurno.map((r) => r.corretor_nome.toUpperCase()).join(' / ')

          if (nomes) {
            texto += `🕐 ${turno.horario}\n   → ${nomes}\n`
          } else {
            texto += `🕐 ${turno.horario}\n   → _vago_\n`
          }
        }
        texto += '\n'
      }
    }

    texto += '━━━━━━━━━━━━━━━━━━\n'
    texto += '🔗 Reservas em tempo real no app'

    return texto
  }

  const handleCopiar = async () => {
    const texto = gerarTextoEscala()
    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      showToast('Escala copiada para a área de transferência! 📋', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      showToast('Escala copiada! 📋', 'success')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ─── TELA DE SELEÇÃO DE PONTO ────────────────────────────────
  if (!selectedPontoId) {
    if (pontos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Store className="w-16 h-16 text-gray-700" />
          <div>
            <h2 className="text-lg font-semibold text-gray-400">
              Nenhum ponto de captação
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              O administrador precisa criar os pontos de captação.
            </p>
          </div>
        </div>
      )
    }

    return (
      <>
        {/* Saudação */}
        {corretorNome && (
          <div className="mb-4 px-1">
            <p className="text-sm text-gray-500">
              Olá, <span className="text-brand-400 font-medium">{corretorNome}</span> 👋
            </p>
          </div>
        )}

        <div className="mb-4 px-1">
          <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-400" />
            Escolha o Ponto de Captação
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Selecione o local para ver horários e reservar vagas.
          </p>
        </div>

        <div className="space-y-3">
          {pontos.map((ponto) => {
            const info = vagasPorPonto[ponto.id] || {}
            const temVagas = info.vagasLivres > 0

            return (
              <button
                key={ponto.id}
                onClick={() => setSelectedPontoId(ponto.id)}
                className="card w-full text-left hover:border-brand-500/40 hover:bg-surface-700/50 transition-all duration-200 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-100 text-[15px] truncate">
                      {ponto.nome}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {info.totalTurnos || 0} turno{info.totalTurnos !== 1 ? 's' : ''}
                      </span>
                      {info.totalCapacidade > 0 && (
                        <span className={`text-xs font-medium ${temVagas ? 'text-emerald-400' : 'text-red-400'}`}>
                          {temVagas
                            ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${info.vagasLivres !== 1 ? 's' : ''}`
                            : 'Lotado'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Indicador visual */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    info.totalCapacidade === 0
                      ? 'bg-gray-600'
                      : temVagas
                      ? 'bg-emerald-400 animate-pulse-soft'
                      : 'bg-red-500'
                  }`} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer com copiar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface-900/95 backdrop-blur-md border-t border-surface-700">
          <div className="max-w-lg mx-auto px-4 py-3">
            <button
              onClick={handleCopiar}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 min-h-[48px] select-none ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface-700 hover:bg-surface-600 text-gray-300'
              }`}
            >
              {copied ? (
                <>
                  <ClipboardCheck className="w-5 h-5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copiar Escala Completa (WhatsApp)
                </>
              )}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ─── TELA DE TURNOS DO PONTO SELECIONADO ─────────────────────
  return (
    <>
      {/* Botão voltar + nome do ponto */}
      <div className="mb-4">
        <button
          onClick={() => setSelectedPontoId(null)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3 -ml-1 p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos pontos
        </button>

        <div className="flex items-center gap-2.5 px-1">
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <MapPin className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-100">
              {selectedPonto?.nome}
            </h2>
            <p className="text-xs text-gray-500">
              {turnosFiltrados.length} turno{turnosFiltrados.length !== 1 ? 's' : ''} disponíve{turnosFiltrados.length !== 1 ? 'is' : 'l'}
            </p>
          </div>
        </div>
      </div>

      {/* Saudação */}
      {corretorNome && (
        <div className="mb-4 px-1">
          <p className="text-sm text-gray-500">
            Olá, <span className="text-brand-400 font-medium">{corretorNome}</span> 👋
          </p>
        </div>
      )}

      {turnosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Calendar className="w-14 h-14 text-gray-700" />
          <div>
            <h3 className="text-base font-semibold text-gray-400">
              Nenhum turno cadastrado
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              O administrador precisa criar turnos para este ponto.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {diasOrdenados.map((dia) => (
            <section key={dia}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1.5 h-5 rounded-full bg-brand-500" />
                <h2 className="text-base font-bold text-gray-200 uppercase tracking-wide">
                  {dia}
                </h2>
              </div>

              <div className="space-y-3">
                {turnosPorDia[dia].map((turno) => (
                  <TurnoCard
                    key={turno.id}
                    turno={turno}
                    reservas={reservasPorTurno[turno.id] || []}
                    deviceId={deviceId}
                    onReservar={onReservar}
                    onCancelar={onCancelar}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Footer com copiar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface-900/95 backdrop-blur-md border-t border-surface-700">
        <div className="max-w-lg mx-auto px-4 py-3">
          <button
            onClick={handleCopiar}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 min-h-[48px] select-none ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-surface-700 hover:bg-surface-600 text-gray-300'
            }`}
          >
            {copied ? (
              <>
                <ClipboardCheck className="w-5 h-5" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copiar Escala — {selectedPonto?.nome}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
