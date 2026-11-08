import { useState, useId } from 'react'
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  CalendarCheck,
  Building2,
  Activity,
  Wine,
  ShoppingBag,
  HeartHandshake,
  Dumbbell,
  Shield,
  Zap,
  Users,
  Smartphone,
  Lock,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ExternalLink,
  Clock,
  MapPin,
  Check,
  Star,
  Award,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

// Nichos suportados com exemplos práticos
const NICHOS_SHOWCASE = [
  {
    id: 'imobiliaria',
    nome: 'Imobiliárias & Construtoras',
    tag: 'Mais Popular',
    icone: Building2,
    corBadge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dorPrincipal: 'Corretores discutindo no WhatsApp por pontos de captação concorridos e stands de lançamentos.',
    comoResolve: 'Cada ponto e stand tem vagas limitadas por horário. O corretor garante sua presença em 1 toque.',
    exemplos: {
      local: 'Stand Reserva do Parque (Ponto A)',
      vagas: '3 vagas por turno',
      turnos: ['09:00 às 13:00', '13:00 às 17:00'],
      acao: 'Garantir Vaga',
      equipe: 'Corretores de Plantão',
    },
  },
  {
    id: 'saude',
    nome: 'Saúde, Clínicas & Home Care',
    tag: 'Crítico & Urgente',
    icone: Activity,
    corBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dorPrincipal: 'Coordenação caótica de enfermeiros, médicos e cuidadores em plantões diurnos e noturnos.',
    comoResolve: 'Escala em tempo real com travas para evitar que dois profissionais assumam a mesma ala/leito.',
    exemplos: {
      local: 'UTI Adulto / Ala Berrini',
      vagas: '2 plantonistas',
      turnos: ['07:00 às 19:00 (Diurno)', '19:00 às 07:00 (Noturno)'],
      acao: 'Assumir Plantão',
      equipe: 'Corpo Clínico & Enfermagem',
    },
  },
  {
    id: 'eventos',
    nome: 'Eventos, Bares & Buffets',
    tag: 'Fins de Semana',
    icone: Wine,
    corBadge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dorPrincipal: 'Freelas confirmando em cima da hora, desistindo sem aviso e listas imensas de WhatsApp perdidas.',
    comoResolve: 'O gestor cria os setores da festa e os freelancers preenchem as vagas abertas em tempo real.',
    exemplos: {
      local: 'Bar Externo & Salão Nobre (Casamento)',
      vagas: '5 garçons e 2 barmans',
      turnos: ['Sexta 18:00 às 02:00', 'Sábado 12:00 às 20:00'],
      acao: 'Confirmar Presença',
      equipe: 'Equipe de Apoio / Freelas',
    },
  },
  {
    id: 'promotores',
    nome: 'Trade Marketing & Promoção',
    tag: 'Grandes Redes',
    icone: ShoppingBag,
    corBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dorPrincipal: 'Agências perdendo horas de sexta-feira escalando dezenas de promotores para supermercados.',
    comoResolve: 'Cada supermercado tem seu limite de promotores. As diárias fecham sozinhas assim que preenchidas.',
    exemplos: {
      local: 'Pão de Açúcar Jardins / Carrefour',
      vagas: '2 promotores por loja',
      turnos: ['10:00 às 14:00', '16:00 às 20:00'],
      acao: 'Garantir Diária',
      equipe: 'Promotores de Degustação',
    },
  },
  {
    id: 'igrejas',
    nome: 'Igrejas & Voluntários',
    tag: 'Ministérios',
    icone: HeartHandshake,
    corBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dorPrincipal: 'Líderes de ministério passando a semana cobrando quem vai servir nos cultos de domingo.',
    comoResolve: 'Voluntários escolhem onde e quando querem servir (mídia, recepção, infantil) com facilidade.',
    exemplos: {
      local: 'Ministério de Recepção / Mídia & Som',
      vagas: '4 voluntários por culto',
      turnos: ['Domingo 09:30', 'Domingo 18:30'],
      acao: 'Servir Neste Culto',
      equipe: 'Voluntários do Ministério',
    },
  },
  {
    id: 'esportes',
    nome: 'Arenas, Crossfit & Estúdios',
    tag: 'Aulas & Treinos',
    icone: Dumbbell,
    corBadge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    dorPrincipal: 'Aulas coletivas ou quadras cheias demais porque a confirmação em grupos de WhatsApp falhou.',
    comoResolve: 'Vagas limitadas que encerram automaticamente sem precisar de softwares caros e complicados.',
    exemplos: {
      local: 'Quadra 1 (Beach Tennis) / Box WOD',
      vagas: 'Limite de 8 alunos',
      turnos: ['07:00 às 08:00', '18:30 às 19:30'],
      acao: 'Reservar Vaga',
      equipe: 'Alunos / Atletas',
    },
  },
]

