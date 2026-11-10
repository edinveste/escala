import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useConfirm } from '../ConfirmModal'

export function useEquipe({
  empresaId,
  exigirCadastro,
  onExigirCadastroChange,
  isFullAdmin,
  showToast,
}) {
  const confirm = useConfirm()
  const [equipe, setEquipe] = useState([])
  const [loading, setLoading] = useState(true)
  const [alterandoExigir, setAlterandoExigir] = useState(false)

  // ─── Carregar colaboradores da equipe ────────────────────────────
  const fetchEquipe = useCallback(async () => {
    if (!empresaId) return
    try {
      const { data, error } = await supabase
        .from('equipe_corretores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true })

      if (error) {
        console.warn('Aviso ao carregar equipe_corretores:', error.message)
        return
      }
      setEquipe(data || [])
    } catch (err) {
      console.error('Erro ao buscar equipe de colaboradores:', err)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchEquipe()
  }, [fetchEquipe])

  // ─── Escuta Realtime para equipe_corretores ───────────────────
  useEffect(() => {
    if (!empresaId) return

    const channel = supabase
      .channel(`realtime-equipe-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipe_corretores',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => {
          fetchEquipe()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, fetchEquipe])

  // ─── Alternar chave exigir_cadastro_previo na empresa ─────────
  const toggleExigirCadastro = async () => {
    if (!isFullAdmin) {
      showToast?.('Apenas administradores podem alterar a política de acesso.', 'warning')
      return
    }

    const novoValor = !exigirCadastro
    setAlterandoExigir(true)
    try {
      // 1. Tenta via RPC segura
      let rpcSucesso = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('alternar_protecao_equipe', {
          p_empresa_id: empresaId,
          p_exigir: novoValor,
        })
        if (!rpcError && rpcData === true) {
          rpcSucesso = true
        }
      } catch (eRpc) {}

      // 2. Se a RPC não foi executada, tenta update direto
      if (!rpcSucesso) {
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ exigir_cadastro_previo: novoValor })
          .eq('id', empresaId)

        if (updateError) throw updateError
      }

      onExigirCadastroChange?.(novoValor)

      showToast?.(
        novoValor
          ? 'Proteção ativada: Apenas colaboradores autorizados podem reservar! 🛡️'
          : 'Acesso livre: Qualquer colaborador com o link pode reservar. 🔓',
        novoValor ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao atualizar exigir_cadastro_previo:', err)
      showToast?.('Erro ao atualizar política de cadastro prévio.', 'error')
    } finally {
      setAlterandoExigir(false)
    }
  }

  // ─── Adicionar novo colaborador na equipe ─────────────────────
  const adicionarMembro = async ({ nome, whatsapp, email }) => {
    try {
      let novoMembro = null

      // 1. Tenta via RPC segura
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_corretor_equipe', {
          p_empresa_id: empresaId,
          p_nome: nome,
          p_whatsapp: whatsapp,
          p_email: email,
        })
        if (!rpcError && rpcData) {
          novoMembro = rpcData
        }
      } catch (eRpc) {}

      // 2. Se a RPC falhar, tenta insert direto
      if (!novoMembro) {
        const { data: directData, error: insertError } = await supabase
          .from('equipe_corretores')
          .insert({
            empresa_id: empresaId,
            nome,
            whatsapp,
            email,
            ativo: true,
          })
          .select()
          .single()

        if (insertError) throw insertError
        novoMembro = directData
      }

      setEquipe((prev) => [...prev, novoMembro].sort((a, b) => a.nome.localeCompare(b.nome)))
      showToast?.(`"${nome}" cadastrado(a) na equipe! ✅`, 'success')
      return true
    } catch (err) {
      console.error('Erro ao cadastrar:', err)
      if (
        err.message?.includes('já está cadastrado') ||
        err.message?.includes('idx_equipe_corretores') ||
        err.code === '23505'
      ) {
        showToast?.(err.message || 'Este contato já está cadastrado nesta equipe.', 'warning')
      } else {
        showToast?.('Erro ao cadastrar na equipe.', 'error')
      }
      return false
    }
  }

  // ─── Editar colaborador da equipe ─────────────────────────────
  const editarMembro = async ({ id, nome, whatsapp, email }) => {
    try {
      let membroAtualizado = null

      // 1. Tenta via RPC segura editar_corretor_equipe
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('editar_corretor_equipe', {
          p_corretor_id: id,
          p_empresa_id: empresaId,
          p_nome: nome,
          p_whatsapp: whatsapp,
          p_email: email,
        })
        if (!rpcError && rpcData) {
          membroAtualizado = rpcData
        }
      } catch (eRpc) {}

      // 2. Se a RPC falhar ou não existir, faz update direto na tabela
      if (!membroAtualizado) {
        const { data: updateData, error: updateError } = await supabase
          .from('equipe_corretores')
          .update({
            nome,
            whatsapp,
            email,
          })
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (updateError) throw updateError
        membroAtualizado = updateData
      }

      setEquipe((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...membroAtualizado } : c))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      )

      showToast?.(`Cadastro de "${nome}" atualizado com sucesso! ✅`, 'success')
      return true
    } catch (err) {
      console.error('Erro ao atualizar colaborador:', err)
      if (
        err.message?.includes('já está cadastrado') ||
        err.message?.includes('idx_equipe_corretores') ||
        err.code === '23505'
      ) {
        showToast?.(err.message || 'Este contato já está cadastrado para outro colaborador.', 'warning')
      } else {
        showToast?.(err.message || 'Erro ao atualizar dados do colaborador.', 'error')
      }
      return false
    }
  }

  // ─── Alternar status ativo / inativo do colaborador ───────────
  const toggleAtivo = async (colaborador) => {
    const novoStatus = !colaborador.ativo
    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('alternar_status_corretor', {
          p_corretor_id: colaborador.id,
          p_empresa_id: empresaId,
          p_ativo: novoStatus,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .update({ ativo: novoStatus })
          .eq('id', colaborador.id)

        if (error) throw error
      }

      setEquipe((prev) =>
        prev.map((c) => (c.id === colaborador.id ? { ...c, ativo: novoStatus } : c))
      )
      showToast?.(
        novoStatus
          ? `"${colaborador.nome}" reativado na equipe!`
          : `"${colaborador.nome}" desativado. Não poderá reservar vagas.`,
        novoStatus ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao alterar status do colaborador:', err)
      showToast?.('Erro ao atualizar status do colaborador.', 'error')
    }
  }

  // ─── Excluir colaborador da equipe ────────────────────────────
  const deleteColaborador = async (colaborador) => {
    const ok = await confirm({
      title: 'Remover colaborador da equipe?',
      message: `Tem certeza que deseja remover "${colaborador.nome}" da equipe autorizada?\n\nEle não terá mais permissão para garantir vagas quando a proteção contra invasores estiver ativa.`,
      confirmText: 'Remover Colaborador',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return

    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('remover_corretor_equipe', {
          p_corretor_id: colaborador.id,
          p_empresa_id: empresaId,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .delete()
          .eq('id', colaborador.id)

        if (error) throw error
      }

      setEquipe((prev) => prev.filter((c) => c.id !== colaborador.id))
      showToast?.(`"${colaborador.nome}" removido da equipe.`, 'info')
    } catch (err) {
      console.error('Erro ao excluir colaborador:', err)
      showToast?.('Erro ao excluir colaborador da equipe.', 'error')
    }
  }

  // ─── Desvincular aparelho celular do colaborador (Liberar novo aparelho) ──
  const desvincularAparelho = async (colaborador) => {
    const ok = await confirm({
      title: 'Desvincular aparelho celular?',
      message: `Deseja liberar o cadastro de "${colaborador.nome}" para ser vinculado a um novo aparelho celular?\n\nEle poderá registrar seu novo aparelho na próxima reserva de vaga.`,
      confirmText: 'Desvincular Aparelho',
      cancelText: 'Cancelar',
      variant: 'info',
    })
    if (!ok) return

    try {
      let rpcOk = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('desvincular_aparelho_corretor', {
          p_corretor_id: colaborador.id,
          p_empresa_id: empresaId,
        })
        if (!rpcError && rpcData === true) rpcOk = true
      } catch (eRpc) {}

      if (!rpcOk) {
        const { error } = await supabase
          .from('equipe_corretores')
          .update({ device_id: null })
          .eq('id', colaborador.id)

        if (error) throw error
      }

      setEquipe((prev) =>
        prev.map((c) => (c.id === colaborador.id ? { ...c, device_id: null } : c))
      )
      showToast?.(`Aparelho de "${colaborador.nome}" desvinculado com sucesso! 📱`, 'success')
    } catch (err) {
      console.error('Erro ao desvincular aparelho:', err)
      showToast?.('Erro ao desvincular aparelho do colaborador.', 'error')
    }
  }

  return {
    equipe,
    loading,
    alterandoExigir,
    fetchEquipe,
    toggleExigirCadastro,
    adicionarMembro,
    editarMembro,
    toggleAtivo,
    deleteColaborador,
    desvincularAparelho,
  }
}

