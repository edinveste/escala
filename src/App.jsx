import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTenant } from './contexts/TenantContext'
import { useAuth } from './contexts/AuthContext'
import { getPublicShareUrl } from './lib/tenantHelper'
import { obterTermos } from './lib/vocabularioHelper'
import { useConfirm } from './components/ConfirmModal'
import { useEscalaData } from './hooks/useEscalaData'
import { useColaborador } from './hooks/useColaborador'

// Componentes visuais e de fluxo
import AppHeader from './components/AppHeader'
import CorretorView from './components/CorretorView'
import AdminView from './components/AdminView'
import NomeModal from './components/NomeModal'
import AdminLoginModal from './components/AdminLoginModal'
import PortalGestorLogin from './components/PortalGestorLogin'
import PortalSemEmpresaView from './components/PortalSemEmpresaView'
import TenantNotFound from './components/TenantNotFound'
import TenantErrorView from './components/TenantErrorView'
import TenantBlockedView from './components/TenantBlockedView'
import LandingPage from './components/LandingPage'
import DemoEscalaView from './components/DemoEscalaView'
import Toast from './components/Toast'

export default function App() {
  const confirm = useConfirm()

  const {
    empresa,
    loading: tenantLoading,
    notFound,
    error: tenantError,
    refreshEmpresa,
    isAppPortal: isPortalDomain,
    isLandingPage: isLanding,
    isDemo,
    switchTenant,
  } = useTenant()

  const {
    user,
    minhasEmpresas,
    loading: authLoading,
    canManageEmpresa,
    getEmpresaRole,
    signOut,
  } = useAuth()

  // Toast universal
  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // Hook de Dados e Realtime da Escala
  const {
    pontos,
    turnos,
    reservas,
    loading: escalaLoading,
    fetchData,
    handleLimparEscala,
  } = useEscalaData({ empresa, isDemo, showToast, confirm })

  // Hook de Identidade e Ações do Colaborador (Zero-Atrito)
  const {
    deviceId,
    corretorNome,
    corretorWhatsapp,
    corretorEmail,
    showNomeModal,
    nomeModalError,
    cadastroNaoAutorizado,
    pendingTurnoId,
    handleReservar,
    handleCancelar,
    handleNomeConfirm,
    handleEditarPerfil,
    fecharNomeModal,
  } = useColaborador({ empresa, showToast, confirm })

  // Navegação e Acesso Administrativo
  const [view, setView] = useState(() => (isPortalDomain ? 'admin' : 'corretor'))
  const [isPinAuth, setIsPinAuth] = useState(false)
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false)

  const termos = useMemo(() => obterTermos(empresa), [empresa])
  const isAuthorizedGestor = Boolean(user && empresa?.id && canManageEmpresa(empresa.id))
  const isAdminSession = isAuthorizedGestor || isPinAuth
  const userEmpresaRole = empresa?.id ? getEmpresaRole(empresa.id) : null
  const isFullAdmin = userEmpresaRole === 'admin' || isPinAuth

  // Ajusta visão e contingência de PIN ao alternar de empresa
  useEffect(() => {
    setIsPinAuth(false)
    if (isPortalDomain) {
      setView('admin')
    } else if (!isAuthorizedGestor) {
      setView('corretor')
    }
  }, [empresa?.id, isAuthorizedGestor, isPortalDomain])

  const handleAdminLogout = useCallback(async () => {
    setIsPinAuth(false)
    if (user) {
      await signOut()
    }
    if (!isPortalDomain) {
      setView('corretor')
    }
    showToast('Você saiu do modo administrador.', 'info')
  }, [signOut, showToast, user, isPortalDomain])

  // ─── Gateways de Acesso & Roteamento Especiais ───────────────

  // 1. Carregamento Global Inicial (Autenticação ou Resolução de Tenant)
  // Enquanto o Supabase restaura a sessão ou resolve a imobiliária, exibe o spinner elegante,
  // impedindo qualquer piscada indesejada de telas de erro ou de "sem empresa".
  if ((authLoading || tenantLoading) && !empresa && !isPinAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface-900 text-gray-100">
        <div className="w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-400 font-medium">Carregando...</p>
      </div>
    )
  }

  // 2. Portal do Gestor (app.escalafacil.online) Desconectado
  if (isPortalDomain && !user && !isPinAuth) {
    return (
      <>
        <PortalGestorLogin
          onSuccess={(tipo, emp) => {
            if (tipo === 'pin') setIsPinAuth(true)
            setView('admin')
            if (emp) switchTenant(emp.empresa_id || emp.id)
            refreshEmpresa()
          }}
          showToast={showToast}
          empresaId={empresa?.id}
          empresaNome={empresa?.nome}
        />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  // 3. Portal do Gestor Conectado mas sem Nenhuma Empresa Vinculada
  // Só é exibido se o carregamento global concluiu (authLoading=false e tenantLoading=false)
  // e o usuário realmente não possui vínculos com nenhuma empresa no sistema
  if (isPortalDomain && user && !empresa && minhasEmpresas.length === 0) {
    return <PortalSemEmpresaView userEmail={user.email} onSignOut={() => signOut()} />
  }

  // 4. Landing Page Oficial (escalafacil.online/)
  if (isLanding) {
    return (
      <LandingPage
        onOpenDemo={() => switchTenant('demo')}
        onOpenLogin={() => {
          if (isPortalDomain) {
            setShowAdminLoginModal(true)
          } else {
            window.location.href = window.location.hostname.includes('localhost')
              ? '/?portal=app'
              : 'https://app.escalafacil.online'
          }
        }}
      />
    )
  }

  // 5. Escala Demonstrativa Sandbox (Rota /demo)
  if (isDemo) {
    return (
      <DemoEscalaView
        onBackToSite={() => switchTenant('')}
        onCadastrarEmpresa={() => {
          if (isPortalDomain) {
            setShowAdminLoginModal(true)
          } else {
            window.location.href = window.location.hostname.includes('localhost')
              ? '/?portal=app'
              : 'https://app.escalafacil.online'
          }
        }}
      />
    )
  }

  // 6. Tenant Não Encontrado (404)
  if (notFound) {
    return (
      <>
        <TenantNotFound />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  // 7. Erro de Configuração de Tenant
  if (tenantError) {
    return <TenantErrorView tenantError={tenantError} onRetry={refreshEmpresa} />
  }

  // 8. Empresa Suspensa / Bloqueada
  if (empresa?.status === 'bloqueado' && view !== 'admin') {
    return (
      <>
        <TenantBlockedView onOpenAdminLogin={() => setShowAdminLoginModal(true)} />
        <AdminLoginModal
          isOpen={showAdminLoginModal}
          onClose={() => setShowAdminLoginModal(false)}
          onSuccess={() => {
            setIsPinAuth(true)
            setView('admin')
          }}
          showToast={showToast}
          empresaId={empresa?.id}
          empresaNome={empresa?.nome}
        />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  // ─── Render Principal da Aplicação ───────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* Header Modularizado */}
      <AppHeader
        view={view}
        isPortalDomain={isPortalDomain}
        onVoltar={() => setView('corretor')}
        onLogout={handleAdminLogout}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-4 pb-36 sm:pb-40">
        {escalaLoading && pontos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Carregando escala...</p>
          </div>
        ) : view === 'corretor' ? (
          <CorretorView
            pontos={pontos.filter((p) => p.ativo !== false)}
            turnos={turnos}
            reservas={reservas}
            deviceId={deviceId}
            corretorNome={corretorNome}
            corretorWhatsapp={corretorWhatsapp}
            corretorEmail={corretorEmail}
            cadastroNaoAutorizado={cadastroNaoAutorizado}
            onEditarPerfil={handleEditarPerfil}
            onReservar={handleReservar}
            onCancelar={handleCancelar}
            showToast={showToast}
            empresa={empresa}
            empresaShareUrl={getPublicShareUrl(empresa)}
          />
        ) : view === 'admin' && isAdminSession ? (
          <AdminView
            pontos={pontos}
            turnos={turnos}
            reservas={reservas}
            onLimparEscala={handleLimparEscala}
            onDataChanged={fetchData}
            showToast={showToast}
            empresaId={empresa?.id}
            empresaNome={empresa?.nome}
            empresa={empresa}
            onEmpresaUpdated={refreshEmpresa}
            isFullAdmin={isFullAdmin}
          />
        ) : null}
      </main>

      {/* Modal de Identificação do Colaborador */}
      {showNomeModal && (
        <NomeModal
          initialNome={corretorNome}
          initialWhatsapp={corretorWhatsapp}
          initialEmail={corretorEmail}
          deviceId={deviceId}
          tipoValidacao={empresa?.tipo_validacao_equipe || 'whatsapp'}
          exigirCadastro={empresa?.exigir_cadastro_previo || false}
          empresaId={empresa?.id}
          termos={termos}
          errorMessage={nomeModalError}
          hasPendingTurno={Boolean(pendingTurnoId)}
          onConfirm={handleNomeConfirm}
          onClose={fecharNomeModal}
        />
      )}

      {/* Modal de Login de Gestor / Admin */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onSuccess={() => {
          setIsPinAuth(true)
          setView('admin')
        }}
        showToast={showToast}
        empresaId={empresa?.id}
        empresaNome={empresa?.nome}
      />

      {/* Notificações Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
