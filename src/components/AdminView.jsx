import { useState, useCallback, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import {
  Plus,
  Trash2,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  Hash,
  ChevronDown,
  MapPin,
  Pencil,
  Store,
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

  // Estado do formulário de ponto
  const [formPontoNome, setFormPontoNome] = useState('')
  const [formPontoOrdem, setFormPontoOrdem] = useState(0)
  const [addingPonto, setAddingPonto] = useState(false)

  // Estado de edição de nome do ponto
  const [editingPontoId, setEditingPontoId] = useState(null)
  const [editingPontoNome, setEditingPontoNome] = useState('')

  // Estado do formulário de turno
  const [formPontoId, setFormPontoId] = useState('')
  const [formDia, setFormDia] = useState('SÁBADO')
  const [formHorario, setFormHorario] = useState('')
  const [formCapacidade, setFormCapacidade] = useState(3)
  const [formOrdem, setFormOrdem] = useState(0)
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

  // Estado para duplicação de ponto inteiro
  const [modalDuplicarPonto, setModalDuplicarPonto] = useState(null)
  const [nomeNovoPonto, setNomeNovoPonto] = useState('')
  const [duplicandoPonto, setDuplicandoPonto] = useState(false)

  const abrirModalDuplicarPonto = useCallback((ponto, totalTurnos) => {
    setModalDuplicarPonto({ ponto, totalTurnos })
    setNomeNovoPonto(`${ponto.nome} (Cópia)`)
  }, [])

  const handleConfirmDuplicarPonto = useCallback(async (e) => {
    if (e) e.preventDefault()
    if (!modalDuplicarPonto || !nomeNovoPonto.trim()) {
      showToast('Digite um nome para o novo ponto.', 'warning')
      return
    }

    setDuplicandoPonto(true)
    try {
      const pontoOrigem = modalDuplicarPonto.ponto
      const { data: novoPonto, error: erroPonto } = await supabase
        .from('pontos')
        .insert({
          nome: nomeNovoPonto.trim(),
          ordem: (pontoOrigem.ordem || 0) + 1,
        })
        .select()
        .single()

      if (erroPonto) throw erroPonto

      const turnosOrigem = turnos.filter((t) => t.ponto_id === pontoOrigem.id)
      if (turnosOrigem.length > 0) {
        const novosTurnos = turnosOrigem.map((t) => ({
          ponto_id: novoPonto.id,
          dia: t.dia,
          horario: t.horario,
          capacidade: t.capacidade,
          ordem: t.ordem,
        }))

        const { error: erroTurnos } = await supabase.from('turnos').insert(novosTurnos)
        if (erroTurnos) throw erroTurnos
      }

      showToast(`Ponto "${nomeNovoPonto.trim()}" duplicado com ${turnosOrigem.length} turnos! ✅`, 'success')
      setModalDuplicarPonto(null)
      setNomeNovoPonto('')
      onDataChanged()
    } catch (err) {
      console.error('Erro ao duplicar ponto:', err)
      showToast('Erro ao duplicar ponto.', 'error')
    } finally {
      setDuplicandoPonto(false)
    }
  }, [modalDuplicarPonto, nomeNovoPonto, turnos, onDataChanged, showToast])

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

  // ─── CRUD Pontos ─────────────────────────────────────────────

  const handleAddPonto = useCallback(
    async (e) => {
      e.preventDefault()
      if (!formPontoNome.trim()) {
        showToast('Preencha o nome do ponto.', 'error')
        return
      }

      setAddingPonto(true)
      try {
        const { error } = await supabase.from('pontos').insert({
          nome: formPontoNome.trim(),
          ordem: formPontoOrdem,
        })

        if (error) throw error

        showToast('Ponto de captação criado! ✅', 'success')
        setFormPontoNome('')
        setFormPontoOrdem((prev) => prev + 1)
        onDataChanged()
      } catch (err) {
        console.error('Erro ao criar ponto:', err)
        showToast('Erro ao criar ponto.', 'error')
      } finally {
        setAddingPonto(false)
      }
    },
    [formPontoNome, formPontoOrdem, onDataChanged, showToast]
  )

  const handleRenamePonto = useCallback(
    async (pontoId) => {
      if (!editingPontoNome.trim()) {
        showToast('Nome não pode ser vazio.', 'error')
        return
      }

      try {
        const { error } = await supabase
          .from('pontos')
          .update({ nome: editingPontoNome.trim() })
          .eq('id', pontoId)

        if (error) throw error

        showToast('Ponto renomeado com sucesso! ✅', 'success')
        setEditingPontoId(null)
        setEditingPontoNome('')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao renomear ponto:', err)
        showToast('Erro ao renomear ponto.', 'error')
      }
    },
    [editingPontoNome, onDataChanged, showToast]
  )

  const handleDeletePonto = useCallback(
    async (pontoId, pontoNome) => {
      const ok = await confirm({
        title: 'Excluir ponto?',
        message: `Tem certeza que deseja excluir o ponto "${pontoNome}"?\n\nTodos os turnos e reservas deste ponto serão removidos permanentemente!`,
        confirmText: 'Apagar tudo',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { error } = await supabase.from('pontos').delete().eq('id', pontoId)
        if (error) throw error

        showToast('Ponto excluído.', 'info')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao excluir ponto:', err)
        showToast('Erro ao excluir ponto.', 'error')
      }
    },
    [confirm, onDataChanged, showToast]
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
        const { error } = await supabase.from('turnos').insert({
          ponto_id: formPontoId,
          dia: formDia,
          horario: formHorario.trim(),
          capacidade: Math.max(1, formCapacidade),
          ordem: formOrdem,
        })

        if (error) throw error

        showToast('Turno adicionado com sucesso! ✅', 'success')
        setFormHorario('')
        setFormOrdem((prev) => prev + 1)
        onDataChanged()
      } catch (err) {
        console.error('Erro ao adicionar turno:', err)
        showToast('Erro ao adicionar turno.', 'error')
      } finally {
        setAddingTurno(false)
      }
    },
    [formPontoId, formDia, formHorario, formCapacidade, formOrdem, onDataChanged, showToast]
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

      {/* ═══ SEÇÃO: PONTOS DE CAPTAÇÃO ═══ */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-brand-400" />
          Pontos de Captação
        </h2>

        {/* Formulário de novo ponto */}
        <form onSubmit={handleAddPonto} className="space-y-3 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={formPontoNome}
              onChange={(e) => setFormPontoNome(e.target.value)}
              placeholder="Nome do ponto (ex: Mercado Extra)"
              className="input-field flex-1"
              maxLength={100}
            />
            <input
              type="number"
              value={formPontoOrdem}
              onChange={(e) => setFormPontoOrdem(parseInt(e.target.value) || 0)}
              min={0}
              className="input-field w-20 text-center"
              title="Ordem"
              placeholder="#"
            />
          </div>
          <button
            type="submit"
            disabled={addingPonto}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {addingPonto ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Criar Ponto de Captação
              </>
            )}
          </button>
        </form>

        {/* Lista de pontos existentes */}
        {pontos.length > 0 && (
          <div className="space-y-2 border-t border-surface-600 pt-4">
            {pontos.map((ponto) => {
              const qtdTurnos = turnosPorPonto[ponto.id]?.length || 0
              const isEditing = editingPontoId === ponto.id

              return (
                <div
                  key={ponto.id}
                  className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-surface-700/50"
                >
                  <Store className="w-4 h-4 text-brand-400 flex-shrink-0" />

                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingPontoNome}
                        onChange={(e) => setEditingPontoNome(e.target.value)}
                        className="input-field py-1.5 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenamePonto(ponto.id)
                          if (e.key === 'Escape') setEditingPontoId(null)
                        }}
                      />
                      <button
                        onClick={() => handleRenamePonto(ponto.id)}
                        className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingPontoId(null)}
                        className="p-1.5 rounded-lg hover:bg-surface-600 text-gray-500 transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const info = vagasPorPonto[ponto.id] || {}
                        const temVagas = info.vagasLivres > 0
                        return (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">
                              {ponto.nome}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">
                                {qtdTurnos} turno{qtdTurnos !== 1 ? 's' : ''}
                              </span>
                              {info.totalCapacidade > 0 && (
                                <span className={`text-xs font-medium ${temVagas ? 'text-emerald-400' : 'text-red-400'}`}>
                                  • {temVagas
                                    ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${info.vagasLivres !== 1 ? 's' : ''}`
                                    : 'Lotado'}
                                </span>
                              )}
                              <span className="text-xs text-gray-600">• Ordem: {ponto.ordem}</span>
                            </div>
                          </div>
                        )
                      })()}

                      <button
                        onClick={() => {
                          setEditingPontoId(ponto.id)
                          setEditingPontoNome(ponto.nome)
                        }}
                        className="p-2 rounded-lg hover:bg-brand-500/10 text-gray-600 hover:text-brand-400 transition-colors flex-shrink-0"
                        title="Renomear ponto"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => abrirModalDuplicarPonto(ponto, qtdTurnos)}
                        className="p-2 rounded-lg hover:bg-emerald-500/10 text-gray-600 hover:text-emerald-400 transition-colors flex-shrink-0"
                        title={`Duplicar ponto e seus ${qtdTurnos} turnos`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onLimparEscala(ponto.id)}
                        className="p-2 rounded-lg hover:bg-amber-500/10 text-gray-600 hover:text-amber-400 transition-colors flex-shrink-0"
                        title="Limpar reservas deste ponto"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeletePonto(ponto.id, ponto.nome)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Excluir ponto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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

            {/* Capacidade e Ordem */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Capacidade
                </label>
                <input
                  type="number"
                  value={formCapacidade}
                  onChange={(e) => setFormCapacidade(parseInt(e.target.value) || 1)}
                  min={1}
                  max={50}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Ordem
                </label>
                <input
                  type="number"
                  value={formOrdem}
                  onChange={(e) => setFormOrdem(parseInt(e.target.value) || 0)}
                  min={0}
                  className="input-field"
                />
              </div>
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

                        return diasOrdenados.map((dia) => {
                          const ts = porDia[dia]
                          return (
                            <div key={dia} className="mb-3">
                              <div className="flex items-center justify-between mb-1.5 px-1">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                  {dia}
                                </p>
                                <button
                                  onClick={() => abrirModalDuplicar(ponto.id, ponto.nome, dia, ts)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-300 hover:text-brand-200 bg-brand-500/15 hover:bg-brand-500/25 px-2.5 py-1 rounded-lg transition-colors border border-brand-500/20"
                                  title={`Copiar turnos de ${dia} para outros dias da semana`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Duplicar horários
                                </button>
                              </div>
                              {ts.sort((a, b) => a.ordem - b.ordem).map((turno) => {
                                const reservasTurno = reservas.filter(
                                  (r) => r.turno_id === turno.id
                                )
                                const lotado = reservasTurno.length >= turno.capacidade

                                return (
                                  <div
                                    key={turno.id}
                                    className="p-3 rounded-xl bg-surface-700/60 border border-surface-600/40 mb-2 space-y-2.5 transition-all"
                                  >
                                    {/* Linha superior: Horário, vagas e botões de ação */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Clock className="w-4 h-4 text-brand-400 flex-shrink-0" />
                                        <p className="text-sm font-bold text-gray-100 truncate">
                                          {turno.horario}
                                        </p>
                                        <span
                                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                            lotado
                                              ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                              : reservasTurno.length > 0
                                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                              : 'bg-surface-800 text-gray-400 border-surface-600'
                                          }`}
                                        >
                                          {reservasTurno.length}/{turno.capacidade} vagas
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                          onClick={() =>
                                            handleAbrirIncluirPessoa(
                                              turno.id,
                                              turno.horario,
                                              dia,
                                              ponto.nome
                                            )
                                          }
                                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded-lg transition-colors border border-emerald-500/30"
                                          title="Incluir corretor neste horário"
                                        >
                                          <UserPlus className="w-3.5 h-3.5" />
                                          Incluir
                                        </button>

                                        <button
                                          onClick={() =>
                                            handleDeleteTurno(
                                              turno.id,
                                              `${ponto.nome} — ${dia} ${turno.horario}`
                                            )
                                          }
                                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors"
                                          title="Excluir este turno inteiro"
                                          aria-label="Excluir turno"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Lista de pessoas escaladas neste turno */}
                                    <div className="pt-2 border-t border-surface-600/40">
                                      <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1 mb-1.5">
                                        <Users className="w-3 h-3 text-gray-500" />
                                        Corretores escalados:
                                      </p>

                                      {reservasTurno.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">
                                          Nenhum corretor escalado neste horário.
                                        </p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {reservasTurno.map((r) => (
                                            <div
                                              key={r.id}
                                              className="flex items-center gap-1.5 bg-surface-800 text-gray-200 text-xs px-2.5 py-1 rounded-lg border border-surface-600/70 shadow-sm"
                                            >
                                              <User className="w-3 h-3 text-brand-400" />
                                              <span className="font-medium">
                                                {r.corretor_nome}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleRemoverReserva(
                                                    r.id,
                                                    r.corretor_nome,
                                                    `${dia} ${turno.horario}`
                                                  )
                                                }
                                                className="ml-1 p-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                                                title={`Excluir ${r.corretor_nome} deste turno`}
                                              >
                                                <X className="w-3 h-3 stroke-[2.5]" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })
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

      {/* ═══ MODAL DE DUPLICAÇÃO DE PONTO INTEIRO ═══ */}
      {modalDuplicarPonto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !duplicandoPonto && setModalDuplicarPonto(null)}
          />

          <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">
                    Duplicar Ponto de Captação
                  </h3>
                  <p className="text-xs text-gray-400">
                    Copiando horários de{' '}
                    <span className="text-emerald-300 font-medium">
                      {modalDuplicarPonto.ponto.nome}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => !duplicandoPonto && setModalDuplicarPonto(null)}
                className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
                disabled={duplicandoPonto}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-surface-900/60 rounded-xl border border-surface-700">
              <p className="text-xs text-gray-300">
                ✨ Serão clonados todos os{' '}
                <strong className="text-emerald-400">{modalDuplicarPonto.totalTurnos} turnos</strong> (dias,
                horários e capacidades) deste ponto. As reservas iniciarão zeradas para o novo ponto.
              </p>
            </div>

            <form onSubmit={handleConfirmDuplicarPonto} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
                  Nome do novo ponto de captação:
                </label>
                <input
                  type="text"
                  value={nomeNovoPonto}
                  onChange={(e) => setNomeNovoPonto(e.target.value)}
                  placeholder="Ex: Padaria Di Cunto"
                  className="input-field text-base font-medium"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalDuplicarPonto(null)}
                  disabled={duplicandoPonto}
                  className="btn-ghost flex-1 py-3 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={duplicandoPonto || !nomeNovoPonto.trim()}
                  className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {duplicandoPonto ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Duplicando...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Criar Cópia
                    </>
                  )}
                </button>
              </div>
            </form>
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
