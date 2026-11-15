import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, Check, Loader2, AlertCircle } from 'lucide-react'

/**
 * Modal para o gestor alterar o nome de um colaborador na escala ativa.
 * Atualiza todas as reservas desse colaborador e opcionalmente sincroniza na equipe autorizada.
 */
export default function EditarNomeEscalaModal({
  isOpen,
  colaborador,
  onClose,
  onSalvar,
  salvando,
  termos = {},
}) {
  const [novoNome, setNovoNome] = useState('')
  const [sincronizarEquipe, setSincronizarEquipe] = useState(true)
  const inputRef = useRef(null)

  const rotuloPessoa = termos.pessoa || 'Colaborador(a)'

  // Inicializa o valor do input sempre que abrir o modal
  useEffect(() => {
    if (isOpen && colaborador) {
      setNovoNome(colaborador.nome || '')
      setSincronizarEquipe(true)
      // Foco automático no input
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen, colaborador])

  // Trata tecla Escape e trava scroll da página
  useEffect(() => {
    if (!isOpen) return
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

  if (!isOpen || !colaborador) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (salvando) return

    const sucesso = await onSalvar(colaborador, novoNome, sincronizarEquipe)
    if (sucesso) {
      onClose()
    }
  }

  const totalTurnos = colaborador.turnos?.length || 0

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-editar-nome-titulo"
    >
      <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700 bg-surface-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="modal-editar-nome-titulo"
                className="text-base font-bold text-gray-100"
              >
                Alterar Nome na Escala
              </h3>
              <p className="text-xs text-gray-400">
                {rotuloPessoa}: <span className="text-gray-200 font-medium">{colaborador.nome}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700/60 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label
              htmlFor="input-novo-nome-escala"
              className="block text-xs font-semibold text-gray-300 mb-1.5"
            >
              Novo Nome Completo *
            </label>
            <input
              id="input-novo-nome-escala"
              ref={inputRef}
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo da Silva"
              required
              disabled={salvando}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-700 text-gray-100 placeholder-surface-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            />
          </div>

          {/* Banner Informativo de Impacto */}
          <div className="p-3 rounded-xl bg-brand-500/5 border border-brand-500/20 text-xs text-surface-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-brand-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Atualização em Lote</span>
            </div>
            <p>
              Este colaborador possui{' '}
              <strong className="text-brand-300 font-bold">
                {totalTurnos} {totalTurnos === 1 ? 'horário' : 'horários'}
              </strong>{' '}
              agendados na escala ativa. O nome será atualizado em todos eles imediatamente.
            </p>
          </div>

          {/* Checkbox Sincronizar Equipe Autorizada */}
          <label className="flex items-start gap-2.5 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sincronizarEquipe}
              onChange={(e) => setSincronizarEquipe(e.target.checked)}
              disabled={salvando}
              className="mt-0.5 w-4 h-4 rounded bg-surface-900 border-surface-600 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 focus:ring-offset-surface-800"
            />
            <span>
              Atualizar também na lista de equipe autorizada caso este colaborador
              possua cadastro prévio.
            </span>
          </label>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-surface-700/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !novoNome.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors shadow-lg shadow-brand-500/20"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
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
