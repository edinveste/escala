import { useState } from 'react'
import { AlertCircle, Building2, ChevronRight, KeyRound, LogOut } from 'lucide-react'
import { setTenantUrl } from '../../lib/tenantHelper'
import { validarOuVincularPinEmpresa } from './adminAuthHelper'
import AuthFeedback from './AuthFeedback'

/**
 * Visualização apresentada quando o usuário já está autenticado no Supabase Auth,
 * mas ainda não possui vínculo com permissões de gestão na empresa ativa.
 */
export default function AcessoRestritoView({
  user,
  targetEmpresaId,
  targetEmpresaNome,
  minhasEmpresas = [],
  signOut,
  refreshAuth,
  onSuccess,
  onClose,
  showToast,
}) {
  const [pinVinculo, setPinVinculo] = useState('')
  const [vinculandoPin, setVinculandoPin] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')

  const navegarParaEmpresa = (slug) => {
    setTenantUrl(slug)
    window.location.reload()
  }

  const handleVincularComPin = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!pinVinculo.trim()) {
      setErroMsg('Digite o PIN de administrador desta empresa.')
      return
    }

    setVinculandoPin(true)
    try {
      const res = await validarOuVincularPinEmpresa({
        empresaId: targetEmpresaId,
        pin: pinVinculo,
        user,
        refreshAuth,
      })

      if (res.sucesso) {
        showToast(
          res.tipo === 'vinculado'
            ? 'Conta vinculada como administradora com sucesso! 🛡️'
            : 'Acesso de administrador concedido via PIN! 🛡️',
          'success'
        )
        onSuccess()
        onClose()
      } else {
        setErroMsg(res.erro || 'PIN incorreto para esta empresa.')
        setPinVinculo('')
      }
    } catch (err) {
      console.error('Erro ao vincular conta com PIN:', err)
      setErroMsg('Erro ao verificar PIN.')
    } finally {
      setVinculandoPin(false)
    }
  }

  const handleDesconectar = async () => {
    setDesconectando(true)
    setErroMsg('')
    try {
      await signOut()
      setPinVinculo('')
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
              Você está conectado como <strong className="text-gray-100 font-semibold">{user.email}</strong>, mas esta conta ainda não foi vinculada à empresa{' '}
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

      {/* Feedback de Erro ou Sucesso */}
      <AuthFeedback erroMsg={erroMsg} sucessoMsg={sucessoMsg} />

      {/* Opção 1: Validar e Vincular com o PIN da Empresa */}
      <form
        onSubmit={handleVincularComPin}
        className="p-4 rounded-2xl bg-surface-900/60 border border-surface-700/80 space-y-3"
      >
        <div>
          <p className="text-xs font-bold text-gray-200 flex items-center gap-1.5 mb-1">
            <KeyRound className="w-4 h-4 text-brand-400" />
            Vincular Conta com PIN de Administrador
          </p>
          <p className="text-[11px] text-gray-400">
            Possui a senha/PIN desta empresa? Digite abaixo para vincular sua conta ({user.email}) como administradora:
          </p>
        </div>

        <div className="relative">
          <input
            type="password"
            value={pinVinculo}
            onChange={(e) => setPinVinculo(e.target.value)}
            placeholder="Digite o PIN da empresa"
            className="input-field text-center font-mono tracking-widest text-sm"
            maxLength={20}
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={vinculandoPin || !pinVinculo.trim()}
          className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
        >
          {vinculandoPin ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Validando PIN...</span>
            </>
          ) : (
            <>
              <KeyRound className="w-3.5 h-3.5" />
              <span>Validar PIN e Acessar Gestão</span>
            </>
          )}
        </button>
      </form>

      {/* Opção 2: Desconectar desta conta */}
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

