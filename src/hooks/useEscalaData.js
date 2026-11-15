import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { executarPublicoSeguro, isRpcAusenteError } from '../lib/supabasePublicHelper'
import { formatarNomeDia, migrarDiasLegados } from '../lib/diasSemana'
import { DEMO_EMPRESA } from '../lib/demoData'

function mapearPontosComTermos(rawPontos, empresa) {
  return (rawPontos || []).map((p) => {
    const zapPonto = empresa?.termos?.whatsappPontos?.[p.id]
    const enderecoTermos = empresa?.termos?.enderecosPontos?.[p.id]
    return {
      ...p,
      endereco: p.endereco || enderecoTermos || null,
      cabecalho_whatsapp: p.cabecalho_whatsapp || zapPonto?.cabecalho || null,
      rodape_whatsapp: p.rodape_whatsapp || zapPonto?.rodape || null,
    }
  })
}

function normalizarTurnos(rawTurnos) {
  return (rawTurnos || []).map((t) => ({
    ...t,
    dia: formatarNomeDia(t.dia),
  }))
}

/**
 * useEscalaData — Hook responsável por gerenciar dados de pontos, turnos e reservas da empresa,
 * com isolamento entre visão do gestor autenticado e visão pública sanitizada via RPC.
 */
export function useEscalaData({
  empresa,
  isDemo,
  isGestor = false,
  deviceId = '',
  showToast,
  confirm,
}) {
  const [pontos, setPontos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modoSync, setModoSync] = useState(() => (isGestor ? 'gestor' : 'rpc'))

  const prevEmpresaIdRef = useRef(null)
  const empresaRef = useRef(empresa)
  const temDadosRef = useRef(false)
  const fetchCounterRef = useRef(0)
  const fetchDataRef = useRef(null)

  useEffect(() => {
    empresaRef.current = empresa
  }, [empresa])
  useEffect(() => {
    temDadosRef.current = pontos.length > 0 || turnos.length > 0
  }, [pontos.length, turnos.length])

  useEffect(() => {
    setModoSync(isGestor ? 'gestor' : 'rpc')
  }, [isGestor, empresa?.id])

  // ─── Carregamento de dados (Isolado pelo empresa_id) ─────────
  const fetchData = useCallback(
    async (isSilent = true) => {
      if (!empresa?.id || isDemo || empresa.id === DEMO_EMPRESA.id) return

      const currentFetchId = ++fetchCounterRef.current

      if (!isSilent) {
        setLoading(true)
      }

      try {
        if (isGestor) {
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

          if (currentFetchId !== fetchCounterRef.current) return

          if (pontosRes.error) throw pontosRes.error
          if (turnosRes.error) throw turnosRes.error
          if (reservasRes.error) throw reservasRes.error

          setPontos(mapearPontosComTermos(pontosRes.data, empresaRef.current))
          setTurnos(normalizarTurnos(turnosRes.data))
          setReservas(reservasRes.data || [])
          setModoSync('gestor')

          // Migração silenciosa restrita a gestores autenticados
          migrarDiasLegados(turnosRes.data)
          return
        }

        // Área pública: usa RPC sanitizada (zero PII, zero device_id, anonimato server-side)
        const { data: rpcData, error: rpcErr } = await executarPublicoSeguro(() =>
          supabase.rpc('get_escala_publica', {
            p_empresa_id: empresa.id,
            p_device_id: deviceId || null,
          })
        )

        if (currentFetchId !== fetchCounterRef.current) return

        if (!rpcErr && rpcData) {
          setPontos(mapearPontosComTermos(rpcData.pontos, empresaRef.current))
          setTurnos(normalizarTurnos(rpcData.turnos))
          setReservas(rpcData.reservas || [])
          setModoSync('rpc')
          return
        }

        if (isRpcAusenteError(rpcErr)) {
          // Fallback transitório caso a migração SQL da Fase 14 ainda não tenha sido aplicada
          setModoSync('legacy')
          const [pontosRes, turnosRes, reservasRes] = await Promise.all([
            executarPublicoSeguro(() =>
              supabase
                .from('pontos')
                .select('*')
                .eq('empresa_id', empresa.id)
                .order('ordem', { ascending: true })
            ),
            executarPublicoSeguro(() =>
              supabase
                .from('turnos')
                .select('*')
                .eq('empresa_id', empresa.id)
                .order('ordem', { ascending: true })
            ),
            executarPublicoSeguro(() =>
              supabase
                .from('reservas')
                .select('id, empresa_id, turno_id, corretor_nome, device_id, created_at')
                .eq('empresa_id', empresa.id)
                .order('created_at', { ascending: true })
            ),
          ])

          if (currentFetchId !== fetchCounterRef.current) return

          if (pontosRes.error) throw pontosRes.error
          if (turnosRes.error) throw turnosRes.error
          if (reservasRes.error) throw reservasRes.error

          setPontos(mapearPontosComTermos(pontosRes.data, empresaRef.current))
          setTurnos(normalizarTurnos(turnosRes.data))
          setReservas(reservasRes.data || [])
          return
        }

        throw rpcErr
      } catch (err) {
        if (currentFetchId === fetchCounterRef.current) {
          console.error('Erro ao carregar dados da empresa:', err)
          showToast?.('Erro ao carregar escala desta empresa.', 'error')
        }
      } finally {
        if (currentFetchId === fetchCounterRef.current && !isSilent) {
          setLoading(false)
        }
      }
    },
    [empresa?.id, isDemo, isGestor, deviceId, showToast]
  )

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    if (empresa?.id && !isDemo && empresa.id !== DEMO_EMPRESA.id) {
      const isNovaEmpresa = empresa.id !== prevEmpresaIdRef.current
      prevEmpresaIdRef.current = empresa.id

      fetchData(!isNovaEmpresa && temDadosRef.current)
    }
  }, [empresa?.id, isDemo, fetchData])

  // ─── Realtime: Escuta com filtro estrito de empresa_id ────────
  useEffect(() => {
    if (!empresa?.id || isDemo || empresa.id === DEMO_EMPRESA.id) return

    if (modoSync === 'rpc') {
      let debounceTimer = null
      const channel = supabase
        .channel(`realtime-escala-sync-${empresa.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'escala_sync',
            filter: `empresa_id=eq.${empresa.id}`,
          },
          () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              fetchDataRef.current?.(true)
            }, 60)
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            // Canal confirmado ativo: sincroniza uma vez para garantir estado mais fresco
            fetchDataRef.current?.(true)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn(`[Escala Realtime] Canal ${status}, executando sincronização preventiva:`, err)
            fetchDataRef.current?.(true)
          }
        })

      return () => {
        clearTimeout(debounceTimer)
        supabase.removeChannel(channel)
      }
    }

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
              if (data) setTurnos(normalizarTurnos(data))
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
              if (data) setPontos(mapearPontosComTermos(data, empresaRef.current))
            })
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          fetchDataRef.current?.(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[Escala Realtime Gestor] Canal ${status}:`, err)
          fetchDataRef.current?.(true)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresa?.id, isDemo, modoSync])

  // ─── Re-sincronização automática ao retornar foco/visibilidade ──
  // Resolve o problema de navegadores modernos suspenderem WebSockets em abas de fundo
  useEffect(() => {
    if (!empresa?.id || isDemo || empresa.id === DEMO_EMPRESA.id) return

    const handleSyncOnVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchDataRef.current?.(true)
      }
    }

    const handleFocus = () => {
      fetchDataRef.current?.(true)
    }

    document.addEventListener('visibilitychange', handleSyncOnVisible)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleSyncOnVisible)
      window.removeEventListener('focus', handleFocus)
    }
  }, [empresa?.id, isDemo])

  // ─── Polling de Contingência Inteligente (Heartbeat a cada 15s) ──
  // Garante que, mesmo sob oscilações severas de rede ou bloqueios de firewall,
  // as vagas nunca fiquem desatualizadas por mais de 15 segundos na tela ativa.
  useEffect(() => {
    if (!empresa?.id || isDemo || empresa.id === DEMO_EMPRESA.id) return

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDataRef.current?.(true)
      }
    }, 15000)

    return () => clearInterval(intervalId)
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
        : `⚠️ ATENÇÃO: Isso vai apagar TODAS as reservas de TODOS os pontos da empresa "${empresa.nome}"!\n\nEsta ação é irreversível e liberará todas as vagas cadastradas.`

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
        showToast?.(err?.message || 'Erro ao limpar escala.', 'error')
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
