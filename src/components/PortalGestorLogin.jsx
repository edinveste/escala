import {
  usePortalAuth,
  PortalHeader,
  PortalCardHeader,
  PortalFeedback,
  PortalLoginForm,
  PortalCadastroForm,
  PortalRecuperarSenhaForm,
  PortalSecurityFooter,
} from './portal-gestor'

/**
 * Tela institucional de Autenticação do Portal do Gestor (app.escalafacil.online).
 * Orquestra de forma modular e limpa os fluxos de Login (Supabase Auth), Cadastro
 * e Recuperação de Senha.
 */
export default function PortalGestorLogin({ onSuccess, showToast, empresaId, empresaNome: _empresaNomeProp }) {
  const {
    modo,
    switchModo,
    email,
    setEmail,
    senha,
    setSenha,
    nome,
    setNome,
    empresaNome,
    setEmpresaNome,
    showSenha,
    setShowSenha,
    enviando,
    erroMsg,
    sucessoMsg,
    emailInputRef,
    handleLogin,
    handleCadastro,
    handleRecuperarSenha,
  } = usePortalAuth({ onSuccess, showToast, empresaId })

  return (
    <div className="min-h-screen flex flex-col bg-surface-900 text-gray-100 selection:bg-brand-500/30">
      {/* Topo Institucional do Portal */}
      <PortalHeader />

      {/* Área Central de Autenticação */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-8">
        <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-scale-in">
          {/* Brilho decorativo sutil */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Cabeçalho do Card (Ícone, Título e Subtítulo dinâmicos) */}
          <PortalCardHeader modo={modo} />

          {/* Feedback de Mensagens (Erro ou Sucesso) */}
          <PortalFeedback erroMsg={erroMsg} sucessoMsg={sucessoMsg} />

          {/* Subformulários por Modo Ativo */}
          {modo === 'login' && (
            <PortalLoginForm
              email={email}
              setEmail={setEmail}
              senha={senha}
              setSenha={setSenha}
              showSenha={showSenha}
              setShowSenha={setShowSenha}
              enviando={enviando}
              emailInputRef={emailInputRef}
              onSubmit={handleLogin}
              onEsqueceuSenha={() => switchModo('recuperar')}
              onCadastrar={() => switchModo('cadastro')}
            />
          )}

          {modo === 'cadastro' && (
            <PortalCadastroForm
              nome={nome}
              setNome={setNome}
              empresaNome={empresaNome}
              setEmpresaNome={setEmpresaNome}
              email={email}
              setEmail={setEmail}
              senha={senha}
              setSenha={setSenha}
              showSenha={showSenha}
              setShowSenha={setShowSenha}
              enviando={enviando}
              onSubmit={handleCadastro}
              onVoltarLogin={() => switchModo('login')}
            />
          )}

          {modo === 'recuperar' && (
            <PortalRecuperarSenhaForm
              email={email}
              setEmail={setEmail}
              enviando={enviando}
              onSubmit={handleRecuperarSenha}
              onVoltarLogin={() => switchModo('login')}
            />
          )}

          {/* Rodapé de Segurança */}
          <PortalSecurityFooter />
        </div>
      </main>
    </div>
  )
}
