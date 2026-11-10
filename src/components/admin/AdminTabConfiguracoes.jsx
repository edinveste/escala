import LinkSeguroManager from './LinkSeguroManager'
import EscalaPrivacidadeCard from './EscalaPrivacidadeCard'
import VocabularioCard from './VocabularioCard'
import AdminSenhaCard from './AdminSenhaCard'
import WhatsappConfigCard from './whatsapp/WhatsappConfigCard'

/**
 * Seção / Aba de Ajustes e Configurações da Empresa.
 * Reúne link seguro anti-espionagem, mensagens customizadas de WhatsApp,
 * vocabulário personalizado de nicho e alteração de senha de contingência.
 */
export default function AdminTabConfiguracoes({
  empresa,
  onEmpresaUpdated,
  showToast,
  isFullAdmin,
  termos,
  onAbrirModalVocabulario,
  onAbrirModalSenha,
  onAbrirModalWhatsapp,
}) {
  return (
    <div className="space-y-2.5 animate-fade-in">
      <LinkSeguroManager
        empresa={empresa}
        onEmpresaUpdated={onEmpresaUpdated}
        showToast={showToast}
        isFullAdmin={isFullAdmin}
      />

      <EscalaPrivacidadeCard
        empresa={empresa}
        onEmpresaUpdated={onEmpresaUpdated}
        showToast={showToast}
        isFullAdmin={isFullAdmin}
        termos={termos}
      />

      <WhatsappConfigCard
        empresa={empresa}
        isFullAdmin={isFullAdmin}
        onAbrirModalWhatsapp={onAbrirModalWhatsapp}
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

