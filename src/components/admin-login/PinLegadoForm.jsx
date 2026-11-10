import { useState, useRef, useEffect } from 'react'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { validarOuVincularPinEmpresa } from './adminAuthHelper'

/**
 * Formulário de contingência para validação via PIN Legado da Empresa.
 */
export default function PinLegadoForm({
  targetEmpresaId,
  user,
  refreshAuth,
  onSuccess,
  onClose,
  showToast,
  setErroMsg,
  setSucessoMsg,
  onVoltarLogin,
}) {
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const pinInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      pinInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    const pinLimpo = pin.trim()
    if (!pinLimpo) {
      setErroMsg('Digite o PIN de administrador.')
      return
    }

    setEnviando(true)
    try {
      const res = await validarOuVincularPinEmpresa({
        empresaId: targetEmpresaId,
        pin: pinLimpo,
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
        setPin('')
        pinInputRef.current?.focus()
      }
    } catch (err) {
      console.error('Erro ao verificar PIN legado:', err)
      setErroMsg('Erro ao verificar PIN.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-gray-300">
            PIN de Acesso da Empresa
          </label>
          <span className="text-[10px] text-gray-500">Padrão inicial: 1234</span>
        </div>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={pinInputRef}
            type={showPin ? 'text' : 'password'}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Digite o PIN"
            disabled={enviando}
            className="w-full bg-surface-900 border border-surface-600 rounded-2xl pl-10 pr-11 py-3 text-sm text-gray-100 placeholder-gray-500 tracking-wider focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50"
            required
          />
          <button
            type="button"
            onClick={() => setShowPin((prev) => !prev)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label={showPin ? 'Ocultar PIN' : 'Exibir PIN'}
          >
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="w-full btn-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.99] disabled:opacity-50 transition-all"
      >
        {enviando ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Validando PIN...</span>
          </>
        ) : (
          <span>Validar PIN</span>
        )}
      </button>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onVoltarLogin}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Voltar para <strong className="text-brand-400 font-semibold">Login com E-mail</strong>
        </button>
      </div>
    </form>
  )
}

