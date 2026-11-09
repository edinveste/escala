import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatarNomeDia, migrarDiasLegados } from '../lib/diasSemana'
import { DEMO_EMPRESA } from '../lib/demoData'

/**
 * useEscalaData — Hook responsável por gerenciar dados de pontos, turnos e reservas da empresa,
 * com sincronização em tempo real (Supabase Realtime) e suporte a limpeza de escala.
 */
export function useEscalaData({ empresa, isDemo, showToast, confirm }) {
  const [pontos, setPontos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)

  const prevEmpresaIdRef = useRef(null)

  // ─── Carregamento de dados (Isolado pelo empresa_id) ─────────
  const fetchData = useCallback(
    async (isSilent = true) => {
      if (!empresa?.id || isDemo || empresa.id === DEMO_EMPRESA.id) return

      if (!isSilent) {
        setLoading(true)
      }
      try {
        const [pontosRes, turnosRes, reservasRes] = await Promise.all([
          supabase
            .from('pontos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true }),
          supabase
            .from('turnos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true }),
          supabase
            .from('reservas')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('created_at', { ascending: true }),
        ])

        if (pontosRes.error) throw pontosRes.error
        if (turnosRes.error) throw turnosRes.error
        if (reservasRes.error) throw reservasRes.error

        const turnosNormalizados = (turnosRes.data || []).map((t) => ({
          ...t,
          dia: formatarNomeDia(t.dia),
        }))

        setPontos(pontosRes.data || [])
        setTurnos(turnosNormalizados)
        setReservas(reservasRes.data || [])

        // Migra silenciosamente em background dias legados no banco se houver
        migrarDiasLegados(turnosRes.data)
      } catch (err) {
        console.error('Erro ao carregar dados da empresa:', err)
        showToast?.('Erro ao carregar escala desta imobiliária.', 'error')
      } finally {
        if (!isSilent) {
          setLoading(false)
        }
      }
    },
    [empresa?.id, isDemo, showToast]
  )

  useEffect(() => {
    if (empresa?.id && !isDemo && empresa.id !== DEMO_EMPRESA.id) {
      const isNovaEmpresa = empresa.id !== prevEmpresaIdRef.current
      prevEmpresaIdRef.current = empresa.id

      // Se for a mesma empresa que já possui dados carregados, atualiza de forma silenciosa sem piscar a tela
      const jaTemDados = pontos.length > 0 || turnos.length > 0
      fetchData(!isNovaEmpresa && jaTemDados)
    }
  }, [empresa?.id, isDemo, fetchData, pontos.length, turnos.length])

  // ─── Realtime: Escuta com filtro estrito de empresa_id ────────
  useEffect(() => {
    if (!empresa?.id || isDemo || empresa.id === DEMO_EMPRESA.id) return

    const channel = supabase
      .channel(`realtime-tenant-${empresa.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservas',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        (payload) => {
          setReservas((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'reservas',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        (payload) => {
          setReservas((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turnos',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        () => {
          supabase
            .from('turnos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true })
            .then(({ data }) => {
              if (data) {
                setTurnos(data.map((t) => ({ ...t, dia: formatarNomeDia(t.dia) })))
              }
            })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pontos',
          filter: `empresa_id=eq.${empresa.id}`,
        },
        () => {
          supabase
            .from('pontos')
            .select('*')
            .eq('empresa_id', empresa.id)
            .order('ordem', { ascending: true })
            .then(({ data }) => {
              if (data) setPontos(data)
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresa?.id, isDemo])

  // ─── Ação Administrativa: Limpar toda a escala ou por ponto ───
  const handleLimparEscala = useCallback(
    async (pontoId = null) => {
      if (!empresa?.id) return

      const pontoAlvo = pontoId ? pontos.find((p) => p.id === pontoId) : null
      const titulo = pontoAlvo
        ? `Limpar reservas de "${pontoAlvo.nome}"?`
        : `Limpar toda a escala de ${empresa.nome}?`
      const mensagem = pontoAlvo
        ? `⚠️ Tem certeza que deseja apagar TODAS as reservas do ponto "${pontoAlvo.nome}"?\n\nOs horários continuarão existindo, mas todas as vagas deste ponto voltarão a ficar livres.`
        : `⚠️ ATENÇÃO: Isso vai apagar TODAS as reservas de TODOS os pontos da imobiliária "${empresa.nome}"!\n\nEsta ação é irreversível e liberará todas as vagas cadastradas.`

      const ok = await confirm?.({
        title: titulo,
        message: mensagem,
        confirmText: 'Apagar tudo',
        cancelText: 'Cancelar',
        variant: 'danger',
      })
      if (!ok) return

      try {
        const { error } = await supabase.rpc('limpar_escala', {
          p_empresa_id: empresa.id,
          p_ponto_id: pontoId,
        })
        if (error) throw error

        if (pontoId) {
          const turnoIdsDoPonto = turnos.filter((t) => t.ponto_id === pontoId).map((t) => t.id)
          setReservas((prev) => prev.filter((r) => !turnoIdsDoPonto.includes(r.turno_id)))
        } else {
          setReservas([])
        }
        showToast?.('Escala limpa com sucesso!', 'success')
      } catch (err) {
        console.error('Erro ao limpar escala:', err)
        showToast?.('Erro ao limpar escala.', 'error')
      }
    },
    [confirm, empresa, pontos, showToast, turnos]
  )

  return {
    pontos,
    turnos,
    reservas,
    loading,
    fetchData,
    handleLimparEscala,
    setPontos,
    setTurnos,
    setReservas,
  }
}

