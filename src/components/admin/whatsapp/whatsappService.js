import { supabase } from '../../../lib/supabaseClient'

/**
 * Serviço responsável pela persistência assíncrona das mensagens customizadas
 * de WhatsApp no Supabase (tabelas empresas/pontos, RPCs de contingência e fallback JSONB).
 *
 * @param {Object} params
 * @param {Object} params.empresa - Empresa ativa
 * @param {Array} params.pontos - Lista de pontos de captação
 * @param {Object} params.draftsFinais - Dicionário de rascunhos consolidados
 * @param {Array<string>} params.alvosParaSalvar - Lista de chaves/IDs de alvos com modificações
 * @returns {Promise<{ payloadGeral: Object|null, novosTermos: Object, alvosParaSalvar: string[] }>}
 */
export async function persistirWhatsappConfiguracoes({
  empresa,
  pontos = [],
  draftsFinais = {},
  alvosParaSalvar = [],
}) {
  if (!empresa?.id) {
    throw new Error('Empresa inválida ou não selecionada.')
  }

  let payloadGeral = null
  const whatsappPontosMap = {}
  const promessas = []

  for (const id of alvosParaSalvar) {
    const item = draftsFinais[id]
    const cabTexto = item?.cabecalho?.trim() || null
    const rodTexto = item?.rodape?.trim() || null

    if (id === 'geral') {
      payloadGeral = {
        msg_whatsapp_geral: cabTexto,
        rodape_whatsapp_geral: rodTexto,
      }

      promessas.push(
        (async () => {
          const { error: updateErr } = await supabase
            .from('empresas')
            .update(payloadGeral)
            .eq('id', empresa.id)

          if (updateErr) {
            await supabase.rpc('atualizar_whatsapp_empresa', {
              p_empresa_id: empresa.id,
              p_cabecalho: payloadGeral.msg_whatsapp_geral,
              p_rodape: payloadGeral.rodape_whatsapp_geral,
            })
          }
        })()
      )
    } else {
      // Ponto individual de captação
      const payloadPonto = {
        cabecalho_whatsapp: cabTexto,
        rodape_whatsapp: rodTexto,
      }

      whatsappPontosMap[id] = {
        cabecalho: cabTexto,
        rodape: rodTexto,
      }

      // Atualiza o objeto do ponto em memória imediatamente para feedback rápido
      const pIndex = pontos.findIndex((p) => p.id === id)
      if (pIndex !== -1) {
        pontos[pIndex].cabecalho_whatsapp = cabTexto
        pontos[pIndex].rodape_whatsapp = rodTexto
      }

      promessas.push(
        (async () => {
          const { error: updateErr } = await supabase
            .from('pontos')
            .update(payloadPonto)
            .eq('id', id)

          if (updateErr) {
            await supabase.rpc('atualizar_whatsapp_ponto', {
              p_ponto_id: id,
              p_empresa_id: empresa.id,
              p_cabecalho: payloadPonto.cabecalho_whatsapp,
              p_rodape: payloadPonto.rodape_whatsapp,
            })
          }
        })()
      )
    }
  }

  // Executa todas as gravações nos alvos modificados
  await Promise.allSettled(promessas)

  // Salva também no JSONB empresas.termos como blindagem de contingência
  const novosTermos = {
    ...(empresa?.termos || {}),
    whatsappPontos: {
      ...(empresa?.termos?.whatsappPontos || {}),
      ...whatsappPontosMap,
    },
    ...(payloadGeral
      ? {
          msgWhatsappGeral: payloadGeral.msg_whatsapp_geral,
          rodapeWhatsappGeral: payloadGeral.rodape_whatsapp_geral,
        }
      : {}),
  }

  await supabase
    .from('empresas')
    .update({ termos: novosTermos })
    .eq('id', empresa.id)

  return {
    payloadGeral,
    novosTermos,
    alvosParaSalvar,
  }
}

