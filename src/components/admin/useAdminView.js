import { useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useConfirm } from '../ConfirmModal'
import { useAuth } from '../../contexts/AuthContext'
import { obterTermos } from '../../lib/vocabularioHelper'
import { getPublicShareUrl } from '../../lib/tenantHelper'
import { formatarNomeDia } from '../../lib/diasSemana'
import { MapPin, Calendar, Users, Settings } from 'lucide-react'

/**
 * Hook customizado com toda a lógica de estado, cálculos matemáticos,
 * preferências no localStorage e mutações do painel de administração.
 */
export function useAdminView({
  pontos = [],
  turnos = [],
  reservas = [],
  empresa,
  empresaId,
  isFullAdmin: propIsFullAdmin,
  onDataChanged,
  showToast,
}) {
  const confirm = useConfirm()
  const { user, perfil, getEmpresaRole } = useAuth()
  const role = empresaId ? getEmpresaRole(empresaId) : null
  const isFullAdmin = propIsFullAdmin ?? (role === 'admin' || !user)
  const termos = useMemo(() => obterTermos(empresa), [empresa])

  // Preferência de Modo de Visualização: 'abas' (Padrão) ou 'continuo' (Linear Clássico)
  const [layoutMode, setLayoutMode] = useState(() => {
    try {
      return localStorage.getItem('escala_admin_layout_mode') || 'abas'
    } catch (err) {
      return 'abas'
    }
  })

  // Preferência de Aba Ativa (Padrão: 'pontos')
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('escala_admin_active_tab') || 'pontos'
    } catch (err) {
      return 'pontos'
    }
  })

  // URL pública oficial da escala
  const shareUrl = useMemo(() => getPublicShareUrl(empresa), [empresa])

  // Estados dos Modais
  const [modalDuplicar, setModalDuplicar] = useState(null)
  const [modalIncluirPessoa, setModalIncluirPessoa] = useState(null)
  const [modalEditarTurno, setModalEditarTurno] = useState(null)
  const [showModalSenha, setShowModalSenha] = useState(false)
  const [showModalVocabulario, setShowModalVocabulario] = useState(false)

  const handleTrocarLayout = useCallback(
    (novoModo) => {
      setLayoutMode(novoModo)
      try {
        localStorage.setItem('escala_admin_layout_mode', novoModo)
      } catch (err) {
        console.error('Erro ao salvar preferência de layout:', err)
      }
      showToast?.(
        novoModo === 'abas'
          ? 'Layout em Abas ativado! Navegação organizada e limpa 📑'
          : 'Visão Contínua ativada! Todas as seções em uma única página 📜',
        'info'
      )
    },
    [showToast]
  )

  const handleMudarAba = useCallback((tabId) => {
    setActiveTab(tabId)
    try {
      localStorage.setItem('escala_admin_active_tab', tabId)
    } catch (err) {
      console.error('Erro ao salvar aba ativa:', err)
    }
  }, [])

  // ─── Agrupamentos e Métricas Calculadas ───────────────────────
  const turnosPorPonto = useMemo(() => {
    const mapa = {}
    for (const turno of turnos) {
      const key = turno.ponto_id || 'sem_ponto'
      if (!mapa[key]) mapa[key] = []
      mapa[key].push(turno)
    }
    return mapa
  }, [turnos])

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

  const pontoIdsSet = useMemo(() => new Set(pontos.map((p) => p.id)), [pontos])
  const turnosValidos = useMemo(
    () => turnos.filter((t) => t.ponto_id && pontoIdsSet.has(t.ponto_id)),
    [turnos, pontoIdsSet]
  )
  const turnoIdsValidosSet = useMemo(
    () => new Set(turnosValidos.map((t) => t.id)),
    [turnosValidos]
  )
  const reservasValidas = useMemo(
    () => reservas.filter((r) => turnoIdsValidosSet.has(r.turno_id)),
    [reservas, turnoIdsValidosSet]
  )

  // ─── Ações de Turnos e Reservas ──────────────────────────────
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

        showToast?.(`"${corretorNome}" removido do turno!`, 'info')
        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao remover corretor:', err)
        showToast?.('Erro ao remover corretor.', 'error')
      }
    },
    [confirm, onDataChanged, showToast]
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

        showToast?.('Turno excluído.', 'info')
        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao excluir turno:', err)
        showToast?.('Erro ao excluir turno.', 'error')
      }
    },
    [confirm, onDataChanged, showToast]
  )

  const handleAbrirDuplicar = useCallback((pontoId, pontoNome, diaOrigem, turnosDoDia) => {
    setModalDuplicar({
      pontoId,
      pontoNome,
      diaOrigem: formatarNomeDia(diaOrigem),
      turnos: turnosDoDia,
    })
  }, [])

  const handleAbrirIncluirPessoa = useCallback((turnoId, horario, dia, pontoNome) => {
    setModalIncluirPessoa({ turnoId, horario, dia, pontoNome })
  }, [])

  const handleAbrirEditarTurno = useCallback((dados) => {
    setModalEditarTurno(dados)
  }, [])

  // Definição das Abas de navegação
  const tabs = useMemo(
    () => [
      {
        id: 'pontos',
        label: termos.pontos || 'Pontos',
        tooltip: `${termos.pontos || 'Pontos'} (${pontos.length} locais)`,
        icon: MapPin,
      },
      {
        id: 'escala',
        label: 'Escala',
        tooltip: `Escala (${turnosValidos.length} turnos, ${reservasValidas.length} reservas)`,
        icon: Calendar,
      },
      {
        id: 'equipe',
        label: 'Equipe',
        tooltip: 'Equipe & Gestores',
        icon: Users,
      },
      {
        id: 'configuracoes',
        label: 'Configurações',
        tooltip: 'Ajustes & Configurações da Empresa',
        icon: Settings,
      },
    ],
    [pontos.length, termos.pontos, turnosValidos.length, reservasValidas.length]
  )

  return {
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
    reservasPorTurno,
    vagasPorPonto,
    turnosValidos,
    reservasValidas,
    handleRemoverReserva,
    handleDeleteTurno,
    // Estados e Abertura dos Modais
    modalDuplicar,
    setModalDuplicar,
    handleAbrirDuplicar,
    modalIncluirPessoa,
    setModalIncluirPessoa,
    handleAbrirIncluirPessoa,
    modalEditarTurno,
    setModalEditarTurno,
    handleAbrirEditarTurno,
    showModalSenha,
    setShowModalSenha,
    showModalVocabulario,
    setShowModalVocabulario,
  }
}

