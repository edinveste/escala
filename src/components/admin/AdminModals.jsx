import DuplicarDiaModal from './DuplicarDiaModal'
import IncluirPessoaModal from './IncluirPessoaModal'
import EditarTurnoModal from './EditarTurnoModal'
import EditarNomeEmpresaModal from './EditarNomeEmpresaModal'
import VocabularioModal from '../VocabularioModal'
import WhatsappConfigModal from './whatsapp/WhatsappConfigModal'
import AgendamentoModal from './abertura/AgendamentoModal'

/**
 * Agrupador dos modais específicos do painel de administração:
 * Duplicação de dia, inclusão manual de colaborador, edição de turno,
 * edição de nome da empresa, vocabulário/nicho, configuração de WhatsApp
 * e agendamento de abertura programada (global, por locais ou individual).
 */
export default function AdminModals({
  modalDuplicar,
  onCloseDuplicar,
  modalIncluirPessoa,
  onCloseIncluirPessoa,
  modalEditarTurno,
  onCloseEditarTurno,
  showModalNome,
  onCloseNome,
  showModalVocabulario,
  onCloseVocabulario,
  showModalWhatsapp,
  onCloseWhatsapp,
  showModalAgendamento,
  onCloseAgendamento,
  pontos = [],
  empresaId,
  empresa,
  termos,
  onDataChanged,
  onEmpresaUpdated,
  showToast,
}) {
  return (
    <>
      <DuplicarDiaModal
        modalDuplicar={modalDuplicar}
        onClose={onCloseDuplicar}
        empresaId={empresaId}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />

      <IncluirPessoaModal
        modalIncluirPessoa={modalIncluirPessoa}
        onClose={onCloseIncluirPessoa}
        empresaId={empresaId}
        termos={termos}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />

      <EditarTurnoModal
        modalEditarTurno={modalEditarTurno}
        onClose={onCloseEditarTurno}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />

      <EditarNomeEmpresaModal
        isOpen={Boolean(showModalNome)}
        onClose={onCloseNome}
        empresa={empresa}
        onEmpresaUpdated={onEmpresaUpdated}
        showToast={showToast}
      />

      <VocabularioModal
        isOpen={showModalVocabulario}
        onClose={onCloseVocabulario}
        empresa={empresa}
        onUpdateEmpresa={onEmpresaUpdated}
        showToast={showToast}
      />

      <WhatsappConfigModal
        isOpen={Boolean(showModalWhatsapp)}
        onClose={onCloseWhatsapp}
        empresa={empresa}
        pontos={pontos}
        initialAlvoId={typeof showModalWhatsapp === 'string' ? showModalWhatsapp : 'geral'}
        onEmpresaUpdated={onEmpresaUpdated}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />

      <AgendamentoModal
        isOpen={Boolean(showModalAgendamento)}
        onClose={onCloseAgendamento}
        empresa={empresa}
        pontos={pontos}
        alvoPontoId={typeof showModalAgendamento === 'string' ? showModalAgendamento : null}
        termos={termos}
        onEmpresaUpdated={onEmpresaUpdated}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />
    </>
  )
}

