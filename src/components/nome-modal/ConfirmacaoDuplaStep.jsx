import { useEffect } from 'react'
import {
  UserCheck,
  User,
  Phone,
  Mail,
  AlertTriangle,
  Check,
  ArrowLeft,
} from 'lucide-react'

/**
 * Etapa 2 do NomeModal:
 * Confirmação dupla antes de fixar definitivamente os dados de identificação no aparelho.
 * Exibe o resumo do nome, WhatsApp/e-mail (se exigidos) e alerta sobre restrição de alteração.
 */
export default function ConfirmacaoDuplaStep({
  nomeExibicao,
  precisaZap = false,
  whatsapp = '',
  precisaEmail = false,
  email = '',
  termos = {},
  hasPendingTurno = true,
  onConfirm,
  onBack,
}) {
  // Atalho de teclado Enter para confirmar diretamente quando nesta etapa
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onConfirm])

  return (
    <div className="animate-fade-in">
      {/* Ícone */}
      <div className="flex justify-center mb-3">
        <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
          <UserCheck className="w-8 h-8" />
        </div>
      </div>

      {/* Título */}
      <h2 className="text-xl font-bold text-center text-gray-100 mb-1">
        Confirmar Nome
      </h2>
      <p className="text-xs text-gray-400 text-center mb-4 max-w-xs mx-auto">
        Verifique atentamente seu nome antes de fixá-lo neste aparelho.
      </p>

      {/* Cartão de Exibição dos Dados Informados */}
      <div className="p-4 rounded-2xl bg-surface-900 border border-surface-700/80 space-y-2 mb-4">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
          Nome d{termos.artigoPessoa || 'o'} {termos.pessoa || 'Colaborador(a)'}:
        </span>
        <p className="text-lg font-bold text-gray-100 flex items-center gap-2">
          <User className="w-5 h-5 text-brand-400 shrink-0" />
          <span className="break-words">{nomeExibicao}</span>
        </p>

        {precisaZap && whatsapp && (
          <div className="pt-2 border-t border-surface-800 flex items-center gap-2 text-xs text-gray-300">
            <Phone className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            <span className="font-mono">{whatsapp}</span>
          </div>
        )}

        {precisaEmail && email && (
          <div className="pt-2 border-t border-surface-800 flex items-center gap-2 text-xs text-gray-300">
            <Mail className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            <span className="font-mono lowercase">{email}</span>
          </div>
        )}
      </div>

      {/* Alerta de Fixação Permanente (Exclusivo para Gestor alterar) */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2.5 mb-5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <p className="font-bold text-amber-300">Atenção: Fixação no Aparelho</p>
          <p className="mt-1 text-amber-200/90 text-[11px]">
            Este nome ficará gravado no seu aparelho para todas as reservas e <strong>não poderá ser alterado por aqui</strong>.
          </p>
          <p className="mt-1 text-amber-300/85 text-[11px]">
            Caso precise corrigir ou alterar futuramente, será necessário solicitar diretamente ao seu <strong>gestor</strong>.
          </p>
        </div>
      </div>

      {/* Ações de Confirmação Dupla */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onConfirm}
          className="btn-primary w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-98 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>{hasPendingTurno ? 'Sim, confirmar e garantir vaga' : 'Sim, confirmar e fixar meu nome'}</span>
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-2.5 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-surface-700/50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Não, quero corrigir meu nome</span>
        </button>
      </div>
    </div>
  )
}

