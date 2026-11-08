# AGENTS.md — EscalaFácil (Controle de Captação)

> **Instrução para Agentes de IA**: Este arquivo define as diretrizes, contexto de arquitetura, modelo de dados e regras de negócio do **EscalaFácil**. Leia este arquivo integralmente no início de cada sessão para manter consistência nas alterações.

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
**Objetivo principal**: Substituir listas informais e manuais do WhatsApp por uma plataforma web moderna, rápida e em tempo real, onde cada imobiliária possui seu ambiente isolado (multi-tenant) e corretores garantem e cancelam vagas em pontos de captação física sem sobreposição ou conflitos (*race conditions*).

---

## 2. Stack Tecnológica
- **Frontend**: React 18 (SPA) com Vite 5
- **Hospedagem & CDN**: Cloudflare Pages (Deploy contínuo via GitHub, branch main em produção, SSL gratuito e roteamento SPA via public/_redirects)
- **Estilização**: Tailwind CSS com suporte completo a Modo Escuro (padrão) e Modo Claro, alternável via CSS variables dinâmicas e tokens semânticos
- **Ícones**: `lucide-react`
- **Multi-Tenancy**: `TenantContext` com resolução por subdomínio (`imobiliaria.meusaas.com`), rota/slug (`/imobiliaria`), query param (`?empresa=imobiliaria`) e persistência segura no `localStorage`.
- **Backend / BaaS**: Supabase
  - PostgreSQL 15+ com Row Level Security (RLS)
  - Supabase Auth com persistência de sessão JWT (`AuthContext`)
  - Supabase Realtime via WebSockets escutando com filtro estrito de `empresa_id`
  - Postgres Functions / RPCs com transações e row-level locking (`FOR UPDATE`)
- **Autenticação dos Corretores (Zero-Atrito)**: Sem login tradicional (identidade via `localStorage` com `device_id` UUID e `corretor_nome`).
- **Autenticação dos Gestores (RBAC)**: Supabase Auth (`auth.users`) + tabela `perfis` e `usuarios_empresas` com papéis ('superadmin', 'admin', 'gestor'). PIN legado preservado como fallback de contingência.

---

## 3. Modelo de Dados e Banco Multi-Tenant (Supabase)

### Tabelas Principais:
1. **`empresas`** (Tenants do SaaS, ex: Minha Imobiliária, Direcional, Remax Prime):
   - `id` (uuid, PK)
   - `nome` (text, ex: 'Direcional Imóveis')
   - `slug` (text UNIQUE, ex: 'direcional')
   - `codigo_escala` (text UNIQUE, código aleatório de 12 caracteres alfanuméricos anti-espionagem)
   - `logo_url` (text)
   - `cor_primaria` (text, padrão `#3b82f6`)
   - `admin_pin` (text, padrão `'1234'`)
   - `plano` (text: 'trial', 'pro', 'ilimitado')
   - `status` (text: 'ativo', 'inativo', 'bloqueado')
   - `asaas_customer_id` (text, opcional para billing Asaas)
   - `asaas_subscription_id` (text, opcional para billing Asaas)
   - `email_cobranca` (text, e-mail financeiro)
   - `telefone_cobranca` (text)
   - `created_at` (timestamptz)
2. **`perfis`** (Perfis de Usuários Supabase Auth):
   - `id` (uuid, PK REFERENCES `auth.users.id` ON DELETE CASCADE)
   - `email` (text)
   - `nome` (text)
   - `is_superadmin` (boolean, padrão `false`)
   - `created_at` (timestamptz)
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
  - Trava o turno contra race conditions (`SELECT capacidade, empresa_id FROM turnos WHERE id = p_turno_id FOR UPDATE`).
  - Se `exigir_cadastro_previo` estiver ativo na imobiliária, valida se o corretor pertence à `equipe_corretores`.
  - Impede reserva duplicada do mesmo `device_id` no turno.
  - Insere a reserva vinculando automaticamente o `empresa_id` e salvando o WhatsApp.
- **`cancelar_vaga(p_reserva_id, p_device_id)`**:
  - Permite que o corretor delete apenas sua própria vaga comparando `device_id`.
- **`limpar_escala(p_empresa_id, p_ponto_id DEFAULT NULL)`**:
  - Valida papel do gestor autenticado ou superadmin antes de deletar reservas.
- **`get_metricas_empresas()`**:
  - Retorna em uma única query agregada as contagens reais de pontos ativos, turnos e reservas de cada tenant para o Superadmin.
- **`is_superadmin(p_user_id DEFAULT auth.uid())`**:
  - Função `SECURITY DEFINER` para verificação de permissão global de Superadmin.
- **`has_empresa_role(p_empresa_id, p_roles, p_user_id)`**:
  - Função `SECURITY DEFINER` para validação de papel na imobiliária.
