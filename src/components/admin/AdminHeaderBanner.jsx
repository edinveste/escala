import { Shield, ShieldAlert, LayoutGrid } from 'lucide-react'

export default function AdminHeaderBanner({
  user,
  perfil,
  role,
  layoutMode,
  onTrocarLayout,
  empresa,
  empresaNome,
}) {
  const isBloqueado = empresa?.status === 'bloqueado'

  const handleRegularizarAssinatura = () => {
    const texto = encodeURIComponent(
      `Olá! Sou gestor da imobiliária "${empresaNome || ''}" e preciso regularizar a assinatura do EscalaFácil.`
    )
    const zap = import.meta.env.VITE_WHATSAPP_SUPORTE || '5511999999999'
    window.open(`https://wa.me/${zap}?text=${texto}`, '_blank')
  }

  return (
    <>
      {/* ═══ BANNER DE IDENTIDADE DO GESTOR ═══ */}
      {user && (
        <div className="card bg-gradient-to-r from-surface-800 to-surface-850 border-surface-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(perfil?.nome || user.email || 'G').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-100 truncate">
                  {perfil?.nome ? perfil.nome : user.email}
                </p>
                {role === 'admin' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-brand-400" />
                    Administrador
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    Gestor
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
            </div>
          </div>

          {/* Botão no canto direito para voltar ao Modo em Abas quando em Visão Contínua */}
          {layoutMode === 'continuo' && (
            <button
              type="button"
              onClick={() => onTrocarLayout('abas')}
              title="Voltar para o Modo em Abas"
              aria-label="Voltar para o Modo em Abas"
              className="p-2 sm:p-2.5 rounded-xl bg-surface-700/60 hover:bg-brand-500/15 text-gray-400 hover:text-brand-300 border border-surface-600 hover:border-brand-500/40 active:scale-95 transition-all flex items-center justify-center flex-shrink-0 min-h-[40px] min-w-[40px] self-end sm:self-center shadow-sm"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* ═══ ALERTA DE AMBIENTE BLOQUEADO (INADIMPLÊNCIA / CANCELAMENTO ASAAS) ═══ */}
      {isBloqueado && (
        <div className="card bg-red-500/10 border-red-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-200">
          <div className="flex items-start gap-3 min-w-0">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-red-300">Ambiente de Plantão Suspenso</p>
              <p className="text-red-300/80 text-[11px] leading-relaxed">
                A escala desta imobiliária está com pendência na assinatura do Asaas. A criação de
                reservas pelos corretores está bloqueada até a regularização.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRegularizarAssinatura}
            className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap shadow-md shadow-brand-500/10"
          >
            Regularizar Assinatura
          </button>
        </div>
      )}
    </>
  )
}

