import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, AlertTriangle, Info, X } from 'lucide-react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [modalConfig, setModalConfig] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setModalConfig(options || {})
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true)
      resolverRef.current = null
    }
    setModalConfig(null)
  }, [])

  const handleCancel = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
    setModalConfig(null)
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalConfig && (
        <ConfirmModal
          isOpen={true}
          title={modalConfig.title || 'Apagar?'}
          message={modalConfig.message || 'Tem certeza que deseja apagar?'}
          confirmText={modalConfig.confirmText || 'Apagar tudo'}
          cancelText={modalConfig.cancelText || 'Cancelar'}
          badge={modalConfig.badge}
          variant={modalConfig.variant || 'danger'}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider')
  }
  return context.confirm
}

export default function ConfirmModal({
  isOpen = true,
  title = 'Apagar?',
  message = 'Tem certeza que deseja apagar?',
  confirmText = 'Apagar tudo',
  cancelText = 'Cancelar',
  badge = null,
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Previne rolagem do body quando o modal estiver aberto
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Foca o botão de confirmação
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus()
    }, 50)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  // Configurações por variante (danger, warning, info)
  const variantConfig = {
    danger: {
      icon: Trash2,
      iconColor: 'text-red-500',
      badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20',
      btnClass: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-600/25 focus:ring-red-400',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      btnClass: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-lg shadow-amber-600/25 focus:ring-amber-400',
    },
    info: {
      icon: Info,
      iconColor: 'text-brand-400',
      badgeClass: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
      btnClass: 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-lg shadow-brand-600/25 focus:ring-brand-400',
    },
  }

  const currentVariant = variantConfig[variant] || variantConfig.danger
  const IconComponent = currentVariant.icon

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-surface-800 border border-surface-600 rounded-2xl shadow-2xl overflow-hidden animate-scale-in text-gray-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <div className="flex items-center gap-2.5 min-w-0">
            <IconComponent className={`w-5 h-5 flex-shrink-0 ${currentVariant.iconColor}`} />
            <h3 id="confirm-modal-title" className="text-base font-bold text-gray-100 truncate">
              {title}
            </h3>
            {badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${currentVariant.badgeClass}`}>
                {badge}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors ml-2 flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com a mensagem */}
        <div className="px-5 py-4 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
          {message}
        </div>

        {/* Rodapé com botões Cancelar e Ação */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-surface-800/80 border-t border-surface-700/60">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-surface-700 active:bg-surface-600 transition-colors min-h-[44px]"
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] flex items-center justify-center gap-2 select-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-800 ${currentVariant.btnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

