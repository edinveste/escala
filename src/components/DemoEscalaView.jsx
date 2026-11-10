import { CalendarCheck } from 'lucide-react'
import CorretorView from './CorretorView'
import NomeModal from './NomeModal'
import DemoBanner from './DemoBanner'
import Toast from './Toast'
import ThemeToggle from './ThemeToggle'
import { useDemoEscala } from '../hooks/useDemoEscala'

/**
 * DemoEscalaView — Visão demonstrativa 100% sandbox e interativa.
 * Componente declarativo e enxuto com regras de negócio isoladas no hook useDemoEscala.
 */
export default function DemoEscalaView({ onBackToSite, onCadastrarEmpresa }) {
  const {
    deviceId,
    corretorNome,
    corretorWhatsapp,
    corretorEmail,
    reservas,
    pontos,
    turnos,
    empresa,
    termos,
    empresaShareUrl,
    showNomeModal,
    nomeModalError,
    pendingTurnoId,
    toast,
    showToast,
    limparToast,
    handleReservar,
    handleCancelar,
    handleNomeConfirm,
    abrirEdicaoPerfil,
    fecharNomeModal,
  } = useDemoEscala()

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <DemoBanner onBackToSite={onBackToSite} onCadastrar={onCadastrarEmpresa} />

      <header className="sticky top-0 z-40 bg-surface-900/95 backdrop-blur-md border-b border-surface-700">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarCheck className="w-6 h-6 text-brand-400 shrink-0" />
            <h1 className="text-lg font-bold text-gray-100 leading-tight flex items-center gap-1.5 truncate">
              <span>Escala<span className="text-brand-400">Fácil</span></span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
                Demo
              </span>
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-4 pb-36 sm:pb-40">
        <CorretorView
          pontos={pontos}
          turnos={turnos}
          reservas={reservas}
          deviceId={deviceId}
          corretorNome={corretorNome}
          corretorWhatsapp={corretorWhatsapp}
          corretorEmail={corretorEmail}
          cadastroNaoAutorizado={false}
          onEditarPerfil={abrirEdicaoPerfil}
          onReservar={handleReservar}
          onCancelar={handleCancelar}
          showToast={showToast}
          empresa={empresa}
          empresaShareUrl={empresaShareUrl}
        />
      </main>

      {showNomeModal && (
        <NomeModal
          initialNome={corretorNome}
          initialWhatsapp={corretorWhatsapp}
          initialEmail={corretorEmail}
          deviceId={deviceId}
          tipoValidacao="whatsapp"
          exigirCadastro={false}
          empresaId={null}
          termos={termos}
          errorMessage={nomeModalError}
          hasPendingTurno={Boolean(pendingTurnoId)}
          onConfirm={handleNomeConfirm}
          onClose={fecharNomeModal}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={limparToast} />}
    </div>
  )
}
