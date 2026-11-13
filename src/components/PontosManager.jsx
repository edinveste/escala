import {
  PontosHeader,
  FormAddPonto,
  PontosList,
  DuplicarPontoModal,
  usePontosManager,
} from './pontos'

/**
 * Componente orquestrador da Gestão de Pontos de Captação / Locais de Escala.
 * Totalmente modularizado e componentizado para manutenibilidade, Clean Code e UX fluida.
 */
export default function PontosManager({
  pontos = [],
  turnos = [],
  turnosPorPonto = {},
  vagasPorPonto = {},
  onLimparEscala,
  onDataChanged,
  showToast,
  empresaId,
  empresa = null,
  isFullAdmin = true,
  termos = {},
  onAbrirModalWhatsapp,
  onAbrirModalAbertura,
}) {
  const {
    listaPontos,
    setListaPontos,
    isSavingOrder,
    salvarNovaOrdem,
    alternarVisibilidade,
    addingPonto,
    adicionarPonto,
    renomearPonto,
    excluirPonto,
    modalDuplicarPonto,
    abrirModalDuplicarPonto,
    fecharModalDuplicarPonto,
    duplicarPonto,
    duplicandoPonto,
  } = usePontosManager({
    pontos,
    turnos,
    empresaId,
    onDataChanged,
    showToast,
  })

  return (
    <>
      <div className="card">
        {/* Cabeçalho com indicador de salvamento de ordem */}
        <PontosHeader isSavingOrder={isSavingOrder} termos={termos} />

        {/* Formulário de novo ponto (exclusivo para Administradores) */}
        {isFullAdmin && (
          <FormAddPonto
            onAdd={adicionarPonto}
            isAdding={addingPonto}
            termos={termos}
          />
        )}

        {/* Lista reordenável com SortableJS e ações de cada ponto */}
        <PontosList
          listaPontos={listaPontos}
          setListaPontos={setListaPontos}
          turnosPorPonto={turnosPorPonto}
          vagasPorPonto={vagasPorPonto}
          isFullAdmin={isFullAdmin}
          salvarNovaOrdem={salvarNovaOrdem}
          onToggleAtivo={alternarVisibilidade}
          onRename={renomearPonto}
          onDelete={excluirPonto}
          onDuplicar={abrirModalDuplicarPonto}
          onLimparEscala={onLimparEscala}
          onConfigWhatsapp={(ponto) => onAbrirModalWhatsapp?.(ponto.id)}
          onAgendarAbertura={(pontoId) => onAbrirModalAbertura?.(pontoId)}
          empresa={empresa}
        />
      </div>

      {/* Modal de Duplicação de Ponto e seus Horários */}
      <DuplicarPontoModal
        modalData={modalDuplicarPonto}
        onClose={fecharModalDuplicarPonto}
        onConfirm={duplicarPonto}
        isDuplicating={duplicandoPonto}
        termos={termos}
      />
    </>
  )
}
