import {
  Phone,
  Mail,
  MessageCircle,
  Smartphone,
  Pencil,
  UserCheck,
  UserX,
  Trash2,
} from 'lucide-react'
import { TIPOS_VALIDACAO } from '../../lib/validacaoHelper'

export default function EquipeMembroItem({
  colaborador,
  tipoValidacao,
  onEditar,
  onDesvincularAparelho,
  onToggleAtivo,
  onDelete,
}) {
  const digitsZap = (colaborador.whatsapp || '').replace(/\D/g, '')
  const waUrl = digitsZap ? `https://wa.me/55${digitsZap}` : null
  const emailPendente =
    (tipoValidacao === TIPOS_VALIDACAO.EMAIL || tipoValidacao === TIPOS_VALIDACAO.AMBOS) &&
    !colaborador.email

  return (
    <div
      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all ${
        colaborador.ativo !== false
          ? 'bg-surface-750/70 border-surface-650 hover:border-surface-600'
          : 'bg-surface-900/40 border-surface-800 opacity-60'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border ${
            colaborador.ativo !== false
              ? 'bg-brand-500/10 text-brand-300 border-brand-500/20'
              : 'bg-surface-800 text-gray-500 border-surface-700'
          }`}
        >
          {colaborador.nome.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-semibold text-gray-100 truncate">
              {colaborador.nome}
            </p>
            {colaborador.ativo === false && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                Inativo
              </span>
            )}
            {colaborador.device_id && (
              <span
                className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 font-medium inline-flex items-center gap-0.5"
                title="Aparelho celular vinculado. Apenas o dispositivo deste colaborador tem permissão para reservar ou cancelar suas vagas."
              >
                <Smartphone className="w-2.5 h-2.5 text-brand-400" />
                Celular vinculado
              </span>
            )}
            {emailPendente && (
              <button
                type="button"
                onClick={() => onEditar(colaborador)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-400/50 font-medium transition-all flex items-center gap-1 cursor-pointer"
                title="Clique para cadastrar o e-mail deste colaborador"
              >
                <Pencil className="w-2.5 h-2.5" />
                E-mail pendente
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 flex-wrap">
            {colaborador.whatsapp && (
              <div className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-gray-500" />
                <span>{colaborador.whatsapp}</span>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 ml-0.5"
                    title="Conversar no WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {colaborador.email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-500" />
                <a
                  href={`mailto:${colaborador.email}`}
                  className="text-gray-300 hover:text-brand-300 truncate max-w-[170px]"
                  title={`Enviar e-mail para ${colaborador.email}`}
                >
                  {colaborador.email}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Botão de Editar */}
        <button
          type="button"
          onClick={() => onEditar(colaborador)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
          title="Editar colaborador (nome, WhatsApp, e-mail)"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Botão de Desvincular Aparelho Celular */}
        {colaborador.device_id && (
          <button
            type="button"
            onClick={() => onDesvincularAparelho(colaborador)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
            title="Desvincular aparelho celular (liberar para novo aparelho)"
          >
            <Smartphone className="w-4 h-4 text-brand-400" />
          </button>
        )}

        {/* Botão de Alternar Ativo/Inativo */}
        <button
          type="button"
          onClick={() => onToggleAtivo(colaborador)}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            colaborador.ativo !== false
              ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
          }`}
          title={
            colaborador.ativo !== false
              ? 'Desativar colaborador (não poderá reservar)'
              : 'Reativar colaborador na equipe'
          }
        >
          {colaborador.ativo !== false ? (
            <UserCheck className="w-4 h-4" />
          ) : (
            <UserX className="w-4 h-4" />
          )}
        </button>

        {/* Botão de Excluir */}
        <button
          type="button"
          onClick={() => onDelete(colaborador)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Excluir colaborador da equipe"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

