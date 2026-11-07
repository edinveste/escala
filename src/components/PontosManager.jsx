import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Sortable from 'sortablejs'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import {
  MapPin,
  Plus,
  Pencil,
  Copy,
  AlertTriangle,
  Trash2,
  Check,
  X,
  GripVertical,
  MoreVertical,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function PontosManager({
  pontos,
  turnos,
  turnosPorPonto,
  vagasPorPonto,
  onLimparEscala,
  onDataChanged,
  showToast,
  empresaId,
  isFullAdmin = true,
}) {
  const confirm = useConfirm()

  // Estado do formulário de criação de ponto
  const [formPontoNome, setFormPontoNome] = useState('')
  const [addingPonto, setAddingPonto] = useState(false)

  // Estado de edição de nome inline
  const [editingPontoId, setEditingPontoId] = useState(null)
  const [editingPontoNome, setEditingPontoNome] = useState('')

  // Estado para duplicação de ponto inteiro
  const [modalDuplicarPonto, setModalDuplicarPonto] = useState(null)
  const [nomeNovoPonto, setNomeNovoPonto] = useState('')
  const [duplicandoPonto, setDuplicandoPonto] = useState(false)

  // Estado do menu 3 pontinhos no mobile
  const [menuAbertoId, setMenuAbertoId] = useState(null)

  // Lista local para reordenação fluida e sem delay
  const [listaPontos, setListaPontos] = useState(pontos)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const listRef = useRef(null)
  const sortableRef = useRef(null)

  // Sincroniza lista local quando pontos externos mudarem
  useEffect(() => {
    setListaPontos(pontos)
  }, [pontos])

  // Bloqueia rolagem do body e fecha no Esc quando modal de duplicação estiver aberto
  useEffect(() => {
    if (!modalDuplicarPonto) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !duplicandoPonto) {
        setModalDuplicarPonto(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalDuplicarPonto, duplicandoPonto])

  // ─── Salvar Nova Ordem no Supabase ─────────────────────────────
  const salvarNovaOrdem = useCallback(
    async (novaLista) => {
      setIsSavingOrder(true)
      try {
        await Promise.all(
          novaLista.map((p, idx) =>
            supabase.from('pontos').update({ ordem: idx }).eq('id', p.id)
          )
        )
        showToast('Ordem dos pontos atualizada! ↕️', 'success')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao salvar nova ordem dos pontos:', err)
        showToast('Erro ao salvar ordem dos pontos.', 'error')
        setListaPontos(pontos)
      } finally {
        setIsSavingOrder(false)
      }
    },
    [pontos, onDataChanged, showToast]
  )

  const salvarNovaOrdemRef = useRef(salvarNovaOrdem)
  useEffect(() => {
    salvarNovaOrdemRef.current = salvarNovaOrdem
  })

  // ─── Inicialização do SortableJS (Suave, sem travar scroll mobile) ──
  useEffect(() => {
    if (!listRef.current) return

    if (sortableRef.current) {
      sortableRef.current.destroy()
      sortableRef.current = null
    }

    sortableRef.current = Sortable.create(listRef.current, {
      animation: 150,
      handle: '.drag-handle', // arrasta exclusivamente pelo pegador de 6 pontos
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      delay: 150, // No celular: exige segurar 150ms no pegador antes de arrastar
      delayOnTouchOnly: true, // No mouse desktop: arrasto imediato
      touchStartThreshold: 5, // Se o dedo deslizar mais de 5px, cancela e permite rolagem normal
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return

        setListaPontos((prev) => {
          const novaLista = [...prev]
          const [movedItem] = novaLista.splice(oldIndex, 1)
          novaLista.splice(newIndex, 0, movedItem)
          salvarNovaOrdemRef.current(novaLista)
          return novaLista
        })
      },
    })

    return () => {
      if (sortableRef.current) {
        sortableRef.current.destroy()
        sortableRef.current = null
      }
    }
  }, [listaPontos.length > 0])

  // ─── Alternar Visibilidade do Ponto (Ativo / Oculto) ────────────
  const handleToggleAtivo = useCallback(
    async (pontoId, statusAtual, nomePonto) => {
      const novoStatus = !statusAtual
      try {
        const { error } = await supabase
          .from('pontos')
          .update({ ativo: novoStatus })
          .eq('id', pontoId)

        if (error) throw error

        showToast(
          novoStatus
            ? `"${nomePonto}" agora está visível para os corretores! 👁️`
            : `"${nomePonto}" agora está oculto para os corretores. 🔒`,
          novoStatus ? 'success' : 'info'
        )
        onDataChanged()
      } catch (err) {
        console.error('Erro ao alterar visibilidade do ponto:', err)
        showToast('Erro ao atualizar visibilidade.', 'error')
      }
    },
    [onDataChanged, showToast]
  )

  // ─── Criação de Ponto ───────────────────────────────────────────
  const handleAddPonto = useCallback(
    async (e) => {
      e.preventDefault()
      if (!formPontoNome.trim()) {
        showToast('Preencha o nome do ponto.', 'error')
        return
      }

      setAddingPonto(true)
      try {
        const proximaOrdem =
          pontos.length > 0
            ? Math.max(...pontos.map((p) => (Number.isFinite(p.ordem) ? p.ordem : 0))) + 1
            : 0

        const { error } = await supabase.from('pontos').insert({
          nome: formPontoNome.trim(),
          ordem: proximaOrdem,
          ativo: false, // Inicia oculto para corretores enquanto o gestor monta a grade!
          ...(empresaId ? { empresa_id: empresaId } : {}),
        })

        if (error) throw error

        showToast('Ponto criado como rascunho (oculto)! Cadastre os turnos e clique no olho para publicar. 👁️', 'success')
        setFormPontoNome('')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao criar ponto:', err)
        showToast('Erro ao criar ponto.', 'error')
      } finally {
        setAddingPonto(false)
      }
    },
    [formPontoNome, pontos, empresaId, onDataChanged, showToast]
  )

  // ─── Renomear Ponto ─────────────────────────────────────────────
  const handleRenamePonto = useCallback(
    async (pontoId) => {
      if (!editingPontoNome.trim()) {
        showToast('O nome não pode ficar vazio.', 'warning')
        return
      }

      try {
        const { error } = await supabase
          .from('pontos')
          .update({ nome: editingPontoNome.trim() })
          .eq('id', pontoId)

        if (error) throw error

        showToast('Nome do ponto atualizado! ✅', 'success')
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

  // ─── Excluir Ponto ──────────────────────────────────────────────
  const handleDeletePonto = useCallback(
    async (id, nome) => {
      const ok = await confirm({
        title: 'Excluir ponto de captação?',
        message: `Tem certeza que deseja excluir "${nome}"?\n\n⚠️ Todos os turnos e reservas vinculados a este ponto serão EXCLUÍDOS PERMANENTEMENTE.`,
        confirmText: 'Excluir Ponto',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { error } = await supabase.from('pontos').delete().eq('id', id)
        if (error) throw error

        showToast(`Ponto "${nome}" excluído.`, 'info')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao excluir ponto:', err)
        showToast('Erro ao excluir ponto.', 'error')
      }
    },
    [confirm, onDataChanged, showToast]
  )

  // ─── Duplicar Ponto Inteiro ─────────────────────────────────────
  const abrirModalDuplicarPonto = useCallback((ponto, totalTurnos) => {
    setModalDuplicarPonto({ ponto, totalTurnos })
    setNomeNovoPonto(`${ponto.nome} (Cópia)`)
  }, [])

  const handleConfirmDuplicarPonto = useCallback(
    async (e) => {
      if (e) e.preventDefault()
      if (!modalDuplicarPonto || !nomeNovoPonto.trim()) {
        showToast('Digite um nome para o novo ponto.', 'warning')
        return
      }

      setDuplicandoPonto(true)
      try {
        const pontoOrigem = modalDuplicarPonto.ponto
        const proximaOrdem =
          pontos.length > 0
            ? Math.max(...pontos.map((p) => (Number.isFinite(p.ordem) ? p.ordem : 0))) + 1
            : 0

        const { data: novoPonto, error: erroPonto } = await supabase
          .from('pontos')
          .insert({
            nome: nomeNovoPonto.trim(),
            ordem: proximaOrdem,
            ativo: false, // Inicia oculto para corretores até o gestor revisar!
            ...(empresaId ? { empresa_id: empresaId } : {}),
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
            ...(empresaId ? { empresa_id: empresaId } : {}),
          }))
          const { error: erroTurnos } = await supabase.from('turnos').insert(novosTurnos)
          if (erroTurnos) throw erroTurnos
        }

        showToast(`Ponto "${novoPonto.nome}" duplicado com sucesso! ✅`, 'success')
        setModalDuplicarPonto(null)
        setNomeNovoPonto('')
        onDataChanged()
      } catch (err) {
        console.error('Erro ao duplicar ponto:', err)
        showToast('Erro ao duplicar ponto.', 'error')
      } finally {
        setDuplicandoPonto(false)
      }
    },
    [modalDuplicarPonto, nomeNovoPonto, pontos, turnos, empresaId, onDataChanged, showToast]
  )

  return (
    <>
      {/* ═══ SEÇÃO: PONTOS DE CAPTAÇÃO ═══ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-400" />
            Pontos de Captação
          </h2>
          {isSavingOrder && (
            <span className="text-[11px] font-medium text-brand-400 animate-pulse flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-ping" />
              Salvando ordem...
            </span>
          )}
        </div>

        {/* Formulário de novo ponto (Apenas Administradores) */}
        {isFullAdmin && (
          <form onSubmit={handleAddPonto} className="space-y-3 mb-4">
            <div>
              <input
                type="text"
                value={formPontoNome}
                onChange={(e) => setFormPontoNome(e.target.value)}
                placeholder="Nome do ponto (ex: Mercado Extra)"
                className="input-field w-full text-sm"
                maxLength={100}
              />
            </div>
            <button
              type="submit"
              disabled={addingPonto || !formPontoNome.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5"
            >
              {addingPonto ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Criando ponto...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Criar Ponto de Captação
                </>
              )}
            </button>
          </form>
        )}

        {/* Lista de pontos existentes com Arrastar e Soltar fluido */}
        {listaPontos.length > 0 && (
          <div className="space-y-2 border-t border-surface-600 pt-4">
            <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5 text-gray-400" />
              Arraste pelo ícone de 6 pontos para alterar a ordem:
            </p>

            <div ref={listRef} className="space-y-2">
              {listaPontos.map((ponto, index) => {
                const qtdTurnos = turnosPorPonto?.[ponto.id]?.length || 0
                const isEditing = editingPontoId === ponto.id
                const info = vagasPorPonto?.[ponto.id] || {}
                const temVagas = (info.vagasLivres || 0) > 0

                return (
                  <div
                    key={ponto.id}
                    data-id={ponto.id}
                    className="relative flex items-center justify-between gap-1.5 sm:gap-2 py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl bg-surface-700/50 border border-surface-600/30 hover:border-surface-600 transition-colors select-none"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2 py-0.5">
                        <input
                          type="text"
                          value={editingPontoNome}
                          onChange={(e) => setEditingPontoNome(e.target.value)}
                          className="input-field py-1.5 px-3 text-sm flex-1 min-h-[40px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenamePonto(ponto.id)
                            if (e.key === 'Escape') setEditingPontoId(null)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRenamePonto(ponto.id)}
                          className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          title="Salvar"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPontoId(null)}
                          className="p-2 rounded-lg bg-surface-600 text-gray-400 hover:text-gray-200 transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Pegador de Arrastar Dedicado (Apenas no ícone ⠿) */}
                        <div
                          className="drag-handle p-1.5 -ml-1 text-gray-500 hover:text-brand-400 active:text-brand-300 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
                          title="Segure e arraste pelo ícone para reordenar"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Informações do Ponto (Livre para rolagem normal da página) */}
                        <div className="flex-1 min-w-0 pr-1 select-none">
                          <p className="text-sm font-semibold text-gray-100 truncate">
                            {ponto.nome}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span className="text-xs text-gray-400">
                              {qtdTurnos} turno{qtdTurnos !== 1 ? 's' : ''}
                            </span>
                            {info.totalCapacidade > 0 && (
                              <span
                                className={`text-xs font-medium ${
                                  temVagas ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'
                                }`}
                              >
                                •{' '}
                                {temVagas
                                  ? `${info.vagasLivres} vaga${
                                      info.vagasLivres !== 1 ? 's' : ''
                                    } livre${info.vagasLivres !== 1 ? 's' : ''}`
                                  : 'Lotado'}
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-gray-400 bg-surface-800/80 px-1.5 py-0.5 rounded border border-surface-600/40">
                              #{index + 1}
                            </span>
                          </div>
                        </div>

                        {/* Botões Inline em Desktop / Telas maiores */}
                        <div className="hidden sm:flex items-center gap-0.5 flex-shrink-0">
                          {/* Botão de Visibilidade / Olho (Desktop) */}
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleAtivo(ponto.id, ponto.ativo !== false, ponto.nome)
                            }
                            className="p-2 rounded-lg hover:bg-brand-500/10 text-gray-400 hover:text-brand-400 transition-colors"
                            title={
                              ponto.ativo !== false
                                ? 'Ponto visível aos corretores (clique para ocultar)'
                                : 'Ponto oculto aos corretores (clique para publicar)'
                            }
                          >
                            {ponto.ativo !== false ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Ações Destrutivas / Estruturais (Apenas Administrador) */}
                          {isFullAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPontoId(ponto.id)
                                  setEditingPontoNome(ponto.nome)
                                }}
                                className="p-2 rounded-lg hover:bg-brand-500/10 text-gray-400 hover:text-brand-400 transition-colors"
                                title="Renomear ponto"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => abrirModalDuplicarPonto(ponto, qtdTurnos)}
                                className="p-2 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors"
                                title={`Duplicar ponto e seus ${qtdTurnos} turnos`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onLimparEscala(ponto.id)}
                                className="p-2 rounded-lg hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-colors"
                                title="Limpar reservas deste ponto"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeletePonto(ponto.id, ponto.nome)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                                title="Excluir ponto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Ações no Celular (Mobile): Menu ou Botão Direto */}
                        {!isFullAdmin ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleAtivo(ponto.id, ponto.ativo !== false, ponto.nome)
                            }
                            className="sm:hidden p-2 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-surface-600/60 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title={
                              ponto.ativo !== false
                                ? 'Ponto visível (clique para ocultar)'
                                : 'Ponto oculto (clique para publicar)'
                            }
                          >
                            {ponto.ativo !== false ? (
                              <Eye className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-amber-400" />
                            )}
                          </button>
                        ) : (
                          <div className="sm:hidden relative flex-shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuAbertoId(menuAbertoId === ponto.id ? null : ponto.id)
                              }
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-surface-600/60 active:bg-surface-600 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Mais opções"
                              aria-label="Mais opções"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Menu Dropdown Suspenso no Celular */}
                            {menuAbertoId === ponto.id && (
                              <>
                                {/* Backdrop invisível para fechar ao tocar fora */}
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={() => setMenuAbertoId(null)}
                                />

                                <div className="absolute right-0 top-10 z-40 w-48 py-1.5 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl shadow-black/80 animate-scale-in">
                                  {/* Alternar visibilidade no menu */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuAbertoId(null)
                                      handleToggleAtivo(ponto.id, ponto.ativo !== false, ponto.nome)
                                    }}
                                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    {ponto.ativo !== false ? (
                                      <>
                                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                        Ocultar dos Corretores
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                        Publicar para Corretores
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuAbertoId(null)
                                      setEditingPontoId(ponto.id)
                                      setEditingPontoNome(ponto.nome)
                                    }}
                                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-brand-400" />
                                    Renomear
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuAbertoId(null)
                                      abrirModalDuplicarPonto(ponto, qtdTurnos)
                                    }}
                                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                    Duplicar Ponto
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuAbertoId(null)
                                      onLimparEscala(ponto.id)
                                    }}
                                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-gray-200 hover:bg-surface-700/80 active:bg-surface-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                    Limpar Reservas
                                  </button>

                                  <div className="my-1 border-t border-surface-700/80" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuAbertoId(null)
                                      handleDeletePonto(ponto.id, ponto.nome)
                                    }}
                                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 active:bg-red-500/20 flex items-center gap-2.5 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir Ponto
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODAL DE DUPLICAÇÃO DE PONTO INTEIRO ═══ */}
      {modalDuplicarPonto &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
              onClick={() => !duplicandoPonto && setModalDuplicarPonto(null)}
            />

            <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
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
                  type="button"
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
          </div>,
          document.body
        )}
    </>
  )
}
