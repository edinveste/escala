import { Shield, ShieldAlert, LayoutGrid, ScrollText } from 'lucide-react'

export default function AdminHeaderBanner({
  user,
  perfil,
  role,
  layoutMode = 'abas',
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

  const nomeExibicao = perfil?.nome || user?.email || empresaNome || 'Administrador'
  const emailExibicao = user?.email || 'Acesso Administrativo'
  const inicial = (nomeExibicao || 'A').charAt(0).toUpperCase()
  const isModoAbas = layoutMode === 'abas'

  return (
    <>
      {/* ═══ BANNER DE IDENTIDADE DO GESTOR COM ALTERNADOR DE MODO ═══ */}
      {(user || empresa) && (
        <div className="card bg-gradient-to-r from-surface-800 to-surface-850 border-surface-700 p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {inicial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-100 truncate">
                  {nomeExibicao}
                </p>
                {role === 'admin' || !role ? (
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
              <p className="text-xs text-gray-400 mt-0.5 truncate">{emailExibicao}</p>
            </div>
          </div>

          {/* Botão compacto e discreto para alternar entre Modo em Abas e Visão Contínua */}
          {onTrocarLayout && (
            <button
              type="button"
              onClick={() => onTrocarLayout(isModoAbas ? 'continuo' : 'abas')}
              title={isModoAbas ? 'Alternar para Visão Contínua' : 'Alternar para Modo em Abas'}
              aria-label={isModoAbas ? 'Alternar para Visão Contínua' : 'Alternar para Modo em Abas'}
              className="h-8 w-8 rounded-lg bg-surface-700/40 hover:bg-surface-700/80 text-gray-400 hover:text-gray-200 border border-surface-600/60 hover:border-surface-500 active:scale-95 transition-all flex items-center justify-center flex-shrink-0 shadow-sm"
            >
              {isModoAbas ? (
                <ScrollText className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
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

