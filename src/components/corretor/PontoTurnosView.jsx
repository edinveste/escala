import { useMemo } from 'react'
import { ArrowLeft, MapPin, Calendar, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import AgendaCalendarIcon from '../icons/AgendaCalendarIcon'
import CorretorIdentityHeader from './CorretorIdentityHeader'
import DiaAcordeonItem from './DiaAcordeonItem'
import CorretorCopyFooter from './CorretorCopyFooter'
import { obterLinkGoogleMaps } from '../../lib/mapsHelper'

/**
 * Visualização dos turnos do ponto selecionado na visão do colaborador.
 * Inclui navegação de retorno, cabeçalho do local, acordeon por dia e rodapé de cópia.
 */
export default function PontoTurnosView({
  selectedPonto,
  turnosFiltrados = [],
  turnosPorDia = {},
  reservasPorTurno = {},
  diasOrdenados = [],
  isDiaAberto,
  toggleDia,
  toggleTodosDias,
  algumDiaExpandido = false,
  deviceId,
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  cadastroNaoAutorizado = false,
  submittingTurnoId = null,
  onEditarPerfil,
  onVoltar,
  onReservar,
  onCancelar,
  onCopiar,
  copied = false,
  podeCopiar = true,
  termos = {},
  ocultarNomes = false,
  resumoColaborador = null,
  escalaBloqueadaPorAgendamento = false,
  escalaAbreEm = null,
  onAbrirAgenda = null,
}) {
  // Vagas reservadas pelo colaborador especificamente neste ponto
  const turnosReservadosNestePonto = useMemo(() => {
    const lista = resumoColaborador?.turnosReservados || []
    if (!selectedPonto?.id) return []
    return lista.filter((t) => t.ponto_id === selectedPonto.id)
  }, [resumoColaborador?.turnosReservados, selectedPonto?.id])

  const totalVagasNestePonto = turnosReservadosNestePonto.length

  return (
    <>
      {/* Botão voltar + cabeçalho com identificação do ponto */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3 -ml-1 p-1 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos pontos
        </button>

        <div className="flex items-center gap-2.5 px-1">
          {selectedPonto?.endereco ? (
            <a
              href={obterLinkGoogleMaps(selectedPonto.endereco)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative p-2 rounded-xl bg-surface-700/80 border border-surface-600/80 hover:bg-surface-600 hover:border-brand-500/50 hover:scale-105 active:scale-95 transition-all flex-shrink-0 min-w-[42px] min-h-[42px] flex items-center justify-center shadow-sm group/maps"
              title={`Abrir no Google Maps:\n${selectedPonto.endereco}`}
              aria-label={`Abrir no Google Maps: ${selectedPonto.endereco}`}
            >
              <GoogleMapsIcon className="w-5 h-5 transition-transform duration-200 group-hover/maps:-translate-y-0.5 drop-shadow-sm" />
            </a>
          ) : (
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0 min-w-[42px] min-h-[42px] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-brand-400" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-100 truncate">
              {selectedPonto?.nome}
            </h2>
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              <span>
                {turnosFiltrados.length} turno{turnosFiltrados.length !== 1 ? 's' : ''} disponíve{turnosFiltrados.length !== 1 ? 'is' : 'l'}
              </span>
              {selectedPonto?.endereco && (
                <>
                  <span>•</span>
                  <a
                    href={obterLinkGoogleMaps(selectedPonto.endereco)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:text-brand-300 hover:underline truncate max-w-[200px] sm:max-w-[320px] inline-flex items-center gap-1.5"
                    title={`Google Maps: ${selectedPonto.endereco}`}
                  >
                    <GoogleMapsIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{selectedPonto.endereco}</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de regras de cotas ou alertas contextuais no ponto (saudação exibida apenas na tela inicial) */}
      <CorretorIdentityHeader
        corretorNome={corretorNome}
        corretorWhatsapp={corretorWhatsapp}
        corretorEmail={corretorEmail}
        cadastroNaoAutorizado={cadastroNaoAutorizado}
        onEditarPerfil={onEditarPerfil}
        termos={termos}
        resumoColaborador={resumoColaborador}
        selectedPontoId={selectedPonto?.id}
        mostrarSaudacao={false}
        mostrarBotaoAgenda={false}
      />

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
          {/* Barra de controle dos dias: Horários agendados neste ponto (à esquerda) + Expandir/Recolher (à direita) */}
          <div className="flex items-center justify-between px-1 mb-1 gap-2">
            <div>
              {totalVagasNestePonto > 0 && onAbrirAgenda ? (
                <button
                  type="button"
                  onClick={onAbrirAgenda}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 active:bg-brand-500/30 border border-brand-500/30 hover:border-brand-500/50 text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 text-xs font-semibold transition-all shadow-sm active:scale-95 group select-none min-h-[36px]"
                  title={`Ver meus ${totalVagasNestePonto} ${totalVagasNestePonto === 1 ? 'horário agendado' : 'horários agendados'} em ${selectedPonto?.nome || 'neste local'}`}
                  aria-label={`Ver meus ${totalVagasNestePonto} ${totalVagasNestePonto === 1 ? 'horário agendado' : 'horários agendados'} em ${selectedPonto?.nome || 'neste local'}`}
                >
                  <AgendaCalendarIcon className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 group-hover:scale-110 transition-transform shrink-0" />
                  <span>
                    {totalVagasNestePonto} {totalVagasNestePonto === 1 ? 'horário garantido' : 'horários garantidos'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-500/70 dark:text-brand-400/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              ) : null}
            </div>

            {/* Botão de Expandir / Recolher todos os dias (no celular: sem a palavra "todos") */}
            <button
              type="button"
              onClick={toggleTodosDias}
              className="text-xs font-medium text-gray-400 hover:text-gray-200 flex items-center gap-1.5 bg-surface-800 hover:bg-surface-700 px-3 py-1.5 rounded-lg transition-colors border border-surface-600/50 min-h-[36px] active:scale-95 shrink-0 select-none shadow-sm"
              title={algumDiaExpandido ? 'Recolher todos os dias' : 'Expandir todos os dias'}
            >
              {algumDiaExpandido ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Recolher<span className="hidden sm:inline"> todos</span>
                  </span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Expandir<span className="hidden sm:inline"> todos</span>
                  </span>
                </>
              )}
            </button>
          </div>

          {diasOrdenados.map((dia) => (
            <DiaAcordeonItem
              key={dia}
              dia={dia}
              turnosDoDia={turnosPorDia[dia] || []}
              reservasPorTurno={reservasPorTurno}
              isAberto={isDiaAberto(dia)}
              onToggle={() => toggleDia(dia)}
              deviceId={deviceId}
              corretorNome={corretorNome}
              corretorWhatsapp={corretorWhatsapp}
              corretorEmail={corretorEmail}
              submittingTurnoId={submittingTurnoId}
              onReservar={onReservar}
              onCancelar={onCancelar}
              termos={termos}
              ocultarNomes={ocultarNomes}
              resumoColaborador={resumoColaborador}
              escalaBloqueadaPorAgendamento={escalaBloqueadaPorAgendamento}
              escalaAbreEm={escalaAbreEm}
            />
          ))}
        </div>
      )}

      {/* Footer com cópia direcionada ao ponto */}
      {podeCopiar && (
        <CorretorCopyFooter
          onCopiar={onCopiar}
          copied={copied}
          pontoNome={selectedPonto?.nome}
        />
      )}
    </>
  )
}

