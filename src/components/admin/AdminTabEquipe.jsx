import ColaboradoresEscalaManager from '../ColaboradoresEscalaManager'
import EquipeManager from '../EquipeManager'
import GestoresManager from '../GestoresManager'

/**
 * Seção / Aba de Gestão de Equipe e Coordenadores.
 * Apresenta:
 * 1. Colaboradores na Escala (vagas marcadas ativas, horários e edição de nome)
 * 2. Proteção Contra Invasores (equipe pré-autorizada / whitelist)
 * 3. Coordenadores & Gestores (gestores administrativos com RBAC)
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
  reservas = [],
  turnos = [],
  pontos = [],
  onDataChanged,
  onRemoverReserva,
}) {
  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* ═══ 1. COLABORADORES NA ESCALA (VAGAS MARCADAS ATIVAS) ═══ */}
      <ColaboradoresEscalaManager
        reservas={reservas}
        turnos={turnos}
        pontos={pontos}
        empresaId={empresaId}
        isFullAdmin={isFullAdmin}
        onDataChanged={onDataChanged}
        onRemoverReserva={onRemoverReserva}
        showToast={showToast}
        termos={termos}
      />

      {/* ═══ 2. PROTEÇÃO CONTRA INVASORES (EQUIPE PRÉ-AUTORIZADA) ═══ */}
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

      {/* ═══ 3. COORDENADORES & GESTORES (ADMINISTRATIVO / RBAC) ═══ */}
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
