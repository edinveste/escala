import { CalendarCheck, Sparkles, ArrowRight, ShieldCheck, MessageCircle, Clock } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

/**
 * EmConstrucao — Tela temporária de manutenção e lançamento da Landing Page.
 * Utiliza o Design System de tokens semânticos (surface-*, gray-*, brand-*)
 * com suporte nativo e contraste perfeito em Modo Claro e Modo Escuro.
 */
export default function EmConstrucao({ onOpenLogin }) {
  const whatsappSuporte = import.meta.env.VITE_WHATSAPP_SUPORTE || ''
  const linkWhatsapp = whatsappSuporte
    ? `https://wa.me/${whatsappSuporte.replace(/\D/g, '')}?text=${encodeURIComponent(
        'Olá! Gostaria de saber mais informações sobre o EscalaFácil.'
      )}`
    : null

  const handlePortalGestor = () => {
    if (onOpenLogin) {
      onOpenLogin()
    } else {
      window.location.href = window.location.hostname.includes('localhost')
        ? '/?portal=app'
        : 'https://app.escalafacil.online'
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-900 text-gray-100 selection:bg-brand-500/30 selection:text-brand-300 relative overflow-hidden transition-colors duration-200">
      {/* Efeitos visuais decorativos de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* ═══ BARRA SUPERIOR ═══ */}
      <header className="relative z-10 border-b border-surface-600 bg-surface-900/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo da Marca */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-100">
              Escala<span className="text-brand-500">Fácil</span>
            </span>
          </div>

          {/* Alternador de Tema */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ═══ CONTEÚDO PRINCIPAL ═══ */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-12 relative z-10">
        <div className="w-full max-w-xl bg-surface-800 border border-surface-600 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-7 animate-scale-in">
          
          {/* Badge Animado com a Marca do EscalaFácil */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-xs font-semibold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
            <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>Página em Atualização • Novidades em Breve</span>
          </div>

          {/* Título de Impacto */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-100 leading-tight">
              Estamos preparando algo <span className="text-brand-500">incrível</span> para você!
            </h1>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-md mx-auto">
              Nossa página principal está passando por uma reformulação para trazer recursos e novidades exclusivas.
            </p>
          </div>

          {/* Card Informativo para Clientes e Gestores Atuais */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-700 border border-surface-600 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-100">
              <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0" />
              <span>Já é cliente ou gestor cadastrado?</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              O sistema continua funcionando 100% normalmente. As escalas dos seus colaboradores e os links de reserva seguem ativos sem interrupções.
            </p>
          </div>

          {/* Ações e Acessos */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handlePortalGestor}
              className="w-full btn-primary py-3.5 px-5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all"
            >
              <span>Acessar Portal do Gestor</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {linkWhatsapp && (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full btn-secondary py-3 px-5 text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:border-emerald-500/40 hover:text-emerald-500"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <span>Falar Conosco no WhatsApp</span>
              </a>
            )}
          </div>

          {/* Rodapé Interno com Indicador de Estabilidade */}
          <div className="pt-4 border-t border-surface-600 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Previsão de retorno em breve</span>
            </div>
            <span>© {new Date().getFullYear()} EscalaFácil. Todos os direitos reservados.</span>
          </div>

        </div>
      </main>
    </div>
  )
}
