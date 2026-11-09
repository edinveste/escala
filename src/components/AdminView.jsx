import { useState, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import PontosManager from './PontosManager'
import TurnosDiaList from './TurnosDiaList'
import AlterarSenhaModal from './AlterarSenhaModal'
import EquipeManager from './EquipeManager'
import GestoresManager from './GestoresManager'
import LinkSeguroManager from './LinkSeguroManager'
import VocabularioModal from './VocabularioModal'
import { obterTermos } from '../lib/vocabularioHelper'
import { getPublicShareUrl } from '../lib/tenantHelper'
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  MapPin,
  Check,
  X,
  Copy,
  Layers,
  User,
  UserPlus,
  Key,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Settings,
  ScrollText,
  LayoutGrid,
  Share2,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  DIAS_SEMANA,
  DIAS_UTEIS,
  DIAS_FIM_DE_SEMANA,
  formatarNomeDia,
  compararDias,
} from '../lib/diasSemana'

const DIAS_OPCOES = DIAS_SEMANA

export default function AdminView({
  pontos,
  turnos,
  reservas,
  onLimparEscala,
  onDataChanged,
  showToast,
  empresaId,
  empresaNome,
  empresa,
  onEmpresaUpdated,
  isFullAdmin: propIsFullAdmin,
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

  // Estado para feedback do botão copiar rápido na aba de escala
  const [copiadoRapido, setCopiadoRapido] = useState(false)

  // URL pública oficial da escala
  const shareUrl = useMemo(() => getPublicShareUrl(empresa), [empresa])

  const handleCopiarLinkRapido = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiadoRapido(true)
      showToast('Link seguro copiado com sucesso! 📋', 'success')
      setTimeout(() => setCopiadoRapido(false), 2500)
    } catch (err) {
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiadoRapido(true)
      showToast('Link seguro copiado com sucesso! 📋', 'success')
      setTimeout(() => setCopiadoRapido(false), 2500)
    }
  }, [shareUrl, showToast])

  const handleCompartilharWhatsAppRapido = useCallback(() => {
    if (!shareUrl || !empresa) return
    const titulo = (termos.textoWhatsapp || 'ESCALA').replace('📋', '').trim()
    const texto = encodeURIComponent(
      `📋 *${titulo} — ${empresa.nome}*\n\n` +
      `Garanta ou consulte sua vaga em tempo real no nosso link oficial:\n` +
      `👉 ${shareUrl}\n\n` +
      `_Acesso exclusivo para os membros autorizados da equipe._`
    )
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank')
  }, [shareUrl, empresa, termos])

  const handleTrocarLayout = useCallback((novoModo) => {
    setLayoutMode(novoModo)
    try {
      localStorage.setItem('escala_admin_layout_mode', novoModo)
    } catch (err) {
      console.error('Erro ao salvar preferência de layout:', err)
    }
    showToast(
      novoModo === 'abas'
        ? 'Layout em Abas ativado! Navegação organizada e limpa 📑'
        : 'Visão Contínua ativada! Todas as seções em uma única página 📜',
      'info'
    )
  }, [showToast])

  const handleMudarAba = useCallback((tabId) => {
    setActiveTab(tabId)
    try {
      localStorage.setItem('escala_admin_active_tab', tabId)
    } catch (err) {
      console.error('Erro ao salvar aba ativa:', err)
    }
  }, [])

  // Chaves de localStorage isoladas por empresa
  const STORAGE_KEY_FORM_DIA = empresaId ? `escala_admin_ultimo_dia_${empresaId}` : 'escala_admin_ultimo_dia'
  const STORAGE_KEY_PONTOS_EXPANDIDOS = empresaId ? `escala_admin_pontos_expandidos_${empresaId}` : 'escala_admin_pontos_expandidos'

  const [formPontoId, setFormPontoId] = useState('')
  const [formDia, setFormDia] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_FORM_DIA)
      if (salvo) {
        const norm = formatarNomeDia(salvo)
        if (DIAS_OPCOES.includes(norm)) {
          return norm
        }
      }
    } catch (err) {
      console.error('Erro ao ler preferência de dia:', err)
    }
    return 'SEGUNDA-FEIRA' // Padrão inicial para 1º uso: SEGUNDA-FEIRA
  })
  const [formHorario, setFormHorario] = useState('')
  const [formCapacidade, setFormCapacidade] = useState(3)
  const [addingTurno, setAddingTurno] = useState(false)

  const handleDiaChange = (e) => {
    const novoDia = formatarNomeDia(e.target.value)
    setFormDia(novoDia)
    try {
      localStorage.setItem(STORAGE_KEY_FORM_DIA, novoDia)
    } catch (err) {
      console.error('Erro ao salvar preferência de dia:', err)
    }
  }

  // Estado para duplicação de dia
  const [modalDuplicar, setModalDuplicar] = useState(null) // { pontoId, pontoNome, diaOrigem, turnos }
  const [diasDestino, setDiasDestino] = useState([])
  const [duplicando, setDuplicando] = useState(false)

  // Estado para modal de alteração de senha
  const [showModalSenha, setShowModalSenha] = useState(false)

  // Estado para modal de vocabulário e nicho dinâmico
  const [showModalVocabulario, setShowModalVocabulario] = useState(false)

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

  // ─── Gestão de Pessoas nas Reservas (Admin) ───────────────────
  const [modalIncluirPessoa, setModalIncluirPessoa] = useState(null)
  const [nomeCorretorManual, setNomeCorretorManual] = useState('')
  const [salvandoPessoa, setSalvandoPessoa] = useState(false)

  // ─── Modal de Edição de Turno (Horário e Vagas) ────────────────
  const [modalEditarTurno, setModalEditarTurno] = useState(null)
  const [editHorario, setEditHorario] = useState('')
  const [editCapacidade, setEditCapacidade] = useState(2)
  const [salvandoTurno, setSalvandoTurno] = useState(false)

  const handleAbrirEditarTurno = useCallback((dados) => {
    setModalEditarTurno(dados)
    setEditHorario(dados.horario || '')
    setEditCapacidade(dados.capacidade || 2)
  }, [])

  const handleConfirmEditarTurno = useCallback(
    async (e) => {
      e.preventDefault()
      if (!modalEditarTurno || !editHorario.trim()) return

      const novaCap = Math.max(1, parseInt(editCapacidade) || 1)
      setSalvandoTurno(true)
      try {
        const { error } = await supabase
          .from('turnos')
          .update({
            horario: editHorario.trim(),
            capacidade: novaCap,
          })
          .eq('id', modalEditarTurno.turnoId)

        if (error) throw error

        showToast('Horário atualizado com sucesso! ✅', 'success')
        setModalEditarTurno(null)
        onDataChanged()
      } catch (err) {
        console.error('Erro ao editar turno:', err)
        showToast('Erro ao atualizar horário.', 'error')
      } finally {
        setSalvandoTurno(false)
      }
    },
    [modalEditarTurno, editHorario, editCapacidade, onDataChanged, showToast]
  )

  useEffect(() => {
    if (!modalDuplicar && !modalIncluirPessoa && !modalEditarTurno) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalDuplicar && !duplicando) setModalDuplicar(null)
        if (modalIncluirPessoa && !salvandoPessoa) setModalIncluirPessoa(null)
        if (modalEditarTurno && !salvandoTurno) setModalEditarTurno(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalDuplicar, modalIncluirPessoa, modalEditarTurno, duplicando, salvandoPessoa, salvandoTurno])

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

  const handleConfirmIncluirPessoa = useCallback(
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
          ...(empresaId ? { empresa_id: empresaId } : {}),
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
    [modalIncluirPessoa, nomeCorretorManual, empresaId, onDataChanged, showToast]
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
        const diaNorm = formatarNomeDia(formDia)
        const turnosMesmoDia = turnos.filter(
          (t) => t.ponto_id === formPontoId && formatarNomeDia(t.dia) === diaNorm
        )
        const proximaOrdem =
          turnosMesmoDia.length > 0
            ? Math.max(...turnosMesmoDia.map((t) => (Number.isFinite(t.ordem) ? t.ordem : 0))) + 1
            : 0

        const { error } = await supabase.from('turnos').insert({
          ponto_id: formPontoId,
          dia: diaNorm,
          horario: formHorario.trim(),
          capacidade: Math.max(1, formCapacidade),
          ordem: proximaOrdem,
          ...(empresaId ? { empresa_id: empresaId } : {}),
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
    [formPontoId, formDia, formHorario, formCapacidade, turnos, empresaId, onDataChanged, showToast]
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
    const diaNorm = formatarNomeDia(diaOrigem)
    setModalDuplicar({
      pontoId,
      pontoNome,
      diaOrigem: diaNorm,
      turnos: turnosDoDia,
    })
    // Pré-seleciona todos os outros dias exceto o de origem
    setDiasDestino(DIAS_OPCOES.filter((d) => d !== diaNorm))
  }, [])

  const toggleDiaDestino = useCallback((dia) => {
    const diaNorm = formatarNomeDia(dia)
    setDiasDestino((prev) =>
      prev.includes(diaNorm) ? prev.filter((d) => d !== diaNorm) : [...prev, diaNorm]
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
        const uteis = DIAS_UTEIS.filter((d) => d !== diaOrigem)
        setDiasDestino(uteis)
      } else if (tipo === 'fimdesemana') {
        const fds = DIAS_FIM_DE_SEMANA.filter((d) => d !== diaOrigem)
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
            dia: formatarNomeDia(dia),
            horario: t.horario,
            capacidade: t.capacidade,
            ordem: t.ordem,
            ...(empresaId ? { empresa_id: empresaId } : {}),
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
  }, [modalDuplicar, diasDestino, empresaId, onDataChanged, showToast])

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

  // Contagem de turnos e vagas livres por ponto
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

  // Contagem consistente: considera apenas turnos e reservas de pontos cadastrados
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

  // Lista de abas da interface com contadores em tempo real e tooltips descritivos (Pontos em 1º)
  const TABS = useMemo(
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

  // ─── Renderizadores de Seções Modulares ──────────────────────

  // Barra compacta de acesso rápido ao link da escala (aba Escala)
  const renderQuickLinkBar = () => {
    if (!shareUrl) return null
    return (
      <div className="card bg-surface-800/90 border-surface-700 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs sm:text-sm font-bold text-gray-200 truncate">
                Link Seguro da Escala
              </p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                ● Ativo
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5 select-all">
              {shareUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
          {/* Botão Copiar (Apenas Ícone) */}
          <button
            type="button"
            onClick={handleCopiarLinkRapido}
            className={`p-2.5 rounded-xl border active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0 shadow-sm ${copiadoRapido
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-surface-700/60 hover:bg-surface-700 text-gray-200 border-surface-600 hover:border-brand-500/50 hover:text-brand-300'
              }`}
            title={copiadoRapido ? 'Link copiado!' : 'Copiar link da escala'}
            aria-label={copiadoRapido ? 'Link copiado!' : 'Copiar link da escala'}
          >
            {copiadoRapido ? (
              <Check className="w-4 h-4 text-white stroke-[2.5]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Botão Compartilhar WhatsApp (Apenas Ícone) */}
          <button
            type="button"
            onClick={handleCompartilharWhatsAppRapido}
            className="p-2.5 rounded-xl bg-surface-700/60 hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 border border-surface-600 hover:border-emerald-500/40 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0 shadow-sm"
            title="Compartilhar no WhatsApp da equipe"
            aria-label="Compartilhar no WhatsApp da equipe"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Botão Detalhes / Configurações */}
          <button
            type="button"
            onClick={() => handleMudarAba('configuracoes')}
            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-200 bg-surface-700/60 hover:bg-surface-700 border border-surface-600 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
            title="Gerenciar link seguro nas configurações"
            aria-label="Gerenciar link seguro nas configurações"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Cards de Métricas rápidas
  const renderStats = () => (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="card text-center">
        <p className="text-2xl font-bold text-brand-400">{pontos.length}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{termos.pontos || 'Pontos'}</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-neon-green">{turnosValidos.length}</p>
        <p className="text-xs text-gray-500 mt-0.5">Turnos</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-emerald-400">{reservasValidas.length}</p>
        <p className="text-xs text-gray-500 mt-0.5">Reservas</p>
      </div>
    </div>
  )

  // Card de Vocabulário & Nicho
  const renderVocabularioCard = () => {
    if (!isFullAdmin) return null
    return (
      <div className="card flex items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-200 truncate flex items-center gap-2">
              Nicho & Vocabulário
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20 capitalize">
                {termos.preset || 'Personalizado'}
              </span>
            </h3>
            <p className="text-xs text-gray-400 truncate">
              {termos.ponto} • {termos.pessoa} • {termos.tituloEscala}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModalVocabulario(true)}
          className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-1.5 flex-shrink-0 border border-surface-600 hover:border-brand-500/50 hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-500/10 dark:hover:border-brand-500/40 dark:hover:text-brand-300 transition-all font-semibold"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Personalizar
        </button>
      </div>
    )
  }

  // Card de Senha do Administrador
  const renderSenhaCard = () => {
    if (!isFullAdmin) return null
    return (
      <div className="card flex items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-200 truncate">
              Senha de Administrador
            </h3>
            <p className="text-xs text-gray-400 truncate">
              Altere a senha de acesso administrativo
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModalSenha(true)}
          className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-1.5 flex-shrink-0 border border-surface-600 hover:border-amber-500/50 hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/40 dark:hover:text-amber-300 transition-all font-semibold"
        >
          <Lock className="w-3.5 h-3.5" />
          Alterar Senha
        </button>
      </div>
    )
  }

  // Card de Alternância de Layout (Configurações)
  const renderLayoutPreferencesCard = () => (
    <div className="card bg-surface-800/90 border-surface-600 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
          <LayoutGrid className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">Modo de Visualização do Painel</h3>
          <p className="text-xs text-gray-400">
            Escolha como você prefere navegar nas funcionalidades de gestão
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => handleTrocarLayout('abas')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${layoutMode === 'abas'
              ? 'bg-brand-500/15 border-brand-500 text-brand-300 font-bold shadow-sm'
              : 'bg-surface-700/40 border-surface-600 text-gray-400 hover:bg-surface-700/70 hover:text-gray-200'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Modo em Abas (Recomendado)
            </span>
            {layoutMode === 'abas' && <Check className="w-3.5 h-3.5 text-brand-400 stroke-[3]" />}
          </div>
          <p className="text-[11px] font-normal text-gray-400">
            Organizado em 4 menus limpos. Ideal para agilidade e uso no dia a dia.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleTrocarLayout('continuo')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${layoutMode === 'continuo'
              ? 'bg-brand-500/15 border-brand-500 text-brand-300 font-bold shadow-sm'
              : 'bg-surface-700/40 border-surface-600 text-gray-400 hover:bg-surface-700/70 hover:text-gray-200'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" />
              Visão Contínua
            </span>
            {layoutMode === 'continuo' && <Check className="w-3.5 h-3.5 text-brand-400 stroke-[3]" />}
          </div>
          <p className="text-[11px] font-normal text-gray-400">
            Todos os blocos empilhados verticalmente em uma única página com rolagem.
          </p>
        </button>
      </div>
    </div>
  )

  // Card Formulário Adicionar Turno
  const renderFormAddTurno = () => (
    <div className="card">
      <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 text-brand-400" />
        Adicionar Turno
      </h2>

      {pontos.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-gray-500">
            Crie um ponto de captação primeiro para adicionar turnos.
          </p>
          <button
            type="button"
            onClick={() => handleMudarAba('pontos')}
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 underline"
          >
            Ir para Gestão de Pontos →
          </button>
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
                onChange={handleDiaChange}
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
  )

  // Card Turnos Cadastrados (sanfona por ponto com drag-and-drop por dia)
  const renderTurnosCadastrados = () => {
    if (pontos.length === 0) return null
    return (
      <div className="card">
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
                className="border border-surface-700/80 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 bg-surface-900/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => togglePontoFechado(ponto.id)}
                  className="w-full flex items-center justify-between p-1.5 sm:p-2 rounded-xl hover:bg-surface-700/40 transition-colors text-left select-none"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
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
                          <span
                            className={`text-xs font-medium ${temVagas
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-red-600 dark:text-red-400 font-semibold'
                              }`}
                          >
                            {temVagas
                              ? `${info.vagasLivres} vaga${info.vagasLivres !== 1 ? 's' : ''} livre${info.vagasLivres !== 1 ? 's' : ''
                              }`
                              : 'Lotado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${info.totalCapacidade === 0
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
                      className={`p-1.5 rounded-lg bg-surface-700/80 text-gray-300 transition-transform duration-200 ${isFechado ? '' : 'rotate-180'
                        }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>

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
                          const diaFormatado = formatarNomeDia(t.dia)
                          if (!porDia[diaFormatado]) porDia[diaFormatado] = []
                          porDia[diaFormatado].push(t)
                        }

                        const diasOrdenados = Object.keys(porDia).sort(compararDias)

                        return diasOrdenados.map((dia) => (
                          <TurnosDiaList
                            key={dia}
                            dia={dia}
                            turnos={porDia[dia]}
                            ponto={ponto}
                            reservas={reservas}
                            onAbrirIncluirPessoa={handleAbrirIncluirPessoa}
                            onEditarTurno={handleAbrirEditarTurno}
                            onDeleteTurno={handleDeleteTurno}
                            onRemoverReserva={handleRemoverReserva}
                            onAbrirDuplicar={() =>
                              abrirModalDuplicar(ponto.id, ponto.nome, dia, porDia[dia])
                            }
                            onDataChanged={onDataChanged}
                            showToast={showToast}
                          />
                        ))
                      })()
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Card Zona de Perigo (Limpar todas as reservas)
  const renderZonaPerigo = () => {
    if (!isFullAdmin) return null
    return (
      <div className="card border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-400">Zona de Perigo</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Limpar todas as reservas desta escala. Esta ação não afeta outros locais.
            </p>
          </div>
        </div>
        <button
          onClick={() => onLimparEscala(null)}
          className="btn-danger w-full flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4.5 h-4.5" />
          Limpar Todas as Reservas da Escala
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* ═══ BANNER DE IDENTIDADE DO GESTOR ═══ */}
      {user && (
        <div className="card bg-gradient-to-r from-surface-800 to-surface-850 border-surface-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(perfil?.nome || user.email || 'G').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-100 truncate">
                  {perfil?.nome ? perfil.nome : user.email}
                </p>
                {role === 'admin' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-brand-400" />
                    Administrador
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    Gestor
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
            </div>
          </div>

          {/* Botão no canto direito para voltar ao Modo em Abas quando em Visão Contínua */}
          {layoutMode === 'continuo' && (
            <button
              type="button"
              onClick={() => handleTrocarLayout('abas')}
              title="Voltar para o Modo em Abas"
              aria-label="Voltar para o Modo em Abas"
              className="p-2 sm:p-2.5 rounded-xl bg-surface-700/60 hover:bg-brand-500/15 text-gray-400 hover:text-brand-300 border border-surface-600 hover:border-brand-500/40 active:scale-95 transition-all flex items-center justify-center flex-shrink-0 min-h-[40px] min-w-[40px] self-end sm:self-center shadow-sm"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* ═══ ALERTA DE AMBIENTE BLOQUEADO (INADIMPLÊNCIA / CANCELAMENTO ASAAS) ═══ */}
      {empresa?.status === 'bloqueado' && (
        <div className="card bg-red-500/10 border-red-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-200">
          <div className="flex items-start gap-3 min-w-0">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-red-300">Ambiente de Plantão Suspenso</p>
              <p className="text-red-300/80 text-[11px] leading-relaxed">
                A escala desta imobiliária está com pendência na assinatura do Asaas. A criação de
                reservas pelos corretores está bloqueada até a regularização.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const texto = encodeURIComponent(
                `Olá! Sou gestor da imobiliária "${empresaNome || ''
                }" e preciso regularizar a assinatura do EscalaFácil.`
              )
              const zap = import.meta.env.VITE_WHATSAPP_SUPORTE || '5511999999999'
              window.open(`https://wa.me/${zap}?text=${texto}`, '_blank')
            }}
            className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap shadow-md shadow-brand-500/10"
          >
            Regularizar Assinatura
          </button>
        </div>
      )}

      {/* ═══ BARRA DE NAVEGAÇÃO POR ABAS ═══ */}
      {layoutMode === 'abas' && (
        <div className="grid grid-cols-4 gap-1 sm:gap-1.5 bg-surface-850/95 border border-surface-700/80 p-1.5 rounded-2xl shadow-sm">
          {TABS.map((tab) => {
            const TabIcon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleMudarAba(tab.id)}
                title={tab.tooltip}
                aria-label={tab.label}
                className={`flex items-center justify-center p-2.5 rounded-xl transition-all min-h-[44px] select-none ${isActive
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/60'
                  }`}
              >
                <TabIcon
                  className={`w-5 h-5 flex-shrink-0 transition-transform ${isActive ? 'text-white scale-110' : 'text-gray-400'
                    }`}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* ═══ CONTEÚDO PRINCIPAL: MODO ABAS ═══ */}
      {layoutMode === 'abas' && (
        <div className="space-y-2.5">
          {/* Aba 1: Escala & Turnos */}
          {activeTab === 'escala' && (
            <div className="space-y-2.5 animate-fade-in">
              {renderQuickLinkBar()}
              {renderStats()}
              {renderFormAddTurno()}
              {renderTurnosCadastrados()}
              {renderZonaPerigo()}
            </div>
          )}

          {/* Aba 2: Pessoas & Equipe */}
          {activeTab === 'equipe' && (
            <div className="space-y-2.5 animate-fade-in">
              <EquipeManager
                empresaId={empresaId}
                empresaNome={empresaNome}
                exigirCadastro={empresa?.exigir_cadastro_previo || false}
                onExigirCadastroChange={onEmpresaUpdated}
                tipoValidacao={empresa?.tipo_validacao_equipe || 'whatsapp'}
                onTipoValidacaoChange={onEmpresaUpdated}
                isFullAdmin={isFullAdmin}
                showToast={showToast}
                termos={termos}
              />

              {isFullAdmin && (
                <GestoresManager
                  empresaId={empresaId}
                  empresaNome={empresaNome}
                  isFullAdmin={isFullAdmin}
                  currentUserId={user?.id}
                  showToast={showToast}
                  termos={termos}
                />
              )}
            </div>
          )}

          {/* Aba 3: Pontos de Captação / Locais */}
          {activeTab === 'pontos' && (
            <div className="space-y-2.5 animate-fade-in">
              <PontosManager
                pontos={pontos}
                turnos={turnos}
                turnosPorPonto={turnosPorPonto}
                vagasPorPonto={vagasPorPonto}
                onLimparEscala={onLimparEscala}
                onDataChanged={onDataChanged}
                showToast={showToast}
                empresaId={empresaId}
                isFullAdmin={isFullAdmin}
                termos={termos}
              />
            </div>
          )}

          {/* Aba 4: Ajustes & Configurações */}
          {activeTab === 'configuracoes' && (
            <div className="space-y-2.5 animate-fade-in">
              {renderLayoutPreferencesCard()}

              <LinkSeguroManager
                empresa={empresa}
                onEmpresaUpdated={onEmpresaUpdated}
                showToast={showToast}
                isFullAdmin={isFullAdmin}
              />

              {renderVocabularioCard()}
              {renderSenhaCard()}
            </div>
          )}
        </div>
      )}

      {/* ═══ CONTEÚDO PRINCIPAL: VISÃO CONTÍNUA (LEGADO) ═══ */}
      {layoutMode === 'continuo' && (
        <div className="space-y-3 animate-fade-in">
          {/* Link Seguro Completo */}
          <LinkSeguroManager
            empresa={empresa}
            onEmpresaUpdated={onEmpresaUpdated}
            showToast={showToast}
            isFullAdmin={isFullAdmin}
          />

          {/* Stats Rápidos */}
          {renderStats()}

          {/* Vocabulário & Nicho */}
          {renderVocabularioCard()}

          {/* Senha do Administrador */}
          {renderSenhaCard()}

          {/* Coordenadores e Gestores */}
          {isFullAdmin && (
            <GestoresManager
              empresaId={empresaId}
              empresaNome={empresaNome}
              isFullAdmin={isFullAdmin}
              currentUserId={user?.id}
              showToast={showToast}
              termos={termos}
            />
          )}

          {/* Proteção contra Invasores & Equipe Autorizada */}
          <EquipeManager
            empresaId={empresaId}
            empresaNome={empresaNome}
            exigirCadastro={empresa?.exigir_cadastro_previo || false}
            onExigirCadastroChange={onEmpresaUpdated}
            tipoValidacao={empresa?.tipo_validacao_equipe || 'whatsapp'}
            onTipoValidacaoChange={onEmpresaUpdated}
            isFullAdmin={isFullAdmin}
            showToast={showToast}
            termos={termos}
          />

          {/* Pontos de Captação */}
          <PontosManager
            pontos={pontos}
            turnos={turnos}
            turnosPorPonto={turnosPorPonto}
            vagasPorPonto={vagasPorPonto}
            onLimparEscala={onLimparEscala}
            onDataChanged={onDataChanged}
            showToast={showToast}
            empresaId={empresaId}
            isFullAdmin={isFullAdmin}
            termos={termos}
          />

          {/* Adicionar Turno */}
          {renderFormAddTurno()}

          {/* Turnos Cadastrados */}
          {renderTurnosCadastrados()}

          {/* Zona de Perigo */}
          {renderZonaPerigo()}
        </div>
      )}

      {/* ═══ MODAL DE DUPLICAÇÃO DE DIAS ═══ */}
      {modalDuplicar &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
              onClick={() => !duplicando && setModalDuplicar(null)}
            />

            <div className="relative w-full max-w-lg bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
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
                      Ponto: <span className="text-brand-600 dark:text-brand-300 font-semibold">{modalDuplicar.pontoNome}</span> ({modalDuplicar.turnos.length} turno{modalDuplicar.turnos.length !== 1 ? 's' : ''})
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
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all text-left ${isSelected
                          ? 'bg-brand-500/15 border-brand-500/50 text-brand-700 dark:text-brand-200 font-semibold'
                          : 'bg-surface-700/50 border-surface-600 text-gray-400 hover:bg-surface-700'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isSelected
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
          </div>,
          document.body
        )}

      {/* ═══ MODAL DE INCLUSÃO MANUAL DE CORRETOR ═══ */}
      {modalIncluirPessoa &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
              onClick={() => !salvandoPessoa && setModalIncluirPessoa(null)}
            />

            <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
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
                      <span className="text-brand-600 dark:text-brand-300 font-semibold">
                        {modalIncluirPessoa.pontoNome}
                      </span>{' '}
                      • {formatarNomeDia(modalIncluirPessoa.dia)} ({modalIncluirPessoa.horario})
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

              <form onSubmit={handleConfirmIncluirPessoa} className="space-y-4">
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
          </div>,
          document.body
        )}

      {/* ═══ MODAL DE EDIÇÃO DE TURNO (HORÁRIO E VAGAS) ═══ */}
      {modalEditarTurno &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
              onClick={() => !salvandoTurno && setModalEditarTurno(null)}
            />

            <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-100">
                      Editar Horário do Turno
                    </h3>
                    <p className="text-xs text-gray-400">
                      <span className="text-brand-600 dark:text-brand-300 font-semibold">
                        {modalEditarTurno.pontoNome}
                      </span>{' '}
                      • {formatarNomeDia(modalEditarTurno.dia)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !salvandoTurno && setModalEditarTurno(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
                  disabled={salvandoTurno}
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmEditarTurno} className="space-y-4">
                {/* Horário */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
                    Horário do Turno:
                  </label>
                  <input
                    type="text"
                    value={editHorario}
                    onChange={(e) => setEditHorario(e.target.value)}
                    placeholder="Ex: 08:00 às 12:00"
                    className="input-field text-base font-medium"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Ex: "08:00 às 12:00", "13h às 17h", "Plantão Manhã"
                  </p>
                </div>

                {/* Capacidade */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      Capacidade de Vagas neste Horário:
                    </label>
                    {modalEditarTurno.reservasCount > 0 && (
                      <span className="text-[11px] text-amber-400 font-medium">
                        {modalEditarTurno.reservasCount} vaga{modalEditarTurno.reservasCount !== 1 ? 's' : ''} ocupada{modalEditarTurno.reservasCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editCapacidade}
                    onChange={(e) => setEditCapacidade(parseInt(e.target.value) || 1)}
                    className="input-field text-base font-medium"
                    required
                  />
                  {modalEditarTurno.reservasCount > editCapacidade && (
                    <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-medium animate-fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Aviso: A capacidade informada ({editCapacidade}) é menor que o número atual de reservas ({modalEditarTurno.reservasCount}).
                    </p>
                  )}
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalEditarTurno(null)}
                    disabled={salvandoTurno}
                    className="btn-ghost flex-1 py-3 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoTurno || !editHorario.trim()}
                    className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
                  >
                    {salvandoTurno ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ═══ MODAL DE ALTERAÇÃO DE SENHA ═══ */}
      <AlterarSenhaModal
        isOpen={showModalSenha}
        onClose={() => setShowModalSenha(false)}
        showToast={showToast}
        empresaId={empresaId}
      />

      {/* ═══ MODAL DE VOCABULÁRIO & NICHO DINÂMICO ═══ */}
      <VocabularioModal
        isOpen={showModalVocabulario}
        onClose={() => setShowModalVocabulario(false)}
        empresa={empresa}
        onUpdateEmpresa={onEmpresaUpdated}
        showToast={showToast}
      />
    </div>
  )
}
