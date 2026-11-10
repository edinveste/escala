import { Search } from 'lucide-react'
import EquipeMembroItem from './EquipeMembroItem'

export default function EquipeList({
  equipeFiltrada = [],
  totalMembros = 0,
  loading = false,
  busca = '',
  onBuscaChange,
  termos = {},
  tipoValidacao,
  onEditar,
  onDesvincularAparelho,
  onToggleAtivo,
  onDelete,
}) {
  return (
    <div className="space-y-2.5 pt-1">
      {/* Barra de Busca quando houver mais de 3 membros */}
      {totalMembros > 3 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou e-mail..."
            className="w-full bg-surface-900 border border-surface-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      )}

      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando equipe...</p>
        </div>
      ) : equipeFiltrada.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400 italic bg-surface-900/40 rounded-xl border border-surface-700/50">
          {busca.trim()
            ? `Nenhum ${termos?.pessoa?.toLowerCase() || 'colaborador'} encontrado para a busca informada.`
            : `Nenhum ${termos?.pessoa?.toLowerCase() || 'colaborador'} cadastrado na equipe autorizada ainda.`}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {equipeFiltrada.map((colaborador) => (
            <EquipeMembroItem
              key={colaborador.id}
              colaborador={colaborador}
              tipoValidacao={tipoValidacao}
              onEditar={onEditar}
              onDesvincularAparelho={onDesvincularAparelho}
              onToggleAtivo={onToggleAtivo}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

