import { Copy, ClipboardCheck } from 'lucide-react'

/**
 * Barra inferior fixa com botão para copiar a escala para o WhatsApp.
 * Inclui espaçador para evitar que o conteúdo da página fique oculto atrás do rodapé.
 */
export default function CorretorCopyFooter({
  onCopiar,
  copied = false,
  pontoNome = null,
}) {
  const label = pontoNome
    ? `Copiar Escala — ${pontoNome}`
    : 'Copiar Escala Completa (WhatsApp)'

  return (
    <>
      {/* Espaçador para visualização completa acima do rodapé fixo */}
      <div className="h-28 sm:h-36 w-full pointer-events-none" aria-hidden="true" />

      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-surface-900 border-t border-surface-700 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-3">
          <button
            type="button"
            onClick={onCopiar}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 min-h-[48px] select-none ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-surface-700 hover:bg-surface-600 text-gray-300'
            }`}
          >
            {copied ? (
              <>
                <ClipboardCheck className="w-5 h-5" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                {label}
              </>
            )}
          </button>
        </div>
      </footer>
    </>
  )
}

