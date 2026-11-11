import { supabase } from './supabaseClient'

/**
 * Verifica se o erro retornado pelo Supabase/PostgREST indica JWT expirado.
 */
export function isJwtExpiredError(err) {
  if (!err) return false
  const msg = err.message || err.code || ''
  return err.code === 'PGRST303' || msg.includes('JWT expired') || msg.includes('401')
}

/**
 * Verifica se o erro indica que uma RPC ainda não foi aplicada no banco de dados.
 */
export function isRpcAusenteError(err) {
  if (!err) return false
  const msg = err.message || ''
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    msg.includes('Could not find the function') ||
    msg.includes('does not exist')
  )
}

/**
 * Executa uma chamada pública (RPC ou query) tratando JWT expirado residual no browser.
 * Caso haja um token de gestor expirado no localStorage, limpa a sessão local e retenta
 * uma única vez como `anon` via factory function `buildCall`.
 */
export async function executarPublicoSeguro(buildCall) {
  const res = await buildCall()
  if (res?.error && isJwtExpiredError(res.error)) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Ignora falha ao limpar storage local
    }
    return await buildCall()
  }
  return res
}

