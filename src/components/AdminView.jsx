import PontosManager from './PontosManager'
import {
  AdminHeaderBanner,
  AdminTabBar,
  AdminTabEscala,
  AdminTabEquipe,
  AdminTabConfiguracoes,
  AdminModals,
  useAdminView,
} from './admin'

/**
 * AdminView — Painel de Gestão e Administração da Imobiliária / Empresa.
 * Componente orquestrador de alto nível, 100% modularizado, enxuto e desacoplado.
 */
export default function AdminView({
  pontos = [],
  turnos = [],
  reservas = [],
  onLimparEscala,
  onDataChanged,
  showToast,
  empresaId,
  empresaNome,
  empresa,
  onEmpresaUpdated,
  isFullAdmin: propIsFullAdmin,
}) {
  const {
    user,
    perfil,
    role,
    isFullAdmin,
    termos,
    shareUrl,
    layoutMode,
    activeTab,
    tabs,
    handleTrocarLayout,
    handleMudarAba,
    turnosPorPonto,
    vagasPorPonto,
    turnosValidos,
    reservasValidas,
    handleRemoverReserva,
    handleDeleteTurno,
    modalDuplicar,
    setModalDuplicar,
    handleAbrirDuplicar,
    modalIncluirPessoa,
    setModalIncluirPessoa,
    handleAbrirIncluirPessoa,
    modalEditarTurno,
    setModalEditarTurno,
    handleAbrirEditarTurno,
    showModalNome,
    setShowModalNome,
    showModalVocabulario,
    setShowModalVocabulario,
    showModalWhatsapp,
    setShowModalWhatsapp,
  } = useAdminView({
    pontos,
    turnos,
    reservas,
    empresa,
    empresaId,
    isFullAdmin: propIsFullAdmin,
    onDataChanged,
    showToast,
  })

  return (
    <div className="space-y-2.5">
      {/* Banner de Identidade e Status */}
      <AdminHeaderBanner
        user={user}
        perfil={perfil}
        role={role}
        layoutMode={layoutMode}
        onTrocarLayout={handleTrocarLayout}
        empresa={empresa}
        empresaNome={empresaNome}
      />

      {/* Navegação por Abas */}
      {layoutMode === 'abas' && (
        <AdminTabBar tabs={tabs} activeTab={activeTab} onMudarAba={handleMudarAba} />
      )}

      {/* ═══ MODO EM ABAS ═══ */}
      {layoutMode === 'abas' && (
        <div className="space-y-2.5">
          {/* Aba 1: Escala & Turnos */}
          {activeTab === 'escala' && (
            <AdminTabEscala
              shareUrl={shareUrl}
              empresa={empresa}
              termos={termos}
              showToast={showToast}
              onIrConfiguracoes={() => handleMudarAba('configuracoes')}
              onIrPontos={() => handleMudarAba('pontos')}
              pontos={pontos}
              turnos={turnos}
              turnosValidos={turnosValidos}
              reservasValidas={reservasValidas}
              turnosPorPonto={turnosPorPonto}
              vagasPorPonto={vagasPorPonto}
              reservas={reservas}
              empresaId={empresaId}
              isFullAdmin={isFullAdmin}
              onAbrirIncluirPessoa={handleAbrirIncluirPessoa}
              onEditarTurno={handleAbrirEditarTurno}
              onDeleteTurno={handleDeleteTurno}
              onRemoverReserva={handleRemoverReserva}
              onAbrirDuplicar={handleAbrirDuplicar}
              onDataChanged={onDataChanged}
              onLimparEscala={onLimparEscala}
            />
          )}

          {/* Aba 2: Pessoas & Equipe */}
          {activeTab === 'equipe' && (
            <AdminTabEquipe
              empresaId={empresaId}
              empresaNome={empresaNome}
              empresa={empresa}
              onEmpresaUpdated={onEmpresaUpdated}
              isFullAdmin={isFullAdmin}
              currentUserId={user?.id}
              showToast={showToast}
              termos={termos}
            />
          )}

          {/* Aba 3: Pontos de Captação / Locais */}
          {activeTab === 'pontos' && (
            <div className="space-y-2.5 animate-fade-in">
              <PontosManager
                pontos={pontos}
                turnos={turnos}
                turnosPorPonto={turnosPorPonto}
                vagasPorPonto={vagasPorPonto}
                onLimparEscala={onLimparEscala}
                onDataChanged={onDataChanged}
                showToast={showToast}
                empresaId={empresaId}
                empresa={empresa}
                isFullAdmin={isFullAdmin}
                termos={termos}
                onAbrirModalWhatsapp={(pontoId) => setShowModalWhatsapp(pontoId)}
              />
            </div>
          )}

          {/* Aba 4: Ajustes & Configurações */}
          {activeTab === 'configuracoes' && (
            <AdminTabConfiguracoes
              empresa={empresa}
              pontos={pontos}
              onEmpresaUpdated={onEmpresaUpdated}
              showToast={showToast}
              isFullAdmin={isFullAdmin}
              termos={termos}
              onAbrirModalNome={() => setShowModalNome(true)}
              onAbrirModalVocabulario={() => setShowModalVocabulario(true)}
              onAbrirModalWhatsapp={() => setShowModalWhatsapp(true)}
            />
          )}
        </div>
      )}

      {/* ═══ MODO VISÃO CONTÍNUA (COMPATIBILIDADE LINEAR) ═══ */}
      {layoutMode === 'continuo' && (
        <div className="space-y-3 animate-fade-in">
          <AdminTabConfiguracoes
            empresa={empresa}
            pontos={pontos}
            onEmpresaUpdated={onEmpresaUpdated}
            showToast={showToast}
            isFullAdmin={isFullAdmin}
            termos={termos}
            onAbrirModalNome={() => setShowModalNome(true)}
            onAbrirModalVocabulario={() => setShowModalVocabulario(true)}
            onAbrirModalWhatsapp={() => setShowModalWhatsapp(true)}
          />

          <AdminTabEquipe
            empresaId={empresaId}
            empresaNome={empresaNome}
            empresa={empresa}
            onEmpresaUpdated={onEmpresaUpdated}
            isFullAdmin={isFullAdmin}
            currentUserId={user?.id}
            showToast={showToast}
            termos={termos}
          />

          <PontosManager
            pontos={pontos}
            turnos={turnos}
            turnosPorPonto={turnosPorPonto}
            vagasPorPonto={vagasPorPonto}
            onLimparEscala={onLimparEscala}
            onDataChanged={onDataChanged}
            showToast={showToast}
            empresaId={empresaId}
            empresa={empresa}
            isFullAdmin={isFullAdmin}
            termos={termos}
            onAbrirModalWhatsapp={(pontoId) => setShowModalWhatsapp(pontoId)}
          />

          <AdminTabEscala
            shareUrl={shareUrl}
            empresa={empresa}
            termos={termos}
            showToast={showToast}
            onIrConfiguracoes={() => handleMudarAba('configuracoes')}
            onIrPontos={() => handleMudarAba('pontos')}
            pontos={pontos}
            turnos={turnos}
            turnosValidos={turnosValidos}
            reservasValidas={reservasValidas}
            turnosPorPonto={turnosPorPonto}
            vagasPorPonto={vagasPorPonto}
            reservas={reservas}
            empresaId={empresaId}
            isFullAdmin={isFullAdmin}
            onAbrirIncluirPessoa={handleAbrirIncluirPessoa}
            onEditarTurno={handleAbrirEditarTurno}
            onDeleteTurno={handleDeleteTurno}
            onRemoverReserva={handleRemoverReserva}
            onAbrirDuplicar={handleAbrirDuplicar}
            onDataChanged={onDataChanged}
            onLimparEscala={onLimparEscala}
            hideQuickLink
          />
        </div>
      )}

      {/* ═══ MODAIS ESPECÍFICOS DE ADMINISTRAÇÃO ═══ */}
      <AdminModals
        modalDuplicar={modalDuplicar}
        onCloseDuplicar={() => setModalDuplicar(null)}
        modalIncluirPessoa={modalIncluirPessoa}
        onCloseIncluirPessoa={() => setModalIncluirPessoa(null)}
        modalEditarTurno={modalEditarTurno}
        onCloseEditarTurno={() => setModalEditarTurno(null)}
        showModalNome={showModalNome}
        onCloseNome={() => setShowModalNome(false)}
        showModalVocabulario={showModalVocabulario}
        onCloseVocabulario={() => setShowModalVocabulario(false)}
        showModalWhatsapp={showModalWhatsapp}
        onCloseWhatsapp={() => setShowModalWhatsapp(false)}
        pontos={pontos}
        empresaId={empresaId}
        empresa={empresa}
        termos={termos}
        onDataChanged={onDataChanged}
        onEmpresaUpdated={onEmpresaUpdated}
        showToast={showToast}
      />
    </div>
  )
}
