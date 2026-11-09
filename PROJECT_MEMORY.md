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
  - Supabase Auth com gerenciamento de sessão persistente (`AuthContext`), e-mail/senha e tokens JWT
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
    │   ├── AuthContext.jsx      # Provedor de contexto do Supabase Auth, RBAC, sessões e papéis
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
        ├── AdminLoginModal.jsx  # Modal de autenticação profissional de gestores (Email/Senha, Cadastro, Reset e PIN legado)
        ├── AlterarSenhaModal.jsx# Modal para alteração segura de PIN pelo gestor da empresa
        ├── AdminView.jsx        # Painel do Gestor (banner de identidade, gestão de turnos, pontos e equipe)
        ├── PontosManager.jsx    # Gestão de pontos com RBAC granular (bloqueio de exclusão/renomeação para coordenadores)
        ├── GestoresManager.jsx  # Gestão de coordenadores e gestores da imobiliária (convite por e-mail e papéis)
        ├── EquipeManager.jsx    # Gerenciador de equipe autorizada e chave de proteção contra invasores
        ├── TurnosDiaList.jsx    # Lista de turnos por dia com drag-and-drop animado (SortableJS) e gestão de corretores
        ├── TenantNotFound.jsx   # Tela elegante de 404 quando o slug não existe com busca e demo
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
  - O botão avulso de alternância de modo foi removido do topo para evitar poluição visual, mantendo a alternância centralizada no card dedicado dentro da aba ⚙️ Configurações.
  - Na Visão Contínua, o card intermediário foi totalmente removido e substituído por um botão puro de ícone (`LayoutGrid`, sem texto) posicionado no extremo direito do card de identificação do gestor para retorno imediato ao Modo em Abas.
  - Tooltips nativos dinâmicos via atributo `title` ao passar o mouse em cada ícone (*"Escala"*, *"Equipe"*, *"Pontos"* e *"Configurações"*).
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







