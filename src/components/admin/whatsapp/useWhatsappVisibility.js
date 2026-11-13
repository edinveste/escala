import { useMemo, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'

/**
 * Hook especializado em gerenciar o status de visibilidade dos botões
 * de cópia do WhatsApp na interface pública do corretor (Escala Geral e por Ponto).
 *
 * @param {Object} params
 * @param {Object} params.empresa - Objeto com os dados do tenant
 * @param {Array} params.pontos - Lista de pontos de captação
 * @param {Function} [params.onEmpresaUpdated] - Callback de atualização do estado da empresa
 * @param {Function} [params.onDataChanged] - Callback para recarregar dados do painel
 * @param {Function} [params.showToast] - Notificador visual de feedback
 */
export function useWhatsappVisibility({
  empresa,
  pontos = [],
  onEmpresaUpdated,
  onDataChanged,
  showToast,
}) {
  const isCopiaGeralAtiva = useMemo(() => {
    return (
      empresa?.copia_whatsapp_geral_ativa !== false &&
      empresa?.termos?.copiaWhatsappGeralAtiva !== false
    )
  }, [empresa])

  const isCopiaPontoAtiva = useCallback(
    (pId) => {
      const p = pontos.find((item) => item.id === pId)
      return (
        p?.copia_whatsapp_ativa !== false &&
        empresa?.termos?.copiaWhatsappPontos?.[pId] !== false
      )
    },
    [pontos, empresa]
  )

  const alternarCopiaGeral = useCallback(
    async (e) => {
      e?.stopPropagation?.()
      if (!empresa?.id) return

      const statusAtual = isCopiaGeralAtiva
      const novoStatus = !statusAtual

      try {
        const novosTermos = {
          ...(empresa.termos || {}),
          copiaWhatsappGeralAtiva: novoStatus,
        }

        const payload = {
          copia_whatsapp_geral_ativa: novoStatus,
          termos: novosTermos,
        }

        const { error } = await supabase
          .from('empresas')
          .update(payload)
          .eq('id', empresa.id)

        if (error) {
          await supabase
            .from('empresas')
            .update({ termos: novosTermos })
            .eq('id', empresa.id)
        }

        onEmpresaUpdated?.({
          ...empresa,
          copia_whatsapp_geral_ativa: novoStatus,
          termos: novosTermos,
        })

        showToast?.(
          novoStatus
            ? 'Botão de copiar Escala Geral liberado aos corretores! 👁️'
            : 'Botão de copiar Escala Geral ocultado aos corretores. 🙈',
          novoStatus ? 'success' : 'info'
        )
      } catch (err) {
        console.error('Erro ao alternar cópia da escala geral:', err)
        showToast?.('Erro ao atualizar visibilidade da cópia.', 'error')
      }
    },
    [empresa, isCopiaGeralAtiva, onEmpresaUpdated, showToast]
  )

  const alternarCopiaPonto = useCallback(
    async (pontoId, e) => {
      e?.stopPropagation?.()
      const ponto = pontos.find((p) => p.id === pontoId)
      if (!ponto) return

      const statusAtual = isCopiaPontoAtiva(pontoId)
      const novoStatus = !statusAtual

      // Atualização otimista em memória
      ponto.copia_whatsapp_ativa = novoStatus

      try {
        const { error } = await supabase
          .from('pontos')
          .update({ copia_whatsapp_ativa: novoStatus })
          .eq('id', pontoId)

        if (error) {
          const novosTermos = {
            ...(empresa?.termos || {}),
            copiaWhatsappPontos: {
              ...(empresa?.termos?.copiaWhatsappPontos || {}),
              [pontoId]: novoStatus,
            },
          }
          await supabase
            .from('empresas')
            .update({ termos: novosTermos })
            .eq('id', empresa?.id)

          onEmpresaUpdated?.({
            ...empresa,
            termos: novosTermos,
          })
        }

        showToast?.(
          novoStatus
            ? `Botão de copiar escala de "${ponto.nome}" liberado aos corretores! 👁️`
            : `Botão de copiar escala de "${ponto.nome}" ocultado aos corretores. 🙈`,
          novoStatus ? 'success' : 'info'
        )

        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao alternar cópia do ponto:', err)
        showToast?.('Erro ao atualizar visibilidade da cópia do ponto.', 'error')
      }
    },
    [pontos, isCopiaPontoAtiva, empresa, onEmpresaUpdated, onDataChanged, showToast]
  )

  return {
    isCopiaGeralAtiva,
    isCopiaPontoAtiva,
    alternarCopiaGeral,
    alternarCopiaPonto,
  }
}

