import { useMemo, useState, useEffect, useCallback } from 'react'
import TurnoCard from './TurnoCard'
import { formatarNomeDia, compararDias } from '../lib/diasSemana'
import { obterTermos } from '../lib/vocabularioHelper'
import { Copy, ClipboardCheck, Calendar, MapPin, ArrowLeft, Store, ChevronDown } from 'lucide-react'

export default function CorretorView({
  pontos,
  turnos,
  reservas,
  deviceId,
  corretorNome,
  onReservar,
  onCancelar,
  showToast,
  empresa,
  empresaShareUrl,
}) {
  const [copied, setCopied] = useState(false)
  const [selectedPontoId, setSelectedPontoId] = useState(null)
  const termos = useMemo(() => obterTermos(empresa), [empresa])

  // Chave de acordeon no localStorage isolada por empresa
  const STORAGE_KEY_DIAS_EXPANDIDOS = empresa?.id
    ? `escala_corretor_dias_expandidos_${empresa.id}`
    : 'escala_corretor_dias_expandidos'

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

  // Agrupar turnos por dia (usando o padrão completo: SEGUNDA-FEIRA, etc.)
  const turnosPorDia = useMemo(() => {
    const grupos = {}
    for (const turno of turnosFiltrados) {
      const diaFormatado = formatarNomeDia(turno.dia)
      if (!grupos[diaFormatado]) {
        grupos[diaFormatado] = []
      }
      grupos[diaFormatado].push(turno)
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

  // Ordem fixa dos dias cronológica (Segunda-feira a Domingo)
  const diasOrdenados = Object.keys(turnosPorDia).sort(compararDias)

  // ─── Controle de Acordeon dos Dias da Semana ─────────────────
  const [diasExpandidos, setDiasExpandidos] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_DIAS_EXPANDIDOS)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de dias expandidos:', err)
    }
    return {}
  })

  // Salva no localStorage sempre que houver alteração
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DIAS_EXPANDIDOS, JSON.stringify(diasExpandidos))
    } catch (err) {
      console.error('Erro ao salvar preferência de dias expandidos:', err)
    }
  }, [diasExpandidos, STORAGE_KEY_DIAS_EXPANDIDOS])

  const isDiaAberto = useCallback(
    (dia) => {
      if (!selectedPontoId) return false
      return Boolean(diasExpandidos[`${selectedPontoId}_${dia}`])
    },
    [selectedPontoId, diasExpandidos]
  )

  const toggleDia = useCallback(
    (dia) => {
      if (!selectedPontoId) return
      const chave = `${selectedPontoId}_${dia}`
      setDiasExpandidos((prev) => ({
        ...prev,
        [chave]: !prev[chave],
      }))
    },
    [selectedPontoId]
  )

  const recolherTodosDias = useCallback(() => {
    if (!selectedPontoId) return
    setDiasExpandidos((prev) => {
      const novo = { ...prev }
      for (const dia of diasOrdenados) {
        novo[`${selectedPontoId}_${dia}`] = false
      }
      return novo
    })
  }, [selectedPontoId, diasOrdenados])

  const expandirTodosDias = useCallback(() => {
    if (!selectedPontoId) return
    setDiasExpandidos((prev) => {
      const novo = { ...prev }
      for (const dia of diasOrdenados) {
        novo[`${selectedPontoId}_${dia}`] = true
      }
      return novo
    })
  }, [selectedPontoId, diasOrdenados])

  // Gerar texto para copiar (com suporte a Multi-tenant e link WhatsApp)
  const gerarTextoEscala = () => {
    const pontosParaCopiar = selectedPontoId
      ? pontos.filter((p) => p.id === selectedPontoId)
      : pontos

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

    const nomeEmpresaUpper = empresa?.nome ? ` — ${empresa.nome.toUpperCase()}` : ''
    const tituloZap = (termos.textoWhatsapp || 'ESCALA SEMANAL').replace('📋', '').trim()
    let texto = `📋 *${tituloZap}${nomeEmpresaUpper} (${capTexto})*\n`
    texto += '━━━━━━━━━━━━━━━━━━\n\n'

    for (const ponto of pontosParaCopiar) {
      const turnosDoPonto = turnos
        .filter((t) => t.ponto_id === ponto.id)
        .sort((a, b) => a.ordem - b.ordem)

      if (turnosDoPonto.length === 0) continue

      texto += `📍 *${ponto.nome.toUpperCase()}*\n\n`

      const porDia = {}
      for (const t of turnosDoPonto) {
        const diaFormatado = formatarNomeDia(t.dia)
        if (!porDia[diaFormatado]) porDia[diaFormatado] = []
        porDia[diaFormatado].push(t)
      }

      const diasOrd = Object.keys(porDia).sort(compararDias)

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
    if (empresaShareUrl) {
      texto += `🔗 ${termos.acaoVaga || 'Garanta sua vaga'}: ${empresaShareUrl}`
    } else {
      texto += '🔗 Reservas em tempo real no app'
    }

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
              Nenhum {termos.ponto?.toLowerCase() || 'local'} cadastrado
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {empresa?.nome ? `Nenhum ${termos.ponto?.toLowerCase() || 'local'} ativo cadastrado para ${empresa.nome}.` : `O administrador precisa cadastrar os ${termos.pontos?.toLowerCase() || 'locais'}.`}
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
              Olá, <span className="text-brand-600 dark:text-brand-400 font-semibold">{corretorNome}</span> 👋
            </p>
          </div>
        )}

        <div className="mb-4 px-1">
          <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-400" />
            Escolha o {termos.ponto || 'Ponto de Escala'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Selecione {termos.artigoPonto || 'o'} {termos.ponto?.toLowerCase() || 'local'} para ver horários e {termos.acaoVaga?.toLowerCase() || 'garantir vagas'}.
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
                        <span className={`text-xs font-medium ${temVagas ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}`}>
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

        {/* Espaçador para garantir visualização completa acima do footer fixo */}
        <div className="h-28 sm:h-32 w-full pointer-events-none" aria-hidden="true" />

        {/* Footer com copiar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface-900 border-t border-surface-700">
          <div className="max-w-xl mx-auto px-3 sm:px-4 py-3">
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
        <div className="space-y-3">
          {/* Barra de controle / contagem e botões Expandir/Recolher todos */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs text-gray-400 font-medium">
              {diasOrdenados.length} dia{diasOrdenados.length !== 1 ? 's' : ''} com horários
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={recolherTodosDias}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-surface-800 hover:bg-surface-700 px-2.5 py-1 rounded-lg transition-colors border border-surface-600/50"
                title="Recolher todos os dias"
              >
                Recolher todos
              </button>
              <button
                type="button"
                onClick={expandirTodosDias}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-surface-800 hover:bg-surface-700 px-2.5 py-1 rounded-lg transition-colors border border-surface-600/50"
                title="Expandir todos os dias"
              >
                Expandir todos
              </button>
            </div>
          </div>

          {diasOrdenados.map((dia) => {
            const turnosDoDia = turnosPorDia[dia] || []
            const isAberto = isDiaAberto(dia)

            const totalCapacidadeDia = turnosDoDia.reduce((sum, t) => sum + t.capacidade, 0)
            const totalReservadosDia = turnosDoDia.reduce(
              (sum, t) => sum + (reservasPorTurno[t.id]?.length || 0),
              0
            )
            const vagasLivresDia = totalCapacidadeDia - totalReservadosDia
            const temVagas = vagasLivresDia > 0

            const usuarioTemVaga =
              Boolean(deviceId) &&
              turnosDoDia.some((t) =>
                (reservasPorTurno[t.id] || []).some((r) => r.device_id === deviceId)
              )

            return (
              <section key={dia} className="transition-all">
                <button
                  type="button"
                  onClick={() => toggleDia(dia)}
                  className="card w-full flex items-center justify-between py-3 px-3.5 sm:px-4 hover:border-brand-500/40 hover:bg-surface-700/50 transition-all duration-200 active:scale-[0.99] select-none text-left min-h-[48px]"
                  aria-expanded={isAberto}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-1.5 h-5 rounded-full bg-brand-500 flex-shrink-0" />
                    <h2 className="text-sm sm:text-base font-bold text-gray-100 uppercase tracking-wide truncate">
                      {dia}
                    </h2>
                    <span className="text-xs text-gray-400 font-normal flex-shrink-0">
                      ({turnosDoDia.length})
                    </span>
                    {usuarioTemVaga && (
                      <span
                        className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 sm:hidden"
                        title="Você tem vaga neste dia"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {usuarioTemVaga && (
                      <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 rounded-md hidden sm:inline-flex items-center gap-1">
                        Sua vaga
                      </span>
                    )}

                    {totalCapacidadeDia > 0 && (
                      <span
                        className={`text-[11px] sm:text-xs font-medium px-2 py-0.5 rounded-md ${
                          temVagas
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20'
                        }`}
                      >
                        {temVagas
                          ? `${vagasLivresDia} ${vagasLivresDia === 1 ? 'vaga' : 'vagas'}`
                          : 'Lotado'}
                      </span>
                    )}

                    <div
                      className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 ${
                        isAberto ? 'rotate-180 text-brand-500 dark:text-brand-400 bg-brand-500/20' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {isAberto && (
                  <div className="space-y-3 mt-3 animate-fade-in">
                    {turnosDoDia.map((turno) => (
                      <TurnoCard
                        key={turno.id}
                        turno={turno}
                        reservas={reservasPorTurno[turno.id] || []}
                        deviceId={deviceId}
                        onReservar={onReservar}
                        onCancelar={onCancelar}
                        acaoVaga={termos.acaoVaga}
                        acaoCancelar={termos.acaoCancelar}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Espaçador robusto para o último turno */}
      <div className="h-32 sm:h-36 w-full pointer-events-none" aria-hidden="true" />

      {/* Footer com copiar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface-900 border-t border-surface-700 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-3">
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
