import DuplicarDiaModal from './DuplicarDiaModal'
import IncluirPessoaModal from './IncluirPessoaModal'
import EditarTurnoModal from './EditarTurnoModal'
import EditarNomeEmpresaModal from './EditarNomeEmpresaModal'
import AlterarSenhaModal from './AlterarSenhaModal'
import VocabularioModal from '../VocabularioModal'
import WhatsappConfigModal from './whatsapp/WhatsappConfigModal'

/**
 * Agrupador dos modais específicos do painel de administração:
 * Duplicação de dia, inclusão manual de colaborador, edição de turno,
 * edição de nome da empresa, alteração de senha de contingência e vocabulário/nicho.
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
  showModalSenha,
  onCloseSenha,
  showModalVocabulario,
  onCloseVocabulario,
  showModalWhatsapp,
  onCloseWhatsapp,
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

      <AlterarSenhaModal
        isOpen={showModalSenha}
        onClose={onCloseSenha}
        showToast={showToast}
        empresaId={empresaId}
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
    </>
  )
}

