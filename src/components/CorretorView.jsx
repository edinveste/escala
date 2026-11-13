import { useMemo, useState, useCallback, useEffect } from 'react'
import { formatarNomeDia, compararDias } from '../lib/diasSemana'
import { obterTermos } from '../lib/vocabularioHelper'
import { calcularResumoColaborador } from '../lib/horarioHelper'
import { obterAberturaPonto, calcularStatusGeralPontos } from '../lib/aberturaHelper'
import { useDiasAcordeon } from './corretor/useDiasAcordeon'
import { gerarTextoEscala, copiarTextoParaClipboard } from './corretor/escalaTextoHelper'
import { CountdownTimerBanner } from './corretor/countdown'
import MinhaAgendaModal from './corretor/MinhaAgendaModal'
import PontoSelectorView from './corretor/PontoSelectorView'
import PontoTurnosView from './corretor/PontoTurnosView'

/**
 * Componente principal da visão pública do colaborador/corretor.
 * Orquestra a seleção de pontos, listagem de turnos, acordeon por dia e compartilhamento via WhatsApp.
 */
export default function CorretorView({
  pontos = [],
  turnos = [],
  reservas = [],
  deviceId,
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  cadastroNaoAutorizado = false,
  onEditarPerfil,
  onReservar,
  onCancelar,
  showToast,
  empresa,
  empresaShareUrl,
}) {
  const [copied, setCopied] = useState(false)
  const [selectedPontoId, setSelectedPontoId] = useState(null)
  const [aberturaConcluidaLocal, setAberturaConcluidaLocal] = useState(false)
  const [showAgendaModal, setShowAgendaModal] = useState(false)
  const termos = useMemo(() => obterTermos(empresa), [empresa])

  // Ponto atualmente selecionado
  const selectedPonto = useMemo(
    () => pontos.find((p) => p.id === selectedPontoId),
    [pontos, selectedPontoId]
  )

  // Status de Abertura Programada do ponto selecionado
  const infoAberturaPonto = useMemo(() => {
    if (!selectedPonto) return { estaAgendado: false, dataAbertura: null }
    return obterAberturaPonto(selectedPonto, empresa)
  }, [selectedPonto, empresa])

  // Status de abertura consolidado de todos os pontos ativos
  const statusGeralAbertura = useMemo(() => {
    return calcularStatusGeralPontos(pontos, empresa)
  }, [pontos, empresa])

  // Menor data de abertura entre os pontos agendados
  const menorDataAberturaGeral = useMemo(() => {
    if (!statusGeralAbertura.pontosAgendados.length) return null
    const timestamps = statusGeralAbertura.pontosAgendados
      .map((item) => new Date(item.dataAbertura).getTime())
      .filter((t) => !isNaN(t))
    if (!timestamps.length) return null
    return new Date(Math.min(...timestamps)).toISOString()
  }, [statusGeralAbertura])

  // Reset de destravamento ao alternar de ponto ou atualizar horários
  useEffect(() => {
    setAberturaConcluidaLocal(false)
  }, [selectedPontoId, infoAberturaPonto.dataAbertura, empresa?.escala_abre_em])

  // Bloqueio efetivo para o ponto aberto no momento
  const pontoBloqueadoPorAgendamento = useMemo(() => {
    if (!infoAberturaPonto.estaAgendado || aberturaConcluidaLocal) return false
    const targetMs = new Date(infoAberturaPonto.dataAbertura).getTime()
    return !isNaN(targetMs) && targetMs > Date.now()
  }, [infoAberturaPonto, aberturaConcluidaLocal])

  // Bloqueio geral quando todos os pontos estão agendados
  const todosPontosBloqueados = useMemo(() => {
    if (!statusGeralAbertura.todosAgendados || aberturaConcluidaLocal || !menorDataAberturaGeral) {
      return false
    }
    const targetMs = new Date(menorDataAberturaGeral).getTime()
    return !isNaN(targetMs) && targetMs > Date.now()
  }, [statusGeralAbertura, aberturaConcluidaLocal, menorDataAberturaGeral])

  const handleAberturaFinalizada = useCallback(() => {
    setAberturaConcluidaLocal(true)
    showToast?.('🎉 Escala liberada! As reservas estão abertas.', 'success')
  }, [showToast])

  // Turnos filtrados pelo ponto selecionado
  const turnosFiltrados = useMemo(
    () => (selectedPontoId ? turnos.filter((t) => t.ponto_id === selectedPontoId) : []),
    [turnos, selectedPontoId]
  )

  // Agrupar turnos por dia (ex: SEGUNDA-FEIRA, TERÇA-FEIRA, etc.)
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

  // Ordem cronológica fixa dos dias da semana
  const diasOrdenados = useMemo(
    () => Object.keys(turnosPorDia).sort(compararDias),
    [turnosPorDia]
  )

  // Mapa de reservas agrupadas por turno_id
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

  // Contagem e métricas de vagas por ponto
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

  // Resumo de cotas e análise de conflitos do colaborador atual
  const resumoColaborador = useMemo(
    () =>
      calcularResumoColaborador({
        empresa,
        pontos,
        turnos,
        reservas,
        deviceId,
      }),
    [empresa, pontos, turnos, reservas, deviceId]
  )

  // Gerenciamento de acordeons por dia da semana com persistência por empresa
  const { isDiaAberto, toggleDia, toggleTodosDias, algumDiaExpandido } = useDiasAcordeon(
    selectedPontoId,
    diasOrdenados,
    empresa?.id
  )

  // Copiar escala formatada para o WhatsApp
  const handleCopiar = useCallback(async () => {
    const texto = gerarTextoEscala({
      pontos,
      turnos,
      reservasPorTurno,
      selectedPontoId,
      empresa,
      empresaShareUrl,
      termos,
    })

    const copiou = await copiarTextoParaClipboard(texto)
    if (copiou) {
      setCopied(true)
      showToast?.('Escala copiada para a área de transferência! 📋', 'success')
      setTimeout(() => setCopied(false), 2000)
    } else {
      showToast?.('Não foi possível copiar a escala.', 'error')
    }
  }, [
    pontos,
    turnos,
    reservasPorTurno,
    selectedPontoId,
    empresa,
    empresaShareUrl,
    termos,
    showToast,
  ])

  // Status de visibilidade do botão de copiar (WhatsApp)
  const podeCopiarGeral =
    empresa?.copia_whatsapp_geral_ativa !== false &&
    empresa?.termos?.copiaWhatsappGeralAtiva !== false

  const podeCopiarPonto =
    selectedPonto?.copia_whatsapp_ativa !== false &&
    empresa?.termos?.copiaWhatsappPontos?.[selectedPontoId] !== false

  return (
    <>
      {/* Banner de contagem regressiva para todos os pontos (quando nenhum ponto selecionado e todos agendados) */}
      {!selectedPontoId && todosPontosBloqueados && (
        <CountdownTimerBanner
          targetDate={menorDataAberturaGeral}
          onFinish={handleAberturaFinalizada}
        />
      )}

      {/* Banner de contagem regressiva específico do ponto aberto */}
      {selectedPontoId && pontoBloqueadoPorAgendamento && (
        <CountdownTimerBanner
          targetDate={infoAberturaPonto.dataAbertura}
          onFinish={handleAberturaFinalizada}
        />
      )}

      {!selectedPontoId ? (
        <PontoSelectorView
          pontos={pontos}
          vagasPorPonto={vagasPorPonto}
          termos={termos}
          empresa={empresa}
          corretorNome={corretorNome}
          corretorWhatsapp={corretorWhatsapp}
          corretorEmail={corretorEmail}
          cadastroNaoAutorizado={cadastroNaoAutorizado}
          onEditarPerfil={onEditarPerfil}
          onSelectPonto={setSelectedPontoId}
          onCopiar={handleCopiar}
          copied={copied}
          podeCopiar={podeCopiarGeral}
          resumoColaborador={resumoColaborador}
          onAbrirAgenda={() => setShowAgendaModal(true)}
        />
      ) : (
        <PontoTurnosView
          selectedPonto={selectedPonto}
          turnosFiltrados={turnosFiltrados}
          turnosPorDia={turnosPorDia}
          reservasPorTurno={reservasPorTurno}
          diasOrdenados={diasOrdenados}
          isDiaAberto={isDiaAberto}
          toggleDia={toggleDia}
          toggleTodosDias={toggleTodosDias}
          algumDiaExpandido={algumDiaExpandido}
          deviceId={deviceId}
          corretorNome={corretorNome}
          corretorWhatsapp={corretorWhatsapp}
          corretorEmail={corretorEmail}
          cadastroNaoAutorizado={cadastroNaoAutorizado}
          onEditarPerfil={onEditarPerfil}
          onVoltar={() => setSelectedPontoId(null)}
          onReservar={onReservar}
          onCancelar={onCancelar}
          onCopiar={handleCopiar}
          copied={copied}
          podeCopiar={podeCopiarPonto}
          termos={termos}
          ocultarNomes={Boolean(empresa?.ocultar_nomes_escala || empresa?.termos?.ocultarNomesEscala)}
          resumoColaborador={resumoColaborador}
          escalaBloqueadaPorAgendamento={pontoBloqueadoPorAgendamento}
          escalaAbreEm={infoAberturaPonto.dataAbertura}
          onAbrirAgenda={() => setShowAgendaModal(true)}
        />
      )}

      {/* Modal de Minha Agenda Consolidada e Exportação (.ics) */}
      <MinhaAgendaModal
        isOpen={showAgendaModal}
        onClose={() => setShowAgendaModal(false)}
        turnosReservados={resumoColaborador?.turnosReservados || []}
        empresa={empresa}
        corretorNome={corretorNome}
        onCancelar={onCancelar}
        showToast={showToast}
        termos={termos}
      />
    </>
  )
}