- **`get_minhas_empresas()`**:
  - Retorna as empresas às quais o usuário logado possui acesso de gestão.
- **`promover_superadmin(p_email)`**:
  - Promove usuário a Superadmin do SaaS com segurança.
- **`vincular_usuario_empresa(p_email, p_empresa_id, p_role)`**:
  - Vincula gestores e diretores a uma imobiliária por e-mail.
- **`criar_nova_empresa(p_nome, p_slug, p_admin_pin DEFAULT '1234')`**:
  - Cria um novo tenant isolado e associa o criador logado como admin.
- **`alternar_protecao_equipe(p_empresa_id, p_exigir)`**:
  - Altera a chave exigir_cadastro_previo com suporte híbrido para Supabase Auth e PIN de contingência.
- **`adicionar_corretor_equipe(p_empresa_id, p_nome, p_whatsapp)`**:
  - Adiciona membro autorizado na equipe de corretores via RPC segura.
- **`alternar_status_corretor(p_corretor_id, p_empresa_id, p_ativo)`**:
  - Ativa ou desativa corretor da equipe autorizada.
- **`remover_corretor_equipe(p_corretor_id, p_empresa_id)`**:
  - Remove corretor da equipe autorizada da imobiliária.
- **`redefinir_codigo_escala(p_empresa_id)`**:
  - Gera um novo código aleatório seguro de 12 caracteres para a empresa, invalidando o anterior imediatamente contra vazamentos e espionagem de concorrentes. Exclusivo para administradores.

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
├── supabase/
│   └── functions/
│       └── asaas-webhook/       # Supabase Edge Function Deno/TS de processamento do webhook Asaas
│           ├── index.ts
│           └── README.md
├── AGENTS.md                    # Diretrizes e memória para Agentes de IA (este arquivo)
├── PROJECT_MEMORY.md            # Memória técnica persistente
└── src/
    ├── main.jsx                 # Ponto de entrada do React com ConfirmProvider, AuthProvider e TenantProvider
    ├── index.css                # Tailwind + classes utilitárias (.card, .btn-*, scrollbar dark)
    ├── App.jsx                  # Estado raiz, roteamento por tenant/view, canal Realtime isolado
    ├── contexts/
    │   ├── AuthContext.jsx      # Provedor de contexto do Supabase Auth, RBAC e sessões
    │   └── TenantContext.jsx    # Provedor de contexto do tenant ativo, detecção e troca de empresa
    ├── lib/
    │   ├── supabaseClient.js    # Instância do createClient configurada
    │   ├── tenantHelper.js      # Utilitários de extração de slug, subdomínio e URL compartilhável
    │   └── diasSemana.js        # Utilitários, ordenação e normalização de dias da semana
    └── components/
        ├── CorretorView.jsx     # Tela pública do corretor (seleção de ponto, turnos e link WhatsApp)
        ├── TurnoCard.jsx        # Card de turno na visão do corretor (progresso, botões contextuais)
        ├── NomeModal.jsx        # Modal para solicitar nome e WhatsApp do corretor
        ├── ConfirmModal.jsx     # Modal universal assíncrono de confirmação/exclusão (useConfirm)
        ├── AdminLoginModal.jsx  # Modal estilizado para login do gestor (Email/Senha, Cadastro, Reset e PIN legado)
        ├── PortalGestorLogin.jsx# Tela full-page de login exclusivo dos gestores (app.escalafacil.online)
        ├── LinkSeguroManager.jsx# Gerenciador de link seguro anti-espionagem (12 chars) com redefinição no AdminView
        ├── AlterarSenhaModal.jsx# Modal para alteração segura de PIN pelo gestor da empresa
        ├── AdminView.jsx        # Painel do Administrador (banner de identidade, turnos, pontos e equipe)
        ├── PontosManager.jsx    # Gestão de pontos com RBAC granular (bloqueio de ações destrutivas para coordenadores)
        ├── GestoresManager.jsx  # Gestão de coordenadores e gestores da imobiliária (convite por e-mail e papéis)
        ├── EquipeManager.jsx    # Gerenciador de equipe autorizada e chave de proteção contra invasores
        ├── TurnosDiaList.jsx    # Lista de turnos por dia com drag-and-drop animado (SortableJS) e gestão de corretores
        ├── TenantSwitcherModal.jsx # Modal para trocar de imobiliária e copiar link direto do WhatsApp
        ├── TenantNotFound.jsx   # Tela elegante de 404 quando o slug não existe com busca e demo
        ├── TenantBlockedView.jsx# Tela de suspensão amigável para empresas inadimplentes ou bloqueadas
        ├── ThemeToggle.jsx      # Botão animado de alternância Modo Claro / Escuro (Sun/Moon com persistência)
        └── Toast.jsx            # Notificações visuais animadas
