import { Info } from 'lucide-react'

/**
 * Card informativo explicativo do modelo de controle de acesso (RBAC).
 * Adapta dinamicamente o vocabulário conforme o nicho da empresa (termos).
 */
export default function GestoresInfoCard({ termos = {} }) {
  const labelPessoas = termos?.pessoas ? termos.pessoas.toLowerCase() : 'participantes'
  const labelPontos = termos?.pontos ? termos.pontos.toLowerCase() : 'locais'

  return (
    <div className="p-3 rounded-xl bg-surface-800/80 border border-surface-700/70 flex items-start gap-2.5 text-xs text-gray-300">
      <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
      <div className="space-y-1 leading-relaxed">
        <p>
          <strong className="text-gray-100">Coordenador / Gestor da Escala:</strong> pode incluir e remover {labelPessoas} dos horários e acompanhar vagas, mas <em>não pode excluir {labelPontos} nem alterar configurações globais</em>.
        </p>
        <p>
          <strong className="text-gray-100">Administrador:</strong> possui permissão irrestrita (criação e exclusão de {labelPontos}, senhas e gestão de equipe).
        </p>
      </div>
    </div>
  )
}

