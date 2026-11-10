import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, ChevronUp, ChevronDown } from 'lucide-react'
import PontoTurnosAcordeon from './PontoTurnosAcordeon'

/**
 * Painel orquestrador de listagem de turnos cadastrados por ponto de captação.
 * Gerencia o estado de expansão/recolhimento das sanfonas e distribui
 * as ações de edição, exclusão, inclusão de membros e duplicação de dias.
 */
export default function TurnosCadastradosList({
  pontos = [],
  turnosPorPonto = {},
  vagasPorPonto = {},
  reservas = [],
  empresaId,
  onAbrirIncluirPessoa,
  onEditarTurno,
  onDeleteTurno,
  onRemoverReserva,
  onAbrirDuplicar,
  onDataChanged,
  showToast,
}) {
  const STORAGE_KEY_PONTOS_EXPANDIDOS = empresaId
    ? `escala_admin_pontos_expandidos_${empresaId}`
    : 'escala_admin_pontos_expandidos'

  // Controle de sanfona (accordion) dos pontos na listagem de turnos
  const [pontosExpandidos, setPontosExpandidos] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_PONTOS_EXPANDIDOS)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de expansão:', err)
    }
    return {}
  })

  // Salva a preferência no localStorage sempre que o usuário alterar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PONTOS_EXPANDIDOS, JSON.stringify(pontosExpandidos))
    } catch (err) {
      console.error('Erro ao salvar preferência de expansão:', err)
    }
  }, [pontosExpandidos, STORAGE_KEY_PONTOS_EXPANDIDOS])

  const togglePonto = useCallback((pontoId) => {
    setPontosExpandidos((prev) => ({
      ...prev,
      [pontoId]: !prev[pontoId],
    }))
  }, [])

  const recolherTodosPontos = useCallback(() => {
    setPontosExpandidos({})
  }, [])

  const expandirTodosPontos = useCallback(() => {
    const todos = {}
    for (const p of pontos) {
      todos[p.id] = true
    }
    setPontosExpandidos(todos)
  }, [pontos])

  const algumPontoExpandido = useMemo(() => {
    return pontos.some((p) => Boolean(pontosExpandidos[p.id]))
  }, [pontos, pontosExpandidos])

  const toggleTodosPontos = useCallback(() => {
    if (algumPontoExpandido) {
      recolherTodosPontos()
    } else {
      expandirTodosPontos()
    }
  }, [algumPontoExpandido, recolherTodosPontos, expandirTodosPontos])

  if (pontos.length === 0) return null

  return (
    <div className="card">
      {/* Cabeçalho da Seção com Ação em Lote */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-400" />
          Turnos Cadastrados
        </h2>
        <button
          type="button"
          onClick={toggleTodosPontos}
          className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 bg-surface-700/60 hover:bg-surface-700 px-2.5 py-1.5 rounded-lg border border-surface-600/50 transition-colors font-medium"
          title={algumPontoExpandido ? 'Recolher todos os pontos' : 'Expandir todos os pontos'}
        >
          {algumPontoExpandido ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Recolher todos</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expandir todos</span>
            </>
          )}
        </button>
      </div>

      {/* Lista de Pontos Acordeon */}
      <div className="space-y-3">
        {pontos.map((ponto) => {
          const turnosDoPonto = turnosPorPonto[ponto.id] || []
          const isExpandido = Boolean(pontosExpandidos[ponto.id])
          const info = vagasPorPonto[ponto.id] || {}

          return (
            <PontoTurnosAcordeon
              key={ponto.id}
              ponto={ponto}
              turnosDoPonto={turnosDoPonto}
              info={info}
              isExpandido={isExpandido}
              onToggleExpandir={() => togglePonto(ponto.id)}
              reservas={reservas}
              onAbrirIncluirPessoa={onAbrirIncluirPessoa}
              onEditarTurno={onEditarTurno}
              onDeleteTurno={onDeleteTurno}
              onRemoverReserva={onRemoverReserva}
              onAbrirDuplicar={onAbrirDuplicar}
              onDataChanged={onDataChanged}
              showToast={showToast}
            />
          )
        })}
      </div>
    </div>
  )
}
