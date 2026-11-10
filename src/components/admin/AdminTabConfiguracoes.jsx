import LayoutPreferencesCard from './LayoutPreferencesCard'
import LinkSeguroManager from './LinkSeguroManager'
import VocabularioCard from './VocabularioCard'
import AdminSenhaCard from './AdminSenhaCard'

/**
 * Seção / Aba de Ajustes e Configurações da Empresa.
 * Reúne preferências de layout, link seguro anti-espionagem,
 * vocabulário personalizado de nicho e alteração de senha de contingência.
 */
export default function AdminTabConfiguracoes({
  layoutMode,
  onTrocarLayout,
  empresa,
  onEmpresaUpdated,
  showToast,
  isFullAdmin,
  termos,
  onAbrirModalVocabulario,
  onAbrirModalSenha,
  hideLayoutPreferences = false,
}) {
  return (
    <div className="space-y-2.5 animate-fade-in">
      {!hideLayoutPreferences && (
        <LayoutPreferencesCard
          layoutMode={layoutMode}
          onTrocarLayout={onTrocarLayout}
        />
      )}

      <LinkSeguroManager
        empresa={empresa}
        onEmpresaUpdated={onEmpresaUpdated}
        showToast={showToast}
        isFullAdmin={isFullAdmin}
      />

      <VocabularioCard
        isFullAdmin={isFullAdmin}
        termos={termos}
        onAbrirModalVocabulario={onAbrirModalVocabulario}
      />

      <AdminSenhaCard
        isFullAdmin={isFullAdmin}
        onAbrirModalSenha={onAbrirModalSenha}
      />
    </div>
  )
}

