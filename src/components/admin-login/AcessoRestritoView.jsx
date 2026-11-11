import { useState } from 'react'
import { AlertCircle, Building2, ChevronRight, LogOut, ShieldAlert } from 'lucide-react'
import { setTenantUrl } from '../../lib/tenantHelper'
import AuthFeedback from './AuthFeedback'

/**
 * Visualização apresentada quando o usuário já está autenticado no Supabase Auth,
 * mas ainda não possui vínculo com permissões de gestão na empresa ativa.
 */
export default function AcessoRestritoView({
  user,
  targetEmpresaNome,
  minhasEmpresas = [],
  signOut,
  showToast,
}) {
  const [desconectando, setDesconectando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')

  const navegarParaEmpresa = (slug) => {
    setTenantUrl(slug)
    window.location.reload()
  }

  const handleDesconectar = async () => {
    setDesconectando(true)
    setErroMsg('')
    try {
      await signOut()
      showToast('Você desconectou da conta.', 'info')
    } catch (err) {
      console.error('Erro ao deslogar:', err)
      setErroMsg('Erro ao desconectar.')
    } finally {
      setDesconectando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Alerta de Empresa Não Vinculada */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-gray-100">Acesso Restrito a Esta Empresa</p>
            <p className="text-gray-300 text-xs leading-relaxed">
              Você está conectado como{' '}
              <strong className="text-gray-100 font-semibold">{user.email}</strong>, mas esta
              conta não possui permissão de gestão para{' '}
              <strong className="text-amber-300 font-semibold">{targetEmpresaNome}</strong>.
            </p>
          </div>
        </div>

        {/* Lista de Empresas Onde o Usuário Já é Autorizado */}
        {minhasEmpresas.length > 0 && (
          <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
            <p className="text-[11px] text-gray-300 font-medium">Suas empresas autorizadas:</p>
            {minhasEmpresas.map((emp) => (
              <button
                key={emp.empresa_id}
                type="button"
                onClick={() => navegarParaEmpresa(emp.empresa_slug)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-surface-900/60 hover:bg-surface-700 text-left transition-colors text-xs text-gray-200"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-brand-400" />
                  {emp.empresa_nome}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  Ir para escala <ChevronRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <AuthFeedback erroMsg={erroMsg} />

      <div className="p-3.5 rounded-2xl bg-surface-900/60 border border-surface-700/80 text-[11px] text-gray-400 flex items-start gap-2.5 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
        <span>
          Para gerenciar esta empresa, peça a um administrador que adicione o e-mail{' '}
          <strong className="text-gray-200">{user.email}</strong> na aba{' '}
          <strong className="text-gray-200">Equipe → Coordenadores &amp; Gestores</strong>.
        </span>
      </div>

      {/* Desconectar desta conta */}
      <div className="pt-1 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleDesconectar}
          disabled={desconectando}
          className="w-full py-2.5 px-3 rounded-xl bg-surface-700 hover:bg-surface-650 hover:text-red-400 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-surface-600 disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5 text-red-400" />
          <span>Sair desta conta ({user.email})</span>
        </button>
      </div>
    </div>
  )
}
