import { useState } from 'react'
import {
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  KeyRound,
  Crown,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

export default function TenantBlockedView({ onOpenAdminLogin, onOpenSuperadmin }) {
  const { empresa, switchTenant } = useTenant()
  const { user, isSuperadmin, canManageEmpresa } = useAuth()

  const isGestorDestaEmpresa = Boolean(user && empresa?.id && canManageEmpresa(empresa.id))

  // Link de suporte para regularização
  const handleContatarSuporte = () => {
    const texto = encodeURIComponent(
      `Olá! Sou da imobiliária "${empresa?.nome || ''}" (slug: ${empresa?.slug || ''}) e gostaria de regularizar a assinatura do EscalaFácil.`
    )
    window.open(`https://wa.me/5511999999999?text=${texto}`, '_blank')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
      <div className="w-full max-w-md bg-surface-800 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-scale-in">
        {/* Ícone de Alerta */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Informações da Empresa */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
            Acesso Temporariamente Suspenso
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mt-3 truncate">
            {empresa?.nome || 'Imobiliária'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            A escala de plantões e captação desta imobiliária está temporariamente indisponível.
          </p>
        </div>

        {/* Mensagem Contextual para Corretores */}
        <div className="p-3.5 rounded-2xl bg-surface-900/80 border border-surface-700/60 text-left text-xs space-y-1.5">
          <p className="font-semibold text-gray-300">
            📌 Informação aos corretores:
          </p>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            As vagas e turnos estão pausados no momento. Por favor, entre em contato com a coordenação ou diretoria da sua imobiliária para liberação da escala.
          </p>
        </div>

        {/* Ações para Gestores ou Superadmin */}
        <div className="space-y-2.5 pt-1">
          {/* Se for Superadmin */}
          {isSuperadmin && (
            <button
              onClick={onOpenSuperadmin}
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              Painel Superadmin (Reativar Imobiliária)
            </button>
          )}

          {/* Botão de regularização para Gestor conectado */}
          {isGestorDestaEmpresa ? (
            <button
              onClick={handleContatarSuporte}
              className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
            >
              <MessageCircle className="w-4 h-4" />
              Regularizar Assinatura via Suporte
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          ) : (
            /* Botão de login para o gestor acessar e ver a situação */
            <button
              onClick={onOpenAdminLogin}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-gray-300 bg-surface-700/60 hover:bg-surface-700 border border-surface-600 transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-gray-400" />
              Sou o Gestor desta Imobiliária
            </button>
          )}

          {/* Alternar para empresa Demo */}
          <button
            onClick={() => switchTenant('demo')}
            className="w-full btn-ghost py-2.5 text-xs text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1.5"
          >
            Acessar Imobiliária de Demonstração
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rodapé */}
        <div className="pt-3 border-t border-surface-700/60 text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-brand-400" />
          EscalaFácil • Gestão Inteligente de Plantões
        </div>
      </div>
    </div>
  )
}

