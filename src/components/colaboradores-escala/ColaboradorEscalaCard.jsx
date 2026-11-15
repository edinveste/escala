import { useState } from 'react'
import { Phone, Mail, Pencil, Calendar, ChevronDown, ChevronUp, Smartphone } from 'lucide-react'
import ColaboradorTurnoItem from './ColaboradorTurnoItem'

/**
 * Extrai até 2 iniciais do nome do colaborador para o avatar.
 */
function obterIniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Card representativo de um colaborador com vagas marcadas na escala ativa.
 */
export default function ColaboradorEscalaCard({
  colaborador,
  onEditarNome,
  onRemoverReserva,
  isFullAdmin = true,
  termos = {},
  isExpandido,
  onToggleExpandido,
}) {
  const [localExpandido, setLocalExpandido] = useState(true)
  const expandido = onToggleExpandido ? (isExpandido ?? true) : localExpandido

  const handleToggleExpandido = () => {
    if (onToggleExpandido) {
      onToggleExpandido()
    } else {
      setLocalExpandido((prev) => !prev)
    }
  }

  const iniciais = obterIniciais(colaborador.nome)
  const totalTurnos = colaborador.turnos.length
  const rotuloHorario = totalTurnos === 1 ? 'horário marcado' : 'horários marcados'

  // Formata link de WhatsApp caso tenha número com dígitos
  const zapDigits = (colaborador.whatsapp || '').replace(/\D/g, '')
  const zapUrl = zapDigits ? `https://wa.me/55${zapDigits}` : null

  return (
    <div className="bg-surface-800/80 border border-surface-700/70 rounded-xl p-3.5 space-y-3 transition-all hover:border-surface-600">
      {/* ═══ CABEÇALHO DO COLABORADOR ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Avatar + Nome + Contatos */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          {/* Avatar com Iniciais */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600/30 to-sky-600/20 border border-brand-500/30 text-brand-300 font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-inner">
            {iniciais}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-gray-100 truncate">
                {colaborador.nome}
              </h3>

              {/* Botão Ícone do Lápis para Alterar Nome */}
              {isFullAdmin && (
                <button
                  type="button"
                  onClick={() => onEditarNome(colaborador)}
                  className="p-1 rounded-md text-surface-400 hover:text-brand-300 hover:bg-brand-500/15 transition-colors"
                  title={`Alterar o nome de "${colaborador.nome}" na escala`}
                  aria-label={`Alterar nome de ${colaborador.nome}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Badges de Contato (WhatsApp / E-mail / Celular) */}
            <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
              {zapUrl ? (
                <a
                  href={zapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                  title="Abrir conversa no WhatsApp"
                >
                  <Phone className="w-3 h-3 text-emerald-500" />
                  <span>{colaborador.whatsapp}</span>
                </a>
              ) : null}

              {colaborador.email ? (
                <a
                  href={`mailto:${colaborador.email}`}
                  className="inline-flex items-center gap-1 text-surface-400 hover:text-surface-200 transition-colors"
                  title="Enviar e-mail"
                >
                  <Mail className="w-3 h-3" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {colaborador.email}
                  </span>
                </a>
              ) : null}

              {!zapUrl && !colaborador.email && (
                <span className="inline-flex items-center gap-1 text-surface-400 text-[11px]">
                  <Smartphone className="w-3 h-3 text-surface-500" />
                  <span>Acesso Livre</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações: Badge de Total de Horários + Alternar Visibilidade dos Horários */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          {/* Badge de Total de Horários */}
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
            {totalTurnos} {rotuloHorario}
          </span>

          {/* Toggle Expandir/Recolher Horários */}
          <button
            type="button"
            onClick={handleToggleExpandido}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700/60 border border-surface-700 transition-colors"
            title={expandido ? 'Ocultar horários' : 'Exibir horários'}
            aria-expanded={expandido}
            aria-label={
              expandido
                ? `Ocultar horários de ${colaborador.nome}`
                : `Exibir horários de ${colaborador.nome}`
            }
          >
            {expandido ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ═══ LISTA DOS HORÁRIOS MARCADOS (SANFONA INTERNA) ═══ */}
      {expandido && (
        <div className="pt-2 border-t border-surface-700/50 space-y-2 animate-fade-in">
          <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-brand-400" />
            <span>Horários Agendados na Semana ({totalTurnos}):</span>
          </div>

          <div className="space-y-1.5">
            {colaborador.turnos.map((t) => (
              <ColaboradorTurnoItem
                key={t.reservaId}
                turno={t}
                colaboradorNome={colaborador.nome}
                onRemoverReserva={onRemoverReserva}
                isFullAdmin={isFullAdmin}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
