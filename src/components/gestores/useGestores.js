import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useConfirm } from '../ConfirmModal'

/**
 * Hook customizado para gerenciamento de Gestores e Coordenadores da empresa.
 * Encapsula busca, sincronização em tempo real (Supabase Realtime) e mutações seguras (RPCs).
 */
export default function useGestores({
  empresaId,
  currentUserId,
  showToast,
}) {
  const confirm = useConfirm()

  const [gestores, setGestores] = useState([])
  const [loading, setLoading] = useState(true)
  const [adicionando, setAdicionando] = useState(false)

  // ─── Carregar Gestores da Imobiliária ─────────────────────────
  const fetchGestores = useCallback(async () => {
    if (!empresaId) return
    try {
      // 1. Tenta buscar via RPC segura get_gestores_empresa (retorna membros e convites pendentes)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_gestores_empresa', {
        p_empresa_id: empresaId,
      })

      if (!rpcErr && rpcData) {
        setGestores(rpcData)
        return
      }

      // 2. Fallback caso a RPC não esteja disponível
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('usuarios_empresas')
        .select('id, user_id, role, ativo, created_at, perfis:user_id(id, email, nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })

      if (!fallbackErr && fallbackData) {
        const formatados = fallbackData.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          email: m.perfis?.email || '',
          nome: m.perfis?.nome || m.perfis?.email?.split('@')[0] || 'Usuário',
          role: m.role || 'gestor',
          ativo: m.ativo !== false,
          pendente: false,
          created_at: m.created_at,
        }))
        setGestores(formatados)
      }
    } catch (err) {
      console.error('Erro ao carregar gestores:', err)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchGestores()
  }, [fetchGestores])

  // ─── Realtime: Escuta alterações na equipe e convites ────────
  useEffect(() => {
    if (!empresaId) return

    const channel = supabase
      .channel(`realtime-gestores-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usuarios_empresas',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => fetchGestores()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'convites_gestores',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => fetchGestores()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, fetchGestores])

  // ─── Adicionar / Vincular Novo Gestor ou Coordenador ─────────
  const vincularGestor = async ({ email, role = 'gestor' }) => {
    const emailLimpo = email?.trim().toLowerCase()

    if (!emailLimpo || !emailLimpo.includes('@')) {
      showToast?.('Digite um endereço de e-mail válido.', 'warning')
      return false
    }

    setAdicionando(true)
    try {
      const { data, error } = await supabase.rpc('vincular_usuario_empresa', {
        p_email: emailLimpo,
        p_empresa_id: empresaId,
        p_role: role,
      })

      if (error) {
        showToast?.(error.message || 'Erro ao vincular gestor.', 'error')
        return false
      }

      const roleNome = role === 'admin' ? 'Administrador Geral' : 'Coordenador da Escala'
      if (data?.status === 'convidado') {
        showToast?.(
          `Convite prévio salvo para "${emailLimpo}"! Ao criar a conta, o acesso será liberado automaticamente. ✉️`,
          'info'
        )
      } else {
        showToast?.(`"${emailLimpo}" vinculado como ${roleNome}! 🛡️`, 'success')
      }

      await fetchGestores()
      return true
    } catch (err) {
      console.error('Erro ao vincular gestor:', err)
      showToast?.('Erro ao vincular gestor à empresa.', 'error')
      return false
    } finally {
      setAdicionando(false)
    }
  }

  // ─── Remover Acesso de um Gestor / Coordenador ───────────────
  const removerGestor = async (gestor) => {
    if (gestor.user_id && gestor.user_id === currentUserId) {
      showToast?.('Você não pode remover seu próprio acesso administrativo.', 'warning')
      return false
    }

    // Se for convite pendente
    if (gestor.pendente) {
      const ok = await confirm({
        title: 'Cancelar convite pendente?',
        message: `Deseja cancelar o convite de ${gestor.role === 'admin' ? 'Administrador' : 'Coordenador'} para "${gestor.email}"?`,
        confirmText: 'Cancelar Convite',
        cancelText: 'Voltar',
        variant: 'danger',
      })
      if (!ok) return false

      try {
        await supabase.rpc('cancelar_convite_gestor', {
          p_convite_id: gestor.id,
          p_empresa_id: empresaId,
        })
        showToast?.('Convite cancelado.', 'info')
        await fetchGestores()
        return true
      } catch (err) {
        console.error('Erro ao cancelar convite:', err)
        showToast?.('Erro ao cancelar convite.', 'error')
        return false
      }
    }

    // Se for membro já ativo
    const papelLabel = gestor.role === 'admin' ? 'Administrador' : 'Coordenador'
    const ok = await confirm({
      title: 'Remover acesso?',
      message: `Tem certeza que deseja remover o acesso de ${papelLabel} de "${gestor.nome || gestor.email}"?\n\nEsta pessoa perderá o acesso administrativo à empresa imediatamente.`,
      confirmText: 'Remover Acesso',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!ok) return false

    try {
      const { error } = await supabase.rpc('desvincular_usuario_empresa', {
        p_user_id: gestor.user_id,
        p_empresa_id: empresaId,
      })

      if (error) {
        const { error: directErr } = await supabase
          .from('usuarios_empresas')
          .delete()
          .eq('user_id', gestor.user_id)
          .eq('empresa_id', empresaId)

        if (directErr) throw directErr
      }

      showToast?.(`Acesso de "${gestor.nome || gestor.email}" removido.`, 'info')
      await fetchGestores()
      return true
    } catch (err) {
      console.error('Erro ao desvincular gestor:', err)
      showToast?.('Erro ao remover acesso.', 'error')
      return false
    }
  }

  return {
    gestores,
    loading,
    adicionando,
    fetchGestores,
    vincularGestor,
    removerGestor,
  }
}

