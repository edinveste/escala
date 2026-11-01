import { useState, useRef, useEffect } from 'react'
import { UserCircle, X } from 'lucide-react'

export default function NomeModal({ onConfirm, onClose }) {
  const [nome, setNome] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    // Auto-focus no input
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = nome.trim()
    if (trimmed.length < 2) return
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up shadow-2xl">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-surface-700 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Ícone */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20">
            <UserCircle className="w-8 h-8 text-brand-400" />
          </div>
        </div>

        {/* Título */}
        <h2 className="text-xl font-bold text-center text-gray-100 mb-1">
          Como você se chama?
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Seu nome ficará visível na escala para os colegas.
        </p>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Maria Silva"
            className="input-field text-center text-lg"
            maxLength={50}
            autoComplete="name"
          />

          <button
            type="submit"
            disabled={nome.trim().length < 2}
            className="btn-primary w-full"
          >
            Confirmar
          </button>
        </form>
      </div>
    </div>
  )
}

