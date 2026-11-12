import { useState, useEffect, useMemo } from 'react'
import {
  ShieldCheck,
  Clock,
  Calendar,
  CalendarRange,
  MapPin,
  Check,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { isRpcAusenteError, isMissingColumnError } from '../../lib/supabasePublicHelper'
import { obterRegrasEmpresa } from '../../lib/horarioHelper'
import CotaStepperField from './CotaStepperField'
import CotasPontosDropdown from './CotasPontosDropdown'

function listasIguais(a, b) {
  if (a === null && b === null) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, idx) => val === sortedB[idx])
}

/**
 * Card modular de configuração das Regras Inteligentes da Escala (Admin):
 * 1. Bloqueio de Conflito de Horário (turnos sobrepostos no mesmo dia)
 * 2. Cotas Justas ("Anti-Monopólio") por Semana, por Dia e por Ponto/Local,
 *    com seleção de escopo para todos os pontos ou pontos específicos.
 */
export default function RegrasEscalaCard({
  empresa,
  pontos = [],
  onEmpresaUpdated,
  showToast,
  isFullAdmin = true,
  termos = {},
}) {
  const regrasSalvas = useMemo(() => obterRegrasEmpresa(empresa), [empresa])

  const [expandido, setExpandido] = useState(false)
  const [bloquearConflito, setBloquearConflito] = useState(regrasSalvas.bloquearConflito)
  const [limiteSemana, setLimiteSemana] = useState(regrasSalvas.limiteSemana)
  const [limiteDia, setLimiteDia] = useState(regrasSalvas.limiteDia)
  const [limitePonto, setLimitePonto] = useState(regrasSalvas.limitePonto)
  const [cotasPontosIds, setCotasPontosIds] = useState(regrasSalvas.cotasPontosIds)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setBloquearConflito(regrasSalvas.bloquearConflito)
    setLimiteSemana(regrasSalvas.limiteSemana)
    setLimiteDia(regrasSalvas.limiteDia)
    setLimitePonto(regrasSalvas.limitePonto)
    setCotasPontosIds(regrasSalvas.cotasPontosIds)
  }, [
    empresa?.id,
    regrasSalvas.bloquearConflito,
    regrasSalvas.limiteSemana,
    regrasSalvas.limiteDia,
    regrasSalvas.limitePonto,
    regrasSalvas.cotasPontosIds,
  ])

  if (!isFullAdmin) return null

  const pontoIdsExistentes = useMemo(() => new Set(pontos.map((p) => p.id)), [pontos])
  const pontosSelecionadosValidos = useMemo(() => {
    if (cotasPontosIds === null) return null
    return cotasPontosIds.filter((id) => pontoIdsExistentes.has(id))
  }, [cotasPontosIds, pontoIdsExistentes])

  const selecaoPontosInvalida =
    pontosSelecionadosValidos !== null && pontosSelecionadosValidos.length === 0

  const cotasAlteradas =
    limiteSemana !== regrasSalvas.limiteSemana ||
    limiteDia !== regrasSalvas.limiteDia ||
    limitePonto !== regrasSalvas.limitePonto ||
    !listasIguais(pontosSelecionadosValidos, regrasSalvas.cotasPontosIds)

  const temAlgumaCotaDraft =
    limiteSemana !== null || limiteDia !== null || limitePonto !== null

  const avisoInconsistencia =
    limiteSemana !== null &&
    ((limiteDia !== null && limiteDia > limiteSemana) ||
      (limitePonto !== null && limitePonto > limiteSemana))

  const persistirRegras = async (
    {
      novoBloquear = bloquearConflito,
      novoSemana = limiteSemana,
      novoDia = limiteDia,
      novoPonto = limitePonto,
      novosPontosIds = pontosSelecionadosValidos,
    },
    mensagemSucesso
  ) => {
    if (!empresa?.id) return
    if (novosPontosIds !== null && novosPontosIds.length === 0) {
      showToast?.('Selecione pelo menos 1 ponto ou escolha "Todos os pontos".', 'warning')
      return
    }

    setSalvando(true)
    const pontosNormalizados =
      novosPontosIds === null ? null : Array.from(new Set(novosPontosIds))

    try {
      const novosTermos = {
        ...(empresa?.termos || {}),
        regrasEscala: {
          bloquear_conflito_horario: novoBloquear,
          limite_vagas_semana: novoSemana,
          limite_vagas_dia: novoDia,
          limite_vagas_ponto: novoPonto,
          cotas_pontos_ids: pontosNormalizados,
        },
      }

      // 1. Tenta via RPC segura da Fase 15
      const { data: rpcData, error: rpcErr } = await supabase.rpc('atualizar_regras_escala', {
        p_empresa_id: empresa.id,
        p_bloquear_conflito: novoBloquear,
        p_limite_semana: novoSemana,
        p_limite_dia: novoDia,
        p_limite_ponto: novoPonto,
        p_cotas_pontos_ids: pontosNormalizados,
      })

      if (!rpcErr && rpcData) {
        onEmpresaUpdated?.({
          ...empresa,
          ...rpcData,
        })
        showToast?.(mensagemSucesso, 'success')
        return
      }

      if (rpcErr && !isRpcAusenteError(rpcErr)) {
        throw rpcErr
      }

      // 2. Fallback caso RPC ainda não exista: update direto na tabela empresas
      const { error: updateErr } = await supabase
        .from('empresas')
        .update({
          bloquear_conflito_horario: novoBloquear,
          limite_vagas_semana: novoSemana,
          limite_vagas_dia: novoDia,
          limite_vagas_ponto: novoPonto,
          cotas_pontos_ids: pontosNormalizados,
          termos: novosTermos,
        })
        .eq('id', empresa.id)

      if (!updateErr) {
        onEmpresaUpdated?.({
          ...empresa,
          bloquear_conflito_horario: novoBloquear,
          limite_vagas_semana: novoSemana,
          limite_vagas_dia: novoDia,
          limite_vagas_ponto: novoPonto,
          cotas_pontos_ids: pontosNormalizados,
          termos: novosTermos,
        })
        showToast?.(mensagemSucesso, 'success')
        return
      }

      if (!isMissingColumnError(updateErr)) {
        throw updateErr
      }

      // 3. Fallback transitório pré-migração: salva em termos.regrasEscala
      const { error: fallbackErr } = await supabase
        .from('empresas')
        .update({ termos: novosTermos })
        .eq('id', empresa.id)

      if (fallbackErr) throw fallbackErr

      onEmpresaUpdated?.({
        ...empresa,
        termos: novosTermos,
      })
      showToast?.(
        `${mensagemSucesso} (Aplique o script SQL Fase 15 atualizado para validação no banco.)`,
        'info'
      )
    } catch (err) {
      console.error('Erro ao salvar regras da escala:', err)
      showToast?.(err?.message || 'Erro ao salvar regras da escala.', 'error')
      setBloquearConflito(regrasSalvas.bloquearConflito)
      setLimiteSemana(regrasSalvas.limiteSemana)
      setLimiteDia(regrasSalvas.limiteDia)
      setLimitePonto(regrasSalvas.limitePonto)
      setCotasPontosIds(regrasSalvas.cotasPontosIds)
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleConflito = () => {
    if (salvando) return
    const proximo = !bloquearConflito
    setBloquearConflito(proximo)
    persistirRegras(
      {
        novoBloquear: proximo,
        novoSemana: regrasSalvas.limiteSemana,
        novoDia: regrasSalvas.limiteDia,
        novoPonto: regrasSalvas.limitePonto,
        novosPontosIds: regrasSalvas.cotasPontosIds,
      },
      proximo
        ? 'Bloqueio de conflito de horário ativado! 🛡️'
        : 'Bloqueio de conflito de horário desativado.'
    )
  }

  const handleSalvarCotas = () => {
    if (salvando || selecaoPontosInvalida) return
    persistirRegras(
      {
        novoBloquear: bloquearConflito,
        novoSemana: limiteSemana,
        novoDia: limiteDia,
        novoPonto: limitePonto,
        novosPontosIds: pontosSelecionadosValidos,
      },
      'Limites por colaborador atualizados! ✅'
    )
  }

  const pessoaPlural = termos.pessoas?.toLowerCase() || 'colaboradores'
  const pontoLabel = termos.ponto || 'Local'

  return (
    <div className="card bg-surface-800/90 border-surface-600 space-y-3">
      {/* Cabeçalho retrátil */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left min-h-[44px]"
        aria-expanded={expandido}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-xl border flex-shrink-0 transition-colors ${
              regrasSalvas.temAlgumaRegra
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-surface-700/80 border-surface-600 text-gray-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-200 truncate">
                Regras Inteligentes da Escala
              </h3>
              {regrasSalvas.bloquearConflito && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                  Anti-Conflito
                </span>
              )}
              {regrasSalvas.temAlgumaCota && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300 border border-brand-500/30">
                  {regrasSalvas.cotasPontosIds
                    ? `Cotas (${regrasSalvas.cotasPontosIds.length} ${
                        regrasSalvas.cotasPontosIds.length === 1 ? 'local' : 'locais'
                      })`
                    : 'Cotas Ativas'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              {regrasSalvas.temAlgumaRegra
                ? 'Bloqueio de choques de horário e limites justos configurados.'
                : 'Evite choques de horário e limite quantas vagas cada pessoa pode pegar.'}
            </p>
          </div>
        </div>

        <div
          className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 flex-shrink-0 ${
            expandido ? 'rotate-180 text-brand-400 bg-brand-500/15' : ''
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expandido && (
        <div className="pt-3 border-t border-surface-600/60 space-y-4 animate-fade-in">
          {/* Regra 1: Bloqueio de Conflito de Horário */}
          <div className="p-3.5 rounded-xl bg-surface-900/50 border border-surface-600/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Clock className="w-4.5 h-4.5 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-200">
                  Bloquear Conflito de Horário (Turnos Simultâneos)
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                  Impede que {pessoaPlural} reservem horários que se sobrepõem no mesmo dia, mesmo em {termos.pontos?.toLowerCase() || 'locais'} diferentes.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={bloquearConflito}
              disabled={salvando}
              onClick={handleToggleConflito}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-end sm:self-center ${
                bloquearConflito ? 'bg-emerald-600' : 'bg-surface-600'
              } ${salvando ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={
                bloquearConflito
                  ? 'Clique para permitir reservas simultâneas'
                  : 'Clique para bloquear reservas em horários simultâneos'
              }
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  bloquearConflito ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Regra 2: Cotas / Limites Anti-Monopólio */}
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-200">
                Cotas Justas por {termos.pessoa || 'Colaborador'} (Anti-Monopólio)
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Escolha se os limites valem para todos os pontos ou apenas para pontos específicos.
              </p>
            </div>

            {/* Menu Suspenso de Escopo por Pontos */}
            <CotasPontosDropdown
              pontos={pontos}
              selectedIds={cotasPontosIds}
              onChange={setCotasPontosIds}
              disabled={salvando}
              termos={termos}
            />

            {/* Controles horizontais sem truncamento */}
            <div className="space-y-2">
              <CotaStepperField
                label="Máx. na Semana"
                icon={CalendarRange}
                value={limiteSemana}
                onChange={setLimiteSemana}
                disabled={salvando}
              />

              <CotaStepperField
                label="Máx. por Dia"
                icon={Calendar}
                value={limiteDia}
                onChange={setLimiteDia}
                disabled={salvando}
              />

              <CotaStepperField
                label={`Máx. por ${pontoLabel}`}
                icon={MapPin}
                value={limitePonto}
                onChange={setLimitePonto}
                disabled={salvando}
              />
            </div>

            {!temAlgumaCotaDraft && pontosSelecionadosValidos !== null && (
              <p className="text-[11px] text-gray-400">
                Defina ao menos um limite acima (Semana, Dia ou {pontoLabel}) para restringir reservas nos pontos selecionados.
              </p>
            )}

            {avisoInconsistencia && (
              <p className="text-[11px] text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Dica: o limite diário ou por local está maior que o limite semanal ({limiteSemana}).
              </p>
            )}

            {cotasAlteradas && (
              <div className="flex justify-end pt-1 animate-fade-in">
                <button
                  type="button"
                  disabled={salvando || selecaoPontosInvalida}
                  onClick={handleSalvarCotas}
                  className="btn-primary py-2.5 px-4 text-xs min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-1.5"
                >
                  {salvando ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Salvar Limites
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