```

---

## 5. Fluxos e Funcionalidades Detalhadas

### 5.1. Fluxo do Corretor (Visão Pública — Zero-Atrito)
1. **Identificação transparente**: Ao carregar, o sistema obtém ou gera um `device_id` no `localStorage`.
2. **Seleção de Ponto de Captação**:
   - Exibe apenas os pontos da empresa cadastrada com status de vagas em tempo real.
3. **Quadro de Horários e Acordeon por Dia da Semana**:
   - Agrupado pelos dias da semana na ordem cronológica natural (Segunda a Domingo).
   - Vagas em tempo real, "Garantir Vaga" e "Cancelar Minha Vaga".

### 5.2. Fluxo do Gestor / Administrador (Supabase Auth & RBAC)
1. **Acesso com E-mail e Senha**:
   - Supabase Auth com validação de vínculo na empresa ativa (`canManageEmpresa`).
   - Se pertencer a outra imobiliária, o modal apresenta atalho direto de 1 clique.
   - Fallback para PIN legado mantido durante a transição.
2. **Banner de Identidade no AdminView**:
   - Exibe nome do gestor, e-mail e badge contextual (`Admin da Imobiliária` ou `Gestor de Plantão`).
3. **Gestão de Pontos e Turnos**:
   - Criar, ordenar, duplicar e renomear pontos e horários, sempre vinculando ao `empresa_id` e protegido por RLS.

### 5.3. Gestão Centralizada da Plataforma (100% Supabase / Zero Frontend Attack Surface)
1. **Remoção Completa do Superadmin no Frontend**:
   - Toda e qualquer administração de nível de plataforma (criação de tenants, alteração de planos, bloqueio e desbloqueio de imobiliárias, concessão de perfis administrativos) é feita diretamente pelo painel do **Supabase Studio (Table Editor / SQL Editor)**.
   - Isso elimina qualquer risco de exposição no frontend, bypass de JWT ou vazamento de privilégios globais na aplicação cliente.

### 5.4. Piloto Automático de Vendas & Billing Asaas (Fase 3)
1. **Supabase Edge Function (`asaas-webhook`)**:
   - Deployed no projeto `cpystvyhkstxfvkzfvkk` com `--no-verify-jwt`.
   - URL: `https://cpystvyhkstxfvkzfvkk.supabase.co/functions/v1/asaas-webhook`.
   - Processa notificações de pagamento do Asaas com idempotência em `asaas_webhooks_log`.
2. **Provisionamento e Bloqueio**:
   - `PAYMENT_CONFIRMED`: Cria tenant, usuário no Supabase Auth e turnos iniciais via RPC `provisionar_empresa_asaas`.
   - `PAYMENT_OVERDUE` / `SUBSCRIPTION_DELETED`: Suspende imobiliária alterando status para `'bloqueado'` via RPC `atualizar_status_empresa_asaas`.
   - `PAYMENT_RECEIVED`: Restaura status para `'ativo'` automaticamente quando fatura em atraso for quitada.
3. **Frontend Suspenso (`TenantBlockedView.jsx`)**:
   - Apresenta tela informativa amigável para corretores e botão de regularização via WhatsApp para gestores.
   - Alerta contextual persistente no topo do `AdminView.jsx`.
4. **Pendências Externas (Configuração Manual do Usuário)**:
   - Configuração de secrets no Supabase (`ASAAS_WEBHOOK_SECRET`, `ASAAS_API_KEY`, `ASAAS_ENV`).
   - Cadastro do endpoint de webhook no painel do Asaas.

### 5.5. Arquitetura de URLs, Portal do Gestor e Links Seguros Anti-Espionagem (Fase 4)
1. **Portal Exclusivo do Gestor (`app.escalafacil.online`)**:
   - Subdomínio dedicado apenas à área autenticada dos gestores.
   - Se desconectado: renderiza a tela dedicada de login/cadastro (`PortalGestorLogin.jsx`).
   - Se conectado: detecta a imobiliária vinculada e abre direto o `AdminView` (sem tela de corretor ou botão voltar).
   - Inclui atalho de 1 clique no header para "Escala Pública ↗" em nova aba.
2. **Link Seguro dos Corretores (`escalafacil.online/[codigo12]`)**:
   - Token aleatório de 12 caracteres alfanuméricos (`codigo_escala`), ex: `https://escalafacil.online/A7bjs92Rlzm6`.
   - Impossível de adivinhar por concorrentes trocando o nome da empresa na URL.
   - Oculta o botão de escudo/admin do header, garantindo layout 100% voltado para corretores com zero superfície de ataque.
3. **Gerenciador de Link no `AdminView` (`LinkSeguroManager.jsx`)**:
   - Exibe a URL oficial segura com botões de 1 clique para "Copiar Link" e "Compartilhar no WhatsApp".
   - Botão "Redefinir Link Seguro" com modal assíncrono `useConfirm`, acionando a RPC `redefinir_codigo_escala` que revoga o link anterior imediatamente.

