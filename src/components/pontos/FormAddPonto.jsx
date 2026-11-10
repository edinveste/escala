import { useState } from 'react'
import { Plus } from 'lucide-react'

export default function FormAddPonto({ onAdd, isAdding, termos = {} }) {
  const [nome, setNome] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nome.trim() || isAdding) return

    const sucesso = await onAdd(nome)
    if (sucesso) {
      setNome('')
    }
  }

  const placeholderTexto = `Nome d${termos.artigoPonto || 'o'} ${
    termos.ponto?.toLowerCase() || 'ponto'
  } (ex: Loja Centro, Ala A, Stand Sul)`

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mb-4">
      <div>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={placeholderTexto}
          className="input-field w-full text-sm"
          maxLength={100}
        />
      </div>
      <button
        type="submit"
        disabled={isAdding || !nome.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5"
      >
        {isAdding ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Criar {termos.ponto || 'Ponto de Captação'}
          </>
        )}
      </button>
    </form>
  )
}

