import { supabase } from '../../lib/supabaseClient'

/**
 * Valida o PIN de administrador e vincula ao usuário autenticado (se houver).
 * Executa prioritariamente a RPC `vincular_com_pin` e fallback para `verificar_admin_pin` + upsert em usuarios_empresas.
 *
 * @param {Object} params
 * @param {string} params.empresaId - UUID da empresa alvo
 * @param {string} params.pin - PIN informado
 * @param {Object|null} params.user - Usuário Supabase Auth logado (opcional)
 * @param {Function} [params.refreshAuth] - Função de atualização de sessão e permissões do AuthContext
 * @returns {Promise<{ sucesso: boolean, tipo?: 'vinculado' | 'pin_validado', erro?: string }>}
 */
export async function validarOuVincularPinEmpresa({ empresaId, pin, user, refreshAuth }) {
  const pinLimpo = pin?.trim()
  if (!pinLimpo) {
    return { sucesso: false, erro: 'Digite o PIN de administrador.' }
  }
  if (!empresaId) {
    return { sucesso: false, erro: 'Empresa não identificada.' }
  }

  try {
    // 1. Se houver usuário logado, tenta vincular via RPC vincular_com_pin
    if (user) {
      const { data: vincOk, error: vincErr } = await supabase.rpc('vincular_com_pin', {
        p_empresa_id: empresaId,
        p_pin: pinLimpo,
      })

      if (!vincErr && vincOk === true) {
        if (refreshAuth) await refreshAuth()
        return { sucesso: true, tipo: 'vinculado' }
      }
    }

    // 2. Fallback: verificar_admin_pin legado
    const { data: rpcValido, error: rpcError } = await supabase.rpc('verificar_admin_pin', {
      p_empresa_id: empresaId,
      p_pin: pinLimpo,
    })

    if (!rpcError && rpcValido === true) {
      if (user) {
        try {
          await supabase.from('usuarios_empresas').upsert({
            user_id: user.id,
            empresa_id: empresaId,
            role: 'admin',
            ativo: true,
          })
          if (refreshAuth) await refreshAuth()
        } catch (e) {
          console.warn('Aviso no upsert de usuarios_empresas:', e)
        }
      }
      return { sucesso: true, tipo: 'pin_validado' }
    }

    return { sucesso: false, erro: 'PIN incorreto para esta empresa.' }
  } catch (err) {
    console.error('Erro ao validar ou vincular com PIN:', err)
    return { sucesso: false, erro: 'Erro ao verificar PIN. Tente novamente.' }
  }
}

