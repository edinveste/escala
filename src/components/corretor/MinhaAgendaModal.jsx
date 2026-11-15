import { useMemo, useState, useEffect } from 'react'
import {
  Calendar,
  X,
  MapPin,
  Clock,
  Trash2,
  ExternalLink,
  FileText,
} from 'lucide-react'
import { compararDias, formatarDiaComData } from '../../lib/diasSemana'
import { gerarGoogleCalendarUrl } from '../../lib/icsHelper'
import { baixarAgendaPdf } from '../../lib/agendaPdfHelper'
import { obterLinkGoogleMaps } from '../../lib/mapsHelper'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import AgendaCalendarIcon from '../icons/AgendaCalendarIcon'

/**
 * MinhaAgendaModal — Visualização consolidada dos horários do colaborador
 * na semana corrente ou direcionada ao ponto individual aberto, com botão fixo
 * para Baixar em PDF no topo e botão do Google Agenda nos cards de horários.
 */
export default function MinhaAgendaModal({
  isOpen,
  onClose,
  turnosReservados = [],
  empresa = null,
  corretorNome = '',
  onCancelar,
  showToast,
  termos = {},
  pontoAtivo = null,
}) {
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [mostrarApenasPonto, setMostrarApenasPonto] = useState(Boolean(pontoAtivo))

  // Sempre que o modal for aberto ou o pontoAtivo mudar, sincroniza o filtro inicial
  useEffect(() => {
    if (isOpen) {
      setMostrarApenasPonto(Boolean(pontoAtivo))
    }
  }, [isOpen, pontoAtivo])

  // Turnos deste ponto específico
  const turnosDoPonto = useMemo(() => {
    if (!pontoAtivo?.id) return []
    return turnosReservados.filter((t) => t.ponto_id === pontoAtivo.id)
  }, [turnosReservados, pontoAtivo?.id])

  // Turnos exibidos conforme o filtro ativo
  const turnosFiltrados = useMemo(() => {
    if (mostrarApenasPonto && pontoAtivo?.id) {
      return turnosDoPonto
    }
    return turnosReservados
  }, [mostrarApenasPonto, pontoAtivo?.id, turnosDoPonto, turnosReservados])

  // Ordena os turnos cronologicamente por dia e ordem/horário
  const turnosOrdenados = useMemo(() => {
    return [...turnosFiltrados].sort((a, b) => {
      const cmpDia = compararDias(a.dia, b.dia)
      if (cmpDia !== 0) return cmpDia
      return (a.ordem ?? 0) - (b.ordem ?? 0)
    })
  }, [turnosFiltrados])

  const temOutrosPontos = Boolean(
    pontoAtivo && turnosReservados.length > turnosDoPonto.length
  )

  // Baixar agenda formatada em PDF
  const handleBaixarPdf = async () => {
    if (turnosOrdenados.length === 0) {
      showToast?.('Nenhum horário reservado para exportar.', 'warning')
      return
    }

    try {
      setGerandoPdf(true)
      showToast?.('Gerando PDF da sua agenda... 📄', 'info')
      await baixarAgendaPdf({
        turnos: turnosOrdenados,
        empresa,
        corretorNome,
      })
      showToast?.('PDF baixado com sucesso! ✅', 'success')
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      showToast?.('Erro ao gerar PDF da agenda.', 'error')
    } finally {
      setGerandoPdf(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="minha-agenda-titulo"
        onClick={(e) => e.stopPropagation()}
        className="card w-full sm:max-w-lg bg-surface-800 border-surface-600 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-scale-in"
      >
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 border-b border-surface-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0">
              <AgendaCalendarIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="minha-agenda-titulo"
                className="text-base sm:text-lg font-bold text-gray-100 truncate"
              >
                {mostrarApenasPonto && pontoAtivo?.nome
                  ? `Minha Agenda — ${pontoAtivo.nome}`
                  : 'Minha Agenda da Semana'}
              </h2>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {mostrarApenasPonto && pontoAtivo?.nome
                  ? `Horários em ${pontoAtivo.nome}`
                  : corretorNome
                  ? `Horários de ${corretorNome}`
                  : 'Seus horários confirmados'}{' '}
                •{' '}
                <strong className="text-brand-300 font-semibold">{turnosOrdenados.length}</strong>{' '}
                {turnosOrdenados.length === 1 ? 'vaga garantida' : 'vagas garantidas'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            aria-label="Fechar agenda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Escopo: Apenas este Ponto vs Todos os Pontos */}
        {temOutrosPontos && (
          <div className="px-4 sm:px-5 py-2 border-b border-surface-700/80 bg-surface-850/60 flex items-center gap-2 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setMostrarApenasPonto(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 min-h-[32px] ${
                mostrarApenasPonto
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700 border border-transparent'
              }`}
            >
              Apenas {pontoAtivo.nome} ({turnosDoPonto.length})
            </button>
            <button
              type="button"
              onClick={() => setMostrarApenasPonto(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 min-h-[32px] ${
                !mostrarApenasPonto
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700 border border-transparent'
              }`}
            >
              Todos os locais ({turnosReservados.length})
            </button>
          </div>
        )}

        {/* Bloco Fixo no Topo: Baixar em PDF */}
        {turnosOrdenados.length > 0 && (
          <div className="p-4 sm:p-5 border-b border-surface-700/80 bg-surface-850 shrink-0">
            <button
              type="button"
              onClick={handleBaixarPdf}
              disabled={gerandoPdf}
              className="btn-primary w-full py-2.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all min-h-[44px] disabled:opacity-60"
            >
              <FileText className="w-4 h-4" />
              <span>{gerandoPdf ? 'Gerando PDF...' : 'Baixar Agenda em PDF'}</span>
            </button>
          </div>
        )}

        {/* Área de rolagem: Lista dos turnos */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {turnosOrdenados.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-700 text-gray-400 flex items-center justify-center mx-auto">
                <AgendaCalendarIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-300">
                {mostrarApenasPonto && pontoAtivo?.nome
                  ? `Você não possui vagas reservadas em ${pontoAtivo.nome}.`
                  : 'Você ainda não possui vagas reservadas nesta semana.'}
              </p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Navegue pelos {termos?.pontos?.toLowerCase() || 'locais'} da escala e clique no botão para garantir seus horários.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {mostrarApenasPonto && pontoAtivo?.nome
                    ? `Horários em ${pontoAtivo.nome} (${turnosOrdenados.length})`
                    : `Horários Confirmados (${turnosOrdenados.length})`}
                </span>
              </div>

              {turnosOrdenados.map((turno) => {
                const diaComData = formatarDiaComData(turno.dia)
                const googleUrl = gerarGoogleCalendarUrl({
                  turno,
                  empresa,
                  corretorNome,
                })

                return (
                  <div
                    key={turno.reservaId || turno.id}
                    className="p-3.5 rounded-xl bg-surface-700/60 border border-surface-600/80 hover:border-surface-500 transition-all space-y-2.5 shadow-sm"
                  >
                    {/* Topo do Card: Dia, Horário, Local e Lixeira de Cancelar */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-300">
                          <AgendaCalendarIcon className="w-3.5 h-3.5 shrink-0 text-brand-400" />
                          <span className="truncate">{diaComData}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-100">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                          <span>{turno.horario}</span>
                        </div>

                        {turno.pontoNome && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                            <span className="truncate">{turno.pontoNome}</span>
                            {turno.pontoEndereco && (
                              <a
                                href={obterLinkGoogleMaps(turno.pontoEndereco)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-400 hover:text-brand-300 ml-1 inline-flex items-center gap-0.5"
                                title={`Abrir no Google Maps: ${turno.pontoEndereco}`}
                              >
                                <GoogleMapsIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Botão de Cancelar Vaga */}
                      {onCancelar && turno.reservaId && (
                        <button
                          type="button"
                          onClick={() => onCancelar(turno.reservaId)}
                          title="Cancelar esta vaga"
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Botão Individual: Adicionar este horário ao Google Agenda */}
                    <div className="pt-2 border-t border-surface-600/60 flex items-center justify-between gap-2">
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-600 text-gray-200 text-xs font-semibold border border-surface-600/80 hover:border-brand-500/50 transition-colors min-h-[36px]"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-brand-400" />
                        <span>Adicionar ao Google Agenda</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-3 sm:p-4 border-t border-surface-700 bg-surface-800/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary w-full sm:w-auto text-xs py-2 px-4 min-h-[40px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
