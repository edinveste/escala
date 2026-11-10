import { ShieldCheck, ShieldAlert } from 'lucide-react'

export default function EquipeStatusBanner({ exigirCadastro, termos = {} }) {
  return (
    <div
      className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-colors ${
        exigirCadastro
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : 'bg-surface-800/80 border-surface-700/70 text-gray-300'
      }`}
    >
      {exigirCadastro ? (
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
      ) : (
        <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      )}
      <div className="space-y-0.5 leading-relaxed">
        <p>
          <strong className={exigirCadastro ? 'text-emerald-200' : 'text-gray-100'}>
            {exigirCadastro
              ? 'Proteção Ativada (Acesso Restrito):'
              : 'Proteção Desativada (Acesso Livre):'}
          </strong>{' '}
          {exigirCadastro
            ? `Apenas ${termos.pessoas?.toLowerCase() || 'colaboradores'} cadastrados e com status ativo nesta lista conseguem garantir vagas na escala.`
            : 'Qualquer pessoa com o link público pode reservar vagas normalmente. Cadastre a equipe abaixo e ative a chave no topo quando desejar bloquear invasores.'}
        </p>
      </div>
    </div>
  )
}