// FAQ Items
const FAQ_ITEMS = [
  {
    pergunta: 'Minha equipe precisa baixar algum aplicativo?',
    resposta:
      'Não! Esse é o maior diferencial do EscalaFácil. Sua equipe não precisa ir na Google Play nem App Store, e não precisa criar login com senha. Eles apenas clicam no link seguro que você envia no WhatsApp e a escala abre instantaneamente no navegador do celular.',
  },
  {
    pergunta: 'O que acontece se duas pessoas tentarem pegar a mesma vaga ao mesmo tempo?',
    resposta:
      'Nosso sistema utiliza travas transacionais de banco de dados (Row-Level Locking). Em milissegundos, quem clicou primeiro garante a vaga e a tela de todos os outros usuários atualiza na mesma fração de segundo via WebSockets.',
  },
  {
    pergunta: 'Como evito que pessoas de fora ou invasores reservem vagas?',
    resposta:
      'Você tem à disposição a chave "Proteção Contra Invasores". Quando ativada, apenas os números de WhatsApp e nomes previamente autorizados por você na sua lista de equipe conseguem assumir horários.',
  },
  {
    pergunta: 'Posso personalizar para o meu nicho (médicos, promotores, freelas)?',
    resposta:
      'Sim! No seu painel de gestor, você escolhe o segmento da sua empresa em 1 clique (ou edita os termos manualmente). Se você escolher Saúde, o sistema vira "Plantão / Plantonistas". Se escolher Eventos, vira "Apoio / Freelas". É 100% camaleão.',
  },
  {
    pergunta: 'Concorrentes conseguem espionar minha escala?',
    resposta:
      'Não. Cada empresa possui um Link Seguro de 12 caracteres alfanuméricos criptograficamente aleatório (ex: escalafacil.online/X9kL2pQm8Zs1). É matematicamente impossível adivinhar o link da sua empresa.',
  },
  {
    pergunta: 'Como funciona o cancelamento do plano?',
    resposta:
      'Sem fidelidade e sem burocracia. Você pode cancelar sua assinatura a qualquer momento com apenas 1 clique ou nos avisando pelo WhatsApp.',
  },
]

