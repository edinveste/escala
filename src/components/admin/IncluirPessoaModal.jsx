import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus, X } from 'lucide-react'
import { formatarNomeDia } from '../../lib/diasSemana'
import { supabase } from '../../lib/supabaseClient'

export default function IncluirPessoaModal({
  modalIncluirPessoa,
  onClose,
  empresaId,
  termos = {},
  onDataChanged,
  showToast,
}) {
  const [nomeCorretorManual, setNomeCorretorManual] = useState('')
  const [salvandoPessoa, setSalvandoPessoa] = useState(false)

  // Reseta input ao abrir novo modal
  useEffect(() => {
    if (modalIncluirPessoa) {
      setNomeCorretorManual('')
    }
  }, [modalIncluirPessoa])

  // Trata tecla Escape e trava scroll do body
  useEffect(() => {
    if (!modalIncluirPessoa) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvandoPessoa) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalIncluirPessoa, salvandoPessoa, onClose])

  const handleConfirmIncluirPessoa = async (e) => {
    if (e) e.preventDefault()
    if (!modalIncluirPessoa || !nomeCorretorManual.trim()) {
      showToast?.('Digite o nome do colaborador.', 'warning')
      return
    }

    setSalvandoPessoa(true)
    try {
      const { error } = await supabase.from('reservas').insert({
        turno_id: modalIncluirPessoa.turnoId,
        corretor_nome: nomeCorretorManual.trim(),
        device_id: 'admin_manual_' + Date.now(),
        ...(empresaId ? { empresa_id: empresaId } : {}),
      })

      if (error) throw error

      showToast?.(`"${nomeCorretorManual.trim()}" incluído com sucesso! ✅`, 'success')
      onClose()
      setNomeCorretorManual('')
      onDataChanged?.()
    } catch (err) {
      console.error('Erro ao incluir pessoa:', err)
      showToast?.('Erro ao incluir pessoa.', 'error')
    } finally {
      setSalvandoPessoa(false)
    }
  }

  if (!modalIncluirPessoa) return null

  const labelPessoa = termos.pessoa || 'Corretor'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !salvandoPessoa && onClose()}
      />

      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Incluir {labelPessoa} no Turno
              </h3>
              <p className="text-xs text-gray-400">
                <span className="text-brand-600 dark:text-brand-300 font-semibold">
                  {modalIncluirPessoa.pontoNome}
                </span>{' '}
                • {formatarNomeDia(modalIncluirPessoa.dia)} ({modalIncluirPessoa.horario})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !salvandoPessoa && onClose()}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
            disabled={salvandoPessoa}
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmIncluirPessoa} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              Nome do {labelPessoa}:
            </label>
            <input
              type="text"
              value={nomeCorretorManual}
              onChange={(e) => setNomeCorretorManual(e.target.value)}
              placeholder="Ex: Carlos Oliveira"
              className="input-field text-base font-medium"
              autoFocus
              required
            />
            <p className="text-[11px] text-gray-500 mt-1">
              O {labelPessoa.toLowerCase()} será adicionado imediatamente a este horário.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvandoPessoa}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoPessoa || !nomeCorretorManual.trim()}
              className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {salvandoPessoa ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Confirmar Inclusão
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

