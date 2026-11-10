import AdminQuickLinkBar from './AdminQuickLinkBar'
import AdminStats from './AdminStats'
import FormAddTurno from './FormAddTurno'
import TurnosCadastradosList from './TurnosCadastradosList'
import AdminZonaPerigo from './AdminZonaPerigo'

/**
 * Seção / Aba de Gestão da Escala e Turnos.
 * Reúne barra de link rápido, estatísticas, cadastro de horários,
 * lista com ordenação por dia e zona de perigo.
 */
export default function AdminTabEscala({
  shareUrl,
  empresa,
  termos,
  showToast,
  onIrConfiguracoes,
  onIrPontos,
  pontos = [],
  turnos = [],
  turnosValidos = [],
  reservasValidas = [],
  turnosPorPonto = {},
  vagasPorPonto = {},
  reservas = [],
  empresaId,
  isFullAdmin,
  onAbrirIncluirPessoa,
  onEditarTurno,
  onDeleteTurno,
  onRemoverReserva,
  onAbrirDuplicar,
  onDataChanged,
  onLimparEscala,
  hideQuickLink = false,
  hideStats = false,
}) {
  return (
    <div className="space-y-2.5 animate-fade-in">
      {!hideQuickLink && (
        <AdminQuickLinkBar
          shareUrl={shareUrl}
          empresa={empresa}
          termos={termos}
          showToast={showToast}
          onIrConfiguracoes={onIrConfiguracoes}
        />
      )}

      {!hideStats && (
        <AdminStats
          pontosCount={pontos.length}
          termos={termos}
          turnosCount={turnosValidos.length}
          reservasCount={reservasValidas.length}
        />
      )}

      <FormAddTurno
        pontos={pontos}
        turnos={turnos}
        empresaId={empresaId}
        termos={termos}
        onDataChanged={onDataChanged}
        showToast={showToast}
        onIrPontos={onIrPontos}
      />

      <TurnosCadastradosList
        pontos={pontos}
        turnosPorPonto={turnosPorPonto}
        vagasPorPonto={vagasPorPonto}
        reservas={reservas}
        empresaId={empresaId}
        onAbrirIncluirPessoa={onAbrirIncluirPessoa}
        onEditarTurno={onEditarTurno}
        onDeleteTurno={onDeleteTurno}
        onRemoverReserva={onRemoverReserva}
        onAbrirDuplicar={onAbrirDuplicar}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />

      <AdminZonaPerigo
        isFullAdmin={isFullAdmin}
        onLimparEscala={onLimparEscala}
      />
    </div>
  )
}

