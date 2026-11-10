import { KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react'

/**
 * Formulário de Acesso por PIN de Contingência Legado no Portal do Gestor.
 */
export default function PortalPinLegadoForm({
  pinLegado,
  setPinLegado,
  showPinLegado,
  setShowPinLegado,
  pinInputRef,
  enviando,
  onSubmit,
  onVoltarLogin,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Campo PIN */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-300 block">
          PIN Numérico da Empresa
        </label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={pinInputRef}
            type={showPinLegado ? 'text' : 'password'}
            value={pinLegado}
            onChange={(e) => setPinLegado(e.target.value)}
            placeholder="Ex: 1234"
            maxLength={10}
            required
            className="input-field pl-10 pr-10 text-sm text-center font-mono tracking-widest"
            disabled={enviando}
          />
          <button
            type="button"
            onClick={() => setShowPinLegado(!showPinLegado)}
            disabled={enviando}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
            title={showPinLegado ? 'Ocultar PIN' : 'Exibir PIN'}
            aria-label={showPinLegado ? 'Ocultar PIN' : 'Exibir PIN'}
          >
            {showPinLegado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Botão de Validação */}
      <button
        type="submit"
        disabled={enviando}
        className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {enviando ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Verificando PIN...</span>
          </>
        ) : (
          <>
            <span>Acessar via PIN</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Ação de Retorno */}
      <div className="text-center pt-2 text-xs">
        <button
          type="button"
          onClick={onVoltarLogin}
          disabled={enviando}
          className="text-brand-400 font-semibold hover:underline transition-colors disabled:opacity-50"
        >
          ← Voltar para o Login com E-mail
        </button>
      </div>
    </form>
  )
}

