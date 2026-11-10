import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'

export default function EquipeHeader({
  exigirCadastro,
  totalAtivos,
  alterandoExigir,
  isFullAdmin,
  onToggleExigir,
  isExpanded,
  onToggleExpand,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Identidade: Título, badges e descrição */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`p-2.5 rounded-xl border flex-shrink-0 transition-colors ${
            exigirCadastro
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-surface-700/80 border-surface-600 text-gray-400'
          }`}
        >
          {exigirCadastro ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <ShieldAlert className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-gray-100">
              Proteção Contra Invasores
            </h2>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                exigirCadastro
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-surface-700 text-gray-400 border-surface-600'
              }`}
            >
              {exigirCadastro ? 'Ativada (Restrito)' : 'Desativada (Aberto)'}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {totalAtivos} {totalAtivos === 1 ? 'autorizado' : 'autorizados'}
            </span>
          </div>
        </div>
      </div>

      {/* Controles: Switch de Ativação + Seta Sanfona */}
      <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
        {/* Switch Toggle */}
        <button
          type="button"
          disabled={alterandoExigir || !isFullAdmin}
          onClick={onToggleExigir}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            exigirCadastro ? 'bg-emerald-500' : 'bg-surface-600'
          } ${!isFullAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={
            !isFullAdmin
              ? 'Apenas administradores podem alternar esta chave'
              : exigirCadastro
              ? 'Clique para desativar proteção (abrir reservas a todos)'
              : 'Clique para ativar proteção (restringir à equipe cadastrada)'
          }
          role="switch"
          aria-checked={exigirCadastro}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              exigirCadastro ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        {/* Seta de Efeito Sanfona */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 self-end sm:self-center bg-surface-700/60 hover:bg-surface-700 px-2.5 py-1.5 rounded-lg border border-surface-600/50 transition-colors text-left"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex flex-col leading-tight">
                <span>Recolher</span>
                <span>Equipe</span>
              </span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex flex-col leading-tight">
                <span>Gerenciar</span>
                <span>Equipe</span>
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

