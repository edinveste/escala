import { useState, useEffect, useMemo } from 'react'
import { Search, X, ChevronDown, ChevronUp, Users } from 'lucide-react'
import ColaboradoresEscalaHeader from './ColaboradoresEscalaHeader'
import ColaboradorEscalaCard from './ColaboradorEscalaCard'
import EditarNomeEscalaModal from './EditarNomeEscalaModal'
import { useColaboradoresEscala } from './useColaboradoresEscala'

/**
 * ColaboradoresEscalaManager — Orquestrador do módulo de gestão consolidada
 * de todos os colaboradores com vagas/horários preenchidos na escala ativa.
 */
export default function ColaboradoresEscalaManager({
  reservas = [],
  turnos = [],
  pontos = [],
  empresaId,
  isFullAdmin = true,
  onDataChanged,
  onRemoverReserva,
  showToast,
  termos = {},
}) {
  // Chave de persistência de preferência de expansão da sanfona (por empresa)
  const STORAGE_KEY_COLABORADORES_EXPANDED = empresaId
    ? `escala_colaboradores_expanded_${empresaId}`
    : 'escala_colaboradores_expanded'

  // Por padrão aberto se houver reservas, preservando escolha prévia do gestor
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_COLABORADORES_EXPANDED)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de colaboradores expandidos:', err)
    }
    return true
  })

  // Salva no localStorage sempre que o usuário alternar o estado de expansão
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_COLABORADORES_EXPANDED,
        JSON.stringify(isExpanded)
      )
    } catch (err) {
      console.error('Erro ao salvar preferência de colaboradores expandidos:', err)
    }
  }, [isExpanded, STORAGE_KEY_COLABORADORES_EXPANDED])

  // Hook isolado de domínio, agrupamentos, filtros e mutações
  const {
    colaboradores,
    totalColaboradores,
    totalVagas,
    busca,
    setBusca,
    ordenacao,
    setOrdenacao,
    salvandoNome,
    renomearColaborador,
    colaboradorParaEditar,
    setColaboradorParaEditar,
  } = useColaboradoresEscala({
    reservas,
    turnos,
    pontos,
    empresaId,
    onDataChanged,
    showToast,
  })

  const rotuloPessoas = termos.pessoas || 'Colaboradores'
  const rotuloPessoa = termos.pessoa || 'Colaborador'

  // ─── Controle de Expansão dos Horários dos Colaboradores ────────────────
  const [expandidosMap, setExpandidosMap] = useState({})

  const isCardExpandido = (colabId) => {
    return expandidosMap[colabId] !== undefined ? expandidosMap[colabId] : true
  }

  const handleToggleCard = (colabId) => {
    setExpandidosMap((prev) => ({
      ...prev,
      [colabId]: !isCardExpandido(colabId),
    }))
  }

  const algumCardExpandido = useMemo(() => {
    if (colaboradores.length === 0) return false
    return colaboradores.some((c) => isCardExpandido(c.id))
  }, [colaboradores, expandidosMap])

  const toggleTodosCards = () => {
    const novoEstado = !algumCardExpandido
    const novoMap = {}
    for (const c of colaboradores) {
      novoMap[c.id] = novoEstado
    }
    setExpandidosMap(novoMap)
  }

  return (
    <div className="card space-y-4">
      {/* ═══ CABEÇALHO DO MÓDULO (TÍTULO, CONTADORES E SANFONA) ═══ */}
      <ColaboradoresEscalaHeader
        totalColaboradores={totalColaboradores}
        totalVagas={totalVagas}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((prev) => !prev)}
        termos={termos}
      />

      {/* ═══ CONTEÚDO EXPANSÍVEL (SANFONA) ═══ */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-surface-700/60 animate-fade-in">
          {totalColaboradores === 0 ? (
            /* Estado Vazio: Nenhuma vaga preenchida */
            <div className="py-8 px-4 text-center space-y-3 rounded-xl bg-surface-900/40 border border-dashed border-surface-700">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-800 text-surface-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-semibold text-gray-200">
                  Nenhum(a) {rotuloPessoa.toLowerCase()} com vaga marcada no momento
                </h4>
                <p className="text-xs text-gray-400">
                  Assim que os colaboradores garantirem seus horários pelo celular
                  (ou você incluí-los manualmente), a lista completa com todos os
                  horários e a opção de alterar o nome aparecerão aqui.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Barra de Filtro e Ordenação */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                {/* Input de Busca */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={`Buscar por nome do(a) ${rotuloPessoa.toLowerCase()}, dia, local ou telefone...`}
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-900 border border-surface-700 text-xs text-gray-100 placeholder-surface-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-surface-400 hover:text-surface-200 rounded"
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Controles: Ordenação + Expandir/Recolher Horários */}
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  {/* Seletor de Ordenação */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-surface-400 hidden sm:inline">
                      Ordenar:
                    </span>
                    <select
                      value={ordenacao}
                      onChange={(e) => setOrdenacao(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-surface-900 border border-surface-700 text-xs text-gray-200 focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="nome_asc">Nome (A - Z)</option>
                      <option value="nome_desc">Nome (Z - A)</option>
                      <option value="vagas_desc">Mais Horários</option>
                    </select>
                  </div>

                  {/* Botão de Expandir / Recolher Todos os Horários de cada nome */}
                  <button
                    type="button"
                    onClick={toggleTodosCards}
                    className="text-xs text-gray-300 hover:text-gray-100 flex items-center gap-1.5 bg-surface-900 hover:bg-surface-700/80 px-2.5 py-1.5 rounded-xl border border-surface-700 transition-colors font-medium min-h-[34px]"
                    title={
                      algumCardExpandido
                        ? 'Recolher os horários de todos os nomes'
                        : 'Expandir os horários de todos os nomes'
                    }
                    aria-label={
                      algumCardExpandido
                        ? 'Recolher todos os horários'
                        : 'Expandir todos os horários'
                    }
                  >
                    {algumCardExpandido ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 text-surface-400" />
                        <span>Recolher horários</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
                        <span>Expandir horários</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Contador de Resultados Filtrados */}
              {busca && (
                <div className="text-xs text-surface-400 flex items-center justify-between px-1">
                  <span>
                    Exibindo <strong>{colaboradores.length}</strong> de{' '}
                    <strong>{totalColaboradores}</strong> {rotuloPessoas.toLowerCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    className="text-brand-400 hover:underline"
                  >
                    Limpar filtro
                  </button>
                </div>
              )}

              {/* Lista dos Cards de Colaboradores */}
              {colaboradores.length === 0 ? (
                <div className="py-6 text-center text-xs text-surface-400 bg-surface-900/30 rounded-xl border border-surface-800">
                  Nenhum colaborador encontrado para o termo &ldquo;{busca}&rdquo;.
                </div>
              ) : (
                <div className="space-y-3">
                  {colaboradores.map((colab) => (
                    <ColaboradorEscalaCard
                      key={colab.id}
                      colaborador={colab}
                      isExpandido={isCardExpandido(colab.id)}
                      onToggleExpandido={() => handleToggleCard(colab.id)}
                      onEditarNome={(c) => setColaboradorParaEditar(c)}
                      onRemoverReserva={onRemoverReserva}
                      isFullAdmin={isFullAdmin}
                      termos={termos}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ MODAL DE ALTERAÇÃO DE NOME NA ESCALA ═══ */}
      <EditarNomeEscalaModal
        isOpen={Boolean(colaboradorParaEditar)}
        colaborador={colaboradorParaEditar}
        onClose={() => setColaboradorParaEditar(null)}
        onSalvar={renomearColaborador}
        salvando={salvandoNome}
        termos={termos}
      />
    </div>
  )
}
