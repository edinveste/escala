import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useConfirm } from '../ConfirmModal'

/**
 * Hook customizado para gerenciamento de dados e operações de Pontos de Captação
 */
export function usePontosManager({
  pontos = [],
  turnos = [],
  empresaId,
  onDataChanged,
  showToast,
}) {
  const confirm = useConfirm()

  // Lista local para reordenação fluida e sem delay visual
  const [listaPontos, setListaPontos] = useState(pontos)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  // Estado de adição e duplicação
  const [addingPonto, setAddingPonto] = useState(false)
  const [modalDuplicarPonto, setModalDuplicarPonto] = useState(null)
  const [duplicandoPonto, setDuplicandoPonto] = useState(false)

  // Sincroniza lista local quando a prop pontos mudar
  useEffect(() => {
    setListaPontos(pontos)
  }, [pontos])

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
        onDataChanged?.()
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

  // ─── Alternar Visibilidade do Ponto (Ativo / Oculto) ────────────
  const alternarVisibilidade = useCallback(
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
        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao alterar visibilidade do ponto:', err)
        showToast('Erro ao atualizar visibilidade.', 'error')
      }
    },
    [onDataChanged, showToast]
  )

  // ─── Criação de Ponto ───────────────────────────────────────────
  const adicionarPonto = useCallback(
    async (nome) => {
      if (!nome || !nome.trim()) {
        showToast('Preencha o nome do ponto.', 'error')
        return false
      }

      setAddingPonto(true)
      try {
        const proximaOrdem =
          pontos.length > 0
            ? Math.max(...pontos.map((p) => (Number.isFinite(p.ordem) ? p.ordem : 0))) + 1
            : 0

        const { error } = await supabase.from('pontos').insert({
          nome: nome.trim(),
          ordem: proximaOrdem,
          ativo: false, // Inicia oculto para corretores enquanto o gestor monta a grade!
          ...(empresaId ? { empresa_id: empresaId } : {}),
        })

        if (error) throw error

        showToast(
          'Ponto criado como rascunho (oculto)! Cadastre os turnos e clique no olho para publicar. 👁️',
          'success'
        )
        onDataChanged?.()
        return true
      } catch (err) {
        console.error('Erro ao criar ponto:', err)
        showToast('Erro ao criar ponto.', 'error')
        return false
      } finally {
        setAddingPonto(false)
      }
    },
    [pontos, empresaId, onDataChanged, showToast]
  )

  // ─── Renomear Ponto ─────────────────────────────────────────────
  const renomearPonto = useCallback(
    async (pontoId, novoNome) => {
      if (!novoNome || !novoNome.trim()) {
        showToast('O nome não pode ficar vazio.', 'warning')
        return false
      }

      try {
        const { error } = await supabase
          .from('pontos')
          .update({ nome: novoNome.trim() })
          .eq('id', pontoId)

        if (error) throw error

        showToast('Nome do ponto atualizado! ✅', 'success')
        onDataChanged?.()
        return true
      } catch (err) {
        console.error('Erro ao renomear ponto:', err)
        showToast('Erro ao renomear ponto.', 'error')
        return false
      }
    },
    [onDataChanged, showToast]
  )

  // ─── Excluir Ponto ──────────────────────────────────────────────
  const excluirPonto = useCallback(
    async (id, nome) => {
      const ok = await confirm({
        title: 'Excluir ponto de captação?',
        message: `Tem certeza que deseja excluir "${nome}"?\n\n⚠️ Todos os turnos e reservas vinculados a este ponto serão EXCLUÍDOS PERMANENTEMENTE.`,
        confirmText: 'Excluir Ponto',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return false

      try {
        const { error } = await supabase.from('pontos').delete().eq('id', id)
        if (error) throw error

        showToast(`Ponto "${nome}" excluído.`, 'info')
        onDataChanged?.()
        return true
      } catch (err) {
        console.error('Erro ao excluir ponto:', err)
        showToast('Erro ao excluir ponto.', 'error')
        return false
      }
    },
    [confirm, onDataChanged, showToast]
  )

  // ─── Abrir / Fechar Modal de Duplicação ──────────────────────────
  const abrirModalDuplicarPonto = useCallback((ponto, totalTurnos) => {
    setModalDuplicarPonto({ ponto, totalTurnos })
  }, [])

  const fecharModalDuplicarPonto = useCallback(() => {
    if (!duplicandoPonto) {
      setModalDuplicarPonto(null)
    }
  }, [duplicandoPonto])

  // ─── Duplicar Ponto Inteiro ─────────────────────────────────────
  const duplicarPonto = useCallback(
    async (nomeNovo) => {
      if (!modalDuplicarPonto || !nomeNovo || !nomeNovo.trim()) {
        showToast('Digite um nome para o novo ponto.', 'warning')
        return false
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
            nome: nomeNovo.trim(),
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
        onDataChanged?.()
        return true
      } catch (err) {
        console.error('Erro ao duplicar ponto:', err)
        showToast('Erro ao duplicar ponto.', 'error')
        return false
      } finally {
        setDuplicandoPonto(false)
      }
    },
    [modalDuplicarPonto, pontos, turnos, empresaId, onDataChanged, showToast]
  )

  return {
    listaPontos,
    setListaPontos,
    isSavingOrder,
    salvarNovaOrdem,
    alternarVisibilidade,
    addingPonto,
    adicionarPonto,
    renomearPonto,
    excluirPonto,
    modalDuplicarPonto,
    abrirModalDuplicarPonto,
    fecharModalDuplicarPonto,
    duplicarPonto,
    duplicandoPonto,
  }
}

