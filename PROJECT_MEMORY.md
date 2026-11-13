# PROJECT_MEMORY.md — EscalaFácil (Controle de Captação)

> **Instrução para a IA**: Este documento serve como **memória persistente** e **contexto de arquitetura** do projeto. Leia este arquivo integralmente no início de cada novo chat para entender os objetivos, estrutura de dados, fluxos de UI/UX e regras de negócio antes de propor alterações.

---

## 0. Perfil de Atuação e Padrões de Engenharia (Senior Software Engineer)
- **Mindset de Engenheiro Sênior**: Em todas as tarefas, atue como um **Engenheiro de Software Sênior e Arquiteto de Soluções**. Pense de forma preventiva, prevendo casos de borda, concorrência, consistência de estado, segurança, manutenibilidade e alta performance.
- **Componentização e Modularidade por Padrão**: Sempre que construir novas funcionalidades ou fluxos, crie o código **já modularizado e devidamente componentizado**. Evite componentes monolíticos; extraia responsabilidades em submódulos coesos, componentes reaproveitáveis e helpers/hooks dedicados.
- **Tecnologia Moderna e Código Limpo**: Toda adição ou refatoração deve utilizar o que há de mais moderno, idiomático e consolidado no ecossistema (React 18+, Tailwind CSS, Supabase BaaS, ESNext), aplicando Clean Code, SOLID e código autoexplicativo com documentação pontual apenas onde houver regra de negócio complexa.
- **Excelência em UI/UX e Design System**:
  - Foco obsessivo na experiência do usuário: hierarquia visual clara, espaçamentos consistentes, tipografia legível e microinterações polidas.
  - **Mobile-First rigoroso**: layout touch-friendly (zonas de clique com mínimo de 44–48px), sem quebras em telas estreitas, feedback imediato (estados de hover, active, loading, disabled e toasts contextuais).
  - Prevenção de frustração: confirmações amigáveis em ações destrutivas, transições suaves e zero poluição visual ou elementos redundantes.

---

## 1. Visão Geral e Objetivo
O **EscalaFácil - Controle de Captação** é uma plataforma SaaS Multi-Tenant B2B voltada para imobiliárias, incorporadoras e corretores de imóveis.  
**Objetivo principal**: Substituir listas informais e manuais do WhatsApp por uma plataforma web moderna, rápida e em tempo real, onde cada imobiliária possui seu ambiente 100% isolado (multi-tenant) e corretores garantem e cancelam vagas em pontos de captação física sem sobreposição ou conflitos (*race conditions*).

---

## 2. Stack Tecnológica
- **Frontend**: React 18 (SPA) com Vite 5
- **Hospedagem & CDN**: Cloudflare Pages (Deploy contínuo via GitHub, branch main em produção, SSL gratuito e roteamento SPA via public/_redirects)
- **Estilização**: Tailwind CSS com suporte completo a Modo Escuro (padrão) e Modo Claro, alternável via CSS variables dinâmicas e tokens semânticos
- **Ícones**: `lucide-react`
- **Multi-Tenancy**: `TenantContext` com resolução por subdomínio (`imobiliaria.meusaas.com`), rota/slug (`/imobiliaria`), query param (`?empresa=imobiliaria`) e persistência segura no `localStorage`.
- **Backend / BaaS**: Supabase
  - PostgreSQL 15+ com Row Level Security (RLS)
  - Supabase Auth com gerenciamento de sessão persistente (`AuthContext`), e-mail/senha, tokens JWT e refresh automático resiliente
  - Supabase Realtime via WebSockets escutando com filtro estrito de `empresa_id`
  - Postgres Functions / RPCs com transações e row-level locking (`FOR UPDATE`)
- **Autenticação dos Corretores (Zero-Atrito)**: Sem login ou senha (identidade via `localStorage` com `device_id` UUID e `corretor_nome`).
- **Autenticação dos Gestores (Fase 2 - RBAC)**: Supabase Auth (`auth.users`) integrado à tabela de perfis e tabela `usuarios_empresas` com papéis ('superadmin', 'admin', 'gestor'). PIN legado preservado como fallback de contingência.

---

## 3. Modelo de Dados e Banco Multi-Tenant (Supabase)

### Tabelas Principais:
1. **`empresas`** (Tenants do SaaS, ex: Minha Imobiliária, Direcional, Remax Prime):
   - `id` (uuid, PK)
   - `nome` (text, ex: 'Direcional Imóveis')
   - `slug` (text UNIQUE, ex: 'direcional')
   - `logo_url` (text)
   - `cor_primaria` (text, padrão `#3b82f6`)
   - `admin_pin` (text, padrão `'1234'`)
   - `plano` (text: 'trial', 'pro', 'ilimitado')
   - `status` (text: 'ativo', 'inativo', 'bloqueado')
   - `exigir_cadastro_previo` (boolean, padrão `false`)
   - `created_at` (timestamptz)
2. **`perfis`** (Perfis de Usuários do Supabase Auth):
   - `id` (uuid, PK REFERENCES `auth.users.id` ON DELETE CASCADE)
   - `email` (text)
   - `nome` (text)
   - `is_superadmin` (boolean, padrão `false`)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)
3. **`usuarios_empresas`** (Vínculos Multi-Tenant de Gestores e Administradores):
   - `id` (uuid, PK)
   - `user_id` (uuid, FK `auth.users.id` ON DELETE CASCADE)
   - `empresa_id` (uuid, FK `empresas.id` ON DELETE CASCADE)
   - `role` (text: 'admin', 'gestor')
   - `ativo` (boolean, padrão `true`)
   - `created_at` (timestamptz)
   - `UNIQUE (user_id, empresa_id)`
4. **`pontos`** (Pontos de Captação vinculados à empresa):
   - `id` (uuid, PK)
   - `empresa_id` (uuid, FK `empresas.id` ON DELETE CASCADE)
   - `nome` (text)
   - `ordem` (int)
   - `ativo` (boolean)
   - `created_at` (timestamptz)
