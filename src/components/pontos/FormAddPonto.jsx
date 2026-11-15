import { useState } from 'react'
import { Plus } from 'lucide-react'
import GoogleMapsIcon from '../icons/GoogleMapsIcon'
import EnderecoAutocompleteInput from './EnderecoAutocompleteInput'
import { obterLinkGoogleMaps } from '../../lib/mapsHelper'

export default function FormAddPonto({ onAdd, isAdding, termos = {} }) {
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nome.trim() || isAdding) return

    const sucesso = await onAdd(nome, endereco)
    if (sucesso) {
      setNome('')
      setEndereco('')
    }
  }

  const placeholderTexto = `Nome d${termos.artigoPonto || 'o'} ${
    termos.ponto?.toLowerCase() || 'ponto'
  } (ex: Loja Centro, Ala A, Stand Sul)`

  const mapsPreviewUrl = obterLinkGoogleMaps(endereco)

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 mb-4 p-3.5 rounded-2xl bg-surface-700/30 border border-surface-600/40"
    >
      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1">
          Nome d{termos.artigoPonto || 'o'} {termos.ponto || 'Ponto'} *
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={placeholderTexto}
          className="input-field w-full text-sm"
          maxLength={100}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-300">
            Endereço ou Link do Google Maps{' '}
            <span className="text-gray-500 font-normal">(Opcional)</span>
          </label>
          {mapsPreviewUrl && (
            <a
              href={mapsPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-brand-400 hover:text-brand-300 inline-flex items-center gap-1.5 transition-colors"
            >
              <GoogleMapsIcon className="w-3.5 h-3.5" />
              Testar no Maps
            </a>
          )}
        </div>
        <EnderecoAutocompleteInput
          value={endereco}
          onChange={setEndereco}
          placeholder="Ex: Av. Paulista, 1000 ou Shopping Morumbi"
          maxLength={250}
        />
        <p className="text-[11px] text-gray-500 mt-1">
          💡 Quando preenchido, os corretores poderão abrir o local com um clique no Google Maps.
        </p>
      </div>

      <button
        type="submit"
        disabled={isAdding || !nome.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5 mt-1"
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
