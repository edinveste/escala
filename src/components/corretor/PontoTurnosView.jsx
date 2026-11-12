import { ArrowLeft, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import CorretorIdentityHeader from './CorretorIdentityHeader'
import DiaAcordeonItem from './DiaAcordeonItem'
import CorretorCopyFooter from './CorretorCopyFooter'

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
}) {
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
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
            <MapPin className="w-5 h-5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-100 truncate">
              {selectedPonto?.nome}
            </h2>
            <p className="text-xs text-gray-500">
              {turnosFiltrados.length} turno{turnosFiltrados.length !== 1 ? 's' : ''} disponíve{turnosFiltrados.length !== 1 ? 'is' : 'l'}
            </p>
          </div>
        </div>
      </div>

      {/* Identificação do participante com suporte a edição e resumo de regras */}
      <CorretorIdentityHeader
        corretorNome={corretorNome}
        corretorWhatsapp={corretorWhatsapp}
        corretorEmail={corretorEmail}
        cadastroNaoAutorizado={cadastroNaoAutorizado}
        onEditarPerfil={onEditarPerfil}
        termos={termos}
        resumoColaborador={resumoColaborador}
        selectedPontoId={selectedPonto?.id}
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
          {/* Barra de controle / contagem e botão unificado Expandir/Recolher todos */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs text-gray-400 font-medium">
              {diasOrdenados.length} dia{diasOrdenados.length !== 1 ? 's' : ''} com horários
            </span>
            <button
              type="button"
              onClick={toggleTodosDias}
              className="text-[11px] font-medium text-gray-400 hover:text-gray-200 flex items-center gap-1.5 bg-surface-800 hover:bg-surface-700 px-2.5 py-1 rounded-lg transition-colors border border-surface-600/50 min-h-[36px]"
              title={algumDiaExpandido ? 'Recolher todos os dias' : 'Expandir todos os dias'}
            >
              {algumDiaExpandido ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Recolher todos</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Expandir todos</span>
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
              onReservar={onReservar}
              onCancelar={onCancelar}
              termos={termos}
              ocultarNomes={ocultarNomes}
              resumoColaborador={resumoColaborador}
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

