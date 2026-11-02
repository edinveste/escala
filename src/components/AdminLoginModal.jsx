import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Shield, Eye, EyeOff, Lock, X } from 'lucide-react'

export default function AdminLoginModal({ isOpen, onClose, onSuccess, showToast }) {
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setPin('')
      setShowPin(false)
      setVerificando(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleVerificar = async (e) => {
    if (e) e.preventDefault()
    const pinLimpo = pin.trim()
    if (!pinLimpo) {
      showToast('Digite o PIN de administrador.', 'warning')
      return
    }

    setVerificando(true)
    try {
      // 1. Tentar via RPC segura primeiro
      const { data: rpcValido, error: rpcError } = await supabase.rpc('verificar_admin_pin', {
        p_pin: pinLimpo,
      })

      if (!rpcError && typeof rpcValido === 'boolean') {
        if (rpcValido) {
          onSuccess()
          showToast('Acesso de administrador concedido! 🛡️', 'success')
          onClose()
        } else {
          showToast('PIN incorreto! Tente novamente.', 'error')
          setPin('')
          inputRef.current?.focus()
        }
        return
      }

      // 2. Fallback caso a RPC ainda não tenha sido executada no banco
      const { data, error } = await supabase
        .from('config')
        .select('admin_pin')
        .eq('id', 1)
        .single()

      if (error) throw error

      if (data?.admin_pin === pinLimpo) {
        onSuccess()
        showToast('Acesso de administrador concedido! 🛡️', 'success')
        onClose()
      } else {
        showToast('PIN incorreto! Tente novamente.', 'error')
        setPin('')
        inputRef.current?.focus()
      }
    } catch (err) {
      console.error('Erro ao verificar PIN:', err)
      showToast('Erro ao validar PIN. Verifique a conexão.', 'error')
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !verificando && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-surface-800 border border-surface-600 rounded-2xl p-6 shadow-2xl animate-scale-up z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Acesso de Administrador
              </h3>
              <p className="text-xs text-gray-400">
                Digite o PIN para gerenciar a escala
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={verificando}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleVerificar} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              PIN de Acesso:
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Digite seu PIN"
                className="input-field pr-12 text-center text-lg tracking-widest font-mono placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-gray-500"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-1"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={verificando}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={verificando || !pin.trim()}
              className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
            >
              {verificando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Entrar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

