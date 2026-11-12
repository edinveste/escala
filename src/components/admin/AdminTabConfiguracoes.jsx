import LinkSeguroManager from './LinkSeguroManager'
import EmpresaNomeCard from './EmpresaNomeCard'
import EscalaPrivacidadeCard from './EscalaPrivacidadeCard'
import RegrasEscalaCard from './RegrasEscalaCard'
import VocabularioCard from './VocabularioCard'
import WhatsappConfigCard from './whatsapp/WhatsappConfigCard'

/**
 * Seção / Aba de Ajustes e Configurações da Empresa.
 * Reúne link seguro anti-espionagem, nome oficial da empresa, privacidade,
 * mensagens customizadas de WhatsApp e vocabulário personalizado de nicho.
 */
export default function AdminTabConfiguracoes({
  empresa,
  pontos = [],
  onEmpresaUpdated,
  showToast,
  isFullAdmin,
  termos,
  onAbrirModalNome,
  onAbrirModalVocabulario,
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

      <EmpresaNomeCard
        empresa={empresa}
        isFullAdmin={isFullAdmin}
        onAbrirModalNome={onAbrirModalNome}
      />

      <EscalaPrivacidadeCard
        empresa={empresa}
        onEmpresaUpdated={onEmpresaUpdated}
        showToast={showToast}
        isFullAdmin={isFullAdmin}
        termos={termos}
      />

      <RegrasEscalaCard
        empresa={empresa}
        pontos={pontos}
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
    </div>
  )
}

