import { useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { isRpcAusenteError } from '../../lib/supabasePublicHelper'
import { DIAS_SEMANA, formatarNomeDia } from '../../lib/diasSemana'

/**
 * Hook de domínio e inteligência para gerenciamento dos colaboradores
 * que possuem horários preenchidos na escala ativa da empresa.
 */
export function useColaboradoresEscala({
  reservas = [],
  turnos = [],
  pontos = [],
  empresaId,
  onDataChanged,
  showToast,
}) {
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('nome_asc') // 'nome_asc', 'nome_desc', 'vagas_desc'
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState(null)

  // ─── 1. Lookups indexados O(1) para alta performance ─────────────────────
  const pontosMap = useMemo(() => {
    const map = new Map()
    for (const p of pontos) {
      if (p?.id) map.set(p.id, p)
    }
    return map
  }, [pontos])

  const turnosMap = useMemo(() => {
    const map = new Map()
    for (const t of turnos) {
      if (t?.id) map.set(t.id, t)
    }
    return map
  }, [turnos])

  // ─── 2. Agrupamento consolidado de reservas por colaborador ───────────────
  const colaboradores = useMemo(() => {
    if (!reservas || reservas.length === 0) return []

    const grupos = new Map()

    for (const r of reservas) {
      const nomeBruto = (r.corretor_nome || '').trim()
      if (!nomeBruto) continue

      // Chave normalizada por nome (case-insensitive)
      const chave = nomeBruto.toLowerCase()

      const turno = turnosMap.get(r.turno_id)
      const ponto = turno?.ponto_id ? pontosMap.get(turno.ponto_id) : null

      const diaFormatado = turno?.dia ? formatarNomeDia(turno.dia) : 'Outros'
      const diaOrdem = DIAS_SEMANA.indexOf(diaFormatado)

      const turnoInfo = {
        reservaId: r.id,
        turnoId: r.turno_id,
        pontoId: ponto?.id || turno?.ponto_id,
        pontoNome: ponto?.nome || 'Local não identificado',
        dia: diaFormatado,
        diaOrdem: diaOrdem >= 0 ? diaOrdem : 99,
        horario: turno?.horario || 'Horário a definir',
        hora_inicio: turno?.hora_inicio || null,
        hora_fim: turno?.hora_fim || null,
        ordemTurno: turno?.ordem ?? 0,
        created_at: r.created_at,
        deviceId: r.device_id,
        whatsapp: r.corretor_whatsapp,
        email: r.corretor_email,
      }

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          id: `colab_${chave}`,
          chave,
          nome: nomeBruto,
          whatsapp: r.corretor_whatsapp || null,
          email: r.corretor_email || null,
          device_id:
            r.device_id && !r.device_id.startsWith('admin_manual_')
              ? r.device_id
              : null,
          device_ids: new Set(r.device_id ? [r.device_id] : []),
          reserva_ids: [r.id],
          turnos: [turnoInfo],
        })
      } else {
        const existente = grupos.get(chave)

        // Atualiza para a melhor grafia (caso haja variação de maiúsculas/minúsculas)
        if (nomeBruto.length > existente.nome.length) {
          existente.nome = nomeBruto
        }

        if (!existente.whatsapp && r.corretor_whatsapp) {
          existente.whatsapp = r.corretor_whatsapp
        }
        if (!existente.email && r.corretor_email) {
          existente.email = r.corretor_email
        }
        if (
          !existente.device_id &&
          r.device_id &&
          !r.device_id.startsWith('admin_manual_')
        ) {
          existente.device_id = r.device_id
        }
        if (r.device_id) {
          existente.device_ids.add(r.device_id)
        }

        existente.reserva_ids.push(r.id)
        existente.turnos.push(turnoInfo)
      }
    }

    // Ordena os turnos cronologicamente por dia e horário para cada colaborador
    const lista = Array.from(grupos.values()).map((c) => {
      const turnosOrdenados = [...c.turnos].sort((a, b) => {
        if (a.diaOrdem !== b.diaOrdem) {
          return a.diaOrdem - b.diaOrdem
        }
        if (a.hora_inicio && b.hora_inicio) {
          return a.hora_inicio.localeCompare(b.hora_inicio)
        }
        if (a.ordemTurno !== b.ordemTurno) {
          return a.ordemTurno - b.ordemTurno
        }
        return (a.horario || '').localeCompare(b.horario || '')
      })

      return {
        ...c,
        device_ids: Array.from(c.device_ids),
        totalTurnos: c.reserva_ids.length,
        turnos: turnosOrdenados,
      }
    })

    return lista
  }, [reservas, turnosMap, pontosMap])

  // ─── 3. Filtro e busca dinâmica ───────────────────────────────────────────
  const colaboradoresFiltrados = useMemo(() => {
    let resultado = colaboradores

    if (busca.trim()) {
      const termo = busca.toLowerCase().trim()
      const termoDigits = busca.replace(/\D/g, '')

      resultado = resultado.filter((colab) => {
        const matchNome = colab.nome.toLowerCase().includes(termo)
        const matchZap =
          termoDigits && (colab.whatsapp || '').replace(/\D/g, '').includes(termoDigits)
        const matchEmail = (colab.email || '').toLowerCase().includes(termo)

        // Permite buscar também por dia ou ponto em que a pessoa atua
        const matchTurno = colab.turnos.some(
          (t) =>
            t.dia.toLowerCase().includes(termo) ||
            t.pontoNome.toLowerCase().includes(termo) ||
            t.horario.toLowerCase().includes(termo)
        )

        return matchNome || matchZap || matchEmail || matchTurno
      })
    }

    // Ordenação
    return [...resultado].sort((a, b) => {
      if (ordenacao === 'vagas_desc') {
        const diffVagas = b.totalTurnos - a.totalTurnos
        if (diffVagas !== 0) return diffVagas
        return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
      }
      if (ordenacao === 'nome_desc') {
        return b.nome.localeCompare(a.nome, 'pt-BR', { sensitivity: 'base' })
      }
      // Padrão: nome_asc
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    })
  }, [colaboradores, busca, ordenacao])

  // ─── 4. Métricas consolidadas ─────────────────────────────────────────────
  const metricas = useMemo(() => {
    const totalColaboradores = colaboradores.length
    const totalVagas = colaboradores.reduce((acc, c) => acc + c.totalTurnos, 0)
    return {
      totalColaboradores,
      totalVagas,
    }
  }, [colaboradores])

  // ─── 5. Ação de renomeação em lote de colaborador ─────────────────────────
  const renomearColaborador = useCallback(
    async (colaborador, novoNomeBruto, sincronizarEquipe = true) => {
      const novoNome = (novoNomeBruto || '').trim()

      if (!novoNome || novoNome.length < 2) {
        showToast?.('O novo nome deve conter pelo menos 2 caracteres.', 'warning')
        return false
      }

      if (novoNome === colaborador.nome) {
        showToast?.('O novo nome é idêntico ao atual.', 'info')
        return false
      }

      setSalvandoNome(true)
      try {
        let rpcSucesso = false

        // 1. Tenta executar a RPC segura de renomeação em lote
        try {
          const { data, error } = await supabase.rpc('renomear_colaborador_escala', {
            p_empresa_id: empresaId,
            p_nome_antigo: colaborador.nome,
            p_novo_nome: novoNome,
            p_device_id: colaborador.device_id || null,
            p_reserva_ids: colaborador.reserva_ids,
            p_sincronizar_equipe: sincronizarEquipe,
          })

          if (error) {
            if (isRpcAusenteError(error)) {
              console.warn(
                '[useColaboradoresEscala] RPC renomear_colaborador_escala ausente, executando fallback via update direto.'
              )
            } else {
              throw error
            }
          } else {
            rpcSucesso = true
          }
        } catch (rpcErr) {
          if (!isRpcAusenteError(rpcErr)) {
            throw rpcErr
          }
        }

        // 2. Fallback direto caso a RPC ainda não esteja instalada no Supabase
        if (!rpcSucesso) {
          // Atualiza as reservas deste colaborador pelo ID
          const { error: errReservas } = await supabase
            .from('reservas')
            .update({ corretor_nome: novoNome })
            .in('id', colaborador.reserva_ids)

          if (errReservas) throw errReservas

          // Se solicitado, sincroniza também na equipe autorizada
          if (sincronizarEquipe && empresaId) {
            try {
              await supabase
                .from('equipe_corretores')
                .update({ nome: novoNome })
                .eq('empresa_id', empresaId)
                .ilike('nome', colaborador.nome)
            } catch (errEquipe) {
              console.warn(
                '[useColaboradoresEscala] Aviso ao sincronizar com equipe_corretores:',
                errEquipe
              )
            }
          }
        }

        const qtdTurnos = colaborador.totalTurnos
        showToast?.(
          `Nome alterado para "${novoNome}" em ${qtdTurnos} ${
            qtdTurnos === 1 ? 'horário' : 'horários'
          }! ✅`,
          'success'
        )

        onDataChanged?.()
        return true
      } catch (err) {
        console.error('[useColaboradoresEscala] Erro ao renomear colaborador:', err)
        showToast?.('Erro ao alterar o nome do colaborador.', 'error')
        return false
      } finally {
        setSalvandoNome(false)
      }
    },
    [empresaId, onDataChanged, showToast]
  )

  return {
    colaboradores: colaboradoresFiltrados,
    totalColaboradores: metricas.totalColaboradores,
    totalVagas: metricas.totalVagas,
    busca,
    setBusca,
    ordenacao,
    setOrdenacao,
    salvandoNome,
    renomearColaborador,
    colaboradorParaEditar,
    setColaboradorParaEditar,
  }
}