5. **`turnos`** (Horários vinculados a um ponto e empresa):
   - `id` (uuid, PK)
   - `empresa_id` (uuid, FK `empresas.id` ON DELETE CASCADE)
   - `ponto_id` (uuid, FK `pontos.id` ON DELETE CASCADE)
   - `dia` (text: 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO')
   - `horario` (text, ex: '8 as 10 hs', '11:30 às 14hrs')
   - `capacidade` (int)
   - `ordem` (int)
   - `created_at` (timestamptz)
6. **`reservas`** (Vagas preenchidas por corretores vinculadas ao turno e empresa):
   - `id` (uuid, PK)
   - `empresa_id` (uuid, FK `empresas.id` ON DELETE CASCADE)
   - `turno_id` (uuid, FK `turnos.id` ON DELETE CASCADE)
   - `corretor_nome` (text)
   - `corretor_whatsapp` (text, opcional)
   - `device_id` (text)
   - `created_at` (timestamptz)
7. **`equipe_corretores`** (Lista autorizada de corretores da imobiliária para proteção contra invasores):
   - `id` (uuid, PK)
   - `empresa_id` (uuid, FK `empresas.id` ON DELETE CASCADE)
   - `nome` (text)
   - `whatsapp` (text)
   - `ativo` (boolean, padrão `true`)
   - `created_at` (timestamptz)

### RPCs Críticas (PostgreSQL):
- **`reservar_vaga(p_turno_id, p_corretor_nome, p_device_id, p_corretor_whatsapp DEFAULT NULL)`**:
  - Utiliza `SELECT capacidade, empresa_id FROM turnos WHERE id = p_turno_id FOR UPDATE` para travar o turno contra concorrência simultânea (*race conditions*).
  - Valida se `exigir_cadastro_previo` está ativo na empresa; em caso positivo, barra corretores não autorizados em `equipe_corretores`.
  - Impede reserva duplicada do mesmo `device_id` no mesmo turno.
  - Insere a reserva vinculando automaticamente o `empresa_id` e salvando o `corretor_whatsapp`.
- **`cancelar_vaga(p_reserva_id, p_device_id)`**:
  - Permite que o corretor delete apenas sua própria vaga comparando `device_id`.
- **`limpar_escala(p_empresa_id, p_ponto_id DEFAULT NULL)`**:
  - Se executada por usuário autenticado, valida se ele possui papel `'admin'` ou `'gestor'` na empresa (ou `is_superadmin`).
- **`get_metricas_empresas()`**:
  - Retorna em uma única query agregada as contagens reais de pontos ativos, turnos e reservas de cada tenant para o Superadmin.
- **`is_superadmin(p_user_id DEFAULT auth.uid())`**:
  - Função `SECURITY DEFINER` que verifica privilégio global de Superadmin sem recursão de RLS.
- **`has_empresa_role(p_empresa_id, p_roles, p_user_id)`**:
  - Função `SECURITY DEFINER` que checa se o usuário logado possui papel ativo na imobiliária.
- **`get_minhas_empresas()`**:
  - Retorna todas as empresas com seus respectivos papéis para o usuário logado (ou todas se for Superadmin).
- **`promover_superadmin(p_email)`**:
  - Promove usuário a Superadmin do SaaS com segurança.
- **`vincular_usuario_empresa(p_email, p_empresa_id, p_role)`**:
  - Adiciona gestor/administrador à imobiliária informada.
- **`criar_nova_empresa(p_nome, p_slug, p_admin_pin DEFAULT '1234')`**:
  - Cria um novo tenant isolado e, se o criador estiver logado, vincula-o como `'admin'` da empresa criada.

### Políticas de RLS (Row Level Security):
- `perfis`: Leitura própria ou Superadmin; atualização do próprio nome ou Superadmin.
- `usuarios_empresas`: Leitura própria, de admins da empresa ou Superadmin; modificações restritas a admins da empresa ou Superadmin.
- `empresas`: Leitura pública (`SELECT` por slug/id); atualização por admins da imobiliária ou Superadmin; exclusão apenas por Superadmin.
- `pontos`, `turnos`: Leitura pública; inserção, alteração e deleção restritas a gestores autenticados daquela empresa (`has_empresa_role`) ou Superadmin.
- `reservas`: Leitura pública em tempo real; inserção controlada via RPC e gestor; exclusão pelo próprio corretor (`device_id`) via RPC ou gestores autenticados.
- Realtime ativado para: `empresas`, `pontos`, `turnos`, `reservas`, `perfis`, `usuarios_empresas`.

---

## 4. Estrutura de Diretórios e Arquivos

```
e:\Escala\
├── .env                         # Variáveis de ambiente locais (Supabase URL e Anon Key)
├── .env.example                 # Exemplo documentado de variáveis
├── package.json                 # Dependências e scripts
├── vite.config.js               # Configuração do Vite com suporte a host de rede
├── tailwind.config.js           # Tema dark mode, cores brand e surface
├── postcss.config.js
├── index.html                   # Mobile-first viewport e meta tags PWA
├── supabase_schema.sql          # Schema SQL mestre multi-tenant completo (Fases 1 e 2)
├── supabase_migration_multitenant.sql # Script de migração para Fase 1 Multi-Tenant
├── supabase_migration_fase2_auth.sql  # Script de migração para Fase 2 Auth & RBAC
├── supabase_migration_fase2_refinamentos.sql # Script de migração: Equipe, Bloqueio de Invasores e Métricas
├── supabase_migration_fase3_asaas.sql # Script de migração Fase 3: Piloto Automático Asaas & Bloqueio
├── supabase_migration_fase4_links_seguros.sql # Script de migração Fase 4: Links Seguros Anti-Espionagem (12 chars)
├── supabase_migration_fase5_vocabulario.sql # Script de migração Fase 5: Vocabulário & Nicho Dinâmico (termos JSONB)
├── supabase_migration_fase6_telefone_unico.sql # Script de migração Fase 6: Telefone Único & Anti-Spoofing
├── supabase_migration_fase7_validacao_email.sql # Script de migração Fase 7: Validação Flexível por E-mail Corporativo
├── supabase_migration_fase8_vinculo_aparelho.sql # Script de migração Fase 8: Trava Estrita de Aparelho (device_id_vinculado)
├── supabase_migration_fase9_editar_colaborador.sql # Script de migração Fase 9: Edição Segura de Colaboradores (RPC)
├── supabase_migration_fase14_blindagem_seguranca.sql # Script de migração Fase 14: Blindagem RLS/RPCs, Realtime sem PII e Remoção do PIN Legado
├── supabase_migration_fase15_regras_escala.sql # Script de migração Fase 15: Bloqueio de Conflito de Horário & Cotas Anti-Monopólio
├── supabase/
│   └── functions/
│       └── asaas-webhook/       # Supabase Edge Function Deno/TS de processamento do webhook Asaas
│           ├── index.ts
│           └── README.md
├── AGENTS.md                    # Diretrizes e memória para Agentes de IA
├── PROJECT_MEMORY.md            # Este arquivo de contexto/memória da IA
└── src/
    ├── main.jsx                 # Ponto de entrada do React com ConfirmProvider, AuthProvider e TenantProvider
    ├── index.css                # Tailwind + classes utilitárias (.card, .btn-*, scrollbar dark)
    ├── App.jsx                  # Estado raiz, roteamento por tenant/view, canal Realtime isolado
    ├── contexts/
    │   ├── AuthContext.jsx      # Provedor de contexto do Supabase Auth, RBAC, sessões, papéis e refresh resiliente de JWT
    │   └── TenantContext.jsx    # Provedor de contexto do tenant ativo, detecção, troca de empresa e query pública segura contra JWT expirado
    ├── hooks/
    │   ├── useEscalaData.js     # Hook de busca, cache e sincronização em tempo real (Supabase Realtime)
    │   ├── useColaborador.js    # Hook de identidade Zero-Atrito, localStorage e reservas do colaborador
    │   ├── useVerificacaoIdentidade.js # Hook de checagem em tempo real contra equipe autorizada e anti-spoofing
    │   └── useDemoEscala.js     # Hook de sandbox local, simulação de reservas e regras da demonstração (/demo)
    ├── lib/
    │   ├── supabaseClient.js    # Instância do createClient configurada
    │   ├── tenantHelper.js      # Utilitários de extração de slug, subdomínio e URL compartilhável
    │   ├── diasSemana.js        # Utilitários, ordenação e normalização de dias da semana
    │   ├── horarioHelper.js     # Parsing de horários legados, detecção de conflitos e cálculo de cotas
    │   ├── supabasePublicHelper.js # Utilitários de execução pública segura (JWT expirado e fallbacks)
    │   ├── vocabularioHelper.js # Dicionário de presets, termos e helpers de vocabulário multi-nicho
    │   └── demoData.js          # Mock data e persistência local da escala demonstrativa sandbox (/demo)
    └── components/
        ├── AppHeader.jsx        # Barra superior com logo, badge do portal de gestão, tema e logout
        ├── LandingPage.jsx      # Página de vendas oficial de alta conversão (escalafacil.online/)
        ├── DemoBanner.jsx       # Banner informativo superior da demonstração com ações de conversão
        ├── DemoEscalaView.jsx   # Visão da escala demonstrativa 100% sandbox e isolada do banco Supabase
        ├── VocabularioModal.jsx # Re-export para retrocompatibilidade do modal de vocabulário
        ├── vocabulario/         # Submódulos e hook isolados de nicho e vocabulário dinâmico
        │   ├── useVocabularioModal.js        # Hook de regras, estado e sincronização de termos no Supabase
        │   ├── VocabularioPresetSelector.jsx # Seletor de segmento/preset com ícones e descrições
        │   ├── VocabularioLivePreview.jsx    # Card de pré-visualização ao vivo no celular
        │   ├── VocabularioCamposCustomizados.jsx # Formulário sanfona de ajuste fino dos 7 termos
        │   └── VocabularioModal.jsx          # Modal orquestrador enxuto com backdrop e ações
        ├── CorretorView.jsx     # Tela pública orquestradora do corretor (modularizada e enxuta)
        ├── corretor/            # Submódulos e componentes isolados da visão do corretor
        │   ├── CorretorIdentityHeader.jsx # Saudação, resumo de cotas/regras e alerta de autorização
        │   ├── CorretorRegrasBanner.jsx   # Barra discreta com saldo de cotas e regras ativas
        │   ├── CorretorCopyFooter.jsx     # Barra fixa inferior com botão de copiar escala (WhatsApp)
        │   ├── PontoSelectorView.jsx      # Tela de seleção de ponto com contagem de turnos e vagas
        │   ├── PontoTurnosView.jsx        # Tela de turnos do ponto com navegação, cabeçalho e dias
        │   ├── DiaAcordeonItem.jsx        # Item de acordeon de dia com vagas e lista de TurnoCard
        │   ├── TurnoCard.jsx              # Card de turno na visão do corretor (progresso, botões contextuais)
        │   ├── useDiasAcordeon.js         # Hook de controle e persistência de acordeons de dias por tenant
        │   └── escalaTextoHelper.js       # Formatação de texto para WhatsApp e cópia para clipboard
        ├── TurnoCard.jsx        # Re-export para retrocompatibilidade do card de turno do colaborador
        ├── NomeModal.jsx        # Modal para solicitar nome e WhatsApp do corretor
        ├── ConfirmModal.jsx     # Modal universal assíncrono de confirmação/exclusão (useConfirm)
        ├── AdminLoginModal.jsx  # Modal orquestrador de login do gestor (modularizado e enxuto)
        ├── admin-login/         # Submódulos e formulários isolados do fluxo de autenticação do gestor
        │   ├── adminAuthHelper.js     # Helper de validação e auto-vinculação com PIN (RPCs Supabase)
        │   ├── AuthFeedback.jsx       # Componente de feedback para erros e alertas
        │   ├── AcessoRestritoView.jsx # Visão de usuário logado sem vínculo à empresa ativa
        │   ├── LoginForm.jsx          # Formulário de login institucional (E-mail/Senha)
        │   ├── CadastroForm.jsx       # Formulário de criação de conta de gestor
        │   ├── RecuperarSenhaForm.jsx # Formulário de redefinição de senha
        │   └── PinLegadoForm.jsx      # Formulário de contingência via PIN legado
        ├── PortalGestorLogin.jsx# Tela full-page de login exclusivo dos gestores (app.escalafacil.online)
        ├── PortalSemEmpresaView.jsx # Tela de aviso amigável quando o gestor logado não tem empresa vinculada
        ├── LinkSeguroManager.jsx# Re-export para retrocompatibilidade do gerenciador de link seguro
        ├── AlterarSenhaModal.jsx# Re-export para retrocompatibilidade do modal de alteração de senha
        ├── AdminView.jsx        # Painel orquestrador do Administrador (modularizado e enxuto)
        ├── admin/               # Submódulos e formulários isolados do Painel do Administrador
        │   ├── AdminHeaderBanner.jsx      # Banner de identidade do gestor e alerta de suspensão Asaas
        │   ├── AdminTabBar.jsx            # Barra de navegação por abas com feedback visual e acessibilidade
        │   ├── AdminQuickLinkBar.jsx      # Barra de compartilhamento rápido com link seguro e WhatsApp
        │   ├── AdminStats.jsx             # Métricas agregadas em tempo real (Pontos, Turnos e Reservas)
        │   ├── FormAddTurno.jsx           # Formulário de criação de turnos com persistência do último dia
        │   ├── TurnosCadastradosList.jsx  # Acordeon por ponto com sanfona, status de vagas e agrupamento por dia
        │   ├── PontoTurnosAcordeon.jsx    # Card sanfona do ponto com métricas e lista de turnos por dia
        │   ├── TurnosDiaList.jsx          # Lista de turnos do dia com reordenação SortableJS e duplicação
        │   ├── AdminTurnoCard.jsx         # Card individual de turno com tags de participantes e ações
        │   ├── AdminZonaPerigo.jsx        # Bloco de zona de perigo para limpeza geral de reservas
        │   ├── DuplicarDiaModal.jsx       # Modal de replicação de turnos para múltiplos dias com presets
        │   ├── IncluirPessoaModal.jsx     # Modal para inclusão manual de colaborador no turno
        │   ├── EditarTurnoModal.jsx       # Modal para edição de horário e capacidade com validações
        │   ├── AlterarSenhaModal.jsx      # Modal para alteração segura de PIN pelo gestor da empresa
        │   ├── InputSenhaPin.jsx          # Campo reutilizável para entrada de senha/PIN com botão Eye/EyeOff
        │   ├── LayoutPreferencesCard.jsx  # Card para alternar modo de navegação (Abas vs Visão Contínua)
        │   ├── LinkSeguroManager.jsx      # Gerenciador de link seguro anti-espionagem (12 chars) com redefinição
        │   ├── VocabularioCard.jsx        # Card de atalho para customização de vocabulário e nicho
        │   ├── RegrasEscalaCard.jsx       # Card de configuração de bloqueio de conflito e cotas anti-monopólio
        │   ├── CotaStepperField.jsx       # Controle stepper touch-friendly de cota numérica ou Ilimitado
        │   ├── CotasPontosDropdown.jsx    # Menu suspenso multi-seleção para aplicar cotas a todos ou a pontos específicos
        │   ├── AdminSenhaCard.jsx         # Card de alteração da senha de contingência/admin
        │   ├── AdminTabEscala.jsx         # Submódulo da aba/seção de escala e turnos (com QuickLink, Stats, Form, Lista e Zona de Perigo)
        │   ├── AdminTabEquipe.jsx         # Submódulo da aba/seção de equipe e gestores
        │   ├── AdminTabConfiguracoes.jsx  # Submódulo da aba/seção de preferências, link seguro, vocabulário e senha
        │   ├── AdminModals.jsx            # Agrupador isolado de todos os 5 modais de administração
        │   ├── useAdminView.js            # Hook com estado, preferências, cálculos matemáticos, agrupamentos e mutações
        │   └── index.js                   # Barrel export de componentes e hook do admin
        ├── PontosManager.jsx    # Painel orquestrador modularizado e enxuto de gestão de pontos de captação
        ├── pontos/              # Submódulos e componentes isolados de gestão de pontos
        │   ├── usePontosManager.js        # Hook customizado para reordenação, CRUD de pontos, duplicação e Supabase
        │   ├── PontosHeader.jsx           # Cabeçalho da seção com título e indicador de salvamento de ordem
        │   ├── FormAddPonto.jsx           # Formulário de cadastro de novo ponto com feedback de loading
        │   ├── PontosList.jsx             # Lista reordenável via SortableJS com touch delay e fluidez mobile
        │   ├── PontoItem.jsx              # Card de ponto com drag-handle, vagas, edição inline e ações
        │   ├── PontoMobileMenu.jsx        # Menu dropdown suspenso touch-friendly com backdrop invisível
        │   └── DuplicarPontoModal.jsx     # Modal via Portal com trava de scroll para clonagem estrutural de turnos
        ├── GestoresManager.jsx  # Painel orquestrador modularizado e enxuto de gestão de coordenadores e gestores
        ├── gestores/            # Submódulos e componentes isolados de gestão de coordenadores e gestores
        │   ├── useGestores.js             # Hook customizado de dados, Realtime e mutações via RPCs do Supabase
        │   ├── GestoresHeader.jsx         # Cabeçalho com título, contador de membros e controle de sanfona
        │   ├── GestoresInfoCard.jsx       # Card explicativo dos papéis RBAC adaptado ao nicho/vocabulário
        │   ├── FormAddGestor.jsx          # Formulário de convite e vinculação de novo gestor ou coordenador
        │   ├── GestoresList.jsx           # Listagem com loading, empty state e renderização de membros
        │   └── GestorItem.jsx             # Card de membro com avatar, badge de papel/convite e remoção segura
        ├── EquipeManager.jsx    # Gerenciador orquestrador de equipe autorizada e proteção contra invasores
        ├── equipe/              # Submódulos e componentes isolados de gestão de equipe
        │   ├── useEquipe.js               # Hook customizado de dados, mutations, RPCs e Supabase Realtime
        │   ├── EquipeHeader.jsx           # Cabeçalho unificado com título, badges, switch e sanfona
        │   ├── EquipeStatusBanner.jsx     # Banner contextual de status da proteção (acesso restrito vs livre)
        │   ├── EquipeList.jsx             # Barra de busca, loading, empty state e lista de membros
        │   ├── EquipeMembroItem.jsx       # Card individual de colaborador com avatar, badges e ações
        │   ├── MembroDeviceVinculado.jsx  # Subcomponente para exibição e desvinculação do celular cadastrado
        │   ├── AdicionarMembroForm.jsx    # Formulário modular de cadastro de novos membros na equipe
        │   ├── EditarMembroModal.jsx      # Modal assíncrono para edição de dados do colaborador
        │   ├── TipoValidacaoSelector.jsx  # Seletor da política de validação da empresa (WhatsApp, E-mail ou Ambos)
        │   └── index.js                   # Barrel export de componentes e hook da equipe
        ├── AdicionarMembroForm.jsx # Re-export para retrocompatibilidade do formulário de cadastro de membro
        ├── EditarMembroModal.jsx # Re-export para retrocompatibilidade do modal de edição de membro
        ├── IdentificacaoCampos.jsx # Re-export para retrocompatibilidade dos campos de identificação
        ├── TipoValidacaoSelector.jsx # Re-export para retrocompatibilidade do seletor de política de validação
        ├── TurnosDiaList.jsx    # Lista de turnos por dia com drag-and-drop animado (SortableJS) e gestão de corretores
        ├── TenantNotFound.jsx   # Tela elegante de 404 quando o slug não existe com busca e demo
        ├── TenantErrorView.jsx  # Tela amigável para falhas críticas de configuração do tenant com retry
        ├── TenantBlockedView.jsx# Tela de suspensão amigável para empresas inadimplentes ou bloqueadas
        ├── ThemeToggle.jsx      # Botão animado de alternância Modo Claro / Escuro (Sun/Moon com persistência)
        └── Toast.jsx            # Notificações visuais animadas
```

---

## 5. Fluxos e Funcionalidades Detalhadas

### 5.1. Resolução de Tenant e Navegação Multi-Tenant
1. **Identificação por URL ou Subdomínio**:
   - Slug na URL: `meusaas.com/direcional` ou `meusaas.com/?empresa=direcional`
   - Subdomínio: `direcional.meusaas.com`
   - Fallback de memória: último slug acessado no `localStorage` (`escala_tenant_slug`), ou `'demo'`.
2. **Isolamento de Estado**:
   - Cada imobiliária tem seu `empresa_id` em todos os registros (`pontos`, `turnos`, `reservas`, `usuarios_empresas`).
   - WebSockets do Supabase Realtime filtram com `filter: 'empresa_id=eq.' + empresa.id`.

### 5.2. Fluxo do Corretor (Visão Pública — Zero-Atrito)
1. **Identificação transparente**: Ao carregar, o sistema obtém ou gera um `device_id` no `localStorage`.
2. **Seleção de Ponto de Captação**:
   - Exibe os pontos da empresa selecionada com status de vagas disponíveis em tempo real.
3. **Quadro de Horários e Acordeon por Dia da Semana**:
   - Agrupado pelos dias da semana na ordem cronológica natural (Segunda a Domingo).
   - Mostra horário, contagem de vagas, barra de progresso e nomes de quem já reservou.
   - "Garantir Vaga" (com modal de nome no 1º uso) e "Cancelar Minha Vaga".

### 5.3. Fluxo do Gestor / Administrador (Supabase Auth & RBAC)
1. **Acesso com E-mail e Senha**:
   - Modal com abas para login profissional, criação de conta de gestor e recuperação de senha.
   - Alternância de contingência para PIN legado da imobiliária.
2. **Validação de Tenant e Papel**:
   - `canManageEmpresa(empresa.id)` valida se o usuário possui acesso ativo como `'admin'` ou `'gestor'`.
   - Caso tente acessar imobiliária não autorizada, o modal lista suas imobiliárias com navegação em 1 clique.
3. **Banner de Identidade e Badges**:
   - No topo do `AdminView`, exibe nome, e-mail e badge contextual (`Admin da Imobiliária` ou `Gestor de Plantão`).
4. **Operações Protegidas**:
   - Criar, editar, reordenar e duplicar pontos e horários.
   - Alocar ou remover corretores manualmente de turnos.
   - Limpar escala da imobiliária com verificação de autorização no banco.

### 5.4. Gestão Centralizada da Plataforma (100% Supabase / Zero Frontend Attack Surface)
1. **Remoção Completa do Superadmin no Frontend**:
   - Toda gestão global (criação de novas imobiliárias, troca de planos, bloqueio/desbloqueio e associação de gestores) é realizada diretamente no painel do **Supabase Studio (Table Editor / SQL Editor)**.
   - Sem área de Superadmin no frontend, o sistema possui **zero superfície de ataque cliente-servidor** para funções de administração da plataforma, garantindo segurança máxima com 2FA nativo do Supabase.

---

## 6. Comandos e Execução
```bash
# Instalação de dependências
npm install

# Execução em ambiente de desenvolvimento (porta 5100 / host exposto para mobile)
npm run dev

# Build de produção
npm run build
```

---

## 7. Diretrizes para Manutenção e Futuras Extensões
- **Isolamento Multi-Tenant**: NUNCA executar `insert` ou `delete` em `pontos`, `turnos` ou `reservas` sem vincular ou filtrar por `empresa_id`.
- **Race Condition**: Toda reserva de novas vagas deve passar pela RPC `reservar_vaga` com row-level lock (`FOR UPDATE`).
- **Funções SECURITY DEFINER com search_path**: Todas as funções utilitárias de verificação (`is_superadmin`, `has_empresa_role`, etc.) devem conter `SET search_path = public` e `SECURITY DEFINER` para evitar recursão infinita no RLS.
- **Dark Mode & Light Mode**: Manter a consistência das classes `surface-900` a `500` e `text-gray-*`. Jamais utilizar cores claras sem o prefixo `dark:`.
- **Modais e Portals (React Portals)**: Todos os modais devem utilizar `createPortal(..., document.body)` e posicionamento centralizado com `fixed inset-0 z-50 flex items-center justify-center p-4` (com `max-h-[90vh] overflow-y-auto` e bloqueio de rolagem do body `overflow: hidden`).

---

## 8. Status Atual e Pendências para a Fase 3

### Concluído na Fase 2:
- ✅ **RBAC Granular para Coordenadores (`gestor`)**: Ações destrutivas (excluir ponto, renomear, duplicar e limpar escala) ocultadas em `PontosManager.jsx` e `AdminView.jsx`.
- ✅ **Componente GestoresManager.jsx**: Gestão de equipe de coordenação diretamente no painel do Admin, com vinculação por e-mail (`vincular_usuario_empresa`), seleção de papel ('admin' ou 'gestor'), listagem em tempo real e desvinculação.
- ✅ **Proteção Contra Invasores / Equipe Autorizada**: Tabela `equipe_corretores`, chave opcional `exigir_cadastro_previo` em `empresas`, validação na RPC `reservar_vaga` com WhatsApp e componente `EquipeManager.jsx`.
- ✅ **Prevenção de WhatsApp Duplicado na Equipe**: Índice único funcional `idx_equipe_corretores_empresa_zap_clean` no Postgres, validação dupla na RPC `adicionar_corretor_equipe` e checagem instantânea no front-end em `EquipeManager.jsx`.
- ✅ **Métricas Reais de Consumo**: RPC `get_metricas_empresas()` para agregação de pontos ativos, turnos e reservas de cada tenant diretamente no banco.
- ✅ **Resolução Amigável de Sessão**: Tratamento em `AdminLoginModal.jsx` para usuários logados sem vínculo com atalho de auto-vinculação via PIN (`vincular_com_pin`) e logout direto.

### Concluído na Fase 3 (Piloto Automático de Vendas & Blindagem de UI):
- ✅ **Blindagem de UI/UX do Corretor**: Cabeçalho na visão pública do corretor agora exibe nome/marca estática, sem dropdown, sem chevron e sem atalho para trocar de empresa. O `TenantSwitcherModal` é restrito à visão autenticada do Gestor.
- ✅ **Script SQL de Migração Fase 3 (`supabase_migration_fase3_asaas.sql`)**:
  - Campos de cliente e assinatura do Asaas em `empresas` (`asaas_customer_id`, `asaas_subscription_id`, `email_cobranca`, `telefone_cobranca`).
  - Tabela `asaas_webhooks_log` para auditoria e controle de idempotência.
  - RPC `reservar_vaga` atualizada com bloqueio estrito contra reservas em empresas com status `'bloqueado'` ou `'inativo'`.
  - RPC `provisionar_empresa_asaas` para criação autônoma de tenant, vinculação de gestor e geração de ponto inicial com turnos.
  - RPC `atualizar_status_empresa_asaas` para suspensão e reativação automática.
- ✅ **Supabase Edge Function (`supabase/functions/asaas-webhook/index.ts`)**:
  - Deploy realizado com sucesso no projeto `cpystvyhkstxfvkzfvkk` via Supabase CLI (`--no-verify-jwt`).
  - Endpoint ativo e verificado com resposta `HTTP 200 OK {"status":"online"}` em `https://cpystvyhkstxfvkzfvkk.supabase.co/functions/v1/asaas-webhook`.
  - Suporte completo aos eventos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `SUBSCRIPTION_DELETED`.
  - Provisionamento automático de novo usuário no Supabase Auth com senha provisória e link de ativação (`recovery`).
  - Idempotência baseada em hash de evento na tabela `asaas_webhooks_log`.
  - Reativação em tempo real de clientes que quitarem boletos/faturas atrasadas.
- ✅ **Tela de Bloqueio Amigável (`TenantBlockedView.jsx`)**:
  - Exibição de tela amigável e segura quando `empresa.status === 'bloqueado'`.
  - Canal direto via WhatsApp configurável via variável de ambiente `VITE_WHATSAPP_SUPORTE` para regularização rápida do gestor e comunicação clara para corretores.
  - Alerta integrado no topo do `AdminView.jsx` com atalho de regularização.

- ✅ **Remoção Completa da Área Superadmin no Frontend (Segurança Máxima 100% Supabase)**:
  - Exclusão dos componentes `SuperadminModal.jsx` (710 linhas) e `NovaEmpresaModal.jsx` (282 linhas).
  - Remoção de todos os botões de Coroa 👑 no cabeçalho e visões administrativa e pública.
  - Eliminação de qualquer superfície de ataque client-side para administração global de tenants.
  - Toda a gestão de plataformas (criação de empresas, atribuição de administradores, alteração de planos e status ativo/bloqueado) agora é realizada com total segurança diretamente no **Supabase Dashboard (Table Editor / SQL Editor)**.
  - Limpeza dos contextos `AuthContext` e `TenantContext`, mantendo o código modular, leve e sem dead-code.
  - Verificação de compilação com `npm run build` bem-sucedida (0 erros).

- ✅ **RPCs Seguras de Gestão de Equipe (Suporte Híbrido Auth & PIN)**:
  - Criação das RPCs `alternar_protecao_equipe`, `adicionar_corretor_equipe`, `alternar_status_corretor` e `remover_corretor_equipe` com `SECURITY DEFINER` em `supabase_migration_fase2_refinamentos.sql` e `supabase_schema.sql`.
  - Elimina bloqueios de RLS quando o gestor opera via PIN legado ou quando o usuário não autenticado interage com a equipe.
- ✅ **Botão Unificado de Expansão/Recolhimento em `AdminView.jsx`**:
  - Os botões duplicados "Recolher todos" e "Expandir todos" na seção **Turnos Cadastrados** foram unidos em um **único botão inteligente com alternância dinâmica**.
  - O botão detecta automaticamente se há algum ponto expandido para exibir **"Recolher todos"** (com `ChevronUp`) ou, caso estejam todos fechados, exibir **"Expandir todos"** (com `ChevronDown`).
- ✅ **Design System Retrátil e Cabeçalho Unificado em `EquipeManager.jsx`**:
  - O card agora se chama diretamente **"Proteção Contra Invasores"** com status (`Ativada (Restrito)` / `Desativada (Aberto)`), contagem de autorizados e o switch toggle liga/desliga integrado na mesma linha do cabeçalho.
  - Implementado o botão com a **seta de efeito sanfona em 2 linhas** (ícone `ChevronDown` / `ChevronUp` ao lado de `Gerenciar` / `Equipe`), mantendo exata paridade e alinhamento visual com o card de cima "Coordenadores & Gestores".
  - O painel expansível inclui card informativo contextual (explicando se o acesso está restrito à lista ou aberto a qualquer corretor com o link público), formulário de autorização rápida com máscara de WhatsApp e listagem com busca e ações contextuais.
- ✅ **Refinamento Minimalista no Cabeçalho (`App.jsx`)**:
  - Botões de ação do topo padronizados em formato somente ícone (Superadmin, Gestor/Admin, Sair e avatar com primeira letra + logout), mantendo consistência elegante e idêntica entre Desktop e Mobile.
  - Tooltips contextuais (`title` e `aria-label`) preservam a acessibilidade e identificação de cada ação ao passar o mouse.

### ⏳ Pendências Externas para Ativação Final do Asaas (A Fazer Depois pelo Usuário):
1. **Configurar as Secrets (Chaves) no Supabase**:
   - Pelo terminal:
     ```powershell
     supabase secrets set ASAAS_WEBHOOK_SECRET="seu_token_secreto_aqui" ASAAS_API_KEY="$aact_sua_chave_do_asaas" ASAAS_ENV="production" --project-ref cpystvyhkstxfvkzfvkk
     ```
   - Ou no Supabase Dashboard em **Project Settings** > **Edge Functions** > **Secrets**:
     - `ASAAS_WEBHOOK_SECRET`: Token de autenticação escolhido para autenticar os envios do webhook.
     - `ASAAS_API_KEY`: Chave da API do Asaas gerada em Minha Conta > Integração.
     - `ASAAS_ENV`: `production` (ou `sandbox` para homologação).

2. **Cadastrar o Webhook no Painel do Asaas**:
   - Acessar o Asaas em **Minha Conta** > **Integração** > **Webhooks** e cadastrar:
     - **URL do Webhook**: `https://cpystvyhkstxfvkzfvkk.supabase.co/functions/v1/asaas-webhook`
     - **Email de Notificação**: Seu e-mail de suporte técnico
     - **Token de Autenticação**: Informe exatamente o mesmo valor definido em `ASAAS_WEBHOOK_SECRET`
     - **Eventos Selecionados**:
       - `PAYMENT_CONFIRMED` *(criação do tenant, admin no Auth e turnos)*
       - `PAYMENT_RECEIVED` *(reativação de imobiliária suspensa)*
       - `PAYMENT_OVERDUE` *(bloqueio automático por atraso)*
       - `PAYMENT_REFUNDED` *(bloqueio automático por estorno)*
       - `SUBSCRIPTION_DELETED` *(bloqueio automático por cancelamento)*

---

## 8. Arquitetura de URLs, Portal do Gestor e Links Seguros Anti-Espionagem (Fase 4)

### 8.1. Separação de Ambientes e Portal Exclusivo do Gestor (`app.escalafacil.online`)
- **Subdomínio Dedicado**: O acesso administrativo fica isolado em `app.escalafacil.online` (detectado por `isAppPortal()`).
- **Comportamento quando desconectado**: Apresenta a tela dedicada de login e cadastro (`PortalGestorLogin.jsx`) com Supabase Auth (e-mail e senha) e suporte a PIN legado. O corretor nunca vê essa tela em seu link público.
- **Comportamento quando conectado**: Detecta automaticamente a imobiliária pertencente ao gestor logado e abre diretamente o `AdminView`, sem exibir opções de escala de corretor. O cabeçalho inclui botão de 1 clique "Escala Pública ↗" que abre o link dos corretores em nova aba.

### 8.2. Links Seguros dos Corretores (`escalafacil.online/[codigo12]`)
- **Token Aleatório de 12 Caracteres**: Gerado via função PostgreSQL `public.gerar_codigo_escala()` utilizando o alfabeto alfanumérico `[a-zA-Z0-9]` ($62^{12} \approx 3,22 \times 10^{21}$ combinações), ex: `https://escalafacil.online/A7bjs92Rlzm6`.
- **Anti-Espionagem Eficaz**: Concorrentes não conseguem adivinhar links ou espionar postos de captação de outras empresas trocando o slug na URL.
- **Blindagem no Frontend**: Na visualização pública do corretor, o botão de escudo/login administrativo é completamente omitido do cabeçalho, deixando a interface 100% voltada às reservas e sem portas de entrada visíveis para invasores.
- **Retrocompatibilidade**: Mantém compatibilidade com slugs existentes caso o código de 12 caracteres não seja encontrado.

### 8.3. Gerenciador de Links no Painel do Gestor (`LinkSeguroManager.jsx`)
- Integrado ao topo do `AdminView`, apresenta a URL oficial de compartilhamento com botões de 1 clique para "Copiar Link" e "Compartilhar Convite no WhatsApp".
- **Botão "Redefinir Link Seguro"**: Permite revogar o link anterior imediatamente e gerar um novo código de 12 caracteres caso o link tenha vazado ou corretores tenham sido desligados da imobiliária. Ação protegida por modal assíncrono `useConfirm` e RPC `redefinir_codigo_escala`.

---

## 9. Vocabulário & Nicho Dinâmico (White-Label) e Página de Vendas (Fase 5)

### 9.1. Vocabulário & Nichos Dinâmicos (`VocabularioModal.jsx` e `vocabularioHelper.js`)
- **Adaptação Camaleônica Multi-Nicho**: O SaaS não fica restrito a imobiliárias e construtoras. Cada empresa pode selecionar seu segmento ou customizar livremente suas palavras-chave.
- **Coluna `termos` (JSONB) em `empresas`**: Guarda os rótulos de interface de cada tenant (`ponto`, `pontos`, `pessoa`, `pessoas`, `tituloEscala`, `acaoVaga`, `acaoCancelar`, `textoWhatsapp`, `equipeAutorizada`).
- **Presets Nativos Disponíveis no Painel**:
  1. 🏢 **Imobiliárias & Construtoras**: Stands de vendas, pontos de captação e corretores.
  2. 🩺 **Saúde, Clínicas & Home Care**: Alas/postos, plantonistas, médicos e enfermeiros.
  3. 🍸 **Eventos, Bares & Buffets**: Setores do evento, freelas, garçons e bartenders.
  4. 🛒 **Trade Marketing & Varejo**: Lojas de varejo, supermercados e promotores de degustação.
  5. ⛪ **Igrejas & Voluntariado**: Ministérios, cultos, eventos sociais e voluntários.
  6. 🎾 **Arenas, Crossfit & Estúdios**: Quadras, boxes de treino e alunos/atletas.
  7. ⚖️ **Geral / Universal (Padrão)**: Pontos de escala, colaboradores e gestão de horários.
  8. ✏️ **Personalizado**: Permite ao gestor digitar qualquer nome que preferir.
- **Componentes Dinâmicos**: `CorretorView`, `TurnoCard`, `NomeModal`, `AdminView`, `PontosManager`, `EquipeManager` e texto copiado para o WhatsApp refletem instantaneamente a linguagem do nicho selecionado.

### 9.2. Página de Vendas Oficial (`LandingPage.jsx` em `https://escalafacil.online`)
- **Roteamento Inteligente (`isLandingPage()`)**:
  - `https://escalafacil.online/` $\rightarrow$ Renderiza a **Landing Page de Vendas**.
  - `https://escalafacil.online/demo` $\rightarrow$ Abre a escala demonstrativa ao vivo.
  - `https://escalafacil.online/[codigo12]` $\rightarrow$ Abre diretamente a escala da empresa do cliente.
  - `https://app.escalafacil.online` $\rightarrow$ Abre o **Portal do Gestor** para autenticação e administração.
- **Arquitetura de Alta Conversão (CRO)**:
  - **Hero Section**: Headline focada na dor universal (*"O fim das listas confusas no WhatsApp"*), badge de tempo real, CTAs de alta conversão e microprovas de valor.
  - **Simulador Interativo ao Vivo**: Permite ao visitante clicar em um card simulado na própria hero e testar a reserva de vaga em tempo real.
  - **Showcase Interativo de Nichos**: 6 abas dinâmicas mostrando a dor real vs. solução do EscalaFácil com vocabulário adaptado.
  - **Os 3 Passos Simples**: Cadastre horários $\rightarrow$ Envie no WhatsApp $\rightarrow$ Vagas preenchidas no piloto automático.
  - **Grid de Benefícios**: Zero atrito (sem app), tempo real WebSockets, proteção anti-invasores, link anti-espionagem, anti-colisão transacional e cópia para o WhatsApp.
  - **Plano Start**: R$ 27/mês no anual (R$ 324/ano) ou R$ 47/mês no mensal. Limite de até 3 locais/pontos e até 15 colaboradores.
  - **Plano Pro**: R$ 47/mês no anual (R$ 564/ano) ou R$ 67/mês no mensal. Limite de até 10 locais/pontos e até 50 colaboradores. Destaque principal "Mais Escolhido".
  - **Plano Elite**: R$ 77/mês no anual (R$ 924/ano) ou R$ 97/mês no mensal. Locais e colaboradores ilimitados, proteção anti-invasores, white-label de vocabulário e suporte VIP.
  - Alternador Anual / Mensal com economia destacada (abre por padrão no plano anual).
  - 7 dias de garantia incondicional e suporte WhatsApp.
  - **FAQ Acordeon**: Respostas completas sanando todas as principais objeções de compra.

---

## 10. Refinamentos de UI/UX e Microinterações (Novembro/2026)
- **Generalização Completa de Coordenadores e Gestores (`GestoresManager.jsx`)**:
  - Removidas todas as referências estáticas a "imobiliária", "corretores" e "plantões".
  - Integrado com `termos` dinâmicos da empresa para adaptar o texto explicativo de permissões de acordo com o nicho (locais/pontos e participantes/colaboradores).
  - Badges atualizadas para `"Administrador"` e `"Gestor da Escala"`.
  - Placeholder ajustado para `gestor@empresa.com` e botão para `"Vincular Gestor"`.
  - Opções do seletor de papel atualizadas para `"Coordenador (Gestão de Vagas)"` e `"Administrador (Acesso Total)"`.
  - **Estado por Padrão Fechado com Persistência**: O card de Coordenadores e Gestores (assim como o de Equipe) agora inicia recolhido (`false`) por padrão ao carregar a página pela primeira vez, e persiste a preferência de expansão/recolhimento do usuário no `localStorage` por tenant (`escala_gestores_expanded_${empresaId}`).
- **Limpeza Total do Cabeçalho e Remoção de Redundâncias (`App.jsx`)**:
  - Removido o subtítulo `"Minha Imobiliária"` do cabeçalho, deixando apenas a identidade visual limpa `EscalaFácil [Gestão]`.
  - Removido o botão redundante `"Escala Pública"` do topo do cabeçalho (já disponível de forma nativa e compacta no card `Link Seguro da Escala`).
  - Removido o modal legado `TenantSwitcherModal.jsx` e o seletor com dropdown de empresas.
  - Termos generalizados de `"Admin da Imobiliária"` / `"Gestor de Plantão"` para `"Administrador"` e `"Gestor"`.
- **Generalização e Limpeza do Card de Link Seguro (`LinkSeguroManager.jsx`)**:
  - Título alterado de `"Link Seguro dos Corretores"` para **`"Link Seguro da Escala"`**, tornando-o 100% universal para qualquer segmento (imobiliárias, eventos, clínicas/saúde, varejo, igrejas, academias).
  - Removido o subtítulo redundante `"Código seguro de 12 caracteres para blindar os pontos..."`, deixando o cabeçalho do card limpo e direto.
  - Removido o badge `"12 chars"` de dentro do input, liberando largura total para a visualização da URL.
  - Integrado com `obterTermos(empresa)` para mensagens dinâmicas de compartilhamento no WhatsApp e diálogos de confirmação de revogação.
- **Botão de Copiar Link Seguro Compacto (`LinkSeguroManager.jsx`)**:
  - Removido o rótulo de texto `"Copiar Link"`, deixando o botão com apenas o ícone (`Copy` / `Check` ao copiar).
  - Alinhado como um bloco de botões de ícone com `min-h-[40px] min-w-[40px]` e design idêntico ao WhatsApp e visualização externa, eliminando poluição visual e garantindo layout perfeito em linha única tanto no mobile quanto no desktop.
- **Unificação dos Botões "Recolher todos" e "Expandir todos" na Visão do Corretor (`CorretorView.jsx`)**:
  - Unificados os dois botões anteriores em um **único botão inteligente com alternância dinâmica**.
  - O botão detecta automaticamente via `algumDiaExpandido` se há algum dia aberto para exibir **"Recolher todos"** (com `ChevronUp`) ou, caso estejam todos fechados, exibir **"Expandir todos"** (com `ChevronDown`).

---

## 11. Arquitetura Modular por Abas com Alternador de Layout (Fase 6 — Novembro/2026)
- **Eliminação da Coluna Vertical Infinita ("Scroll Fatigue") no Painel do Gestor (`AdminView.jsx`)**:
  - Separou o painel de administração em **4 menus temáticos (Abas)** limpos, responsivos e touch-friendly (mínimo de 44px de altura touch target):
    1. 📅 **Escala & Turnos**: Operação diária com acesso rápido ao link da escala (copiar e WhatsApp em 1 clique), métricas rápidas (pontos, turnos, reservas), criação de turnos, quadro de turnos com sanfona por ponto/dia, duplicação e zona de perigo.
    2. 👥 **Pessoas & Equipe**: Centraliza a proteção contra invasores com lista autorizada (`EquipeManager`) e gestão de coordenadores/gestores com acesso administrativo (`GestoresManager`).
    3. 📍 **Pontos & Locais**: Gestão de locais físicos com drag-and-drop, criação, ordenação, pausa e limpeza (`PontosManager`).
    4. ⚙️ **Ajustes & Configurações**: Preferências de visualização do painel, gerenciador completo do link seguro anti-espionagem de 12 caracteres com redefinição (`LinkSeguroManager`), white-label de vocabulário e nicho (`VocabularioModal`), e alteração de senha de administrador (`AlterarSenhaModal`).
- **Alternador de Layout Bidirecional (Zero Risco & Liberdade do Usuário)**:
  - Adicionado botão de alternância suave no cabeçalho e card explicativo nas configurações:
    - 📑 **Modo em Abas (Padrão / Focado)**: Foco operacional limpo por área temática, sem poluição visual.
    - 📜 **Visão Contínua (Clássico / Legado)**: Exibe todos os blocos empilhados verticalmente em uma única página longa com scroll, preservando o layout familiar.
  - Persistência das preferências no `localStorage` via chaves `escala_admin_layout_mode` e `escala_admin_active_tab`.
  - Zero duplicação de código: todos os submódulos, modais e handlers são compartilhados diretamente entre os dois modos de visualização.
- **Barra de Abas Ultra-Compacta com Ícones Puros e Tooltips (`AdminView.jsx`)**:
  - Removidos os rótulos de texto e badges numéricos de dentro dos botões de abas, deixando apenas os 4 ícones limpos em um grid simétrico de 4 colunas perfeitamente distribuídas (`w-5 h-5`, touch target de `44px`).
  - **Reordenação e Aba Padrão**: A aba 📍 **Pontos de Escala** (`'pontos'`) foi definida como a **primeira da lista** e como a **aba padrão** de abertura ao carregar o painel em Modo Abas, facilitando a visualização e criação de novos locais/stands imediatamente.
  - O botão avulso de alternância de modo foi removido do topo para evitar poluição visual, mantendo a alternância centralizada no card dedicado dentro da aba ⚙️ Configurações.
  - Na Visão Contínua, o card intermediário foi totalmente removido e substituído por um botão puro de ícone (`LayoutGrid`, sem texto) posicionado no extremo direito do card de identificação do gestor para retorno imediato ao Modo em Abas.
  - Tooltips nativos dinâmicos via atributo `title` ao passar o mouse em cada ícone (*"Pontos"*, *"Escala"*, *"Equipe"* e *"Configurações"*).
  - Eliminação total de qualquer barra de rolagem horizontal (`overflow-x`), garantindo encaixe 100% responsivo em qualquer tela.


- **Botões de Ação do Link Seguro Apenas com Ícones (`renderQuickLinkBar` em `AdminView.jsx`)**:
  - Removidos os textos `"Copiar"` e `"WhatsApp"` dos botões de ação rápida no card do Link Seguro da aba Escala.
  - Transformados em um trio de botões de ícone puros (`Copy`/`Check`, `Share2` WhatsApp e `ExternalLink` Configurações) com proporção 40x40px, idênticos ao padrão do `LinkSeguroManager.jsx`, com tooltips nativos ao passar o mouse.
- **Eliminação Completa do Flicker ("2 Piscadas / F5") ao Alternar Abas (`AuthContext`, `TenantContext` e `App.jsx`)**:
  - **Causa Raiz Identificada**: Ao alternar o foco entre abas do navegador, o SDK do Supabase disparava eventos de verificação de sessão/token (`TOKEN_REFRESHED`). O `AuthContext` re-executava `fetchUserData` desnecessariamente e gerava uma nova referência de array para `minhasEmpresas`, acionando o `useEffect` de `TenantContext`, que por sua vez definia `loading = true` (desmontando a aplicação inteira para exibir o spinner de tela cheia). Em seguida, `App.jsx` executava `fetchData(false)` com `loading = true`, gerando uma segunda piscada visual em cascata.
  - **Correção Aplicada**:
    1. `AuthContext.jsx`: O listener `onAuthStateChange` agora ignora eventos corriqueiros de `TOKEN_REFRESHED` se o `userId` não mudou, e preserva a igualdade referencial dos estados `perfil` e `minhasEmpresas` via comparação profunda antes de disparar re-render.
    2. `TenantContext.jsx`: Implementado padrão *Stale-While-Revalidate* — se a empresa já está carregada em memória (`empresaRef.current`), jamais aciona `setLoading(true)` bloqueante. Compara `targetKey` e evita refetch fantasma ao alternar foco de abas.
    3. `App.jsx`: A tela de carregamento cheia agora só é exibida na primeira carga absoluta (`tenantLoading && !empresa`). O carregamento de turnos/pontos passa a ser silencioso (`isSilent = true`) quando dados já existem em tela (`loading && pontos.length === 0`), garantindo transição 100% suave e sem nenhum piscar.

---

## 12. Fluxo de Recuperação e Correção de Identidade no Modo Contra Invasores (Novembro/2026)
- **Problema de UX e Dead-End Identificado**:
  - Quando o modo contra invasores (`exigir_cadastro_previo`) estava ativo e um corretor digitava um WhatsApp com erro de digitação ou ainda não autorizado pela coordenação, o sistema salvava o nome e WhatsApp no `localStorage`.
  - Ao receber o erro da RPC `reservar_vaga` (*"Acesso restrito: Seu cadastro não foi encontrado na equipe desta imobiliária"*), o modal já havia fechado.
  - Ao clicar novamente em "Garantir Vaga" para tentar digitar outro número, o sistema verificava que `corretorNome` e `corretorWhatsapp` já existiam em memória/localStorage, pulando a abertura do `NomeModal` e reenviando em loop infinito os mesmos dados rejeitados, travando o usuário sem opção de corrigir o telefone.
- **Solução Implementada (Engenharia Preventiva & Zero-Atrito)**:
  1. **Reabertura Automática com Feedback Contextual (`NomeModal.jsx` & `App.jsx`)**:
     - Ao detectar a exceção de acesso restrito / não autorizado, o sistema agora seta a flag `cadastroNaoAutorizado = true` e **reabre imediatamente o `NomeModal`** com os dados previamente digitados, destacando um alerta explicativo amigável em vermelho/âmbar dentro do modal.
     - O campo de WhatsApp recebe foco e seleção automática (`.select()`) para que o usuário possa corrigir o DDD ou os dígitos com zero atrito.
  2. **Intercepção Preventiva no Clique (`handleReservar` em `App.jsx`)**:
     - Se `cadastroNaoAutorizado` for `true`, qualquer clique futuro em "Garantir Vaga" abre diretamente o `NomeModal` com mensagem de correção, em vez de reenviar a requisição rejeitada ao banco de dados.
  3. **Botão Universal "Alterar meus dados" e Card de Correção (`CorretorView.jsx` — `CorretorIdentityHeader`)**:
     - Criado o componente modular `CorretorIdentityHeader` presente tanto na tela de seleção de pontos quanto no quadro de horários.
     - Exibe a saudação limpa apenas com o nome (`Olá, Nome 👋`) e um botão discreto minimalista com ícone de lápis (`Pencil`), sem expor o número de telefone na linha e sem texto longo no botão.
     - Se o cadastro estiver pendente de autorização (`cadastroNaoAutorizado === true`), exibe um card de alerta destacado com o botão de 1 clique **"Corrigir número agora"**.
  4. **Atualização Reativa de Identidade**:
     - Ao submeter o formulário sem pendência de vaga (edição voluntária), salva no `localStorage`, reseta os erros e emite o toast *"Identificação atualizada com sucesso! ✅"*.
     - Se houver turno pendente, prossegue automaticamente para garantir a vaga com os dados corrigidos.

---

## 13. Proteção Contra Múltiplos Usuários com o Mesmo Telefone & Anti-Spoofing (Fase 6 — Novembro/2026)
- **Problema Identificado**:
  - Usuários conseguiam cadastrar múltiplos nomes diferentes na escala utilizando o mesmo número de WhatsApp.
  - No Modo Contra Invasores, se um número estivesse na equipe autorizada (ex: "Carlos Silva"), qualquer pessoa poderia digitar outro nome (ex: "Usuario 1", "Usuario 2") e o sistema salvava reservas com esses nomes avulsos, pois a RPC apenas checava se o telefone existia na equipe, mas não amarrava a reserva ao nome oficial do membro.
  - Além disso, a verificação de duplicidade de reserva no mesmo turno checava apenas `device_id`, permitindo que um mesmo telefone reservasse múltiplas vagas no mesmo turno usando navegadores diferentes ou alterando os dados.
- **Solução Implementada (Frontend & Backend)**:
  1. **Script de Migração SQL (`supabase_migration_fase6_telefone_unico.sql`)**:
     - **Vínculo Estrito com Nome Oficial**: No Modo Contra Invasores, a RPC `reservar_vaga` agora busca o membro oficial na `equipe_corretores` e força `v_nome_final := v_nome_oficial`. Ninguém consegue forjar nomes avulsos com o telefone de outro corretor.
     - **Regra de Telefone Único por Empresa**: A RPC impede que um mesmo WhatsApp seja associado a nomes diferentes na mesma empresa em `reservas`. Se o telefone já estiver em uso por outro corretor, bloqueia com mensagem explicativa.
     - **Trava de Turno Completa**: A verificação de vaga duplicada no mesmo turno agora checa `device_id`, `corretor_whatsapp` (dígitos limpos) e `corretor_nome`, impedindo que o mesmo telefone reserve mais de uma vaga no mesmo horário.
     - **Índice Único em `equipe_corretores`**: Criado índice único `idx_equipe_corretores_empresa_zap_unico` para impedir cadastros duplicados do mesmo telefone na equipe.
  2. **Identificação Inteligente Reativa no Frontend (`NomeModal.jsx`)**:
     - Campo de WhatsApp posicionado como identificador primário no formulário.
     - Ao digitar o WhatsApp (10-11 dígitos), o modal consulta a equipe em tempo real:
       - Se autorizado: preenche automaticamente o Nome com o registro oficial, bloqueia o campo contra alterações maliciosas (`readOnly`) e exibe badge verde: *"✓ Cadastro autorizado: [Nome]"*.
       - Se a empresa exigir cadastro e o número não for encontrado: exibe aviso em tempo real e desabilita o botão de confirmação.
       - Se não exigir cadastro prévio mas o telefone já pertencer a outro corretor na escala: alerta sobre o conflito e impede a apropriação indevida do telefone.
  3. **Normalização de DDI 55 (`EquipeManager.jsx` & RPCs)**:
     - Normalização inteligente que remove DDI `55` em números de 12 ou 13 dígitos, garantindo consistência absoluta nas comparações.

---

## 14. Validação por E-mail Corporativo e Flexibilidade de Identificação (Fase 7 — Novembro/2026)
- **Motivação e Generalização**:
  - A plataforma expandiu para múltiplos nichos e segmentos de mercado (saúde, eventos, varejo, corporate, etc.) onde o uso de **E-mail Corporativo/Institucional** é prioritário ou complementar ao WhatsApp.
  - Substituição da nomenclatura restritiva de *"corretor"* por **"colaborador"** / **"membro"**, mantendo a identidade universal em todos os fluxos.
- **Solução Implementada (Arquitetura Limpa e Componentizada)**:
  1. **Script de Migração SQL (`supabase_migration_fase7_validacao_email.sql` e sincronizado em `supabase_schema.sql`)**:
     - **Coluna `tipo_validacao_equipe`** em `empresas` (`'whatsapp'`, `'email'`, `'ambos'`, default `'whatsapp'`).
     - **Coluna `email`** em `equipe_corretores` com busca case-insensitive (`idx_equipe_corretores_email_lower`) e índice único parcial (`idx_equipe_corretores_empresa_email_unico`).
     - **Flexibilização da Tabela**: `whatsapp` em `equipe_corretores` passa a permitir `NULL` para empresas que operam exclusivamente com e-mail corporativo.
     - **Coluna `corretor_email`** na tabela `reservas` para auditoria e rastreamento completo de identidade.
     - **RPC `alternar_tipo_validacao_equipe`**: Permite aos administradores alterar com segurança a política de identificação do tenant.
     - **RPC `adicionar_corretor_equipe`**: Aceita WhatsApp e/ou E-mail, aplicando regras de obrigatoriedade e checagem de duplicidade no banco.
     - **RPC `reservar_vaga`**: Valida a equipe autorizada conforme o modo configurado (`'whatsapp'`, `'email'` ou `'ambos'`), aplica proteção anti-spoofing em reservas e amarra o registro ao nome oficial.
     - **RPC `cancelar_vaga`**: Suporte a cancelamento seguro por `device_id`, WhatsApp ou E-mail.
  2. **Módulos Utilitários e Hooks Dedicados (`src/lib/validacaoHelper.js` & `src/hooks/useVerificacaoIdentidade.js`)**:
     - `validacaoHelper.js`: Funções puras de validação, normalização e metadados das opções de validação.
     - `useVerificacaoIdentidade.js`: Hook desacoplado com consulta reativa e debounced (220ms) na equipe e em reservas.
  3. **Componentes Modulares sem Inflar Arquivos Existentes**:
     - `TipoValidacaoSelector.jsx`: Seletor touch-friendly para o gestor alternar entre WhatsApp, E-mail Corporativo e Ambos.
     - `AdicionarMembroForm.jsx`: Submódulo dedicado no `EquipeManager.jsx` com campos adaptáveis conforme a política ativa.
     - `IdentificacaoCampos.jsx`: Submódulo para o `NomeModal.jsx` renderizando os campos e feedbacks de validação em tempo real.
  4. **Integração no Fluxo de Reserva (`App.jsx`, `CorretorView.jsx`, `TurnoCard.jsx`)**:
     - Detecção inteligente de campos pendentes antes de abrir o modal.
     - Persistência no `localStorage` de `escala_corretor_email`.
     - Identificação de reservas próprias no `TurnoCard` contemplando `corretor_email`.

---

## 15. Trava Estrita de Identidade por Aparelho e Anti-Sabotagem (Fase 8 — Novembro/2026)
- **Problema de Sabotagem Identificado (Concorrência Interna / Amigos com Má Intenção)**:
  - Como o WhatsApp ou e-mail corporativo de um colega é de conhecimento público entre os membros da equipe, um colaborador mal-intencionado poderia digitar o telefone/e-mail de outro colega em seu próprio celular.
  - Isso permitia duas ações indevidas:
    1. **Cancelamento indevido**: O colega conseguia ver o botão vermelho *"Cancelar Minha Vaga"* e liberar a vaga do outro.
    2. **Reserva indevida / Falsidade de identidade**: O colega conseguia garantir vagas em horários indesejados ou bloquear plantões fingindo ser outra pessoa.
- **Solução Implementada (Arquitetura 100% Zero-Atrito com Trava de Hardware/Device ID)**:
  1. **Script de Migração SQL (`supabase_migration_fase8_vinculo_aparelho.sql` e sincronizado em `supabase_schema.sql`)**:
     - **Coluna `device_id`** adicionada na tabela `equipe_corretores` com índice rápido.
     - **Vínculo Automático no 1º Uso**: Na primeira vez que o colaborador reserva uma vaga utilizando seu WhatsApp ou E-mail, a RPC `reservar_vaga` grava seu `device_id` no cadastro oficial da equipe.
     - **Bloqueio Transacional de Aparelhos Terceiros**: Se outro aparelho tentar reservar utilizando o WhatsApp ou E-mail do colega, a RPC barra imediatamente: *"Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular. Por segurança, cada colaborador deve acessar pelo seu próprio aparelho."*.
     - **Cancelamento Estritamente por `device_id`**: A RPC `cancelar_vaga` exige estritamente `device_id = p_device_id`. Ninguém em outro aparelho consegue cancelar a vaga de um colega.
     - **RPC `desvincular_aparelho_corretor`**: Permite aos administradores e coordenadores desvincular o aparelho de um colaborador com 1 clique caso ele tenha trocado de celular ou formatado o navegador.
  2. **Intercepção em Tempo Real no Frontend (`useVerificacaoIdentidade.js` & `NomeModal.jsx`)**:
     - Ao digitar o WhatsApp/E-mail de um colega cujo cadastro já tem aparelho vinculado, o modal acusa em tempo real: *"Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular..."* e desabilita o botão de confirmação.
  3. **Visualização no Painel do Gestor (`EquipeManager.jsx`)**:
     - Badge visual *"Celular vinculado 📱"* em colaboradores que já registraram seu aparelho.
     - Botão de ação rápida de **Smartphone** com confirmação (`useConfirm`) para desvincular o celular quando necessário.
  4. **Frontend Público (`TurnoCard.jsx` e `CorretorView.jsx`)**:
     - O botão *"Cancelar Minha Vaga"* e a etiqueta *"VOCÊ"* aparecem exclusivamente no aparelho físico que realizou a reserva (`r.device_id === deviceId`), eliminando qualquer risco de cancelamento acidental ou sabotagem entre colegas.

---

## 16. Edição de Colaboradores e Resolução de Pendências (Fase 9 — Novembro/2026)
- **Problema de UX e Gestão de Dados**:
  - Quando a imobiliária mudava a política de identificação para E-mail ou Ambos, membros cadastrados anteriormente ficavam com *"E-mail pendente"*, porém não havia interface para editar os dados do colaborador sem ter que excluí-lo e recriá-lo.
- **Solução Implementada**:
  1. **Script de Migração SQL (`supabase_migration_fase9_editar_colaborador.sql` e sincronizado em `supabase_schema.sql`)**:
     - **RPC `editar_corretor_equipe`**: Atualiza `nome`, `whatsapp` e `email` com checagem de permissões (`has_empresa_role`), validação de formato e garantia de unicidade (anti-duplicidade) em relação a outros membros da empresa.
  2. **Componente Modular `EditarMembroModal.jsx`**:
     - Modal com foco em edição de dados do colaborador (Nome Completo, WhatsApp e E-mail Corporativo).
     - Alerta visual contextual para preenchimento de campos pendentes exigidos pela empresa.
     - Suporte a desvincular aparelho celular diretamente do modal quando aplicável.
  3. **Integração no `EquipeManager.jsx`**:
     - Botão de ação com ícone de lápis (`Pencil`) em cada colaborador da lista.
     - Badge interativa *"E-mail pendente"* clicável com atalho direto de 1 clique para abrir o modal de edição e incluir o e-mail faltante.
  4. **Blindagem do Frontend Público (`CorretorView.jsx`)**:
     - Remoção do botão de lápis ("Alterar meus dados") ao lado da saudação `Olá, [Nome] 👋` do colaborador.
     - Uma vez identificado e validado na equipe, os dados ficam fixos e blindados no aparelho do colaborador. Alterações cadastrais de nome, telefone e e-mail passam a ser de gestão exclusiva da coordenação via painel do gestor, impedindo troca indevida de identidade ou usurpação de cadastro entre colegas.

---

## 17. Modularização e Componentização do App.jsx (Novembro/2026)
- **Motivação e Refatoração de Arquitetura**:
  - O arquivo `App.jsx` encontrava-se monolítico com mais de 850 linhas, acumulando 6 responsabilidades distintas (roteamento de alto nível, queries e subscriptions do Supabase Realtime, regras de reservas e cancelamentos, identidade Zero-Atrito com localStorage, layout do cabeçalho e telas de estados especiais).
- **Solução Implementada (Clean Code & SOLID)**:
  1. **Redução e Orquestração Enxuta (`App.jsx`)**:
     - `App.jsx` reduzido de 850 para ~310 linhas, operando estritamente como orquestrador de gateways de acesso, layouts e rotas da aplicação.
  2. **Hook `src/hooks/useEscalaData.js`**:
     - Centraliza a busca e cache silencioso de `pontos`, `turnos` e `reservas`.
     - Subscriptions do Supabase Realtime com filtro estrito por `empresa_id` em `reservas`, `turnos` e `pontos`.
     - Ação administrativa de limpeza de escala (`handleLimparEscala`) com diálogo `useConfirm`.
  3. **Hook `src/hooks/useColaborador.js`**:
     - Encapsula a identidade do colaborador (`device_id` UUID, `corretorNome`, `corretorWhatsapp`, `corretorEmail`).
     - Ações de reserva (`handleReservar`, `handleReservarComDados`) e cancelamento com confirmação (`handleCancelar`).
     - Controle de estado do modal de identificação (`NomeModal`), pendências de turno e tratamentos de erro de autorização de equipe.
  4. **Subcomponentes Especializados de Interface**:
     - `src/components/AppHeader.jsx`: Cabeçalho unificado com botão voltar, logotipo, badge "Gestão", alternador de tema e botão de logout.
     - `src/components/PortalSemEmpresaView.jsx`: Tela amigável para gestores autenticados no portal que ainda não possuem empresa vinculada.
     - `src/components/TenantErrorView.jsx`: Tela amigável com retry para falhas de configuração de tenant.











---

## 18. Arquitetura Modular e Componentização dos Núcleos Principais (AdminView, AdminLoginModal e CorretorView) — Novembro/2026
- **Objetivo da Refatoração**:
  - Eliminar arquivos monolíticos residuais no frontend, aplicando Clean Code, SOLID e componentização modular por padrão conforme a diretriz de Engenheiro de Software Sênior.
- **Módulos Refatorados e Subcomponentes Criados**:
  1. **Visão Pública do Corretor (`CorretorView.jsx` & `src/components/corretor/`)**:
     - `CorretorView.jsx` reduzido de 644 para ~150 linhas, atuando puramente como componente orquestrador de estado e visualizações.
     - `PontoSelectorView.jsx`: Tela pública inicial para seleção de ponto com contagem de turnos, status de vagas em tempo real e estado vazio amigável.
     - `PontoTurnosView.jsx`: Visualização dos turnos do ponto selecionado com navegação de retorno, cabeçalho do local e botão unificado para expandir/recolher todos os dias.
     - `DiaAcordeonItem.jsx`: Item individual de acordeon por dia com cálculo de lotação, indicador "Sua vaga" com trava estrita de aparelho e renderização de `TurnoCard`.
     - `useDiasAcordeon.js`: Hook dedicado para gerenciamento do estado dos acordeons e persistência no `localStorage` isolada por empresa.
     - `CorretorIdentityHeader.jsx`: Cabeçalho com saudação e alerta de não autorização com botão de correção.
     - `CorretorCopyFooter.jsx`: Barra fixa inferior com botão de cópia formatada para o WhatsApp e espaçador seguro para dispositivos móveis.
     - `escalaTextoHelper.js`: Utilitários puros de formatação de texto para WhatsApp e cópia via Clipboard API com fallback seguro.
  2. **Painel do Administrador (`AdminView.jsx` & `src/components/admin/`)**:
     - `AdminView.jsx` transformado em orquestrador enxuto com submódulos especializados:
       - `AdminHeaderBanner.jsx`: Banner de perfil do gestor logado e alerta de suspensão Asaas.
       - `AdminTabBar.jsx`: Barra de navegação por abas com acessibilidade e feedback visual.
       - `AdminQuickLinkBar.jsx`: Acesso rápido ao link seguro e compartilhamento WhatsApp.
       - `AdminStats.jsx`: Métricas agregadas de pontos, turnos e reservas em tempo real.
       - `FormAddTurno.jsx`: Formulário para cadastro de turnos com persistência do último dia selecionado.
       - `TurnosCadastradosList.jsx`: Listagem sanfonada por ponto e dia com contagem de ocupação.
       - `AdminZonaPerigo.jsx`: Zona de perigo para limpeza geral de reservas com confirmação.
       - `DuplicarDiaModal.jsx`: Modal de replicação de turnos em múltiplos dias.
       - `IncluirPessoaModal.jsx`: Modal para encaixe manual de colaborador pela coordenação.
       - `EditarTurnoModal.jsx`: Modal para alteração de horário e capacidade de turno.
       - `LayoutPreferencesCard.jsx`: Preferência de layout (Abas vs Visão Contínua).
       - `VocabularioCard.jsx`: Atalho para personalização de vocabulário e nicho.
       - `AdminSenhaCard.jsx`: Card de alteração do PIN de contingência.
  3. **Modal de Autenticação do Gestor (`AdminLoginModal.jsx` & `src/components/admin-login/`)**:
     - Orquestrador modularizado para fluxo de autenticação e RBAC:
       - `adminAuthHelper.js`: Lógica de verificação, autenticação institucional e auto-vinculação por PIN.
       - `AuthFeedback.jsx`: Alertas e mensagens de status.
       - `AcessoRestritoView.jsx`: Tela para usuário logado que não possui acesso ao tenant ativo.
       - `LoginForm.jsx`: Formulário institucional de E-mail e Senha.
       - `CadastroForm.jsx`: Formulário de criação de nova conta de gestor.
       - `RecuperarSenhaForm.jsx`: Formulário para redefinição de senha esquecida.
       - `PinLegadoForm.jsx`: Formulário de contingência via PIN numérico legado.

---

## 19. Modularização e Componentização do EquipeManager.jsx (`src/components/equipe/`) — Novembro/2026
- **Objetivo da Refatoração**:
  - `EquipeManager.jsx` possuía mais de 770 linhas de código com múltiplas responsabilidades misturadas (queries Supabase, canais Realtime WebSockets, chamadas a RPCs e fallbacks diretos de banco, diálogos modais de confirmação, persistência no localStorage, layout de sanfona, cabeçalho de proteção contra invasores com switch de ativação, banner explicativo de regras, barra de busca com debounce e filtros de texto, e listagem complexa de membros com múltiplos badges e 4 botões contextuais de ação).
- **Estrutura Criada (`src/components/equipe/`)**:
  1. `useEquipe.js`: Hook customizado responsável pelo ciclo de vida dos dados da equipe, channel Realtime em `equipe_corretores`, mutations com chamadas seguras a RPCs (`alternar_protecao_equipe`, `adicionar_corretor_equipe`, `editar_corretor_equipe`, `alternar_status_corretor`, `remover_corretor_equipe`, `desvincular_aparelho_corretor`), diálogos `useConfirm` e fallbacks de tabela resilientes.
  2. `EquipeHeader.jsx`: Cabeçalho unificado com título, badges contextuais (status de proteção e contador de autorizados), botão switch acessível (`role="switch"`) e botão de sanfona (expandir/recolher).
  3. `EquipeStatusBanner.jsx`: Banner informativo contextual (Proteção Ativada vs Desativada) adaptado aos termos dinâmicos da empresa (`termos`).
  4. `EquipeList.jsx`: Gerenciamento da barra de busca de membros (para mais de 3 colaboradores), feedback visual de carregamento (`loading`), mensagem amigável de estado vazio e container scrollável.
  5. `EquipeMembroItem.jsx`: Card individual de colaborador com avatar com inicial, badges informativas (Inativo, Celular vinculado e E-mail pendente), links para WhatsApp e e-mail com mailto, e botões de ação com feedback (Editar, Desvincular aparelho celular, Alternar Ativo/Inativo e Excluir).
  6. `index.js`: Ponto central de re-exportação para importações limpas e idiomáticas.
- **Resultado**:
  - `EquipeManager.jsx` transformado em um orquestrador limpo, declarativo e altamente legível, reduzido de 773 linhas para ~140 linhas (~80% de redução no tamanho do arquivo principal), preservando 100% dos comportamentos de tela, acessibilidade, compatibilidade retroativa e sincronização em tempo real.

---

## 20. Modularização e Componentização do PontosManager.jsx (`src/components/pontos/`) — Novembro/2026
- **Objetivo da Refatoração**:
  - `PontosManager.jsx` possuía 766 linhas em um único componente monolítico, acumulando múltiplas responsabilidades: gerenciamento de estado e operações com Supabase (reordenação por batch de updates, criação com status inicial oculto, renomeação inline, exclusão em cascata e clonagem completa de turnos), integração do SortableJS com delay touch e listeners de arrasto, menus suspensos mobile com backdrops, inline-editing com listeners de tecla (Enter/Esc), cabeçalho de seção com indicador pulsante de salvamento, formulário de cadastro com restrição de permissão de administrador (`isFullAdmin`) e modal complexo de duplicação via `createPortal` com bloqueio de rolagem do body.
- **Estrutura Criada (`src/components/pontos/`)**:
  1. `usePontosManager.js`: Hook customizado responsável pelo ciclo de vida, estado local sincronizado (`listaPontos`), operações com o Supabase (`salvarNovaOrdem`, `alternarVisibilidade`, `adicionarPonto`, `renomearPonto`, `excluirPonto`, `duplicarPonto`), diálogos universais de confirmação (`useConfirm`), controle do modal de duplicação e flags de carregamento.
  2. `PontosHeader.jsx`: Cabeçalho limpo com ícone de localização, título contextual (`termos.pontos`) e indicador animado de salvamento de ordem em tempo real.
  3. `FormAddPonto.jsx`: Formulário desacoplado de cadastro de novo ponto com placeholder dinâmico, sanitização e botão com spinner de loading.
  4. `PontoMobileMenu.jsx`: Menu dropdown flutuante touch-friendly para dispositivos móveis com backdrop invisível de fechamento ao tocar fora e ações completas (publicar/ocultar, renomear, duplicar, limpar reservas e excluir).
  5. `PontoItem.jsx`: Card individual de ponto com pegador dedicado `drag-handle` (`GripVertical`), badges informativos (quantidade de turnos, indicador de vagas livres / lotado e posição `#{index + 1}`), edição inline com confirmação (Check) e cancelamento (X), botões diretos para desktop e menu mobile.
  6. `PontosList.jsx`: Lista reordenável com integração refinada do `SortableJS` (delay de 150ms no touch para preservar scroll natural do celular, limiar de 5px, animações fluidas e atualização atômica de ordem no Supabase).
  7. `DuplicarPontoModal.jsx`: Modal via `createPortal` para clonagem estrutural de pontos e seus respectivos turnos, com bloqueio automático do scroll do `body` e atalho de fechamento por `Escape`.
  8. `index.js`: Ponto de entrada e re-exportação para imports limpos.
- **Resultado**:
  - `PontosManager.jsx` reduzido de 766 linhas para apenas 80 linhas (~90% de redução), transformado em um componente orquestrador declarativo, modular, de fácil manutenção e seguindo rigorosamente os padrões de Engenharia Sênior e Clean Code.

---

## 21. Modularização e Componentização do PortalGestorLogin.jsx (`src/components/portal-gestor/`) — Novembro/2026
- **Objetivo da Refatoração**:
  - `PortalGestorLogin.jsx` possuía cerca de 600 linhas em um único arquivo monolítico, acumulando responsabilidades díspares: gerenciamento de múltiplos estados de autenticação (`modo`, e-mail, senha, nome, PIN legado, visibilidade de senhas, flags de loading e mensagens de retorno), integração com métodos de Supabase Auth (`signIn`, `signUp`, `resetPassword`) e RPCs de validação de contingência (`verificar_admin_pin` e busca de fallback em `empresas`), gerenciamento de foco de inputs com `useRef`, cabeçalho superior institucional fixo com logo e ThemeToggle, cabeçalho de card com escudo e títulos dinâmicos por modo, banners animados de erro e sucesso, 4 formulários completos de entrada de dados e rodapé de segurança RBAC.
- **Estrutura Criada (`src/components/portal-gestor/`)**:
  1. `usePortalAuth.js`: Hook customizado responsável pelo estado de autenticação (`modo`, formulários e mensagens), ciclo de vida e foco dos inputs (`emailInputRef` e `pinInputRef`), e submissões com tratamento de erros preventivo (`handleLogin`, `handleCadastro`, `handleRecuperarSenha`, `handlePinLegado`).
  2. `PortalHeader.jsx`: Cabeçalho institucional superior isolado com logo EscalaFácil, badge oficial "Portal do Gestor" e alternador de tema claro/escuro (`ThemeToggle`).
  3. `PortalCardHeader.jsx`: Cabeçalho interno do container de login com escudo estético em destaque, título dinâmico e subtítulo explicativo de acordo com o modo ativo ('login', 'cadastro', 'recuperar' ou 'pin_legado').
  4. `PortalFeedback.jsx`: Alertas visuais e acessíveis de erro (`erroMsg` em vermelho com `AlertCircle`) e sucesso (`sucessoMsg` em esmeralda com `CheckCircle2`) com animação suave de entrada.
  5. `PortalLoginForm.jsx`: Formulário desacoplado de autenticação principal (e-mail institucional e senha com toggle de visibilidade), link para recuperação, links de rodapé para cadastro e contingência por PIN.
  6. `PortalCadastroForm.jsx`: Formulário para novos gestores com campos de nome completo, e-mail profissional e senha protegida, com validações de tamanho mínimo e botão de retorno para login.
  7. `PortalRecuperarSenhaForm.jsx`: Formulário para redefinição de senha esquecida via e-mail e botão de voltar para o login.
  8. `PortalPinLegadoForm.jsx`: Formulário de contingência por PIN numérico da imobiliária com máscara monospace centralizada, toggle de visibilidade e botão de retorno.
  9. `PortalSecurityFooter.jsx`: Rodapé de credibilidade e segurança com ícone de cadeado e aviso de proteção RBAC.
  10. `index.js`: Ponto central de re-exportação para importações limpas e idiomáticas.
- **Resultado**:
  - `PortalGestorLogin.jsx` foi reduzido de 581 linhas para ~115 linhas (~80% de redução), tornando-se um orquestrador extremamente legível, declarativo e robusto, com separação clara de responsabilidades, alta manutenibilidade e padrão profissional de Engenharia Sênior.

---

## 22. Política de Senha Forte para Novos Cadastros (8 caracteres, A-Z, a-z, 0-9) — Novembro/2026
- **Regra Implementada**:
  - A função [`validarSenhaForte(senha)`](file:///e:/Escala/src/lib/validacaoHelper.js) foi adicionada a `validacaoHelper.js`.
  - Exige: mínimo de 8 caracteres, pelo menos uma letra maiúscula (`[A-Z]`), pelo menos uma letra minúscula (`[a-z]`) e pelo menos um número (`[0-9]`).
  - Aplicada no cadastro de gestores tanto no Portal (`usePortalAuth.js` / `PortalCadastroForm.jsx`) quanto no modal (`AdminLoginModal.jsx` / `CadastroForm.jsx`).
  - **Retrocompatibilidade 100% Garantida**: Usuários já cadastrados (inclusive com senhas legadas de 6 números) continuam acessando e fazendo login normalmente sem qualquer alteração, pois a validação de força ocorre exclusivamente no momento de criação/registro de novas contas (`signUp`).

---

## 23. Consolidação dos Domínios `equipe/` e `admin/` (AlterarSenhaModal & InputSenhaPin) — Novembro/2026
- **Consolidação do Domínio `equipe/`**:
  - Os componentes `AdicionarMembroForm.jsx`, `EditarMembroModal.jsx` e `TipoValidacaoSelector.jsx` foram migrados para dentro de `src/components/equipe/`.
  - O bloco de vinculação de celular em `EditarMembroModal.jsx` foi extraído para o subcomponente `MembroDeviceVinculado.jsx`.
  - O barrel export `src/components/equipe/index.js` foi atualizado para exportar todos os submódulos da equipe.
  - `EquipeManager.jsx` atualizado para importar diretamente de `./equipe`.
  - Os arquivos originais na raiz (`src/components/`) foram mantidos como re-exports transparentes para garantir 100% de retrocompatibilidade.
- **Componentização e Consolidação do Domínio `admin/`**:
  - `AlterarSenhaModal.jsx` foi movido para `src/components/admin/AlterarSenhaModal.jsx`.
  - Criado o componente desacoplado e reutilizável `src/components/admin/InputSenhaPin.jsx`, encapsulando o campo de senha/PIN com botão de alternância de visibilidade (`Eye`/`EyeOff`), eliminando duplicações e estados redundantes.
  - `src/components/admin/AdminModals.jsx` atualizado para importar `./AlterarSenhaModal` diretamente.
  - Barrel `src/components/admin/index.js` atualizado exportando `AlterarSenhaModal` e `InputSenhaPin`.
  - Arquivo `src/components/AlterarSenhaModal.jsx` mantido na raiz como re-export transparente (`export { default } from './admin/AlterarSenhaModal'`).
- **Validação de Build**:
  - `npm run build` executado com sucesso (código 0) e zero regressões.

---

## 24. Modularização da Demo (`useDemoEscala.js`) e Alinhamento de Domínios (`corretor/TurnoCard` & `admin/LinkSeguroManager`) — Novembro/2026
- **Hook Dedicado para a Demonstração (`src/hooks/useDemoEscala.js`)**:
  - `DemoEscalaView.jsx` misturava responsabilidades visuais com lógica de estado e persistência local da sandbox.
  - Toda a lógica de negócios e estado foi extraída para o novo hook dedicado `src/hooks/useDemoEscala.js`:
    - Gerenciamento de identidade do visitante: `deviceId` UUID no `localStorage`, `corretorNome`, `corretorWhatsapp`, `corretorEmail`.
    - Gestão de reservas na memória e sandbox local (`escala_demo_sandbox_reservas` via `salvarReservasDemo`).
    - Validação de concorrência, capacidade por turno e prevenção de duplicidade de reserva por aparelho.
    - Ciclo de vida do modal de identificação (`showNomeModal`, `nomeModalError`, `pendingTurnoId`, `abrirEdicaoPerfil`, `fecharNomeModal`).
    - Cancelamento de reserva com confirmação assíncrona (`useConfirm`) e disparo de toasts (`showToast`, `limparToast`).
    - `DemoEscalaView.jsx` foi refatorado para um componente puramente declarativo de 78 linhas (< 80 linhas), com altíssima legibilidade e desacoplamento.
- **Alinhamento do Domínio Público/Corretor (`TurnoCard.jsx`)**:
  - `TurnoCard.jsx` foi movido para seu domínio de pertinência: `src/components/corretor/TurnoCard.jsx`.
  - `DiaAcordeonItem.jsx` atualizado para importar diretamente de `./TurnoCard`.
  - `src/components/TurnoCard.jsx` preservado na raiz como re-export transparente para garantir 100% de retrocompatibilidade.
- **Alinhamento do Domínio Administrativo (`LinkSeguroManager.jsx`)**:
  - `LinkSeguroManager.jsx` foi movido para seu domínio de pertinência: `src/components/admin/LinkSeguroManager.jsx`.
  - `AdminTabConfiguracoes.jsx` atualizado para importar diretamente de `./LinkSeguroManager`.
  - Barrel `src/components/admin/index.js` atualizado exportando `LinkSeguroManager`.
  - `src/components/LinkSeguroManager.jsx` preservado na raiz como re-export transparente para garantir 100% de retrocompatibilidade.
- **Validação de Build**:
  - `npm run build` executado com sucesso gerando bundle de produção sem erros nem regressões.

---

## 25. Customização Completa de Mensagens do WhatsApp (Ponto Individual e Escala Geral) — Novembro/2026
- **Contexto e Dor do Negócio**:
  - Coordenadores e gestores de plantão costumam publicar no WhatsApp mensagens ricas com emojis de impacto, nome do empreendimento, equipe/regional, endereço do ponto, referências de localização e regras de conduta (ex: "não copie e cole, envie seu horário").
  - O sistema anteriormente gerava um texto padronizado fixo que não permitia aos gestores adaptar a comunicação ao contexto real de cada plantão nem da escala geral da semana.
- **Novas Capacidades Implementadas**:
  1. **Customização por Ponto Individual (`pontos.cabecalho_whatsapp` e `pontos.rodape_whatsapp`)**:
     - Cada ponto de captação (ex: *Supermercado Ipanema*) possui botão dedicado de configuração (em desktop e no menu mobile).
     - Abre o `PontoWhatsappModal.jsx` permitindo ao gestor inserir o texto livre com emojis, referências do local e regras.
     - Indicador visual (`💬 WhatsApp`) no item do ponto na lista para indicar pontos com texto personalizado configurado.
     - Botão "Inserir Modelo Completo" com sugestão profissional baseada na prática real dos plantões.
     - Suporte a tags inteligentes `{ponto}`, `{empresa}`, `{capacidade}`, `{link}`.
  2. **Customização Centralizada com Seletor de Escopo (`WhatsappConfigModal.jsx`)**:
     - Card `WhatsappConfigCard.jsx` integrado na aba **Configurações** do painel do gestor.
     - Modal unificado com dropdown no topo permitindo alternar instantaneamente entre a **Escala Completa (Geral)** e qualquer um dos **Pontos de Captação Individuais** sem precisar fechar o modal.
     - Indicador visual `✓ (Personalizado)` no menu suspenso para pontos que já possuem texto próprio salvo.
     - Live preview em tempo real adaptado ao ponto ou à escala completa, tags rápidas, modelo sugerido específico para cada contexto e persistência via RPCs ou tabelas Supabase.
  3. **Simulador Visual Realista (`WhatsappPreviewBubble.jsx`)**:
     - Componente reutilizável com layout idêntico à bolha de mensagem enviada no WhatsApp (`#005c4b` no dark mode), interpretando marcações de formatação (`*negrito*`, `_itálico_`, `~tachado~`), quebras de linha e carimbo de hora com checkmarks duplos (`CheckCheck`).
  4. **Motor de Cópia Inteligente (`src/components/corretor/escalaTextoHelper.js`)**:
     - `gerarTextoEscala`: se o ponto selecionado possuir cabeçalho customizado, prioriza o texto do ponto e injeta os turnos e horários logo abaixo com divisórias elegantes. Se for a escala completa, utiliza a mensagem geral configurada pela empresa.
     - Linha divisória `━━━━━━━━━━━━━━━━━━` antes do rodapé de avisos/observações para separá-lo visualmente dos turnos, mantendo a divisória antes do link.
     - Chamada de ação do link padronizada em caixa alta e negrito: `🔗 *GARANTA SUA VAGA*: https://...`.
- **Banco de Dados & RPCs**:
  - Script de migração: `supabase_migration_fase10_whatsapp_customizado.sql`.
  - RPCs criadas: `atualizar_whatsapp_ponto` e `atualizar_whatsapp_empresa` com verificação de permissões e `SECURITY DEFINER`.
  - Schema mestre `supabase_schema.sql` atualizado com as novas colunas e funções.
- **Arquitetura Modular Criada**:
  - `src/components/admin/whatsapp/WhatsappPreviewBubble.jsx`
  - `src/components/admin/whatsapp/useWhatsappConfig.js`
  - `src/components/admin/whatsapp/WhatsappConfigModal.jsx`
  - `src/components/admin/whatsapp/WhatsappConfigCard.jsx`
  - `src/components/pontos/PontoWhatsappModal.jsx`
- **Validação de Build**:
  - `npm run build` executado com sucesso gerando bundle de produção limpo e sem warnings.

---

## 26. Menu Suspenso Customizado com Controle de Visibilidade de Cópia da Escala (`Eye`/`EyeOff`) — Novembro/2026
- **Contexto e Necessidade**:
  - No modal de personalização do WhatsApp (`WhatsappConfigModal.jsx`), a seleção de escopo utilizava um `<select>` HTML nativo que não suportava elementos interativos por item.
  - O gestor necessitava de uma forma ágil de ocultar ou exibir o botão *"Copiar Escala"* no app dos corretores, tanto para a **Escala Geral** quanto para **Pontos Individuais**, diretamente no seletor de escopo.
- **Implementação Realizada**:
  1. **Componente Modularizado (`WhatsappEscopoDropdown.jsx`)**:
     - Substituiu o `<select>` nativo por um dropdown moderno, acessível e mobile-first.
     - Cada item (Escala Completa e cada um dos Pontos de Captação) conta com um botão dedicado com ícone de olho (`Eye` em verde quando liberado / `EyeOff` em âmbar quando oculto).
     - Clique com `e.stopPropagation()` no botão do olho permitindo alternar a visibilidade de múltiplos itens em sequência sem fechar o menu.
     - Fechamento inteligente por clique externo (`mousedown`) e tecla `Escape`.
     - Rodapé com legenda explicativa clara: `👁️ = Botão Copiar visível | 🙈 = Oculto aos corretores`.
  2. **Regra de Negócio e Ocultação do Botão no App**:
     - `CorretorView.jsx` calcula `podeCopiarGeral` e `podeCopiarPonto`.
     - `PontoSelectorView.jsx`: se a cópia geral estiver oculta, o botão fixo inferior `CorretorCopyFooter` não é renderizado.
     - `PontoTurnosView.jsx`: se a cópia do ponto selecionado estiver oculta, o botão fixo inferior `CorretorCopyFooter` não é renderizado.
  3. **Persistência Híbrida e Defensiva**:
     - Script SQL de migração: `supabase_migration_fase11_copia_whatsapp.sql` adicionando `copia_whatsapp_ativa` em `pontos` e `copia_whatsapp_geral_ativa` em `empresas`.
     - Fallback automático e transparente em `empresas.termos` (`copiaWhatsappGeralAtiva` e `copiaWhatsappPontos`), garantindo funcionamento instantâneo em qualquer ambiente.
     - `supabase_schema.sql` atualizado com as novas colunas.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero regressões.

---

## 27. Correção de Concorrência e Sincronização de Sessão no Portal do Gestor (`app.escalafacil.online`) — Novembro/2026
- **Contexto e Causa Raiz do Bug**:
  - Ao acessar a página de vendas e clicar em *"Área do Gestor"* (redirecionando para `https://app.escalafacil.online`), usuários com sessão ativa no navegador eram indevidamente recebidos com a tela `"Nenhuma Empresa Vinculada"`.
  - Ao desconectar e fazer login novamente com as mesmas credenciais, a tela `"Nenhuma Empresa Vinculada"` dava uma piscada rápida (~150-300ms) antes de abrir o painel.
  - **Causa Raiz Identificada**:
    1. *Race Condition entre `getSession()` e `onAuthStateChange`*: na montagem inicial, ambos os métodos assíncronos do `@supabase/supabase-js` eram disparados concorrentemente. O `onAuthStateChange` recebia `INITIAL_SESSION` com `userChanged = false`, pulava o `fetchUserData` e chamava `setLoading(false)` prematuramente, enquanto a RPC `get_minhas_empresas` da chamada concorrente ainda estava em trânsito pela rede.
    2. *`minhasEmpresas` ausente nas dependências do `TenantContext`*: com `authLoading = false` precoce, `carregarEmpresa` avaliava `minhasEmpresas = []`, cacheava o alvo como resolvido sem empresa e nunca mais re-disparava quando os dados reais chegavam.
    3. *Falta de ordenação de guards no `App.jsx`*: o guard do `PortalSemEmpresaView` era avaliado antes da tela de carregamento global e sem verificar `authLoading`, renderizando a mensagem de erro antes do término das consultas assíncronas.
    4. *Retorno assíncrono do `signIn`*: o método `signIn` resolvia antes de carregar o perfil e as empresas do usuário, gerando uma breve janela em que `user` existia mas `minhasEmpresas` era `[]`.
- **Implementações Técnicas e Blindagem**:
  1. **Unificação do Ciclo de Autenticação (`AuthContext.jsx`)**:
     - `onAuthStateChange` atua como fonte primária com flag de inicialização, garantindo que `setLoading(false)` só seja executado **após** a conclusão bem-sucedida de `fetchUserData`.
     - `signIn` aguarda o término do `fetchUserData` e retorna `{ ...data, empresas }` diretamente para o formulário.
     - Fallback resiliente no `fetchUserData`: se a RPC `get_minhas_empresas` retornar vazia (ex: transição de token JWT em storage), consulta diretamente a tabela `usuarios_empresas` com `user_id = userId`.
     - Limpeza do `localStorage.removeItem('escala_gestor_empresa_id')` no `signOut`.
  2. **Reatividade e Cache Dinâmico no `TenantContext.jsx`**:
     - `minhasEmpresas` adicionado às dependências do `useEffect`.
     - Chave de cache (`targetKey`) agora inclui a relação ordenada de IDs das empresas vinculadas, forçando re-avaliação imediata e suave assim que as permissões são carregadas.
     - Enquanto `authLoading = true`, o tenant força `loading = true` no subdomínio do portal.
  3. **Hierarquia Blindada de Guards no `App.jsx`**:
     - Guard 1: `(authLoading || tenantLoading) && !empresa && !isPinAuth` exibe o spinner elegante "Carregando..." enquanto qualquer operação assíncrona estiver pendente, eliminando 100% dos flashes e piscadas visuais.
     - Guard 2: Portal desconectado exibe `PortalGestorLogin`.
     - Guard 3: `PortalSemEmpresaView` só é renderizado se `authLoading` e `tenantLoading` forem falsos e `minhasEmpresas.length === 0`.
  4. **Fluxo Otimizado no `usePortalAuth.js`**:
     - Após autenticação por senha bem-sucedida, repassa a empresa retornada para o `onSuccess('auth', res?.empresas?.[0])`, ativando o tenant imediatamente.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros.

---

## 28. Gerenciamento e Edição do Nome Oficial da Empresa (`EmpresaNomeCard` e `EditarNomeEmpresaModal`) — Novembro/2026
- **Contexto e Necessidade**:
  - A empresa inicial ou recém-criada vinha cadastrada por padrão com o nome `"Minha Imobiliária"`.
  - O gestor precisava alterar esse nome para a razão social/marca real da sua imobiliária diretamente pelo painel administrativo, sem necessidade de intervenção direta no banco Supabase.
- **Implementações Técnicas**:
  1. **Componente de Configuração (`EmpresaNomeCard.jsx`)**:
     - Posicionado na aba **Configurações** (`AdminTabConfiguracoes.jsx`), exibe o ícone `Building2` em azul, o título *"Nome da Empresa"* com badge contendo o nome atual e o botão de ação *"Alterar Nome"*.
  2. **Modal Modularizado de Edição (`EditarNomeEmpresaModal.jsx`)**:
     - Modal acessível com foco automático no input, validação de comprimento (mínimo 2 caracteres), tratamento de loading (`salvando`), fechamento por clique externo/ESC e feedback em toast.
     - Atualização direta e reativa no Supabase: `supabase.from('empresas').update({ nome }).eq('id', empresa.id)`.
     - Propagação instantânea em tempo real via canal WebSocket do Supabase Realtime para todos os aparelhos conectados (atualizando o título da aba do navegador `document.title`, cabeçalho da escala pública e mensagens do WhatsApp).
  3. **Exportação e Orquestração**:
     - Exportado no barrel `src/components/admin/index.js`.
     - Integrado aos modais do painel em `AdminModals.jsx` e ao hook de estado `useAdminView.js`.
- **Validação de Build**:
  - `npm run build` executado com sucesso sem erros.

---

## 29. Unificação do Modal de WhatsApp dos Pontos e Limpeza Visual de Emojis — Novembro/2026
- **Contexto e Decisão de Design**:
  - Na aba **Pontos de Captação**, o botão de WhatsApp ainda acionava o modal legado `PontoWhatsappModal.jsx` (sem as novidades do seletor de escopo, tags e live preview da bolha).
  - Além disso, a presença de muitos botões coloridos de emojis fixos criava ruído visual excessivo na interface.
- **Implementações Realizadas**:
  1. **Unificação Total de Modais**:
     - `PontoWhatsappModal.jsx` foi completamente removido e descontinuado.
     - O botão de WhatsApp na lista de pontos (`PontosList.jsx` / `PontoItem.jsx`) agora aciona diretamente o modal unificado oficial `WhatsappConfigModal.jsx`, passando o `id` do ponto como alvo selecionado.
     - O modal já abre com o ponto selecionado no topo, permitindo alternar entre a mensagem geral e qualquer ponto sem precisar fechar a janela.
  2. **Limpeza Visual e Destaque para Atalhos Nativos do Teclado**:
     - Removidos todos os botões soltos e coloridos de emojis do cabeçalho e do rodapé do modal, bem como o banner fixo que ocupava espaço.
     - Posicionado um botão discreto e elegante `[😀 Emojis no PC]` na mesma linha das tags (ao lado de `{link}`), com visibilidade exclusiva para desktop (`hidden sm:inline-flex`), permanecendo 100% oculto no celular onde o teclado nativo já supre essa função.
     - Ao clicar no botão, abre-se um modal dedicado, limpo e focado, explicando detalhadamente os atalhos nativos do sistema:
       - **Windows**: <kbd>Win</kbd> + <kbd>.</kbd>
       - **Mac**: <kbd>Ctrl</kbd> + <kbd>Cmd ⌘</kbd> + <kbd>Espaço</kbd>
     - Preservadas e organizadas as tags inteligentes clicáveis (`{ponto}`, `{empresa}`, `{capacidade}`, `{link}`).
     - **Remoção do Bloco de Sugestão Rápida & Realocação do Botão Padrão**: o bloco superior *"Sugestão Rápida"* (com o botão de inserir modelo pré-fixado) foi totalmente removido para deixar o formulário mais enxuto e direto ao ponto. O botão `[🔄 Padrão]` foi reposicionado diretamente na barra de ações/tags, logo ao lado do botão de emojis.
- **Validação de Build**:
  - `npm run build` executado com sucesso, reduzindo bundle e sem erros.

---

## 30. Persistência e Gerenciamento Individual de WhatsApp por Ponto no Menu Suspenso — Novembro/2026
- **Contexto e Problema Identificado**:
  - No menu suspenso do modal de WhatsApp, o gestor pode alternar entre a *Escala Completa (Geral)* e cada um dos *Pontos de Captação* cadastrados.
  - Anteriormente, ao redigir o cabeçalho/rodapé de um ponto e selecionar outro no menu suspenso antes de salvar, os dados digitados eram perdidos da memória e sobrescritos com o valor original do novo ponto. Além disso, ao clicar em *"Salvar Alterações"*, apenas o ponto que estava ativo no instante do clique era gravado.
- **Implementações Realizadas**:
  1. **Buffer e Rascunhos em Memória Multi-Alvo (`drafts`) no `useWhatsappConfig.js`**:
     - Introduzido estado `drafts: { [id]: { cabecalho, rodape, modificado } }`.
     - Ao digitar no cabeçalho ou rodapé, o rascunho do ponto atualmente ativo é atualizado em tempo real.
     - A função `mudarAlvo` preserva automaticamente as edições do alvo anterior antes de carregar o próximo, permitindo que o gestor alterne livremente entre todos os pontos do menu sem perder nenhuma linha de texto.
  2. **Persistência Individual Completa no Banco de Dados (`salvarConfiguracao`)**:
     - Ao clicar no botão *"Salvar Alterações"*, todos os pontos modificados durante a sessão (e a escala geral se tiver sido alterada) são persistidos individualmente no banco de dados.
     - **Salvamento Direto nas Tabelas**:
       - Para a escala geral: colunas `msg_whatsapp_geral` e `rodape_whatsapp_geral` em `public.empresas` (com fallback para RPC `atualizar_whatsapp_empresa`).
       - Para cada ponto: colunas `cabecalho_whatsapp` e `rodape_whatsapp` em `public.pontos` (com fallback para RPC `atualizar_whatsapp_ponto`).
     - **Blindagem em Dupla Camada (`empresas.termos.whatsappPontos`)**:
       - Cada mensagem individual de ponto é adicionalmente espelhada no JSONB `termos.whatsappPontos[pontoId]`, garantindo funcionamento 100% resiliente mesmo em bancos de dados onde as migrações de coluna ainda não tenham sido executadas.
     - Atualização instantânea dos objetos em memória (`pontos[index]` e `empresa`) com disparo de `onEmpresaUpdated` e `onDataChanged`.
  3. **Suporte no Gerador de Texto (`escalaTextoHelper.js`)**:
     - Leitura integrada com fallback: `pontoUnico?.cabecalho_whatsapp || empresa?.termos?.whatsappPontos?.[pontoUnico?.id]?.cabecalho`.
     - Ao copiar a escala de um ponto específico (seja no painel ou no app do corretor), o texto gerado utiliza fielmente a mensagem personalizada exclusiva daquele ponto.
  4. **Feedback Visual em Tempo Real no Menu Suspenso (`WhatsappEscopoDropdown.jsx`)**:
     - Itens do menu suspenso (geral e cada ponto) exibem a tag verde `✓ Personalizado` em tempo real sempre que possuírem mensagem customizada gravada ou em rascunho na sessão.
  5. **Sincronização e Hidratação de Pontos (`useEscalaData.js`)**:
     - O hook hidrata silenciosamente na carga inicial e no canal Realtime cada ponto com sua respectiva mensagem individual vinda do JSONB `empresas.termos.whatsappPontos`, assegurando consistência em toda a interface (como as badges `💬 WhatsApp` em `PontoItem.jsx`) sem depender de migrações SQL.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros.

---

## 31. Onboarding Multi-Tenant, Nome da Empresa no Cadastro & Erradicação de Superadmin (Fase 13) — Novembro/2026
- **Contexto e Problema Identificado**:
  - Contas criadas com e-mails distintos (ex: `edinvest.oliver@gmail.com` e `elias.oli2019@gmail.com`) estavam compartilhando a mesma empresa e os mesmos pontos de captação.
  - O formulário de cadastro (`PortalCadastroForm.jsx` e `CadastroForm.jsx`) continha apenas Nome, E-mail e Senha, sem campo para o Nome da Empresa/Imobiliária. Consequentemente, o cadastro criava o usuário no Supabase Auth, mas nunca provisionava um novo Tenant (`empresas`).
  - Além disso, a RPC legada `get_minhas_empresas()` mantinha um bypass de `is_superadmin`: se o usuário possuísse a flag, o banco retornava todas as empresas indistintamente.
- **Implementações Realizadas**:
  1. **Campo Obrigatório de Nome da Imobiliária / Empresa no Cadastro**:
     - `PortalCadastroForm.jsx` e `CadastroForm.jsx` agora exigem o Nome da Imobiliária / Empresa (com ícone `Building2` e feedback).
     - Integração no `usePortalAuth.js` e `AdminLoginModal.jsx`: validação prévia de tamanho mínimo e envio nos metadados do `signUp`.
  2. **Provisionamento Automático de Tenant (`handle_new_auth_user` e `criar_nova_empresa`)**:
     - O trigger `handle_new_auth_user` extrai `empresa_nome` dos metadados e provisiona o Tenant imediatamente com slug único (anti-colisão com sufixo numérico) e código seguro de 12 caracteres (`codigo_escala`).
     - A RPC `criar_nova_empresa` foi atualizada tornando `p_slug` opcional (derivação automática e higienizada do nome).
     - O usuário criador é vinculado automaticamente como Administrador Geral na tabela `usuarios_empresas`.
  3. **Erradicação Completa de Superadmin**:
     - Removida qualquer referência de superadmin do frontend (`AuthContext.jsx`).
     - Atualizada a RPC `get_minhas_empresas()` para retornar **ESTRITAMENTE** as empresas onde o usuário autenticado possui vínculo ativo em `usuarios_empresas`. Nenhum usuário recebe acesso global ou dados de outros tenants.
     - Script de migração (`supabase_migration_fase13_onboarding_empresa.sql`) redefine `is_superadmin = false` em `public.perfis` e desvincula contas sobrepostas.
  4. **Self-Service Onboarding para Usuários Órfãos (`PortalSemEmpresaView.jsx`)**:
     - Caso um usuário autenticado não possua nenhuma empresa vinculada (ex: contas criadas antes da Fase 13), a tela agora exibe o botão e formulário inline *"Criar Minha Empresa Agora"*, permitindo provisionar seu espaço de trabalho instantaneamente sem fricção.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros.

---

### Fase 12: Privacidade da Escala Pública (Modo Anônimo / Ocultar Nomes)
- **Data**: 10/11/2026
- **Contexto**:
  - Solicitação de discrição/privacidade entre colaboradores: permitir que o gestor ative uma opção no painel administrativo para que colaboradores reservando horários na escala pública não vejam os nomes de quem está em cada horário, visualizando apenas a indicação "Reservado" (com ícone 🔒).
  - O participante logado continua vendo seu próprio nome acompanhado da tag destacada `"VOCÊ"` (permitindo que acompanhe seus horários e efetue cancelamento se necessário).
  - Administradores e gestores continuam visualizando todos os nomes reais normalmente no painel administrativo.
- **Implementações Técnicas**:
  1. **Card de Configuração no Painel do Gestor**:
     - `src/components/admin/EscalaPrivacidadeCard.jsx`: componente moderno e modular com ícones `Eye`/`EyeOff`, badges contextuais (`Modo Anônimo Ativo 🙈` vs `Nomes Visíveis 👁️`), switch liga/desliga touch-friendly, feedback via toast e persistência com fallback defensivo.
     - Integrado diretamente na aba **Configurações** (`AdminTabConfiguracoes.jsx`) e exportado no barrel `src/components/admin/index.js`.
  2. **Exibição Inteligente na Visão do Colaborador**:
     - `TurnoCard.jsx`: quando `ocultarNomes` está ativo, reservas de terceiros exibem o ícone de cadeado `Lock` e o texto itálico `"Reservado"`, enquanto a reserva do próprio colaborador exibe o ícone `User`, seu nome real e a tag `"VOCÊ"`.
     - Fluxo de props propagado suavemente: `CorretorView` -> `PontoTurnosView` -> `DiaAcordeonItem` -> `TurnoCard`.
  3. **Proteção Anti-Vazamento na Cópia de WhatsApp**:
     - `src/components/corretor/escalaTextoHelper.js`: a função `gerarTextoEscala` verifica se `ocultarNomes` está ativo. Em caso positivo, substitui nomes reais por `RESERVADO` na mensagem gerada, prevenindo que colaboradores copiem a escala para obter os nomes que estavam ocultos na interface.
  4. **Banco de Dados e Persistência**:
     - Criada a migração `supabase_migration_fase12_ocultar_nomes.sql` adicionando a coluna `ocultar_nomes_escala BOOLEAN NOT NULL DEFAULT false` na tabela `empresas`.
     - Atualizados `supabase_schema.sql` e `DEMO_EMPRESA` em `src/lib/demoData.js`.
     - Implementado fallback automático para `empresa.termos.ocultarNomesEscala` (JSONB), assegurando funcionamento imediato mesmo antes da execução manual do script SQL no Supabase.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero regressões.

---

## 27. Correção de Concorrência e Sincronização de Sessão no Portal do Gestor (`app.escalafacil.online`) — Novembro/2026
- **Contexto e Causa Raiz do Bug**:
  - Ao acessar a página de vendas e clicar em *"Área do Gestor"* (redirecionando para `https://app.escalafacil.online`), usuários com sessão ativa no navegador eram indevidamente recebidos com a tela `"Nenhuma Empresa Vinculada"`.
  - Ao desconectar e fazer login novamente com as mesmas credenciais, a tela `"Nenhuma Empresa Vinculada"` dava uma piscada rápida (~150-300ms) antes de abrir o painel.
  - **Causa Raiz Identificada**:
    1. *Race Condition entre `getSession()` e `onAuthStateChange`*: na montagem inicial, ambos os métodos assíncronos do `@supabase/supabase-js` eram disparados concorrentemente. O `onAuthStateChange` recebia `INITIAL_SESSION` com `userChanged = false`, pulava o `fetchUserData` e chamava `setLoading(false)` prematuramente, enquanto a RPC `get_minhas_empresas` da chamada concorrente ainda estava em trânsito pela rede.
    2. *`minhasEmpresas` ausente nas dependências do `TenantContext`*: com `authLoading = false` precoce, `carregarEmpresa` avaliava `minhasEmpresas = []`, cacheava o alvo como resolvido sem empresa e nunca mais re-disparava quando os dados reais chegavam.
    3. *Falta de ordenação de guards no `App.jsx`*: o guard do `PortalSemEmpresaView` era avaliado antes da tela de carregamento global e sem verificar `authLoading`, renderizando a mensagem de erro antes do término das consultas assíncronas.
    4. *Retorno assíncrono do `signIn`*: o método `signIn` resolvia antes de carregar o perfil e as empresas do usuário, gerando uma breve janela em que `user` existia mas `minhasEmpresas` era `[]`.
- **Implementações Técnicas e Blindagem**:
  1. **Unificação do Ciclo de Autenticação (`AuthContext.jsx`)**:
     - `onAuthStateChange` atua como fonte primária com flag de inicialização, garantindo que `setLoading(false)` só seja executado **após** a conclusão bem-sucedida de `fetchUserData`.
     - `signIn` aguarda o término do `fetchUserData` e retorna `{ ...data, empresas }` diretamente para o formulário.
     - Fallback resiliente no `fetchUserData`: se a RPC `get_minhas_empresas` retornar vazia (ex: transição de token JWT em storage), consulta diretamente a tabela `usuarios_empresas` com `user_id = userId`.
     - Limpeza do `localStorage.removeItem('escala_gestor_empresa_id')` no `signOut`.
  2. **Reatividade e Cache Dinâmico no `TenantContext.jsx`**:
     - `minhasEmpresas` adicionado às dependências do `useEffect`.
     - Chave de cache (`targetKey`) agora inclui a relação ordenada de IDs das empresas vinculadas, forçando re-avaliação imediata e suave assim que as permissões são carregadas.
     - Enquanto `authLoading = true`, o tenant força `loading = true` no subdomínio do portal.
  3. **Hierarquia Blindada de Guards no `App.jsx`**:
     - Guard 1: `(authLoading || tenantLoading) && !empresa && !isPinAuth` exibe o spinner elegante "Carregando..." enquanto qualquer operação assíncrona estiver pendente, eliminando 100% dos flashes e piscadas visuais.
     - Guard 2: Portal desconectado exibe `PortalGestorLogin`.
     - Guard 3: `PortalSemEmpresaView` só é renderizado se `authLoading` e `tenantLoading` forem falsos e `minhasEmpresas.length === 0`.
  4. **Fluxo Otimizado no `usePortalAuth.js`**:
     - Após autenticação por senha bem-sucedida, repassa a empresa retornada para o `onSuccess('auth', res?.empresas?.[0])`, ativando o tenant imediatamente.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros.

---

## 28. Gerenciamento e Edição do Nome Oficial da Empresa (`EmpresaNomeCard` e `EditarNomeEmpresaModal`) — Novembro/2026
- **Contexto e Necessidade**:
  - A empresa inicial ou recém-criada vinha cadastrada por padrão com o nome `"Minha Imobiliária"`.
  - O gestor precisava alterar esse nome para a razão social/marca real da sua imobiliária diretamente pelo painel administrativo, sem necessidade de intervenção direta no banco Supabase.
- **Implementações Técnicas**:
  1. **Componente de Configuração (`EmpresaNomeCard.jsx`)**:
     - Posicionado na aba **Configurações** (`AdminTabConfiguracoes.jsx`), exibe o ícone `Building2` em azul, o título *"Nome da Empresa"* com badge contendo o nome atual e o botão de ação *"Alterar Nome"*.
  2. **Modal Modularizado de Edição (`EditarNomeEmpresaModal.jsx`)**:
     - Modal acessível com foco automático no input, validação de comprimento (mínimo 2 caracteres), tratamento de loading (`salvando`), fechamento por clique externo/ESC e feedback em toast.
     - Atualização direta e reativa no Supabase: `supabase.from('empresas').update({ nome }).eq('id', empresa.id)`.
     - Propagação instantânea em tempo real via canal WebSocket do Supabase Realtime para todos os aparelhos conectados (atualizando o título da aba do navegador `document.title`, cabeçalho da escala pública e mensagens do WhatsApp).
  3. **Exportação e Orquestração**:
     - Exportado no barrel `src/components/admin/index.js`.
     - Integrado aos modais do painel em `AdminModals.jsx` e ao hook de estado `useAdminView.js`.
- **Validação de Build**:
  - `npm run build` executado com sucesso sem erros.

---

## 29. Unificação do Modal de WhatsApp dos Pontos e Limpeza Visual de Emojis — Novembro/2026
- **Contexto e Decisão de Design**:
  - Na aba **Pontos de Captação**, o botão de WhatsApp ainda acionava o modal legado `PontoWhatsappModal.jsx` (sem as novidades do seletor de escopo, tags e live preview da bolha).
  - Além disso, a presença de muitos botões coloridos de emojis fixos criava ruído visual excessivo na interface.
- **Implementações Realizadas**:
  1. **Unificação Total de Modais**:
     - `PontoWhatsappModal.jsx` foi completamente removido e descontinuado.
     - O botão de WhatsApp na lista de pontos (`PontosList.jsx` / `PontoItem.jsx`) agora aciona diretamente o modal unificado oficial `WhatsappConfigModal.jsx`, passando o `id` do ponto como alvo selecionado.
     - O modal já abre com o ponto selecionado no topo, permitindo alternar entre a mensagem geral e qualquer ponto sem precisar fechar a janela.
  2. **Limpeza Visual e Destaque para Atalhos Nativos do Teclado**:
     - Removidos todos os botões soltos e coloridos de emojis do cabeçalho e do rodapé do modal, bem como o banner fixo que ocupava espaço.
     - Posicionado um botão discreto e elegante `[😀 Emojis no PC]` na mesma linha das tags (ao lado de `{link}`), com visibilidade exclusiva para desktop (`hidden sm:inline-flex`), permanecendo 100% oculto no celular onde o teclado nativo já supre essa função.
     - Ao clicar no botão, abre-se um modal dedicado, limpo e focado, explicando detalhadamente os atalhos nativos do sistema:
       - **Windows**: <kbd>Win</kbd> + <kbd>.</kbd>
       - **Mac**: <kbd>Ctrl</kbd> + <kbd>Cmd ⌘</kbd> + <kbd>Espaço</kbd>
     - Preservadas e organizadas as tags inteligentes clicáveis (`{ponto}`, `{empresa}`, `{capacidade}`, `{link}`).
     - **Remoção do Bloco de Sugestão Rápida & Realocação do Botão Padrão**: o bloco superior *"Sugestão Rápida"* (com o botão de inserir modelo pré-fixado) foi totalmente removido para deixar o formulário mais enxuto e direto ao ponto. O botão `[🔄 Padrão]` foi reposicionado diretamente na barra de ações/tags, logo ao lado do botão de emojis.
- **Validação de Build**:
  - `npm run build` executado com sucesso, reduzindo bundle e sem erros.

---

## 30. Persistência e Gerenciamento Individual de WhatsApp por Ponto no Menu Suspenso — Novembro/2026
- **Contexto e Problema Identificado**:
  - No menu suspenso do modal de WhatsApp, o gestor pode alternar entre a *Escala Completa (Geral)* e cada um dos *Pontos de Captação* cadastrados.
  - Anteriormente, ao redigir o cabeçalho/rodapé de um ponto e selecionar outro no menu suspenso antes de salvar, os dados digitados eram perdidos da memória e sobrescritos com o valor original do novo ponto. Além disso, ao clicar em *"Salvar Alterações"*, apenas o ponto que estava ativo no instante do clique era gravado.
- **Implementações Realizadas**:
  1. **Buffer e Rascunhos em Memória Multi-Alvo (`drafts`) no `useWhatsappConfig.js`**:
     - Introduzido estado `drafts: { [id]: { cabecalho, rodape, modificado } }`.
     - Ao digitar no cabeçalho ou rodapé, o rascunho do ponto atualmente ativo é atualizado em tempo real.
     - A função `mudarAlvo` preserva automaticamente as edições do alvo anterior antes de carregar o próximo, permitindo que o gestor alterne livremente entre todos os pontos do menu sem perder nenhuma linha de texto.
  2. **Persistência Individual Completa no Banco de Dados (`salvarConfiguracao`)**:
     - Ao clicar no botão *"Salvar Alterações"*, todos os pontos modificados durante a sessão (e a escala geral se tiver sido alterada) são persistidos individualmente no banco de dados.
     - **Salvamento Direto nas Tabelas**:
       - Para a escala geral: colunas `msg_whatsapp_geral` e `rodape_whatsapp_geral` em `public.empresas` (com fallback para RPC `atualizar_whatsapp_empresa`).
       - Para cada ponto: colunas `cabecalho_whatsapp` e `rodape_whatsapp` em `public.pontos` (com fallback para RPC `atualizar_whatsapp_ponto`).
     - **Blindagem em Dupla Camada (`empresas.termos.whatsappPontos`)**:
       - Cada mensagem individual de ponto é adicionalmente espelhada no JSONB `termos.whatsappPontos[pontoId]`, garantindo funcionamento 100% resiliente mesmo em bancos de dados onde as migrações de coluna ainda não tenham sido executadas.
     - Atualização instantânea dos objetos em memória (`pontos[index]` e `empresa`) com disparo de `onEmpresaUpdated` e `onDataChanged`.
  3. **Suporte no Gerador de Texto (`escalaTextoHelper.js`)**:
     - Leitura integrada com fallback: `pontoUnico?.cabecalho_whatsapp || empresa?.termos?.whatsappPontos?.[pontoUnico?.id]?.cabecalho`.
     - Ao copiar a escala de um ponto específico (seja no painel ou no app do corretor), o texto gerado utiliza fielmente a mensagem personalizada exclusiva daquele ponto.
  4. **Feedback Visual em Tempo Real no Menu Suspenso (`WhatsappEscopoDropdown.jsx`)**:
     - Itens do menu suspenso (geral e cada ponto) exibem a tag verde `✓ Personalizado` em tempo real sempre que possuírem mensagem customizada gravada ou em rascunho na sessão.
  5. **Sincronização e Hidratação de Pontos (`useEscalaData.js`)**:
     - O hook hidrata silenciosamente na carga inicial e no canal Realtime cada ponto com sua respectiva mensagem individual vinda do JSONB `empresas.termos.whatsappPontos`, assegurando consistência em toda a interface (como as badges `💬 WhatsApp` em `PontoItem.jsx`) sem depender de migrações SQL.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros.

---

## 31. Onboarding Multi-Tenant, Nome da Empresa no Cadastro & Erradicação de Superadmin (Fase 13) — Novembro/2026
- **Contexto e Problema Identificado**:
  - Contas criadas com e-mails distintos (ex: `edinvest.oliver@gmail.com` e `elias.oli2019@gmail.com`) estavam compartilhando a mesma empresa e os mesmos pontos de captação.
  - O formulário de cadastro (`PortalCadastroForm.jsx` e `CadastroForm.jsx`) continha apenas Nome, E-mail e Senha, sem campo para o Nome da Empresa/Imobiliária. Consequentemente, o cadastro criava o usuário no Supabase Auth, mas nunca provisionava um novo Tenant (`empresas`).
  - Além disso, a RPC legada `get_minhas_empresas()` mantinha um bypass de `is_superadmin`: se o usuário possuísse a flag, o banco retornava todas as empresas indistintamente.
- **Implementações Realizadas**:
  1. **Campo Obrigatório de Nome da Imobiliária / Empresa no Cadastro**:
     - `PortalCadastroForm.jsx` e `CadastroForm.jsx` agora exigem o Nome da Imobiliária / Empresa (com ícone `Building2` e feedback).
     - Integração no `usePortalAuth.js` e `AdminLoginModal.jsx`: validação prévia de tamanho mínimo e envio nos metadados do `signUp`.
  2. **Provisionamento Automático de Tenant (`handle_new_auth_user` e `criar_nova_empresa`)**:
     - O trigger `handle_new_auth_user` extrai `empresa_nome` dos metadados e provisiona o Tenant imediatamente com slug único (anti-colisão com sufixo numérico) e código seguro de 12 caracteres (`codigo_escala`).
     - A RPC `criar_nova_empresa` foi atualizada tornando `p_slug` opcional (derivação automática e higienizada do nome).
     - O usuário criador é vinculado automaticamente como Administrador Geral na tabela `usuarios_empresas`.
  3. **Erradicação Completa de Superadmin**:
     - Removida qualquer referência de superadmin do frontend (`AuthContext.jsx`).
     - Atualizada a RPC `get_minhas_empresas()` para retornar **ESTRITAMENTE** as empresas onde o usuário autenticado possui vínculo ativo em `usuarios_empresas`. Nenhum usuário recebe acesso global ou dados de outros tenants.
     - Script de migração (`supabase_migration_fase13_onboarding_empresa.sql`) redefine `is_superadmin = false` em `public.perfis` e desvincula contas sobrepostas.
  4. **Self-Service Onboarding para Usuários Órfãos (`PortalSemEmpresaView.jsx`)**:
     - Caso um usuário autenticado não possua nenhuma empresa vinculada (ex: contas criadas antes da Fase 13), a tela agora exibe o botão e formulário inline *"Criar Minha Empresa Agora"*, permitindo provisionar seu espaço de trabalho instantaneamente sem fricção.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros.

---

## 32. WhatsApp Pré-Preenchido com Padrão WYSIWYG & Rodapé Único (Fase 14) — Novembro/2026
- **Contexto e Problema de UX Identificado**:
  - No modal de personalização do WhatsApp (`WhatsappConfigModal.jsx`), os campos de Cabeçalho e Rodapé iniciavam vazios (`""`). O usuário via o texto padrão apenas na prévia inferior do WhatsApp, sem saber onde o que ele digitasse seria inserido na mensagem final.
  - Além disso, no rodapé, o sistema inseria uma linha separadora antes do rodapé customizado e **outra linha separadora** antes do link fixo *"GARANTA SUA VAGA"*, gerando uma quebra dupla desnecessária e desconexa na mensagem.
- **Implementações Realizadas (Engenharia Preventiva & UX de Alta Fidelidade)**:
  1. **Textareas Pré-Preenchidos com os Modelos Padrão (`obterCabecalhoPadrao` & `obterRodapePadrao`)**:
     - Criadas as funções centralizadas `obterCabecalhoPadrao` e `obterRodapePadrao` em `src/components/corretor/escalaTextoHelper.js`.
     - Ao abrir o modal ou alternar entre alvos (Escala Geral ou Ponto de Captação), caso o alvo não possua mensagem customizada salva, as caixas de texto já vêm **preenchidas com os textos padrão**:
       - **Cabeçalho (Ponto)**: `📋 *ESCALA DE CAPTAÇÃO — {empresa} ({capacidade})*\n━━━━━━━━━━━━━━━━━━\n\n📍 *{ponto}*`
       - **Cabeçalho (Geral)**: `📋 *ESCALA DE CAPTAÇÃO — {empresa} ({capacidade})*\n━━━━━━━━━━━━━━━━━━`
       - **Rodapé**: `🔗 *GARANTA SUA VAGA*: {link}`
     - Agora, o gestor enxerga dentro das caixas exatamente o mesmo conteúdo e formato que aparece na prévia do WhatsApp, facilitando a edição de regras, referências e orientações específicas.
  2. **Eliminação da Segunda Linha Separadora no Rodapé**:
     - Removida a linha separadora duplicada tanto em `escalaTextoHelper.js` quanto na prévia ao vivo (`useWhatsappConfig.js`).
     - Agora existe apenas **uma única linha separadora** (`━━━━━━━━━━━━━━━━━━`) após os turnos, seguida imediatamente pelo rodapé (que já contém a tag `{link}` e a chamada *"GARANTA SUA VAGA"*).
     - Se o gestor desejar adicionar avisos finais (ex: tolerância de atraso), ele escreve diretamente na caixa de Rodapé, acima ou abaixo do link.
  3. **Foco Contextual para Inserção de Tags (`campoFoco`)**:
     - No `WhatsappConfigModal.jsx`, adicionado o estado `campoFoco` que monitora qual campo recebeu foco por último (`cabecalho` ou `rodape`).
     - O clique nos botões de tags (`{ponto}`, `{empresa}`, `{capacidade}`, `{link}`) insere o valor diretamente no campo ativo.
  4. **Ação Inteligente do Botão "Restaurar Padrão"**:
     - Em vez de limpar os campos para strings vazias, o botão *"Restaurar Padrão"* agora repõe instantaneamente os templates padrão com tags dinâmicas no cabeçalho e rodapé do alvo selecionado.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros (distribuído em 10.33s).

## 33. Resiliência de Sessão JWT e Refresh Automático — Novembro/2026
- **Problema Identificado (2 cenários distintos)**:
  1. **Área Pública do Colaborador**: Quando um gestor tinha logado anteriormente no mesmo navegador e seu JWT expirava, o Supabase client enviava o token expirado no header `Authorization` nas queries públicas (`empresas.select('*').eq('codigo_escala', ...)`). O PostgREST rejeitava com `PGRST303 JWT expired` em vez de fazer fallback para role `anon`. Resultado: tela "Erro de Configuração" com loop infinito de 401.
  2. **Portal do Gestor**: Após ~1h (expiração do access_token), o `onAuthStateChange` disparava com sessão expirada. A versão anterior do código fazia `signOut({ scope: 'local' })` ao detectar JWT expirado, **destruindo o `refresh_token`** do `localStorage` e impedindo a renovação automática da sessão. Resultado: gestor era deslogado e via "Nenhuma Empresa Vinculada" mesmo tendo empresa cadastrada.
- **Correções Implementadas**:
  1. **`AuthContext.jsx` — Refresh Silencioso com 3 Camadas de Proteção**:
     - `handleSessionChange` com detecção de `expires_at` expirado: em vez de destruir o `refresh_token`, chama `supabase.auth.refreshSession()` e aguarda o `onAuthStateChange` com `TOKEN_REFRESHED` e sessão válida.
     - Guard `refreshingRef` (useRef) contra múltiplas chamadas simultâneas de `refreshSession()` quando o SDK dispara vários eventos em sequência (ex: `_onVisibilityChanged`).
     - `fetchUserData` reformulado para retornar `{ data, jwtExpired }` com *early return* ao primeiro erro PGRST303 — evita 3 requests 401 desnecessárias (perfis + get_minhas_empresas + usuarios_empresas). Se `jwtExpired = true`, o handler tenta refresh + retry automático.
     - Helper `isJwtExpiredError()` centralizado para detecção de `PGRST303`, `JWT expired` e `401`.
     - Sessão null (refresh falhou): apenas limpa estado React, **NÃO** re-executa `signOut` (Supabase já limpou internamente).
     - `TOKEN_REFRESHED` adicionado à lista de eventos que disparam `fetchUserData` para recarregar dados após renovação bem-sucedida.
  2. **`TenantContext.jsx` — Query Pública Segura (`queryEmpresaSegura`)**:
     - Wrapper factory-based para queries da área pública (Cenário C / visão do colaborador).
     - Se a primeira tentativa retorna `PGRST303`, faz `signOut({ scope: 'local' })` silencioso (neste caso é seguro pois a área pública não usa autenticação) e reconstrói a query do zero via factory function (query builders do Supabase são single-use / consumidos após execução).
     - Na segunda execução, o client não envia mais o JWT expirado → query passa como role `anon` normalmente.
     - Garante que colaboradores nunca vejam "Erro de Configuração" por causa de sessão expirada de gestor no mesmo navegador.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros (distribuído em 8.28s).

---

## 34. Manutenção Programada e Modo "Em Construção" na Landing Page — Novembro/2026
- **Contexto e Necessidade**:
  - Necessidade de suspender temporariamente a página de vendas principal (`escalafacil.online/`) para reformulações ou atualizações, exibindo um aviso de "Em Construção / Novidades em Breve".
  - **Requisito Crítico**: o bloqueio NUNCA pode afetar os links seguros das escalas dos corretores (`escalafacil.online/[codigo12]`) nem o portal administrativo dos gestores (`app.escalafacil.online`).
- **Implementações Realizadas**:
  1. **Componente Modular `EmConstrucao.jsx`**:
     - Design moderno, mobile-first e dark mode com iluminação sutil.
     - Badge animado com efeito ping: `🚧 Página em Atualização • Novidades em Breve`.
     - Título e mensagem amigável explicando a reformulação da página.
     - Card contextual tranquilizando clientes e gestores já cadastrados (garantindo que suas escalas e links continuam 100% no ar).
     - Botão de acesso direto ao **"Portal do Gestor"** e atalho para o **WhatsApp de Suporte** (`VITE_WHATSAPP_SUPORTE`).
  2. **Controle Híbrido em `src/App.jsx`**:
     - Flag `EM_CONSTRUCAO` configurável tanto diretamente no código quanto via variável de ambiente `.env` (`VITE_EM_CONSTRUCAO=true|false`).
     - Integração isolada no bloco `if (isLanding)` — preserva 100% da integridade de corretores e gestores.
  3. **Documentação e Build**:
     - Atualizado `.env.example` com `VITE_EM_CONSTRUCAO`.
     - `npm run build` executado com sucesso e zero erros.

---

## 35. Blindagem de Segurança & Remoção Integral do PIN Legado (Fase 14) — Novembro/2026
- **Contexto e Riscos Endereçados**:
  1. **Remoção total do PIN Legado**: O sistema passou a operar exclusivamente com autenticação institucional via Supabase Auth (E-mail e Senha), eliminando formulários, cards, modais e RPCs legadas de PIN (`PinLegadoForm`, `PortalPinLegadoForm`, `AlterarSenhaModal`, `AdminSenhaCard`, `InputSenhaPin`, `adminAuthHelper`, `isPinAuth`, `empresas.admin_pin`, `verificar_admin_pin`, `alterar_admin_pin`, `vincular_com_pin`).
  2. **Brecha de chamada anônima em RPCs administrativas**: Corrigidas todas as funções `SECURITY DEFINER` que usavam `IF auth.uid() IS NOT NULL THEN ...` para exigir estritamente `auth.uid() IS NOT NULL AND has_empresa_role(...)` (sem bypass de superadmin).
  3. **Exposição pública via `SELECT USING (true)`**: Bloqueado acesso direto de `anon` nas tabelas `empresas`, `pontos`, `turnos`, `reservas`, `equipe_corretores`, `convites_gestores` e `asaas_webhooks_log`, e removida escrita direta anônima em `reservas`.
  4. **Fallback por nome em `reservar_vaga`**: Removida a busca por nome quando `exigir_cadastro_previo = true`, exigindo correspondência exata na credencial configurada (`whatsapp`, `email` ou `ambos`).
  5. **Restrição de Webhook Asaas**: `provisionar_empresa_asaas` e `atualizar_status_empresa_asaas` revogadas de `PUBLIC`, `anon` e `authenticated`, ficando restritas a `service_role`.
- **Arquitetura Implementada**:
  1. **Script SQL `supabase_migration_fase14_blindagem_seguranca.sql` + `supabase_schema.sql`**:
     - Nova tabela `escala_sync (empresa_id, updated_at)` sem PII, atualizada por trigger `fn_sync_escala_empresa` para Realtime público seguro.
     - Novas RPCs públicas sanitizadas: `get_empresa_publica`, `get_escala_publica` (oculta `device_id`, `corretor_whatsapp`, `corretor_email` e aplica Modo Anônimo no servidor) e `verificar_identidade_colaborador` (checagem pontual sem listar equipe/reservas).
  2. **Frontend Blindado**:
     - Novo helper `src/lib/supabasePublicHelper.js` (`executarPublicoSeguro`, `isRpcAusenteError`, `isJwtExpiredError`).
     - `TenantContext.jsx`, `useEscalaData.js`, `useVerificacaoIdentidade.js` e `useColaborador.js` migrados para as RPCs públicas sanitizadas e `escala_sync` (com fallback transitório automático caso a migração SQL ainda não tenha sido executada).
     - `TurnoCard.jsx` e `DiaAcordeonItem.jsx` compatíveis com `eh_minha` (RPC pública) e `device_id` (gestor/demo).
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros (`vite build`).

---

## 36. Regras Inteligentes de Escala: Bloqueio de Conflito de Horário & Cotas Anti-Monopólio (Fase 15) — Novembro/2026
- **Contexto e Objetivos**:
  1. **Bloqueio de Conflito de Horário**: Impedir que um colaborador reserve dois turnos que se sobrepõem no mesmo dia (mesmo em pontos de captação diferentes).
  2. **Cotas / Limites Justos ("Anti-Monopólio")**: Permitir configurar limites máximos de reservas por colaborador na empresa (`limite_vagas_semana`, `limite_vagas_dia`, `limite_vagas_ponto`).
- **Arquitetura Implementada**:
  1. **Migração SQL Idempotente (`supabase_migration_fase15_regras_escala.sql` + `supabase_schema.sql`)**:
     - Colunas `hora_inicio TIME` e `hora_fim TIME` em `public.turnos`, com funções `normalizar_dia_semana`, `extrair_horarios_turno`, backfill idempotente de formatos legados (ex: `"8 as 10 hs"`, `"11:30 às 14hrs"`) e trigger `trg_turnos_preencher_horas`.
     - Colunas `bloquear_conflito_horario`, `limite_vagas_semana`, `limite_vagas_dia`, `limite_vagas_ponto` e `cotas_pontos_ids` em `public.empresas`, expostas em `get_empresa_publica` (e `hora_inicio`/`hora_fim` em `get_escala_publica`).
     - RPC administrativa segura `atualizar_regras_escala` exigindo `auth.uid() IS NOT NULL AND has_empresa_role(..., ARRAY['admin'])`.
     - RPC `reservar_vaga` blindada com `pg_advisory_xact_lock` ordenado por identificadores do colaborador (`device_id`, WhatsApp e E-mail) antes de `FOR UPDATE OF t`, tratando virada de meia-noite e lançando exceções amigáveis.
  2. **Frontend Modularizado & Fallbacks Seguros**:
     - `src/lib/horarioHelper.js`: parsing legado, normalização `TIME`, interseção de intervalos (inclusive virada de meia-noite) e `calcularResumoColaborador`.
     - `FormAddTurno.jsx`, `EditarTurnoModal.jsx`, `DuplicarDiaModal.jsx` e `usePontosManager.js`: seleção limpa de **Hora Início** e **Hora Fim** com fallback automático caso a migração SQL ainda não tenha sido aplicada.
     - `RegrasEscalaCard.jsx` + `CotaStepperField.jsx` + `CotasPontosDropdown.jsx` em `AdminTabConfiguracoes.jsx`: painel mobile-first para o administrador configurar bloqueio de conflito, cotas e seleção de pontos (todos ou específicos).
     - `CorretorRegrasBanner.jsx`, `DiaAcordeonItem.jsx`, `TurnoCard.jsx` e `useColaborador.js`: barra discreta de saldo de cotas, bloqueio visual preventivo no card e toasts contextuais claros.
     - `demoData.js` e `useDemoEscala.js`: paridade completa no modo demonstração `/demo` sem tocar no banco.






  3. **Validação de Build**:
     - `npm run build` executado com sucesso e zero erros (`vite build`).

---

## 37. Sincronização de Datas do Calendário no Texto do WhatsApp (Opção A) — Novembro/2026
- **Contexto e UX/UI**:
  - No WhatsApp, o emoji nativo `📅` (Unicode `U+1F4C5`) exibe graficamente a folha de calendário fixa com `"24 FEB"` em homenagem à data de fundação do WhatsApp (24/02/2009).
  - Essa limitação visual do aplicativo WhatsApp causava estranheza aos corretores e gestores, pois todos os dias da semana (Segunda a Domingo) pareciam fixados em 24 de fevereiro.
- **Solução Implementada (Opção A)**:
  - Adicionadas funções utilitárias em `src/lib/diasSemana.js` (`obterSegundaFeiraReferencia`, `obterDataDoDiaSemana`, `formatarDataDdMm`, `formatarDiaComData`).
  - Cálculo inteligente de ciclo semanal:
    - De Segunda a Sábado: a escala refere-se ao ciclo semanal corrente (Segunda-feira mais recente até Domingo).
    - No Domingo: caso a escala contenha dias anteriores (Segunda a Sábado), projeta automaticamente para a nova semana que começa no dia seguinte (Segunda-feira). Se contiver apenas Domingo, refere-se ao domingo atual.
    - Suporta virada de mês, anos bissextos e transição de ano com segurança nativa de `Date`.
    - Sanitização contra duplicação de datas caso o dia já contenha formato `(DD/MM)`.
  - Integração em `src/components/corretor/escalaTextoHelper.js`:
    - Ao gerar o texto para cópia no WhatsApp, cada dia é formatado como: `📅 *SEGUNDA-FEIRA (DD/MM)*`.
  - Integração em `src/components/admin/whatsapp/useWhatsappConfig.js`:
    - A bolha de pré-visualização em tempo real no painel do administrador também exibe a data real calculada da semana, mantendo 100% de coerência visual.
- **Validação de Build**:
  - Testes automatizados executados via Node.js validando todos os cenários (dias úteis, domingos, virada de mês e escala completa).
  - `npm run build` executado com sucesso e zero erros (`vite build`).

---

## 38. Modularização e Composição de Hooks do WhatsApp (`src/components/admin/whatsapp/`) — Novembro/2026
- **Contexto e Problema de Arquitetura**:
  - O hook `useWhatsappConfig.js` possuía 666 linhas concentrando cinco responsabilidades completamente distintas em um bloco monolítico: controle de seleção/cursor de múltiplos textareas com restauração de scroll após re-render, buffer em memória de rascunhos para múltiplos alvos com chaveamento sem perda de dados, status e mutações de visibilidade dos botões de cópia no painel e na visão pública, interpolação de tags e formatação da bolha de prévia ao vivo, e camada assíncrona de I/O no Supabase com fallbacks em RPCs e JSONB.
- **Estrutura Modular Implementada (`Hook Composition & Clean Architecture`)**:
  1. `useTextareaCursor.js`: Sub-hook responsável pelo tracking de seleções de cursor (`selectionStart`/`selectionEnd`), scroll restoration pós-render via `useLayoutEffect`, e despacho de inserção inteligente de tags e emojis no cursor preservando foco.
  2. `useWhatsappDrafts.js`: Sub-hook responsável pelo estado ativo (`alvoId`, `pontoAtual`), carregamento de valores salvos/padrões, mapa de rascunhos em memória (`drafts`), chaveamento suave entre alvos com preservação de alterações e restauração de modelos padrão do sistema.
  3. `useWhatsappVisibility.js`: Sub-hook responsável pelo controle de visibilidade (ativo/inativo) do botão de cópia do WhatsApp na Escala Geral e por Ponto individual, com persistência e fallback no Supabase.
  4. `whatsappService.js`: Módulo de serviço assíncrono puro (`persistirWhatsappConfiguracoes`) para gravação no Supabase (`empresas`, `pontos`, RPCs de contingência e JSONB de blindagem), isolando 100% o I/O de dados fora dos hooks.
  5. `whatsappPreviewHelper.js`: Função utilitária pura (`gerarTextoPreviewWhatsapp`) de interpolação e formatação do texto da prévia do balão com tags, dados da empresa, pontos e datas calculadas.
  6. `useWhatsappConfig.js`: Hook orquestrador (Facade) enxuto reduzido de 666 linhas para ~170 linhas (~75% de redução), compondo os submódulos e mantendo 100% de compatibilidade retroativa com `WhatsappConfigModal.jsx` (zero breaking changes).
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros (`vite build`).


---

## 41. Padronização e Refatoração Visual do Card de Abertura Programada — Novembro/2026
- **Contexto e Causa Raiz do Problema**:
  - O card de Abertura Programada (`AgendamentoAberturaCard.jsx`) na aba de Configurações do painel administrativo apresentava distribuição visual desproporcional e elementos comprimidos:
    - O título principal e o badge de status agendado continham textos longos em caixa alta (`AGENDADA (2 PONTOS DE CAPTAÇÃO SELECIONADOS)`), que quebravam em múltiplas linhas devido à compressão exercida pelos botões fixados à direita.
    - O card não seguia o padrão de altura compacta e acordeon retrátil com chevron rotativo (`v` / `^`) adotado pelo card irmão `RegrasEscalaCard.jsx`.
- **Soluções Implementadas**:
  1. `src/components/admin/abertura/AgendamentoAberturaCard.jsx`:
     - **Padrão Retrátil (Expand/Collapse)**: Implementado cabeçalho clicável com chevron (`ChevronDown`) rotativo de 180°, mantendo a mesma altura uniforme, tokens semânticos (`card bg-surface-800/90 border-surface-600 space-y-3`) e espaçamentos dos demais cards da tela (`min-h-[44px]`).
     - **Distribuição Visual Limpa e Sem Quebras**:
       - Título conciso: *"Abertura Programada"* com ícone `CalendarClock`.
       - Badge inteligente e compacto: exibe *"Agendada (2 locais)"*, *"Agendada (Geral)"* ou *"Aberta"*, evitando quebras de linha em telas estreitas.
       - Subtítulo em linha única truncada: resume a data de abertura e a contagem regressiva ativa (ex: *"Abertura em Sex (13/11) às 21:45 • Faltam 10:54:46"*).
     - **Painel Expandido Detalhado**:
       - Quando agendada: exibe painel com Data Completa de Liberação, Escopo completo com nomes dos locais selecionados, contador de contagem regressiva com dígitos monoespaçados (`CountdownBadge`) e nota informativa da trava automática.
       - Quando locais individuais agendados: lista com tags e horários de cada ponto programado.
       - Quando aberta: orientação de funcionamento da trava e contagem regressiva.
     - **Barra de Ações Ampla e Touch-Friendly**:
       - Botão *"Liberar Agora"* e botão *"Alterar Horário"* / *"Programar Abertura"* movidos para a área expandida com espaçamento adequado, touch targets confortáveis (min-h: 40px) e sem espremer o cabeçalho.
- **Validação de Build**:
  - `npm run build` executado com sucesso e zero erros (`vite build`).

---

## 42. "Minha Agenda" Consolidada: Google Agenda e Baixar em PDF — Novembro/2026
- **Contexto e Necessidade do Usuário**:
  - Na visão pública (`PontoSelectorView.jsx` e `PontoTurnosView.jsx`), o colaborador precisava navegar ponto por ponto e abrir dia por dia para lembrar em quais turnos estava escalado.
  - Havia a necessidade de uma visualização consolidada de todas as vagas garantidas na semana, com atalhos rápidos e sem poluição visual.
  - O formato `.ics` e botões individuais em cada card foram removidos por causarem atrito e ruído visual, sendo substituídos por duas ações principais no topo: **Google Agenda** e **Baixar em PDF**.
- **Arquitetura e Soluções Implementadas**:
  1. `src/lib/agendaPdfHelper.js`:
     - Módulo utilitário de geração de documento PDF/impressão corporativo e de alta definição.
     - `gerarHtmlAgendaPdf`: Gera folha formatada com cabeçalho (empresa, data/hora de emissão), dados do colaborador, quantidade de vagas e tabela estruturada (Dia/Data, Horário em badge, Local/Ponto).
     - `baixarAgendaPdf`: Aciona a impressão nativa via `iframe` oculto que abre o diálogo nativo do navegador com suporte direto a *"Salvar como PDF"* tanto no computador quanto no celular (Android/iOS).
  2. `src/lib/icsHelper.js`:
     - Mantido `gerarGoogleCalendarUrl` para abertura direta de eventos no Google Agenda com dados preenchidos.
  3. `src/lib/horarioHelper.js`:
     - `calcularResumoColaborador` inclui `reservaId: r.id` e `dataReserva: r.created_at` em `turnosReservados`, viabilizando cancelamento de vagas direto da lista consolidada.
  4. `src/components/corretor/MinhaAgendaCard.jsx`:
     - Card compacto e moderno inserido no topo da escala (`CorretorIdentityHeader.jsx`).
     - Exibe badge com contagem de turnos garantidos (ex: *"4 horários"*), preview do próximo horário cronológico e botão de toque rápido *"Ver horários"*.
  5. `src/components/corretor/MinhaAgendaModal.jsx`:
     - Modal responsivo e touch-friendly (Bottom Sheet no mobile com cantos arredondados, backdrop blur e scroll suave).
     - **Topo Fixo com Botão Único de PDF**:
       - Botão **`Baixar Agenda em PDF`**: aciona geração instantânea do PDF da agenda da semana com folha formatada profissional para salvar ou imprimir.
     - **Cards de Horários com Ação Direta no Google Agenda**:
       - Cada card exibe Dia e Data (ex: `SEGUNDA-FEIRA (09/11)`), Horário (`14 as 16 hs`), Local (`Extra Belenzinho`), botão de lixeira no topo para cancelar a vaga e botão **`Adicionar ao Google Agenda`** na base do card para abrir aquele evento específico diretamente no Google Calendar sem misturar abas.
- **Validação e Testes**:
  - Testes automatizados executados via Node.js validando geração de HTML para PDF e links do Google Agenda.
  - `npm run build` executado com sucesso e zero erros (`vite build`).
