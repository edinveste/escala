import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import { Key, Lock, X, CheckCircle2, ShieldAlert } from 'lucide-react'
import InputSenhaPin from './InputSenhaPin'

export default function AlterarSenhaModal({ isOpen, onClose, showToast, empresaId }) {
  const [pinAtual, setPinAtual] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setPinAtual('')
      setNovoPin('')
      setConfirmarPin('')
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvando) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, salvando, onClose])

  if (!isOpen) return null

  const handleSalvar = async (e) => {
    if (e) e.preventDefault()

    const atual = pinAtual.trim()
    const novo = novoPin.trim()
    const confirmacao = confirmarPin.trim()

    if (!atual) {
      showToast?.('Digite a senha atual.', 'warning')
      return
    }

    if (novo.length < 4) {
      showToast?.('A nova senha deve ter no mínimo 4 dígitos/caracteres.', 'warning')
      return
    }

    if (novo === atual) {
      showToast?.('A nova senha deve ser diferente da senha atual.', 'warning')
      return
    }

    if (novo !== confirmacao) {
      showToast?.('A confirmação da senha não coincide com a nova senha.', 'error')
      return
    }

    setSalvando(true)
    try {
      // 1. Tentar alterar pela RPC multi-tenant se empresaId estiver disponível
      if (empresaId) {
        const { data: sucessoRpc, error: rpcError } = await supabase.rpc('alterar_admin_pin', {
          p_empresa_id: empresaId,
          p_pin_atual: atual,
          p_novo_pin: novo,
        })

        if (!rpcError && typeof sucessoRpc === 'boolean') {
          if (sucessoRpc) {
            showToast?.('Senha administrativa alterada com sucesso! Guarde a nova senha. 🔐', 'success')
            onClose()
            return
          } else {
            showToast?.('A senha atual está incorreta. Tente novamente.', 'error')
            return
          }
        }
      }

      // 2. Tentar alterar pela RPC legada
      const { data: sucessoLegacy, error: rpcLegacyError } = await supabase.rpc('alterar_admin_pin', {
        p_pin_atual: atual,
        p_novo_pin: novo,
      })

      if (!rpcLegacyError && typeof sucessoLegacy === 'boolean') {
        if (sucessoLegacy) {
          showToast?.('Senha alterada com sucesso! Guarde a nova senha. 🔐', 'success')
          onClose()
          return
        } else {
          showToast?.('A senha atual está incorreta. Tente novamente.', 'error')
          return
        }
      }

      // 3. Fallback na tabela empresas
      if (empresaId) {
        const { data: empresaAtual, error: errEmpSelect } = await supabase
          .from('empresas')
          .select('admin_pin')
          .eq('id', empresaId)
          .single()

        if (!errEmpSelect && empresaAtual) {
          if (empresaAtual.admin_pin !== atual) {
            showToast?.('A senha atual está incorreta.', 'error')
            return
          }

          const { error: errEmpUpdate } = await supabase
            .from('empresas')
            .update({ admin_pin: novo })
            .eq('id', empresaId)

          if (errEmpUpdate) throw errEmpUpdate

          showToast?.('Senha alterada com sucesso! 🔐', 'success')
          onClose()
          return
        }
      }

      // 4. Fallback caso a RPC ainda não esteja instalada no banco (tabela config legada)
      const { data: configAtual, error: errSelect } = await supabase
        .from('config')
        .select('admin_pin')
        .eq('id', 1)
        .single()

      if (errSelect) throw errSelect

      if (configAtual.admin_pin !== atual) {
        showToast?.('A senha atual está incorreta.', 'error')
        return
      }

      const { error: errUpdate } = await supabase
        .from('config')
        .update({ admin_pin: novo })
        .eq('id', 1)

      if (errUpdate) throw errUpdate

      showToast?.('Senha alterada com sucesso! 🔐', 'success')
      onClose()
    } catch (err) {
      console.error('Erro ao alterar senha:', err)
      showToast?.('Erro ao atualizar senha no banco. Verifique as permissões.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !salvando && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Alterar Senha do Admin
              </h3>
              <p className="text-xs text-gray-400">
                Defina uma nova senha ou PIN de acesso para a administração
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dica de Segurança */}
        <div className="mb-4 p-3 rounded-xl bg-surface-700/50 border border-surface-600 text-xs text-gray-300 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-300">Recomendação de Segurança:</p>
            <p className="text-gray-400 mt-0.5">
              Utilize uma senha com <strong className="text-gray-200">8 dígitos</strong> para proteger o painel contra tentativas de adivinhação.
            </p>
          </div>
        </div>

        <form onSubmit={handleSalvar} className="space-y-3.5">
          {/* Senha Atual */}
          <InputSenhaPin
            label="Senha Atual:"
            value={pinAtual}
            onChange={(e) => setPinAtual(e.target.value)}
            placeholder="Digite a senha atual"
            required
            disabled={salvando}
            autoFocus
          />

          {/* Nova Senha */}
          <InputSenhaPin
            label="Nova Senha:"
            value={novoPin}
            onChange={(e) => setNovoPin(e.target.value)}
            placeholder="Mínimo 4 dígitos (ex: 8 dígitos)"
            required
            disabled={salvando}
          >
            {novoPin.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                <span
                  className={
                    novoPin.length >= 8
                      ? 'text-emerald-400 font-semibold'
                      : novoPin.length >= 4
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }
                >
                  {novoPin.length < 4
                    ? `Faltam ${4 - novoPin.length} dígito(s) para o mínimo`
                    : novoPin.length >= 8
                    ? '✨ Senha forte (8 dígitos)'
                    : `Aceita (${novoPin.length} dígitos), mas 8 dígitos é mais seguro`}
                </span>
              </div>
            )}
          </InputSenhaPin>

          {/* Confirmar Nova Senha */}
          <InputSenhaPin
            label="Confirmar Nova Senha:"
            value={confirmarPin}
            onChange={(e) => setConfirmarPin(e.target.value)}
            placeholder="Repita a nova senha"
            required
            disabled={salvando}
          >
            {confirmarPin.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                {novoPin === confirmarPin ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">As senhas coincidem</span>
                  </>
                ) : (
                  <span className="text-red-400">As senhas não coincidem</span>
                )}
              </div>
            )}
          </InputSenhaPin>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !pinAtual || novoPin.length < 4 || novoPin !== confirmarPin}
              className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Salvar Nova Senha
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