export default function LandingPage({ onOpenDemo, onOpenLogin }) {
  const [nichoAtivo, setNichoAtivo] = useState('imobiliaria')
  const [faqAberto, setFaqAberto] = useState(null)

  // Demonstração interativa na hero
  const [demoOcupada, setDemoOcupada] = useState(false)
  const [demoNome, setDemoNome] = useState('Carlos Eduardo')
  const demoInputId = useId()

  const nichoDados = NICHOS_SHOWCASE.find((n) => n.id === nichoAtivo) || NICHOS_SHOWCASE[0]
  const NichoIcone = nichoDados.icone

  const toggleFaq = (idx) => {
    setFaqAberto(faqAberto === idx ? null : idx)
  }

  const handleCadastrarEmpresa = () => {
    // Redireciona para o Portal do Gestor para criar a conta
    if (onOpenLogin) {
      onOpenLogin()
    } else {
      window.location.href = window.location.hostname.includes('localhost')
        ? '/?portal=app'
        : 'https://app.escalafacil.online'
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 text-text selection:bg-brand-500/30 selection:text-brand-300">
      {/* ═══ NAVBAR SUPERIOR ═══ */}
      <header className="sticky top-0 z-40 bg-surface-900/80 backdrop-blur-md border-b border-border/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-text tracking-tight">
              Escala<span className="text-brand-500">Fácil</span>
            </span>
          </div>

          {/* Links Centrais (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-text-muted">
            <a href="#solucao" className="hover:text-text transition-colors">
              Como Funciona
            </a>
            <a href="#nichos" className="hover:text-text transition-colors">
              Nichos
            </a>
            <a href="#recursos" className="hover:text-text transition-colors">
              Recursos
            </a>
            <a href="#precos" className="hover:text-text transition-colors">
              Planos
            </a>
            <a href="#faq" className="hover:text-text transition-colors">
              Dúvidas
            </a>
          </nav>

          {/* Ações da Direita */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            <button
              onClick={handleCadastrarEmpresa}
              className="hidden sm:inline-flex text-xs font-semibold px-3.5 py-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-elevated transition-colors border border-transparent hover:border-border"
            >
              Área do Gestor
            </button>

            <button
              onClick={handleCadastrarEmpresa}
              className="text-xs sm:text-sm font-semibold px-4 py-2 sm:py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Começar Grátis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ HERO SECTION (DOBRA PRINCIPAL) ═══ */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden border-b border-border/40">
        {/* Glow de fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge flutuante */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span>O Fim das Listas Desatualizadas no WhatsApp</span>
          </div>

          {/* Título Principal */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text leading-[1.15] mb-6">
            A escala da sua equipe organizada em minutos.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-500 to-emerald-400">
              Sem confusão e sem furos.
            </span>
          </h1>

          {/* Subtítulo persuasivo */}
          <p className="text-sm sm:text-lg text-text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            Elimine a bagunça de listas manuais. Crie seus turnos e deixe seus profissionais
            garantirem as vagas pelo celular em tempo real —{' '}
            <strong className="text-text font-semibold">sem precisar baixar app</strong> e{' '}
            <strong className="text-text font-semibold">sem criar senhas</strong>.
          </p>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10">
            <button
              onClick={handleCadastrarEmpresa}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm sm:text-base shadow-xl shadow-brand-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Criar Escala da Minha Equipe</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (onOpenDemo) {
                  onOpenDemo()
                } else {
                  window.location.href = '/demo'
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-border text-text font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Ver Demonstração ao Vivo</span>
              <ExternalLink className="w-4 h-4 text-brand-400" />
            </button>
          </div>

          {/* Micro-provas de valor */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Configuração em 2 minutos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Zero atrito para sua equipe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>7 dias de garantia incondicional</span>
            </div>
          </div>
        </div>

        {/* ═══ MINI DEMO INTERATIVA DIRETO NA HERO ═══ */}
        <div className="max-w-md mx-auto px-4 mt-12">
          <div className="card p-4 sm:p-5 border border-border/80 shadow-2xl relative overflow-hidden bg-surface-elevated/90 backdrop-blur-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-text">
                  Simulação em Tempo Real
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">
                Teste o Clique
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-text">Sábado — 09:00 às 13:00</h4>
                  <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-400" />
                    Stand Principal / Loja Centro
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    demoOcupada
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {demoOcupada ? '1/2 Vagas' : '0/2 Vagas'}
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    demoOcupada ? 'w-1/2 bg-amber-500' : 'w-0'
                  }`}
                />
              </div>

              {/* Lista de reservas */}
              {demoOcupada && (
                <div className="p-2.5 rounded-lg bg-surface border border-border text-xs flex items-center justify-between animate-scale-in">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 font-bold flex items-center justify-center text-[10px]">
                      {demoNome.charAt(0)}
                    </div>
                    <span className="font-medium text-text">{demoNome}</span>
                  </div>
                  <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded font-bold">
                    VOCÊ
                  </span>
                </div>
              )}

              {/* Botão de simulação */}
              {demoOcupada ? (
                <button
                  type="button"
                  onClick={() => setDemoOcupada(false)}
                  className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all"
                >
                  ✕ Liberar Minha Vaga (Simulação)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDemoOcupada(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Garantir Vaga Agora (Clique Aqui)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SEÇÃO DE NICHOS INTERATIVA (O CAMALEÃO DO SAAS) ═══ */}
      <section id="nichos" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text mb-4">
            Feito sob medida para o seu setor
          </h2>
          <p className="text-sm sm:text-base text-text-muted">
            O EscalaFácil adapta todo o seu vocabulário em 1 clique. Selecione seu segmento abaixo
            e veja como a plataforma fala a mesma língua da sua equipe:
          </p>
        </div>

        {/* Abas dos Nichos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-8">
          {NICHOS_SHOWCASE.map((nicho) => {
            const Icon = nicho.icone
            const isAtivo = nicho.id === nichoAtivo
            return (
              <button
                key={nicho.id}
                onClick={() => setNichoAtivo(nicho.id)}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                  isAtivo
                    ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10 font-bold'
                    : 'bg-surface-elevated/50 border-border text-text-muted hover:text-text hover:bg-surface-elevated'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isAtivo ? 'bg-brand-500 text-white shadow-md' : 'bg-surface text-text-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs leading-tight line-clamp-2">{nicho.nome}</span>
              </button>
            )
          })}
        </div>

        {/* Card de Detalhes do Nicho Ativo */}
        <div className="card p-6 sm:p-8 border border-border/80 shadow-xl bg-surface-elevated/70">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Lado Esquerdo: A Dor e a Solução */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 border bg-brand-500/10 text-brand-400 border-brand-500/20">
                <NichoIcone className="w-4 h-4" />
                <span>{nichoDados.nome}</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-text mb-3">
                Como o EscalaFácil transforma a sua rotina:
              </h3>

              <div className="space-y-4 mb-6">
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs sm:text-sm">
                  <p className="font-bold text-red-400 mb-1">❌ Como costuma ser hoje:</p>
                  <p className="text-text-muted">{nichoDados.dorPrincipal}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs sm:text-sm">
                  <p className="font-bold text-emerald-400 mb-1">
                    ✨ Com o EscalaFácil no piloto automático:
                  </p>
                  <p className="text-text-muted">{nichoDados.comoResolve}</p>
                </div>
              </div>

              <button
                onClick={handleCadastrarEmpresa}
                className="btn-primary py-3 px-6 text-xs sm:text-sm flex items-center gap-2 font-bold"
              >
                <span>Usar para {nichoDados.nome}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Lado Direito: Vocabulário & Mockup daquele Nicho */}
            <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Vocabulário adaptado na tela:
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 font-bold">
                  {nichoDados.tag}
                </span>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-text-muted">Nome do Local:</span>
                  <span className="font-bold text-text">{nichoDados.exemplos.local}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-text-muted">Identificação da Equipe:</span>
                  <span className="font-bold text-brand-400">{nichoDados.exemplos.equipe}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-text-muted">Capacidade por Turno:</span>
                  <span className="font-semibold text-text">{nichoDados.exemplos.vagas}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-text-muted">Exemplo de Horários:</span>
                  <span className="font-semibold text-text">
                    {nichoDados.exemplos.turnos.join(' • ')}
                  </span>
                </div>
                <div className="flex justify-between py-1 items-center">
                  <span className="text-text-muted">Botão de Ação:</span>
                  <span className="px-3 py-1 rounded bg-brand-500 text-white font-bold text-xs">
                    {nichoDados.exemplos.acao}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ COMO FUNCIONA EM 3 PASSOS ═══ */}
      <section id="solucao" className="py-16 sm:py-20 bg-surface-elevated/40 border-y border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text mb-3">
              Como funciona em 3 passos simples
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              Do cadastro ao primeiro horário preenchido em menos de 2 minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 border border-border/80 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 font-extrabold text-lg flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-text mb-2">Cadastre seus Horários</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                No seu painel de gestor, insira os pontos/locais e os dias e horários com o limite
                de pessoas por vaga.
              </p>
            </div>

            <div className="card p-6 border border-border/80 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 font-extrabold text-lg flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-text mb-2">Envie o Link no WhatsApp</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Copie o link seguro e envie no grupo da sua equipe. Ninguém precisa baixar app ou
                criar senhas chatas.
              </p>
            </div>

            <div className="card p-6 border border-border/80 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 font-extrabold text-lg flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-text mb-2">Vagas Preenchidas Sozinhas</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Sua equipe escolhe os horários em tempo real. Atingiu a capacidade? O sistema bloqueia
                novas vagas no mesmo segundo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ RECURSOS DIFERENCIAIS ═══ */}
      <section id="recursos" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text mb-3">
            Recursos projetados para acabar com a dor de cabeça
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            Tudo o que você precisa para gerenciar equipes sem atrito e com precisão cirúrgica.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="card p-6 border border-border hover:border-brand-500/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-4">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-text mb-2">Zero Atrito (Sem Aplicativo)</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Sua equipe não precisa ocupar memória do celular. O link abre rápido em qualquer
              navegador com interface mobile-first.
            </p>
          </div>

          <div className="card p-6 border border-border hover:border-brand-500/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-text mb-2">Atualização em Tempo Real</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Via WebSockets instantâneo: quando alguém reserva ou cancela, a tela de todo mundo
              atualiza sem precisar recarregar a página.
            </p>
          </div>

          <div className="card p-6 border border-border hover:border-brand-500/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-text mb-2">Proteção Anti-Invasores</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Ative a chave de segurança para restringir as reservas estritamente aos membros
              autorizados cadastrados pela sua gerência.
            </p>
          </div>

          <div className="card p-6 border border-border hover:border-brand-500/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-text mb-2">Link Seguro Anti-Espionagem</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Código aleatório de 12 dígitos impossível de concorrentes adivinharem trocando o nome
              da imobiliária ou empresa na URL.
            </p>
          </div>

          <div className="card p-6 border border-border hover:border-brand-500/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-text mb-2">Sem Conflitos de Vagas</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Trava transacional no banco de dados contra race conditions: nunca duas pessoas pegam
              a mesma vaga simultaneamente.
            </p>
          </div>

          <div className="card p-6 border border-border hover:border-brand-500/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-text mb-2">Cópia Formatada para WhatsApp</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Gere em 1 clique um resumo elegante e visual de todos os horários e nomes escalados
              para colar no grupo oficial.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ TABELA DE PREÇOS / PLANOS ═══ */}
      <section id="precos" className="py-16 sm:py-24 bg-surface-elevated/40 border-t border-border/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>Sem Fidelidade • Cancele Quando Quiser</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text mb-3">
              Investimento simples que se paga no 1º dia
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              Quanto custa a hora do seu gestor perdida toda semana organizando listas no WhatsApp?
            </p>
          </div>

          {/* Card do Plano */}
          <div className="max-w-md mx-auto card p-7 sm:p-9 border-2 border-brand-500 shadow-2xl relative bg-surface-elevated">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand-500 text-white font-bold text-xs uppercase tracking-wider shadow-md">
              Acesso Completo
            </div>

            <h3 className="text-xl font-bold text-text mb-1">Plano Profissional</h3>
            <p className="text-xs text-text-muted mb-6">
              Para empresas, equipes e gestores de qualquer segmento
            </p>

            <div className="flex items-baseline justify-center gap-1.5 mb-6">
              <span className="text-xs text-text-muted font-medium">R$</span>
              <span className="text-5xl font-black text-text">67</span>
              <span className="text-xs text-text-muted">/mês</span>
            </div>

            <ul className="space-y-3 text-left text-xs sm:text-sm text-text-muted mb-8">
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Locais, pontos e unidades ilimitadas</span>
              </li>
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Turnos e horários ilimitados</span>
              </li>
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Colaboradores e reservas ilimitadas</span>
              </li>
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Atualização instantânea em tempo real (WebSockets)</span>
              </li>
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Proteção anti-invasores e links anti-espionagem</span>
              </li>
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Personalização completa de vocabulário para seu nicho</span>
              </li>
              <li className="flex items-center gap-2.5 text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Suporte prioritário via WhatsApp</span>
              </li>
            </ul>

            <button
              onClick={handleCadastrarEmpresa}
              className="w-full py-3.5 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm sm:text-base shadow-xl shadow-brand-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Começar Teste de 7 Dias Grátis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-text-muted mt-2.5">
              Sem burocracia. Se não gostar, cancele com 1 clique.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ FAQ (PERGUNTAS FREQUENTES) ═══ */}
      <section id="faq" className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text mb-3">
            Perguntas Frequentes
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            Tire suas dúvidas rápidas sobre o EscalaFácil
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((faq, idx) => {
            const isAberto = faqAberto === idx
            return (
              <div
                key={idx}
                className="card border border-border/80 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-text hover:text-brand-400 transition-colors"
                >
                  <span>{faq.pergunta}</span>
                  <div
                    className={`p-1.5 rounded-lg bg-surface text-text-muted transition-transform duration-200 shrink-0 ${
                      isAberto ? 'rotate-180 text-brand-400 bg-brand-500/10' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isAberto && (
                  <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-text-muted leading-relaxed border-t border-border/40 pt-3 animate-fade-in">
                    {faq.resposta}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-surface-elevated/40 to-surface-900 border-t border-border/60 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-black text-text mb-4">
            Pronto para nunca mais perder horas no WhatsApp?
          </h2>
          <p className="text-sm sm:text-base text-text-muted mb-8 max-w-xl mx-auto">
            Crie sua primeira escala agora e envie no grupo da sua equipe antes do próximo fim de
            semana.
          </p>
          <button
            onClick={handleCadastrarEmpresa}
            className="px-8 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-base shadow-2xl shadow-brand-500/30 transition-all active:scale-95 inline-flex items-center gap-2"
          >
            <span>Experimentar Grátis Agora</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border/60 py-8 text-center text-xs text-text-muted bg-surface-900">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-brand-500" />
            <span className="font-bold text-text">
              Escala<span className="text-brand-500">Fácil</span>
            </span>
            <span>© {new Date().getFullYear()} — Todos os direitos reservados.</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleCadastrarEmpresa}
              className="hover:text-text transition-colors"
            >
              Área do Gestor
            </button>
            <a
              href="https://wa.me/5511999999999?text=Olá!%20Gostaria%20de%20tirar%20dúvidas%20sobre%20o%20EscalaFácil"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text transition-colors flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Suporte WhatsApp</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

