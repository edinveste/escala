import { useState, useCallback, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import PontosManager from './PontosManager'
import TurnosDiaList from './TurnosDiaList'
import {
  Plus,
  Trash2,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  ChevronDown,
  MapPin,
  Check,
  X,
  Copy,
  Layers,
  User,
  UserPlus,
} from 'lucide-react'

const DIAS_OPCOES = [
  'SEGUNDA',
  'TERÇA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SÁBADO',
  'DOMINGO',
]

export default function AdminView({
  pontos,
  turnos,
  reservas,
  onLimparEscala,
  onDataChanged,
  showToast,
}) {
  const confirm = useConfirm()

  // Estado do formulário de turno
  const [formPontoId, setFormPontoId] = useState('')
  const [formDia, setFormDia] = useState('SÁBADO')
  const [formHorario, setFormHorario] = useState('')
  const [formCapacidade, setFormCapacidade] = useState(3)
  const [addingTurno, setAddingTurno] = useState(false)

  // Estado para duplicação de dia
  const [modalDuplicar, setModalDuplicar] = useState(null) // { pontoId, pontoNome, diaOrigem, turnos }
  const [diasDestino, setDiasDestino] = useState([])
  const [duplicando, setDuplicando] = useState(false)

  // Controle de sanfona (accordion) dos pontos na listagem de turnos
  // Padrão: tudo recolhido na 1ª abertura, com persistência no localStorage
  const STORAGE_KEY_PONTOS_EXPANDIDOS = 'escala_admin_pontos_expandidos'

  const [pontosExpandidos, setPontosExpandidos] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_PONTOS_EXPANDIDOS)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de expansão:', err)
    }
    return {} // Padrão inicial: todas as sessões recolhidas ao abrir pela primeira vez
  })

  // Salva a preferência no localStorage sempre que o usuário alterar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PONTOS_EXPANDIDOS, JSON.stringify(pontosExpandidos))
    } catch (err) {
      console.error('Erro ao salvar preferência de expansão:', err)
    }
  }, [pontosExpandidos])

  const togglePontoFechado = useCallback((pontoId) => {
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

  // ─── Gestão de Pessoas nas Reservas (Admin) ───────────────────
  const [modalIncluirPessoa, setModalIncluirPessoa] = useState(null)
  const [nomeCorretorManual, setNomeCorretorManual] = useState('')
  const [salvandoPessoa, setSalvandoPessoa] = useState(false)

  const handleRemoverReserva = useCallback(
    async (reservaId, corretorNome, turnoDesc) => {
      const ok = await confirm({
        title: 'Remover corretor?',
        message: `Tem certeza que deseja remover "${corretorNome}" deste turno (${turnoDesc})?`,
        confirmText: 'Remover',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { error } = await supabase.from('reservas').delete().eq('id', reservaId)
        if (error) throw error

        showToast(`"${corretorNome}" removido do turno!`, 'info')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao remover corretor:', err)
        showToast('Erro ao remover corretor.', 'error')
      }
    },
    [confirm, onDataChanged, showToast]
  )

  const handleAbrirIncluirPessoa = useCallback((turnoId, horario, dia, pontoNome) => {
    setModalIncluirPessoa({ turnoId, horario, dia, pontoNome })
    setNomeCorretorManual('')
  }, [])

  const handleConfirmarIncluirPessoa = useCallback(
    async (e) => {
      if (e) e.preventDefault()
      if (!modalIncluirPessoa || !nomeCorretorManual.trim()) {
        showToast('Digite o nome do corretor.', 'warning')
        return
      }

      setSalvandoPessoa(true)
      try {
        const { error } = await supabase.from('reservas').insert({
          turno_id: modalIncluirPessoa.turnoId,
          corretor_nome: nomeCorretorManual.trim(),
          device_id: 'admin_manual_' + Date.now(),
        })

        if (error) throw error

        showToast(`"${nomeCorretorManual.trim()}" incluído com sucesso! ✅`, 'success')
        setModalIncluirPessoa(null)
        setNomeCorretorManual('')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao incluir corretor:', err)
        showToast('Erro ao incluir corretor.', 'error')
      } finally {
        setSalvandoPessoa(false)
      }
    },
    [modalIncluirPessoa, nomeCorretorManual, onDataChanged, showToast]
  )

  // ─── CRUD Turnos ─────────────────────────────────────────────

  const handleAddTurno = useCallback(
    async (e) => {
      e.preventDefault()

      if (!formPontoId) {
        showToast('Selecione um ponto de captação.', 'error')
        return
      }
      if (!formHorario.trim()) {
        showToast('Preencha o horário.', 'error')
        return
      }

      setAddingTurno(true)
      try {
        const turnosMesmoDia = turnos.filter(
          (t) => t.ponto_id === formPontoId && t.dia === formDia
        )
        const proximaOrdem =
          turnosMesmoDia.length > 0
            ? Math.max(...turnosMesmoDia.map((t) => (Number.isFinite(t.ordem) ? t.ordem : 0))) + 1
            : 0

        const { error } = await supabase.from('turnos').insert({
          ponto_id: formPontoId,
          dia: formDia,
          horario: formHorario.trim(),
          capacidade: Math.max(1, formCapacidade),
          ordem: proximaOrdem,
        })

        if (error) throw error

        showToast('Turno adicionado com sucesso! ✅', 'success')
        setFormHorario('')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao adicionar turno:', err)
        showToast('Erro ao adicionar turno.', 'error')
      } finally {
        setAddingTurno(false)
      }
    },
    [formPontoId, formDia, formHorario, formCapacidade, turnos, onDataChanged, showToast]
  )

  const handleDeleteTurno = useCallback(
    async (turnoId, turnoLabel) => {
      const ok = await confirm({
        title: 'Excluir turno?',
        message: `Tem certeza que deseja excluir o turno "${turnoLabel}"?\n\nTodas as reservas deste turno serão removidas.`,
        confirmText: 'Apagar turno',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { error } = await supabase.from('turnos').delete().eq('id', turnoId)
        if (error) throw error

        showToast('Turno excluído.', 'info')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao excluir turno:', err)
        showToast('Erro ao excluir turno.', 'error')
      }
    },
    [confirm, onDataChanged, showToast]
  )

  // ─── Duplicação de Turnos entre Dias ──────────────────────────

  const abrirModalDuplicar = useCallback((pontoId, pontoNome, diaOrigem, turnosDoDia) => {
    setModalDuplicar({
      pontoId,
      pontoNome,
      diaOrigem,
      turnos: turnosDoDia,
    })
    // Pré-seleciona todos os outros dias exceto o de origem
    setDiasDestino(DIAS_OPCOES.filter((d) => d !== diaOrigem))
  }, [])

  const toggleDiaDestino = useCallback((dia) => {
    setDiasDestino((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    )
  }, [])

  const selecionarPresetDias = useCallback(
    (tipo) => {
      if (!modalDuplicar) return
      const diaOrigem = modalDuplicar.diaOrigem
      if (tipo === 'todos') {
        const outros = DIAS_OPCOES.filter((d) => d !== diaOrigem)
        setDiasDestino(diasDestino.length === outros.length ? [] : outros)
      } else if (tipo === 'uteis') {
        const uteis = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA'].filter((d) => d !== diaOrigem)
        setDiasDestino(uteis)
      } else if (tipo === 'fimdesemana') {
        const fds = ['SÁBADO', 'DOMINGO'].filter((d) => d !== diaOrigem)
        setDiasDestino(fds)
      }
    },
    [modalDuplicar, diasDestino]
  )

  const executarDuplicacao = useCallback(async () => {
    if (!modalDuplicar || diasDestino.length === 0) {
      showToast('Selecione pelo menos um dia de destino.', 'warning')
      return
    }

    setDuplicando(true)
    try {
      const novosTurnos = []
      for (const dia of diasDestino) {
        for (const t of modalDuplicar.turnos) {
          novosTurnos.push({
            ponto_id: modalDuplicar.pontoId,
            dia: dia,
            horario: t.horario,
            capacidade: t.capacidade,
            ordem: t.ordem,
          })
        }
      }

      const { error } = await supabase.from('turnos').insert(novosTurnos)
      if (error) throw error

      showToast(
        `Turnos de ${modalDuplicar.diaOrigem} duplicados para ${diasDestino.length} dia(s)! ✅`,
        'success'
      )
      setModalDuplicar(null)
      onDataChanged()
    } catch (err) {
      console.error('Erro ao duplicar turnos:', err)
      showToast('Erro ao duplicar turnos.', 'error')
    } finally {
      setDuplicando(false)
    }
  }, [modalDuplicar, diasDestino, onDataChanged, showToast])

  // Agrupar turnos por ponto
  const turnosPorPonto = useMemo(() => {
    const mapa = {}
    for (const turno of turnos) {
      const key = turno.ponto_id || 'sem_ponto'
      if (!mapa[key]) mapa[key] = []
      mapa[key].push(turno)
    }
    return mapa
  }, [turnos])

  // Mapa de reservas por turno
  const reservasPorTurno = useMemo(() => {
    const mapa = {}
    for (const reserva of reservas) {
      if (!mapa[reserva.turno_id]) {
        mapa[reserva.turno_id] = []
      }
      mapa[reserva.turno_id].push(reserva)
    }
    return mapa
  }, [reservas])

  // Contagem de turnos e vagas livres por ponto (idêntico à visão do corretor)
  const vagasPorPonto = useMemo(() => {
    const mapa = {}
    for (const ponto of pontos) {
      const turnosDoPonto = turnos.filter((t) => t.ponto_id === ponto.id)
      const totalCapacidade = turnosDoPonto.reduce((sum, t) => sum + t.capacidade, 0)
      const totalReservados = turnosDoPonto.reduce(
        (sum, t) => sum + (reservasPorTurno[t.id]?.length || 0),
        0
      )
      mapa[ponto.id] = {
        totalTurnos: turnosDoPonto.length,
        totalCapacidade,
        totalReservados,
        vagasLivres: totalCapacidade - totalReservados,
      }
    }
    return mapa
  }, [pontos, turnos, reservasPorTurno])

  const totalReservas = reservas.length

  return (
    <div className="space-y-6">
      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-400">{pontos.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pontos</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-neon-green">{turnos.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Turnos</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-400">{totalReservas}</p>
          <p className="text-xs text-gray-500 mt-0.5">Reservas</p>
        </div>
      </div>

      {/* ═══ SEÇÃO: PONTOS DE CAPTAÇÃO (COMPONENTIZADO COM DRAG & DROP) ═══ */}
      <PontosManager
        pontos={pontos}
        turnos={turnos}
        turnosPorPonto={turnosPorPonto}
        vagasPorPonto={vagasPorPonto}
        onLimparEscala={onLimparEscala}
        onDataChanged={onDataChanged}
        showToast={showToast}
      />

      {/* ═══ SEÇÃO: TURNOS ═══ */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-brand-400" />
          Adicionar Turno
        </h2>

        {pontos.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500">
              Crie um ponto de captação primeiro para adicionar turnos.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAddTurno} className="space-y-3">
            {/* Ponto */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Ponto de Captação
              </label>
              <div className="relative">
                <select
                  value={formPontoId}
                  onChange={(e) => setFormPontoId(e.target.value)}
                  className="input-field appearance-none pr-10"
                >
                  <option value="">Selecione um ponto...</option>
                  {pontos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dia */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Dia
              </label>
              <div className="relative">
                <select
                  value={formDia}
                  onChange={(e) => setFormDia(e.target.value)}
                  className="input-field appearance-none pr-10"
                >
                  {DIAS_OPCOES.map((dia) => (
                    <option key={dia} value={dia}>
                      {dia}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Horário */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Horário
              </label>
              <input
                type="text"
                value={formHorario}
                onChange={(e) => setFormHorario(e.target.value)}
                placeholder="Ex: 14h às 16h"
                className="input-field"
              />
            </div>

            {/* Capacidade */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Capacidade de vagas neste horário
              </label>
              <input
                type="number"
                value={formCapacidade}
                onChange={(e) => setFormCapacidade(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
                className="input-field"
                placeholder="Ex: 2 ou 3 vagas"
              />
            </div>

            <button
              type="submit"
              disabled={addingTurno}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {addingTurno ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="w-4.5 h-4.5" />
                  Adicionar Turno
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* ═══ SEÇÃO: TURNOS EXISTENTES POR PONTO ═══ */}
      {pontos.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-400" />
              Turnos Cadastrados
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={recolherTodosPontos}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-surface-700/60 hover:bg-surface-700 px-2 py-1 rounded-lg transition-colors border border-surface-600/50"
                title="Recolher todos os pontos"
              >
                Recolher todos
              </button>
              <button
                type="button"
                onClick={expandirTodosPontos}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-surface-700/60 hover:bg-surface-700 px-2 py-1 rounded-lg transition-colors border border-surface-600/50"
                title="Expandir todos os pontos"
              >
                Expandir todos
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {pontos.map((ponto) => {
              const turnosDoPonto = (turnosPorPonto[ponto.id] || []).sort(
                (a, b) => a.ordem - b.ordem
              )
              const isFechado = !pontosExpandidos[ponto.id]
              const info = vagasPorPonto[ponto.id] || {}
              const temVagas = info.vagasLivres > 0

              return (
                <div
                  key={ponto.id}
                  className="border border-surface-700/80 rounded-2xl p-2.5 bg-surface-900/40 transition-colors"
                >
                  {/* Botão Acordeão / Sanfona do Ponto - Idêntico ao card da visão do corretor */}
                  <button
                    type="button"
                    onClick={() => togglePontoFechado(ponto.id)}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface-700/40 transition-colors text-left select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
                        <MapPin className="w-5 h-5 text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-100 text-[15px] truncate">
                          {ponto.nome}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            {info.totalTurnos || 0} turno{info.totalTurnos !== 1 ? 's' : ''}
                          </span>
                          {info.totalCapacidade > 0 && (
                            <span className={`text-xs font-medium ${temVagas ? 'text-emerald-400' : 'text-red-400'}`}>
                              {temVagas
                                ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${info.vagasLivres !== 1 ? 's' : ''}`
                                : 'Lotado'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {/* Indicador visual idêntico à visão do corretor */}
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          info.totalCapacidade === 0
                            ? 'bg-gray-600'
                            : temVagas
                            ? 'bg-emerald-400 animate-pulse-soft'
                            : 'bg-red-500'
                        }`}
                        title={
                          info.totalCapacidade === 0
                            ? 'Sem turnos/capacidade'
                            : temVagas
                            ? `${info.vagasLivres} vagas livres`
                            : 'Lotado'
                        }
                      />

                      <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
                        {isFechado ? 'Expandir' : 'Recolher'}
                      </span>
                      <div
                        className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 ${
                          isFechado ? '' : 'rotate-180'
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </button>

                  {/* Conteúdo dos Dias e Turnos (colapsável) */}
                  {!isFechado && (
                    <div className="mt-3 pt-3 border-t border-surface-700/60 space-y-3">
                      {turnosDoPonto.length === 0 ? (
                        <p className="text-xs text-gray-500 py-3 text-center italic">
                          Nenhum turno cadastrado para este ponto ainda.
                        </p>
                      ) : (
                        (() => {
                          const porDia = {}
                          for (const t of turnosDoPonto) {
                            if (!porDia[t.dia]) porDia[t.dia] = []
                            porDia[t.dia].push(t)
                          }

                          const diasOrdenados = Object.keys(porDia).sort(
                            (a, b) => DIAS_OPCOES.indexOf(a) - DIAS_OPCOES.indexOf(b)
                          )

                          return diasOrdenados.map((dia) => (
                            <TurnosDiaList
                              key={dia}
                              dia={dia}
                              turnos={porDia[dia]}
                              ponto={ponto}
                              reservas={reservas}
                              onAbrirIncluirPessoa={handleAbrirIncluirPessoa}
                              onDeleteTurno={handleDeleteTurno}
                              onRemoverReserva={handleRemoverReserva}
                              onAbrirDuplicar={() =>
                                abrirModalDuplicar(ponto.id, ponto.nome, dia, porDia[dia])
                              }
                              onDataChanged={onDataChanged}
                              showToast={showToast}
                            />
                          ))
                      })())}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ ZONA DE PERIGO ═══ */}
      <div className="card border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-400">Zona de Perigo</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Limpar todas as reservas de todos os pontos. Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <button
          onClick={() => onLimparEscala(null)}
          className="btn-danger w-full flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4.5 h-4.5" />
          Limpar Toda a Escala
        </button>
      </div>

      {/* ═══ MODAL DE DUPLICAÇÃO DE DIAS ═══ */}
      {modalDuplicar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !duplicando && setModalDuplicar(null)}
          />

          <div className="relative w-full max-w-lg bg-surface-800 border border-surface-600 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">
                    Duplicar Horários de {modalDuplicar.diaOrigem}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Ponto: <span className="text-brand-300 font-medium">{modalDuplicar.pontoNome}</span> ({modalDuplicar.turnos.length} turno{modalDuplicar.turnos.length !== 1 ? 's' : ''})
                  </p>
                </div>
              </div>

              <button
                onClick={() => !duplicando && setModalDuplicar(null)}
                className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
                disabled={duplicando}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pré-visualização dos horários que serão copiados */}
            <div className="mb-4 p-3 bg-surface-900/60 rounded-xl border border-surface-700">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Horários que serão replicados:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {modalDuplicar.turnos.map((t) => (
                  <span
                    key={t.id}
                    className="text-xs bg-surface-700 text-gray-300 px-2.5 py-1 rounded-lg border border-surface-600 font-medium"
                  >
                    {t.horario} ({t.capacidade} vaga{t.capacidade !== 1 ? 's' : ''})
                  </span>
                ))}
              </div>
            </div>

            {/* Atalhos rápidos de seleção */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-300 mb-2">
                Para quais dias deseja duplicar?
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => selecionarPresetDias('todos')}
                  className="text-xs bg-surface-700 hover:bg-surface-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-medium border border-surface-600"
                >
                  {diasDestino.length === DIAS_OPCOES.filter((d) => d !== modalDuplicar.diaOrigem).length
                    ? 'Desmarcar Todos'
                    : 'Marcar Todos'}
                </button>
                <button
                  type="button"
                  onClick={() => selecionarPresetDias('uteis')}
                  className="text-xs bg-surface-700 hover:bg-surface-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-medium border border-surface-600"
                >
                  Seg a Sex
                </button>
                <button
                  type="button"
                  onClick={() => selecionarPresetDias('fimdesemana')}
                  className="text-xs bg-surface-700 hover:bg-surface-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-medium border border-surface-600"
                >
                  Fim de Semana
                </button>
              </div>
            </div>

            {/* Lista de dias para seleção */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {DIAS_OPCOES.filter((dia) => dia !== modalDuplicar.diaOrigem).map((dia) => {
                const isSelected = diasDestino.includes(dia)
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDiaDestino(dia)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                      isSelected
                        ? 'bg-brand-500/15 border-brand-500/50 text-brand-200'
                        : 'bg-surface-700/50 border-surface-600 text-gray-400 hover:bg-surface-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'border-surface-500 bg-surface-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{dia}</span>
                  </button>
                )
              })}
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalDuplicar(null)}
                disabled={duplicando}
                className="btn-ghost flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarDuplicacao}
                disabled={duplicando || diasDestino.length === 0}
                className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
              >
                {duplicando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Duplicando...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Duplicar para {diasDestino.length} dia{diasDestino.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL DE INCLUSÃO MANUAL DE CORRETOR ═══ */}
      {modalIncluirPessoa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !salvandoPessoa && setModalIncluirPessoa(null)}
          />

          <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">
                    Incluir Corretor no Turno
                  </h3>
                  <p className="text-xs text-gray-400">
                    <span className="text-brand-300 font-medium">
                      {modalIncluirPessoa.pontoNome}
                    </span>{' '}
                    • {modalIncluirPessoa.dia} ({modalIncluirPessoa.horario})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !salvandoPessoa && setModalIncluirPessoa(null)}
                className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
                disabled={salvandoPessoa}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmarIncluirPessoa} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
                  Nome do Corretor:
                </label>
                <input
                  type="text"
                  value={nomeCorretorManual}
                  onChange={(e) => setNomeCorretorManual(e.target.value)}
                  placeholder="Ex: Carlos Oliveira"
                  className="input-field text-base font-medium"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  O corretor será adicionado imediatamente a este horário.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalIncluirPessoa(null)}
                  disabled={salvandoPessoa}
                  className="btn-ghost flex-1 py-3 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoPessoa || !nomeCorretorManual.trim()}
                  className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {salvandoPessoa ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Confirmar Inclusão
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
