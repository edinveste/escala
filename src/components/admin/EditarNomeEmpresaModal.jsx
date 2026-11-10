import { useState, useEffect, useRef } from 'react'
import { Building2, X, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

/**
 * Modal para edição do Nome Oficial da Empresa / Imobiliária.
 * Permite ao gestor alterar o nome cadastrado no banco de dados,
 * propagando a alteração em tempo real para mensagens de WhatsApp, links e cabeçalho.
 */
export default function EditarNomeEmpresaModal({
  isOpen,
  onClose,
  empresa,
  onEmpresaUpdated,
  showToast,
}) {
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setNome(empresa?.nome || '')
      setErroMsg('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, empresa?.nome])

  if (!isOpen) return null

  const handleSalvar = async (e) => {
    if (e) e.preventDefault()
    const nomeLimpo = nome.trim()

    if (!nomeLimpo) {
      setErroMsg('Por favor, digite o nome da empresa.')
      inputRef.current?.focus()
      return
    }

    if (nomeLimpo.length < 2) {
      setErroMsg('O nome deve ter no mínimo 2 caracteres.')
      inputRef.current?.focus()
      return
    }

    if (nomeLimpo === empresa?.nome) {
      onClose()
      return
    }

    setSalvando(true)
    setErroMsg('')

    try {
      const { error } = await supabase
        .from('empresas')
        .update({ nome: nomeLimpo })
        .eq('id', empresa.id)

      if (error) throw error

      showToast?.(`Nome da empresa atualizado para "${nomeLimpo}" com sucesso! 🏢`, 'success')
      onEmpresaUpdated?.()
      onClose()
    } catch (err) {
      console.error('Erro ao atualizar nome da empresa:', err)
      setErroMsg('Erro ao salvar o nome da empresa. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onClose()
      }}
    >
      <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
        {/* Cabeçalho do Modal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Nome da Empresa</h2>
              <p className="text-xs text-gray-400">
                Altere o nome oficial exibido na escala e nas mensagens
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSalvar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Nome da Imobiliária / Organização
            </label>
            <input
              ref={inputRef}
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (erroMsg) setErroMsg('')
              }}
              maxLength={80}
              placeholder="Ex: Minha Imobiliária, Remax Prime, Direcional..."
              disabled={salvando}
              className="w-full px-4 py-2.5 bg-surface-900 border border-surface-600 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all disabled:opacity-50"
            />
            {erroMsg && <p className="text-xs text-red-400 mt-1.5">{erroMsg}</p>}
            <p className="text-[11px] text-gray-500 mt-1.5">
              💡 Este nome é exibido no topo da escala pública, nos avisos de WhatsApp gerados pelo
              sistema e na identificação do seu ambiente.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 rounded-xl hover:bg-surface-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !nome.trim()}
              className="btn-primary py-2 px-5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar Nome
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

