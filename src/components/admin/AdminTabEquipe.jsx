import EquipeManager from '../EquipeManager'
import GestoresManager from '../GestoresManager'

/**
 * Seção / Aba de Gestão de Equipe e Coordenadores.
 * Integra a equipe autorizada com controle de acesso e os gestores com RBAC.
 */
export default function AdminTabEquipe({
  empresaId,
  empresaNome,
  empresa,
  onEmpresaUpdated,
  isFullAdmin,
  currentUserId,
  showToast,
  termos,
}) {
  return (
    <div className="space-y-2.5 animate-fade-in">
      <EquipeManager
        empresaId={empresaId}
        empresaNome={empresaNome}
        exigirCadastro={empresa?.exigir_cadastro_previo || false}
        onExigirCadastroChange={onEmpresaUpdated}
        tipoValidacao={empresa?.tipo_validacao_equipe || 'whatsapp'}
        onTipoValidacaoChange={onEmpresaUpdated}
        isFullAdmin={isFullAdmin}
        showToast={showToast}
        termos={termos}
      />

      {isFullAdmin && (
        <GestoresManager
          empresaId={empresaId}
          empresaNome={empresaNome}
          isFullAdmin={isFullAdmin}
          currentUserId={currentUserId}
          showToast={showToast}
          termos={termos}
        />
      )}
    </div>
  )
}

