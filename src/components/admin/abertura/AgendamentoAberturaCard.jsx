import { useState, useMemo } from 'react'
import {
  CalendarClock,
  Clock,
  Unlock,
  CheckCircle2,
  Calendar,
  ChevronDown,
  MapPin,
} from 'lucide-react'
import { useCountdown } from '../../corretor/countdown/useCountdown'
import CountdownBadge from '../../corretor/countdown/CountdownBadge'
import { useConfirm } from '../../ConfirmModal'
import { useAgendamentoAbertura } from './useAgendamentoAbertura'
import {
  calcularStatusGeralPontos,
  formatarDataAberturaCurta,
} from '../../../lib/aberturaHelper'
import AgendamentoModal from './AgendamentoModal'

/**
 * AgendamentoAberturaCard — Card Retrátil de Gestão de Abertura Programada no Painel Administrativo.
 * Segue rigorosamente o padrão visual e de dimensões dos demais cards de configuração (ex: RegrasEscalaCard),
 * com cabeçalho retrátil de altura consistente, seta de expandir/encolher, contagem regressiva em tempo real
 * e ações contextuais bem distribuídas.
 */
export default function AgendamentoAberturaCard({
  empresa,
  pontos = [],
  termos = {},
  onEmpresaUpdated,
  onDataChanged,
  showToast,
  isFullAdmin = true,
}) {
  const [expandido, setExpandido] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const confirm = useConfirm()

  const { statusAgendamento, liberarImediatamente, salvando } = useAgendamentoAbertura({
    empresa,
    pontos,
    onEmpresaUpdated,
    onDataChanged,
    showToast,
    onCloseModal: () => setModalAberto(false),
  })

  const targetDate = statusAgendamento.targetDate
  const countdown = useCountdown(targetDate)

  const statusGeral = useMemo(
    () => calcularStatusGeralPontos(pontos, empresa),
    [pontos, empresa]
  )

  const pontosLabel = termos.pontos || 'locais'
  const pontoLabel = termos.ponto || 'local'

  // Data formatada completa
  const dataFormatada = useMemo(() => {
    if (!targetDate) return ''
    try {
      const d = new Date(targetDate)
      return d.toLocaleString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }, [targetDate])

  // Data formatada curta para o subtítulo do cabeçalho
  const dataFormatadaCurta = useMemo(() => {
    return formatarDataAberturaCurta(targetDate)
  }, [targetDate])

  const pontosIdsEscopo =
    empresa?.escala_abre_pontos_ids !== undefined && empresa?.escala_abre_pontos_ids !== null
      ? empresa?.escala_abre_pontos_ids
      : empresa?.termos?.escala_abre_pontos_ids || null

  // Texto compacto para o badge do cabeçalho (evita quebra de linha)
  const escopoBadgeTexto = useMemo(() => {
    if (!pontosIdsEscopo || !Array.isArray(pontosIdsEscopo) || pontosIdsEscopo.length === 0) {
      return 'Geral'
    }
    const count = pontosIdsEscopo.length
    const labelCurta =
      pontosLabel.length > 10
        ? count === 1
          ? 'local'
          : 'locais'
        : count === 1
        ? pontoLabel.toLowerCase()
        : pontosLabel.toLowerCase()
    return `${count} ${labelCurta}`
  }, [pontosIdsEscopo, pontoLabel, pontosLabel])

  // Texto completo para o painel expandido (com nomes dos locais selecionados)
  const escopoTextoCompleto = useMemo(() => {
    if (!pontosIdsEscopo || !Array.isArray(pontosIdsEscopo) || pontosIdsEscopo.length === 0) {
      return `Todos os ${pontosLabel.toLowerCase()}`
    }
    const nomes = pontos
      .filter((p) => pontosIdsEscopo.includes(p.id))
      .map((p) => p.nome)
    if (nomes.length === 0) {
      return `${pontosIdsEscopo.length} ${pontosLabel.toLowerCase()} selecionados`
    }
    return `${pontosIdsEscopo.length} ${pontosLabel.toLowerCase()} (${nomes.join(', ')})`
  }, [pontosIdsEscopo, pontos, pontosLabel])

  // Tempo restante formatado (ex: "10:54:46" ou "1d 04:12:30")
  const tempoRestanteTexto = useMemo(() => {
    if (!statusAgendamento.agendado || !targetDate) return ''
    const parts = []
    if (countdown.dias > 0) parts.push(`${countdown.dias}d`)
    const hh = String(countdown.horas).padStart(2, '0')
    const mm = String(countdown.minutos).padStart(2, '0')
    const ss = String(countdown.segundos).padStart(2, '0')
    parts.push(`${hh}:${mm}:${ss}`)
    return parts.join(' ')
  }, [
    statusAgendamento.agendado,
    targetDate,
    countdown.dias,
    countdown.horas,
    countdown.minutos,
    countdown.segundos,
  ])

  // Subtítulo do cabeçalho
  const subtituloHeader = useMemo(() => {
    if (statusAgendamento.agendado) {
      return `Abertura ${dataFormatadaCurta ? `em ${dataFormatadaCurta}` : 'programada'}${
        tempoRestanteTexto ? ` • Faltam ${tempoRestanteTexto}` : ''
      }`
    }
    if (statusGeral.totalAgendados > 0) {
      return `${statusGeral.totalAgendados} de ${statusGeral.totalPontos} ${pontosLabel.toLowerCase()} com abertura programada`
    }
    return 'Escala liberada imediatamente. Programe data e hora para travar reservas.'
  }, [
    statusAgendamento.agendado,
    dataFormatadaCurta,
    tempoRestanteTexto,
    statusGeral.totalAgendados,
    statusGeral.totalPontos,
    pontosLabel,
  ])

  if (!isFullAdmin) return null

  const handleLiberarAgora = async () => {
    const aceitou = await confirm({
      title: 'Liberar Escala Imediatamente?',
      message:
        'O agendamento geral será removido e todas as reservas ficarão disponíveis para os corretores agora mesmo.',
      confirmText: 'Sim, Liberar Agora',
      cancelText: 'Cancelar',
      variant: 'warning',
    })

    if (aceitou) {
      await liberarImediatamente()
    }
  }

  const estaAgendadoGeral = statusAgendamento.agendado
  const temPontosAgendados = statusGeral.totalAgendados > 0
  const estaAtivo = estaAgendadoGeral || temPontosAgendados

  return (
    <>
      <div className="card bg-surface-800/90 border-surface-600 space-y-3">
        {/* Cabeçalho retrátil — mesmo padrão visual de RegrasEscalaCard */}
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left min-h-[44px]"
          aria-expanded={expandido}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl border flex-shrink-0 transition-colors ${
                estaAtivo
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              }`}
            >
              <CalendarClock className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-200 truncate">
                  Abertura Programada
                </h3>

                {estaAgendadoGeral ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3 h-3 animate-spin-slow" />
                    <span>Agendada ({escopoBadgeTexto})</span>
                  </span>
                ) : temPontosAgendados ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{statusGeral.totalAgendados} agendado(s)</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Aberta</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-0.5 leading-snug truncate">
                {subtituloHeader}
              </p>
            </div>
          </div>

          <div
            className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 flex-shrink-0 ${
              expandido ? 'rotate-180 text-brand-400 bg-brand-500/15' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>

        {/* Conteúdo expandido */}
        {expandido && (
          <div className="pt-3 border-t border-surface-600/60 space-y-3 sm:space-y-4 animate-fade-in">
            {/* Detalhes do status */}
            {estaAgendadoGeral ? (
              <div className="p-3.5 rounded-xl bg-surface-900/50 border border-surface-600/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      <span className="text-gray-400">Data de Liberação:</span>
                      <span className="font-bold text-gray-100 capitalize">
                        {dataFormatada}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-gray-400">Escopo:</span>
                      <span className="text-gray-200 font-medium truncate">
                        {escopoTextoCompleto}
                      </span>
                    </div>
                  </div>

                  {/* Display de Contagem Regressiva */}
                  <div className="flex items-center gap-1 self-start sm:self-center bg-surface-800/90 p-1.5 rounded-xl border border-surface-600/80 shadow-inner flex-shrink-0">
                    {countdown.dias > 0 && (
                      <>
                        <CountdownBadge valor={countdown.dias} label="Dias" labelCurta="D" />
                        <span className="text-gray-500 font-bold text-xs px-0.5 pb-2 select-none">
                          :
                        </span>
                      </>
                    )}
                    <CountdownBadge valor={countdown.horas} label="Horas" labelCurta="H" />
                    <span className="text-gray-500 font-bold text-xs px-0.5 pb-2 select-none">
                      :
                    </span>
                    <CountdownBadge valor={countdown.minutos} label="Min" labelCurta="M" />
                    <span className="text-gray-500 font-bold text-xs px-0.5 pb-2 select-none">
                      :
                    </span>
                    <CountdownBadge
                      valor={countdown.segundos}
                      label="Seg"
                      labelCurta="S"
                      destaque={true}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed border-t border-surface-700/60 pt-2.5">
                  🛡️ <span className="font-semibold text-gray-300">Trava ativa:</span> As
                  reservas ficam bloqueadas para os colaboradores até o horário agendado. Ao
                  zerar a contagem regressiva, a escala destrava automaticamente em tempo real
                  sem recarregar a página.
                </p>
              </div>
            ) : temPontosAgendados ? (
              <div className="p-3.5 rounded-xl bg-surface-900/50 border border-surface-600/70 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    Aberturas Programadas Individuais ({statusGeral.totalAgendados} de{' '}
                    {statusGeral.totalPontos})
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Alguns {pontosLabel.toLowerCase()} possuem horário de abertura individual
                  configurado diretamente em seus turnos. Os demais locais estão com reservas
                  abertas imediatamente.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {statusGeral.pontosAgendados.map(({ ponto, dataAbertura }) => (
                    <span
                      key={ponto.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-800 border border-surface-700 text-xs text-gray-200"
                    >
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span className="font-medium">{ponto.nome}:</span>
                      <span className="text-amber-300 font-mono text-[11px]">
                        {formatarDataAberturaCurta(dataAbertura)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-surface-900/50 border border-surface-600/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Escala Aberta Imediatamente</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  No momento, as reservas estão livres para os colaboradores preencherem vagas.
                  Você pode programar uma data e hora futura para travar a escala (geral ou em
                  locais selecionados) e liberar simultaneamente com contagem regressiva justa.
                </p>
              </div>
            )}

            {/* Barra de ações */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-gray-400 text-center sm:text-left">
                {estaAtivo
                  ? 'Altere o horário de abertura ou destrave a escala imediatamente.'
                  : 'Defina uma data e horário futuro para abertura programada.'}
              </p>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {estaAtivo && (
                  <button
                    type="button"
                    onClick={handleLiberarAgora}
                    disabled={salvando}
                    className="px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all min-h-[40px] flex items-center justify-center gap-1.5 disabled:opacity-50 flex-1 sm:flex-initial"
                    title="Remove o agendamento e abre a escala imediatamente"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    {salvando ? 'Liberando...' : 'Liberar Agora'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModalAberto(true)}
                  className="btn-primary text-xs font-semibold px-4 py-2.5 min-h-[40px] flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {estaAtivo ? 'Alterar Horário' : 'Programar Abertura'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Agendamento */}
      <AgendamentoModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        empresa={empresa}
        pontos={pontos}
        termos={termos}
        onEmpresaUpdated={onEmpresaUpdated}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />
    </>
  )
}
