import { useState, useMemo } from 'react'
import {
  MapPin,
  Store,
  Lock,
  Search,
  X,
  ChevronRight,
} from 'lucide-react'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import CorretorIdentityHeader from './CorretorIdentityHeader'
import CorretorEmpresaCard from './CorretorEmpresaCard'
import CorretorCopyFooter from './CorretorCopyFooter'
import AgendaCalendarIcon from '../icons/AgendaCalendarIcon'
import { obterAberturaPonto, formatarDataAberturaCurta } from '../../lib/aberturaHelper'
import { obterLinkGoogleMaps } from '../../lib/mapsHelper'

/**
 * PontoSelectorModerno — Layout moderno, rico e profissional da lista de pontos.
 * Recursos:
 * - Branding oficial da empresa e status em tempo real
 * - Card de destaque "Sua Agenda" com atalhos diretos
 * - Barra de métricas consolidadas (Locais, Turnos e Vagas Livres)
 * - Busca e filtro instantâneo por nome ou endereço
 * - Cards com micro-barra de ocupação, tags semânticas e transições polidas
 */
export default function PontoSelectorModerno({
  pontos = [],
  vagasPorPonto = {},
  termos = {},
  empresa = null,
  corretorNome,
  corretorWhatsapp,
  corretorEmail,
  cadastroNaoAutorizado = false,
  onEditarPerfil,
  onSelectPonto,
  onCopiar,
  copied = false,
  podeCopiar = true,
  resumoColaborador = null,
  onAbrirAgenda = null,
}) {
  const [busca, setBusca] = useState('')

  // Métricas consolidadas de todos os pontos ativos
  const statsGerais = useMemo(() => {
    let totalTurnos = 0
    let totalVagasLivres = 0
    let totalCapacidade = 0

    pontos.forEach((p) => {
      const info = vagasPorPonto[p.id] || {}
      totalTurnos += info.totalTurnos || 0
      totalVagasLivres += info.vagasLivres || 0
      totalCapacidade += info.totalCapacidade || 0
    })

    const vagasPreenchidas = Math.max(0, totalCapacidade - totalVagasLivres)
    const taxaOcupacao =
      totalCapacidade > 0 ? Math.round((vagasPreenchidas / totalCapacidade) * 100) : 0

    return { totalTurnos, totalVagasLivres, totalCapacidade, vagasPreenchidas, taxaOcupacao }
  }, [pontos, vagasPorPonto])

  // Filtragem dinâmica de pontos por nome ou endereço
  const pontosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return pontos

    return pontos.filter((p) => {
      const matchNome = (p.nome || '').toLowerCase().includes(termo)
      const matchEndereco = (p.endereco || '').toLowerCase().includes(termo)
      return matchNome || matchEndereco
    })
  }, [pontos, busca])

  const totalVagasAgendadas = resumoColaborador?.turnosReservados?.length || 0

  if (pontos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center text-gray-500 shadow-inner">
          <Store className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-300">
            Nenhum {termos.ponto?.toLowerCase() || 'local'} cadastrado
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            {empresa?.nome
              ? `Nenhum ${termos.ponto?.toLowerCase() || 'local'} ativo cadastrado para ${empresa.nome}.`
              : `O administrador precisa cadastrar os ${termos.pontos?.toLowerCase() || 'locais'}.`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* ═══ 1. CABEÇALHO DE IDENTIDADE E SAUDAÇÃO ═══ */}
      <CorretorIdentityHeader
        corretorNome={corretorNome}
        corretorWhatsapp={corretorWhatsapp}
        corretorEmail={corretorEmail}
        cadastroNaoAutorizado={cadastroNaoAutorizado}
        onEditarPerfil={onEditarPerfil}
        termos={termos}
        resumoColaborador={resumoColaborador}
        onAbrirAgenda={onAbrirAgenda}
        mostrarBotaoAgenda={false} // Exibido no card dedicado abaixo para maior elegância
      />

      {/* ═══ 2. CARD DA EMPRESA COM SELO OFICIAL (BRANDING) ═══ */}
      <CorretorEmpresaCard
        empresa={empresa}
        totalVagasAgendadas={totalVagasAgendadas}
        onAbrirAgenda={onAbrirAgenda}
        mostrarBotaoAgenda={false}
      />

      {/* ═══ 3. CARD DESTACADO "SUA AGENDA" (BANNER EM DESTAQUE NO MODO COMPLETO) ═══ */}
      {totalVagasAgendadas > 0 && onAbrirAgenda && (
        <div
          role="button"
          tabIndex={0}
          onClick={onAbrirAgenda}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onAbrirAgenda()
            }
          }}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500/15 via-surface-800 to-brand-600/10 border border-brand-500/30 hover:border-brand-500/50 p-3.5 transition-all duration-200 active:scale-[0.99] cursor-pointer shadow-sm hover:shadow-md hover:shadow-brand-500/5 select-none"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/20 flex-shrink-0 group-hover:scale-105 transition-transform">
                <AgendaCalendarIcon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                    Sua Agenda Confirmada
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-100 truncate mt-0.5">
                  Você tem{' '}
                  <span className="text-brand-300 font-extrabold">
                    {totalVagasAgendadas}{' '}
                    {totalVagasAgendadas === 1 ? 'horário agendado' : 'horários agendados'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-brand-400 group-hover:text-brand-300 shrink-0">
              <span className="hidden sm:inline">Ver Agenda</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ 4. BARRA DE MÉTRICAS RÁPIDAS (STATS BAR) ═══ */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-800/80 border border-surface-700/80 text-center flex flex-col justify-center">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {termos.pontos || 'Locais'}
          </span>
          <span className="text-base sm:text-lg font-black text-gray-100 mt-0.5 font-mono">
            {pontos.length}
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-800/80 border border-surface-700/80 text-center flex flex-col justify-center">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Turnos
          </span>
          <span className="text-base sm:text-lg font-black text-brand-400 mt-0.5 font-mono">
            {statsGerais.totalTurnos}
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-800/80 border border-surface-700/80 text-center flex flex-col justify-center">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Vagas Livres
          </span>
          <span
            className={`text-base sm:text-lg font-black mt-0.5 font-mono ${
              statsGerais.totalVagasLivres > 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {statsGerais.totalVagasLivres}
          </span>
        </div>
      </div>

      {/* ═══ 5. BARRA DE BUSCA E TÍTULO DA SEÇÃO ═══ */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm sm:text-base font-bold text-gray-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
            <span>Escolha o {termos.ponto || 'Ponto de Escala'}</span>
          </h2>
          <span className="text-[11px] text-gray-400 font-medium">
            {pontosFiltrados.length} {pontosFiltrados.length === 1 ? 'disponível' : 'disponíveis'}
          </span>
        </div>

        {/* Input de Busca Instantânea */}
        {pontos.length > 2 && (
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar por nome ou endereço (ex: ${pontos[0]?.nome || 'Mooca'})...`}
              className="w-full bg-surface-800/90 border border-surface-700 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
                title="Limpar busca"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ 6. LISTA DE CARDS DE PONTOS REDESENHADOS ═══ */}
      {pontosFiltrados.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-surface-800/50 border border-dashed border-surface-700 space-y-2">
          <p className="text-sm font-semibold text-gray-300">
            Nenhum {termos.ponto?.toLowerCase() || 'local'} encontrado para &ldquo;{busca}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setBusca('')}
            className="text-xs text-brand-400 hover:underline font-medium"
          >
            Limpar filtro e ver todos os {pontos.length} {termos.pontos?.toLowerCase() || 'locais'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pontosFiltrados.map((ponto) => {
            const info = vagasPorPonto[ponto.id] || {}
            const temVagas = info.vagasLivres > 0
            const cotaRestritaNestePonto = Boolean(
              resumoColaborador?.regras?.temAlgumaCota &&
                resumoColaborador?.regras?.cotasPontosIds &&
                resumoColaborador?.pontoTemCota?.(ponto.id)
            )
            const abertura = obterAberturaPonto(ponto, empresa)
            const mapsUrl = obterLinkGoogleMaps(ponto.endereco)

            // Percentual de vagas preenchidas
            const totalCap = info.totalCapacidade || 0
            const livres = info.vagasLivres || 0
            const preenchidas = Math.max(0, totalCap - livres)
            const percPreenchido = totalCap > 0 ? Math.round((preenchidas / totalCap) * 100) : 0

            return (
              <div
                key={ponto.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectPonto(ponto.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectPonto(ponto.id)
                  }
                }}
                className="group relative overflow-hidden rounded-2xl bg-surface-800/90 border border-surface-700/80 hover:border-brand-500/50 hover:bg-surface-800 p-3.5 sm:p-4 transition-all duration-200 active:scale-[0.99] cursor-pointer shadow-sm hover:shadow-lg hover:shadow-black/20 select-none"
              >
                {/* Linha Principal do Ponto */}
                <div className="flex items-start gap-3">
                  {/* Ícone Google Maps ou Pin */}
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="relative p-2.5 rounded-xl border border-surface-600/80 bg-surface-700/60 hover:bg-surface-700 hover:border-brand-500/50 transition-all duration-200 shadow-sm flex-shrink-0 group/maps flex items-center justify-center min-w-[44px] min-h-[44px]"
                      title={`Abrir rota no Google Maps:\n${ponto.endereco}`}
                      aria-label={`Abrir ${ponto.nome} no Google Maps`}
                    >
                      <GoogleMapsIcon className="w-5 h-5 group-hover/maps:scale-110 transition-transform drop-shadow-sm" />
                    </a>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400 flex-shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px]">
                      <MapPin className="w-5 h-5" />
                    </div>
                  )}

                  {/* Conteúdo Central */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-gray-100 text-sm sm:text-base truncate group-hover:text-brand-300 transition-colors">
                        {ponto.nome}
                      </h3>

                      {/* Status / Ação à direita */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {abertura.estaAgendado ? (
                          <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Abre {formatarDataAberturaCurta(abertura.dataAbertura)}
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                              temVagas
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {temVagas ? `${livres} vagas livres` : 'Lotado'}
                          </span>
                        )}

                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Endereço */}
                    {ponto.endereco && (
                      <p
                        className="text-[11px] sm:text-xs text-gray-400 truncate mt-0.5"
                        title={ponto.endereco}
                      >
                        {ponto.endereco}
                      </p>
                    )}

                    {/* Micro-Barra Visual de Ocupação */}
                    {totalCap > 0 && !abertura.estaAgendado && (
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                          <span>{info.totalTurnos || 0} turnos na grade</span>
                          <span>
                            {percPreenchido}% ocupado ({preenchidas}/{totalCap})
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-700/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percPreenchido >= 100
                                ? 'bg-red-500'
                                : percPreenchido > 80
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, percPreenchido)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Badges Adicionais */}
                    {cotaRestritaNestePonto && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                          Sujeito a limite de cotas
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ 7. RODAPÉ DE CÓPIA DO WHATSAPP ═══ */}
      {podeCopiar && (
        <CorretorCopyFooter onCopiar={onCopiar} copied={copied} />
      )}
    </div>
  )
}
