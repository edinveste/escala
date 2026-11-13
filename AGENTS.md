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
  - Supabase Auth com persistência de sessão JWT (`AuthContext`) e refresh automático resiliente
  - Supabase Realtime via WebSockets escutando com filtro estrito de `empresa_id`
  - Postgres Functions / RPCs com transações e row-level locking (`FOR UPDATE`)
- **Autenticação dos Corretores (Zero-Atrito)**: Sem login tradicional (identidade via `localStorage` com `device_id` UUID e `corretor_nome`).
- **Autenticação dos Gestores (RBAC)**: Supabase Auth (`auth.users`) + tabela `perfis` e `usuarios_empresas` com papéis ('admin', 'gestor'). Acesso administrativo exclusivamente autenticado via E-mail e Senha (PIN legado removido integralmente na Fase 14).

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
   - `plano` (text: 'trial', 'pro', 'ilimitado')
   - `status` (text: 'ativo', 'inativo', 'bloqueado')
   - `asaas_customer_id` (text, opcional para billing Asaas)
   - `asaas_subscription_id` (text, opcional para billing Asaas)
   - `email_cobranca` (text, e-mail financeiro)
   - `telefone_cobranca` (text)
   - `copia_whatsapp_geral_ativa` (boolean, padrão `true`)
   - `ocultar_nomes_escala` (boolean, padrão `false`, modo anônimo para corretores)
   - `bloquear_conflito_horario` (boolean, padrão `false`, bloqueio de turnos sobrepostos)
   - `limite_vagas_semana` (int nullable, cota semanal máxima por colaborador)
   - `limite_vagas_dia` (int nullable, cota diária máxima por colaborador)
   - `limite_vagas_ponto` (int nullable, cota máxima por ponto/local por colaborador)
   - `cotas_pontos_ids` (uuid[] nullable, lista de pontos sujeitos às cotas; `NULL` = todos os pontos)
   - `escala_abre_em` (timestamptz nullable, data/hora futura de abertura programada das reservas; `NULL` = aberta imediatamente)
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
   - `hora_inicio` (time nullable, extraído de textos legados ou selecionado na criação/edição)
   - `hora_fim` (time nullable, extraído de textos legados ou selecionado na criação/edição)
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
- **`reservar_vaga(p_turno_id, p_corretor_nome, p_device_id, p_corretor_whatsapp DEFAULT NULL, p_corretor_email DEFAULT NULL)`**:
  - Serializa requisições simultâneas do mesmo colaborador via `pg_advisory_xact_lock` e trava o turno com `FOR UPDATE OF t`.
  - Valida blindagem anti-bypass de abertura programada (`escala_abre_em` futuro bloqueia reservas antes do segundo exato com mensagem amigável no fuso America/Sao_Paulo).
  - Se `exigir_cadastro_previo` estiver ativo na empresa, valida estritamente contra `equipe_corretores` e vincula o `device_id`.
  - Valida bloqueio de conflito de horário (mesmo dia normalizado em qualquer ponto ativo, tratando virada de meia-noite e fallback via `extrair_horarios_turno`) e cotas (`limite_vagas_semana`, `limite_vagas_dia`, `limite_vagas_ponto`).
  - Insere a reserva vinculando automaticamente `empresa_id`, `device_id`, WhatsApp e E-mail.
- **`atualizar_agendamento_escala(p_empresa_id, p_abre_em DEFAULT NULL, p_pontos_ids DEFAULT NULL, p_ponto_id DEFAULT NULL)`** (Fase 16):
  - Exige `auth.uid() IS NOT NULL` e papel `'admin'` ou `'gestor'` na empresa para configurar data/hora de abertura futura ou `NULL` para liberar imediatamente. Suporta escopo Global (`NULL`), seleção de pontos (`p_pontos_ids UUID[]`) ou ponto individual (`p_ponto_id UUID` atualiza `pontos.escala_abre_em`). Quando `p_abre_em IS NULL`, limpa automaticamente `termos` (`escala_abre_em`, `escala_abre_pontos_ids`, `aberturaPontos`) e zera `pontos.escala_abre_em`. Notifica em tempo real via `escala_sync`.
- **`atualizar_regras_escala(p_empresa_id, p_bloquear_conflito, p_limite_semana, p_limite_dia, p_limite_ponto, p_cotas_pontos_ids)`** (Fase 15):
  - Exige `auth.uid() IS NOT NULL` e papel `'admin'` na empresa para configurar bloqueio de conflitos, cotas e o escopo de pontos (`NULL` = todos, ou array de UUIDs).
- **`cancelar_vaga(p_reserva_id, p_device_id)`**:
  - Permite que o corretor delete apenas sua própria vaga comparando `device_id`.
- **`limpar_escala(p_empresa_id, p_ponto_id DEFAULT NULL)`**:
  - Exige `auth.uid() IS NOT NULL` e papel `'admin'` na empresa antes de deletar reservas.
- **`get_empresa_publica(p_identificador)`**, **`get_escala_publica(p_empresa_id, p_device_id)`** e **`verificar_identidade_colaborador(p_empresa_id, p_whatsapp, p_email, p_device_id)`** (Fase 14):
  - RPCs públicas `SECURITY DEFINER` sanitizadas que substituem consultas anônimas diretas às tabelas, ocultando `device_id`, telefones, e-mails e dados financeiros.
- **`get_metricas_empresas()`**:
  - Retorna contagens de pontos ativos, turnos e reservas apenas das empresas às quais o usuário autenticado pertence.
- **`has_empresa_role(p_empresa_id, p_roles, p_user_id)`**:
  - Função `SECURITY DEFINER` estrita (sem bypass de superadmin) para validação de papel na imobiliária.
- **`get_minhas_empresas()`**:
  - Retorna estritamente as empresas às quais o usuário autenticado possui vínculo ativo em `usuarios_empresas`.
- **`vincular_usuario_empresa(p_email, p_empresa_id, p_role)`**:
  - Vincula gestores e diretores a uma imobiliária por e-mail.
- **`criar_nova_empresa(p_nome, p_slug DEFAULT NULL, p_termos DEFAULT '{}'::jsonb)`**:
  - Cria um novo tenant isolado com slug único anti-colisão, código seguro de 12 caracteres e associa o criador logado como `'admin'`.
- **`alternar_protecao_equipe(p_empresa_id, p_exigir)`**:
  - Exige `auth.uid() IS NOT NULL` e papel `'admin'` para alterar `exigir_cadastro_previo`.
- **`adicionar_corretor_equipe(p_empresa_id, p_nome, p_whatsapp DEFAULT NULL, p_email DEFAULT NULL)`**:
  - Adiciona membro autorizado na equipe de corretores via RPC segura com suporte a WhatsApp e E-mail corporativo.
- **`editar_corretor_equipe(p_corretor_id, p_empresa_id, p_nome, p_whatsapp DEFAULT NULL, p_email DEFAULT NULL)`**:
  - Edita nome, WhatsApp ou e-mail de membro da equipe com validação anti-duplicidade em nível de tenant.
- **`alternar_status_corretor(p_corretor_id, p_empresa_id, p_ativo)`**:
  - Ativa ou desativa corretor da equipe autorizada.
- **`desvincular_aparelho_corretor(p_corretor_id, p_empresa_id)`**:
  - Limpa o `device_id_vinculado` do colaborador na equipe autorizada, liberando-o para cadastrar um novo aparelho ou trocar de celular.
- **`remover_corretor_equipe(p_corretor_id, p_empresa_id)`**:
  - Remove corretor da equipe autorizada da imobiliária.
- **`redefinir_codigo_escala(p_empresa_id)`**:
  - Gera um novo código aleatório seguro de 12 caracteres para a empresa, invalidando o anterior imediatamente contra vazamentos e espionagem de concorrentes. Exclusivo para administradores.
- **`atualizar_whatsapp_ponto(p_ponto_id, p_empresa_id, p_cabecalho, p_rodape)`**:
  - Atualiza de forma segura o cabeçalho e rodapé customizados de WhatsApp de um ponto de captação.
- **`atualizar_whatsapp_empresa(p_empresa_id, p_cabecalho, p_rodape)`**:
  - Atualiza de forma segura o cabeçalho e rodapé customizados de WhatsApp da escala completa da empresa.
- **`criar_nova_empresa(p_nome, p_slug DEFAULT NULL, p_admin_pin DEFAULT '1234', p_termos DEFAULT '{}'::jsonb)`**:
  - Provisiona novo Tenant isolado com slug automático anti-colisão, código seguro de 12 caracteres e vincula o usuário criador como Administrador Geral na tabela `usuarios_empresas`.
- **`get_minhas_empresas()` (Fase 13 - Isolamento Estrito)**:
  - Retorna estritamente as empresas às quais o usuário autenticado possui vínculo ativo em `usuarios_empresas`. Erradicado qualquer bypass global de superadmin.

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
├── supabase_migration_fase10_whatsapp_customizado.sql # Script de migração Fase 10: Customização do WhatsApp (Ponto e Geral)
├── supabase_migration_fase11_copia_whatsapp.sql # Script de migração Fase 11: Controle de Visibilidade da Cópia da Escala (Eye/EyeOff)
├── supabase_migration_fase12_ocultar_nomes.sql  # Script de migração Fase 12: Privacidade da Escala Pública (Modo Anônimo / Ocultar Nomes)
├── supabase_migration_fase13_onboarding_empresa.sql # Script de migração Fase 13: Onboarding Multi-Tenant, Nome da Empresa no Cadastro & Erradicação de Superadmin
├── supabase_migration_fase14_blindagem_seguranca.sql # Script de migração Fase 14: Blindagem RLS/RPCs, Realtime sem PII e Remoção do PIN Legado
├── supabase_migration_fase15_regras_escala.sql # Script de migração Fase 15: Bloqueio de Conflito de Horário & Cotas Anti-Monopólio
├── supabase_migration_fase16_abertura_programada.sql # Script de migração Fase 16: Abertura Programada com Contagem Regressiva e Destravamento Automático
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
    │   ├── AuthContext.jsx      # Provedor de contexto do Supabase Auth, RBAC, sessões e refresh resiliente de JWT
    │   └── TenantContext.jsx    # Provedor de contexto do tenant ativo, detecção, troca de empresa e query pública segura contra JWT expirado
    ├── hooks/
    │   ├── useEscalaData.js     # Hook de busca, cache e sincronização em tempo real (Supabase Realtime)
    │   ├── useColaborador.js    # Hook de identidade Zero-Atrito, localStorage e reservas do colaborador
    │   ├── useVerificacaoIdentidade.js # Hook de checagem em tempo real contra equipe autorizada e anti-spoofing
    │   └── useDemoEscala.js     # Hook de sandbox local, simulação de reservas e regras da demonstração (/demo)
    ├── lib/
    │   ├── supabaseClient.js    # Instância do createClient configurada
    │   ├── supabasePublicHelper.js # Utilitários de execução pública segura (JWT expirado e fallback RPC)
    │   ├── tenantHelper.js      # Utilitários de extração de slug, subdomínio e URL compartilhável
    │   ├── diasSemana.js        # Utilitários, ordenação e normalização de dias da semana
    │   ├── horarioHelper.js     # Parsing de horários legados, detecção de conflitos e cálculo de cotas
    │   ├── icsHelper.js         # Exportação RFC 5545 iCalendar (.ics) e links web para Google/Apple/Outlook Calendar
    │   ├── aberturaHelper.js    # Resolução de datas de abertura por escopo (ponto, empresa, termos) e cálculo de status
    │   ├── vocabularioHelper.js # Dicionário de presets, termos e helpers de vocabulário multi-nicho
    │   └── demoData.js          # Mock data e persistência local da escala demonstrativa sandbox (/demo)
    └── components/
        ├── AppHeader.jsx        # Barra superior com logo, badge do portal de gestão, tema e logout
        ├── LandingPage.jsx      # Página de vendas oficial de alta conversão (escalafacil.online/)
        ├── EmConstrucao.jsx     # Página temporária de manutenção e lançamento (chave EM_CONSTRUCAO / VITE_EM_CONSTRUCAO)
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
        │   ├── countdown/                 # Submódulos de contagem regressiva da escala pública (Fase 16)
        │   │   ├── useCountdown.js          # Hook de timer 1s com suporte a callback onFinish
        │   │   ├── CountdownBadge.jsx       # Mini card com algarismos tabulares monoespaçados anti-tremores
        │   │   ├── CountdownTimerBanner.jsx # Banner informativo de abertura programada e destravamento
        │   │   └── index.js
        │   ├── CorretorIdentityHeader.jsx # Saudação, resumo de cotas/regras e alerta de autorização
        │   ├── MinhaAgendaCard.jsx        # Card de Minha Agenda compacta no topo com contagem e atalho
        │   ├── MinhaAgendaModal.jsx       # Modal de visualização consolidada dos horários e exportação (.ics)
        │   ├── CorretorRegrasBanner.jsx   # Barra discreta com saldo de cotas e regras ativas
        │   ├── CorretorCopyFooter.jsx     # Barra fixa inferior com botão de copiar escala (WhatsApp)
        │   ├── PontoSelectorView.jsx      # Tela de seleção de ponto com contagem de turnos e vagas
        │   ├── PontoTurnosView.jsx        # Tela de turnos do ponto com navegação, cabeçalho e dias
        │   ├── DiaAcordeonItem.jsx        # Item de acordeon de dia com vagas e lista de TurnoCard
        │   ├── TurnoCard.jsx              # Card de turno na visão do corretor (progresso, botões contextuais)
        │   ├── useDiasAcordeon.js         # Hook de controle e persistência de acordeons de dias por tenant
        │   └── escalaTextoHelper.js       # Formatação de texto para WhatsApp e cópia para clipboard
        ├── TurnoCard.jsx        # Re-export para retrocompatibilidade do card de turno do colaborador
        ├── NomeModal.jsx        # Modal orquestrador de identificação do colaborador (modularizado e enxuto)
        ├── nome-modal/          # Submódulos e etapas isoladas do fluxo de identificação do colaborador
        │   ├── IdentificacaoCampos.jsx    # Campos adaptáveis com máscaras e validação inline (WhatsApp/E-mail/Nome)
        │   ├── IdentificacaoFormStep.jsx  # Etapa 1: cabeçalho, alerta de autorização e submissão
        │   └── ConfirmacaoDuplaStep.jsx   # Etapa 2: resumo, alerta de fixação no aparelho e atalho Enter
        ├── IdentificacaoCampos.jsx # Re-export para retrocompatibilidade dos campos de identificação
        ├── ConfirmModal.jsx     # Modal universal assíncrono de confirmação/exclusão (useConfirm)
        ├── AdminLoginModal.jsx  # Modal orquestrador de login do gestor (modularizado e enxuto)
        ├── admin-login/         # Submódulos e formulários isolados do fluxo de autenticação do gestor
        │   ├── AuthFeedback.jsx       # Componente de feedback para erros e alertas
        │   ├── AcessoRestritoView.jsx # Visão de usuário logado sem vínculo à empresa ativa
        │   ├── LoginForm.jsx          # Formulário de login institucional (E-mail/Senha)
        │   ├── CadastroForm.jsx       # Formulário de criação de conta de gestor
        │   └── RecuperarSenhaForm.jsx # Formulário de redefinição de senha
        ├── PortalGestorLogin.jsx# Tela full-page orquestradora modularizada de login dos gestores (app.escalafacil.online)
        ├── portal-gestor/       # Submódulos e formulários isolados do Portal do Gestor
        │   ├── usePortalAuth.js           # Hook com lógica de autenticação, estados e RPCs do portal
        │   ├── PortalHeader.jsx           # Cabeçalho superior com logo, badge e ThemeToggle
        │   ├── PortalCardHeader.jsx       # Cabeçalho interno do card com título e subtítulo contextuais
        │   ├── PortalFeedback.jsx         # Mensagens de alerta de erro e sucesso com animação
        │   ├── PortalLoginForm.jsx        # Formulário de login com e-mail/senha, visibilidade e links
        │   ├── PortalCadastroForm.jsx     # Formulário de criação de conta de gestor
        │   ├── PortalRecuperarSenhaForm.jsx # Formulário para solicitação de redefinição de senha
        │   └── PortalSecurityFooter.jsx   # Rodapé com selo de segurança RBAC e ambiente blindado
        ├── PortalSemEmpresaView.jsx # Tela de aviso amigável quando o gestor logado não tem empresa vinculada
        ├── LinkSeguroManager.jsx# Re-export para retrocompatibilidade do gerenciador de link seguro
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
        │   ├── LayoutPreferencesCard.jsx  # Card para alternar modo de navegação (Abas vs Visão Contínua)
        │   ├── LinkSeguroManager.jsx      # Gerenciador de link seguro anti-espionagem (12 chars) com redefinição
        │   ├── EmpresaNomeCard.jsx        # Card de visualização e atalho para alteração do nome da empresa
        │   ├── EditarNomeEmpresaModal.jsx # Modal para edição do nome oficial da empresa com atualização Realtime
        │   ├── EscalaPrivacidadeCard.jsx  # Card de privacidade da escala pública (Modo Anônimo / Ocultar Nomes)
        │   ├── RegrasEscalaCard.jsx       # Card de configuração de bloqueio de conflito de horários e cotas anti-monopólio
        │   ├── CotaStepperField.jsx       # Controle stepper touch-friendly de cota numérica ou Ilimitado
        │   ├── CotasPontosDropdown.jsx    # Menu suspenso multi-seleção para aplicar cotas a todos os pontos ou pontos específicos
        │   ├── abertura/                  # Submódulos de Abertura Programada com Contagem Regressiva (Fase 16)
        │   │   ├── useAgendamentoAbertura.js # Hook com suporte a escopo Global, Seleção e Individual, com 3-tier fallback
        │   │   ├── AgendamentoAberturaCard.jsx # Card na aba de Configurações com status ao vivo, escopo e destravamento
        │   │   ├── AgendamentoModal.jsx      # Modal com datetime-local touch-friendly, seletor de pontos e atalhos
        │   │   ├── AberturaPontosSelector.jsx # Seletor touch-friendly de escopo de pontos (todos vs selecionados)
        │   │   └── index.js
        │   ├── VocabularioCard.jsx        # Card de atalho para customização de vocabulário e nicho
        │   ├── whatsapp/                  # Submódulos isolados de customização do WhatsApp
        │   │   ├── useWhatsappConfig.js     # Hook de lógica, tags, preview e persistência multi-alvo (pontos e geral)
        │   │   ├── WhatsappConfigCard.jsx   # Card de atalho na aba Configurações com status
        │   │   ├── WhatsappConfigModal.jsx  # Modal de configuração de mensagens de WhatsApp com menu suspenso individual
        │   │   ├── WhatsappEscopoDropdown.jsx # Menu dropdown suspenso com alternador do olho (Eye/EyeOff) para cópia
        │   │   └── WhatsappPreviewBubble.jsx# Simulador visual realista da bolha de mensagem do WhatsApp
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

### 5.6. Vocabulário & Nicho Dinâmico (White-Label) e Página de Vendas (Fase 5)
1. **White-Label de Vocabulário (`VocabularioModal.jsx` e `vocabularioHelper.js`)**:
   - Transforma o SaaS em uma solução multi-setorial (Imobiliárias, Saúde, Eventos/Buffets, Varejo/Trade Marketing, Igrejas/Voluntariado, Arenas/Crossfit, Genérico ou Personalizado).
   - Coluna `termos` JSONB na tabela `empresas`.
   - Adapta dinamicamente títulos, labels, modais, botões de ação e textos gerados para o WhatsApp.
2. **Página de Vendas Oficial (`LandingPage.jsx` em `https://escalafacil.online`)**:
   - Rota raiz `/` exibe a Landing Page de alta conversão.
   - Simulador interativo em tempo real direto na hero section.
   - Abas comparativas de dor vs. solução por nicho.
   - Links transparentes para demonstração ao vivo (`/demo`) e Portal do Gestor (`app.escalafacil.online`).

### 5.7. Escala Demonstrativa 100% Isolada (Rota `/demo` & Sandbox Mock)
1. **Rota Dedicada `/demo`**:
   - Roteamento transparente via `isDemoRoute()` no `tenantHelper.js` e interceptação no `TenantContext.jsx`.
   - Pode ser acessada diretamente pela URL (`escalafacil.online/demo`) ou pelo botão "Ver Demonstração ao Vivo" na Landing Page.
2. **Isolamento Total do Banco de Dados (Zero Supabase Footprint)**:
   - Não consulta a tabela `empresas` nem realiza fallback para empresas reais cadastradas.
   - Estado de pontos, turnos e reservas provido por `demoData.js`, com dados pré-populados de colegas de equipe em diferentes estados de ocupação (livre, parcial e esgotado).
   - O visitante pode clicar em "Garantir Vaga", informar seu nome de teste no `NomeModal`, ver a vaga preenchida com badge "VOCÊ" e cancelá-la com confirmação.
   - Persistência das alterações de teste no `localStorage` (`escala_demo_sandbox_reservas`).
3. **Banner Superior e UI/UX (`DemoBanner.jsx` e `DemoEscalaView.jsx`)**:
   - Banner discreto no topo: *"💡 Modo Demonstração Interativo — Experimente garantir uma vaga como se fosse um colaborador da equipe."*.
   - Botões de alta conversão: *"Voltar para o Site"* (navegação SPA para `/`) e *"Criar Escala da Minha Empresa"* (redireciona para o Portal do Gestor).

### 5.8. Arquitetura Modular do Frontend e Orquestração do App.jsx
1. **Orquestrador Enxuto (`App.jsx`)**:
   - O componente raiz atua estritamente como orquestrador de gateways de acesso, layout e rotas (reduzido de 850 para ~300 linhas).
2. **Hook de Dados e Realtime (`useEscalaData.js`)**:
   - Centraliza consultas de `pontos`, `turnos` e `reservas`, cache silencioso na alternância de empresa, background migration de dias e canais do Supabase Realtime com filtro por `empresa_id`.
3. **Hook de Identidade do Colaborador (`useColaborador.js`)**:
   - Gerencia identidade Zero-Atrito (`device_id` UUID, `localStorage`), ciclo de vida do `NomeModal` e RPCs de reserva e cancelamento.
4. **Subcomponentes Especializados de Layout e Estado**:
   - `AppHeader.jsx`: Topbar com navegação, badges de gestão, tema e logout.
   - `PortalSemEmpresaView.jsx`: Estado para gestor autenticado no portal sem empresa vinculada.
   - `TenantErrorView.jsx`: Tela amigável com retry para falhas de configuração do tenant.

### 5.9. Componentização e Modularidade dos Módulos Centrais (CorretorView, AdminView e AdminLoginModal)
1. **Visão do Corretor / Colaborador (`CorretorView.jsx` & `src/components/corretor/`)**:
   - `CorretorView.jsx` reduzido de 644 para ~150 linhas como orquestrador enxuto.
   - `PontoSelectorView.jsx`: Lista interativa de locais com métricas de vagas e estado vazio.
   - `PontoTurnosView.jsx`: Quadro de horários do ponto com cabeçalho de navegação e botão unificado de expandir/recolher todos os dias.
   - `DiaAcordeonItem.jsx`: Item individual de acordeon por dia com badges de lotação, indicador "Sua vaga" e listagem de `TurnoCard`.
   - `useDiasAcordeon.js`: Hook para controle reativo e persistência no `localStorage` por empresa.
   - `CorretorIdentityHeader.jsx` & `CorretorCopyFooter.jsx`: Cabeçalho de saudação/alerta e rodapé fixo para cópia de escala no WhatsApp.
   - `escalaTextoHelper.js`: Funções puras de formatação de texto e cópia segura para clipboard.
2. **Painel do Administrador (`AdminView.jsx` & `src/components/admin/`)**:
   - Componente orquestrador desacoplado em submódulos: `AdminHeaderBanner`, `AdminTabBar`, `AdminQuickLinkBar`, `AdminStats`, `FormAddTurno`, `TurnosCadastradosList`, `AdminZonaPerigo`, `DuplicarDiaModal`, `IncluirPessoaModal`, `EditarTurnoModal`, `LayoutPreferencesCard`, `VocabularioCard` e `AdminSenhaCard`.
3. **Modal de Autenticação do Gestor (`AdminLoginModal.jsx` & `src/components/admin-login/`)**:
   - Fluxo de login e contingência modularizado em submódulos: `adminAuthHelper`, `AuthFeedback`, `AcessoRestritoView`, `LoginForm`, `CadastroForm`, `RecuperarSenhaForm` e `PinLegadoForm`.

### 5.10. Componentização e Modularidade da Equipe (`EquipeManager.jsx` & `src/components/equipe/`)
1. **Orquestrador Enxuto (`EquipeManager.jsx`)**:
   - Reduzido de 773 para ~140 linhas, operando estritamente como orquestrador visual declarativo.
2. **Hook de Dados e Mutations (`useEquipe.js`)**:
   - Centraliza consultas de `equipe_corretores`, canal Realtime WebSockets com filtro por `empresa_id`, alternância de proteção de acesso (`alternar_protecao_equipe`), cadastro (`adicionar_corretor_equipe`), edição (`editar_corretor_equipe`), ativação (`alternar_status_corretor`), remoção (`remover_corretor_equipe`) e desvinculação de celular (`desvincular_aparelho_corretor`) com diálogos `useConfirm`.
3. **Subcomponentes Especializados de Interface**:
   - `EquipeHeader.jsx`: Cabeçalho unificado com título, badges contextuais, switch toggle acessível e botão de sanfona (expandir/recolher com persistência por tenant).
   - `EquipeStatusBanner.jsx`: Banner informativo contextual (Proteção Ativada vs Desativada) integrado ao vocabulário da empresa.
   - `EquipeList.jsx`: Gerenciamento de busca, loading, empty state e listagem scrollável.
   - `EquipeMembroItem.jsx`: Card de membro com avatar, badges informativas (Inativo, Celular vinculado e E-mail pendente), links para WhatsApp e e-mail corporativo, e botões de ação contextuais.

### 5.11. Modularização da Demo (`useDemoEscala.js`) e Alinhamento de Domínios
1. **Hook de Demonstração Sandbox (`src/hooks/useDemoEscala.js`)**:
   - Encapsula 100% da lógica e estado da escala de demonstração (`/demo`): `deviceId`, `corretorNome`, `corretorWhatsapp`, `corretorEmail`, `reservas` em memória e `localStorage` (`salvarReservasDemo`), concorrência, lotação e modais de identificação/confirmação com toasts contextuais.
   - Reduz `DemoEscalaView.jsx` para um componente puramente declarativo (< 80 linhas).
2. **Alinhamento do Domínio Público/Corretor (`src/components/corretor/TurnoCard.jsx`)**:
   - Migrado para dentro de `corretor/`, consumido diretamente por `DiaAcordeonItem.jsx`.
   - `src/components/TurnoCard.jsx` preservado na raiz como re-export transparente para retrocompatibilidade.
3. **Alinhamento do Domínio Administrativo (`src/components/admin/LinkSeguroManager.jsx`)**:
   - Migrado para dentro de `admin/`, consumido por `AdminTabConfiguracoes.jsx` e exportado no barrel `src/components/admin/index.js`.
   - `src/components/LinkSeguroManager.jsx` preservado na raiz como re-export transparente para retrocompatibilidade.

### 5.12. Resiliência de Sessão JWT e Refresh Automático (`AuthContext.jsx` & `TenantContext.jsx`)
1. **Problema Resolvido**: JWT expirado causava cascata de erros 401 em loop infinito, deslogava gestores indevidamente mostrando "Nenhuma Empresa Vinculada", e bloqueava a área pública dos colaboradores com "Erro de Configuração".
2. **`AuthContext.jsx` — Refresh Silencioso com 3 Camadas de Proteção**:
   - `handleSessionChange` com detecção de `expires_at` expirado: em vez de destruir o `refresh_token` (via `signOut`), chama `supabase.auth.refreshSession()` e aguarda o `onAuthStateChange` com `TOKEN_REFRESHED`.
   - Guard `refreshingRef` contra múltiplas chamadas simultâneas de refresh.
   - `fetchUserData` reformulado para retornar `{ data, jwtExpired }` com *early return* ao primeiro erro PGRST303, evitando 3 requests 401 desnecessárias e tentando refresh + retry se JWT expirou durante o fetch.
   - Helper `isJwtExpiredError()` centralizado para detecção de erros `PGRST303`, `JWT expired` e `401`.
   - Sessão null (refresh falhou): apenas limpa estado React sem re-executar `signOut` (Supabase já limpou).
3. **`TenantContext.jsx` & `supabasePublicHelper.js` — Chamadas Públicas Seguras (`executarPublicoSeguro`)**:
   - Wrapper factory-based reutilizável para RPCs/queries da área pública (visão do colaborador).
   - Se a primeira tentativa retorna `PGRST303`, faz `signOut({ scope: 'local' })` silencioso e reconstrói a chamada do zero — passando com role `anon` sem JWT expirado.

### 5.13. Blindagem de Segurança & Remoção Integral do PIN Legado (Fase 14)
1. **Remoção Completa do PIN Legado**:
   - Autenticação administrativa 100% via Supabase Auth (E-mail e Senha). Removidos todos os formulários, cards e modais de PIN (`PinLegadoForm`, `PortalPinLegadoForm`, `AlterarSenhaModal`, `AdminSenhaCard`, `InputSenhaPin`, `adminAuthHelper`, `isPinAuth`), além da coluna `empresas.admin_pin` e RPCs `verificar_admin_pin`, `alterar_admin_pin` e `vincular_com_pin`.
2. **Fechamento de RLS e Bypass Anônimo**:
   - Todas as RPCs administrativas rejeitam `auth.uid() IS NULL` e validam `has_empresa_role` sem bypass de superadmin.
   - Leitura/escrita direta de `anon` bloqueada nas tabelas `empresas`, `pontos`, `turnos`, `reservas`, `equipe_corretores`, `convites_gestores` e `asaas_webhooks_log`.
   - `provisionar_empresa_asaas` e `atualizar_status_empresa_asaas` restritas exclusivamente a `service_role`.
   - Removido o fallback por nome em `reservar_vaga` quando `exigir_cadastro_previo = true`.
3. **RPCs Públicas Sanitizadas & Realtime sem PII (`escala_sync`)**:
   - Visão pública utiliza `get_empresa_publica`, `get_escala_publica` (com mascaramento server-side para Modo Anônimo e omissão de `device_id`, `corretor_whatsapp` e `corretor_email`) e `verificar_identidade_colaborador` (sem download de listas de equipe ou reservas).
   - Realtime público escuta a tabela não-sensível `escala_sync` (apenas `empresa_id` e `updated_at`), mantida sincronizada por triggers `fn_sync_escala_empresa`.

### 5.14. Regras Inteligentes de Escala: Bloqueio de Conflitos e Cotas Anti-Monopólio (Fase 15)
1. **Bloqueio de Conflito de Horário (Turnos Simultâneos / Sobrepostos)**:
   - Colunas `hora_inicio TIME` e `hora_fim TIME` em `public.turnos`, com função `extrair_horarios_turno(TEXT)`, backfill idempotente de formatos legados e trigger automático `trg_turnos_preencher_horas`.
   - Coluna `bloquear_conflito_horario BOOLEAN` em `public.empresas` exposta em `get_empresa_publica` e `hora_inicio`/`hora_fim` em `get_escala_publica`.
   - Formulários de criação (`FormAddTurno.jsx`), edição (`EditarTurnoModal.jsx`) e duplicação (`DuplicarDiaModal.jsx` e `usePontosManager.js`) operam com seletores **Hora Início** e **Hora Fim** e fallback seguro para bancos pré-migração.
2. **Cotas / Limites Justos por Colaborador ("Anti-Monopólio")**:
   - Colunas opcionais `limite_vagas_semana`, `limite_vagas_dia`, `limite_vagas_ponto` e `cotas_pontos_ids` (`NULL` = todos os pontos, ou UUIDs específicos) em `public.empresas`, configuradas via `RegrasEscalaCard.jsx` (`CotasPontosDropdown.jsx`) e RPC `atualizar_regras_escala`.
   - `reservar_vaga` utiliza `pg_advisory_xact_lock` ordenado por empresa + identificadores do colaborador (`device_id`, WhatsApp e E-mail) antes de `FOR UPDATE OF t`, impedindo sobreposição de horários (inclusive com virada de meia-noite) e burla simultânea de cotas.
   - Visão pública (`CorretorRegrasBanner.jsx`, `TurnoCard.jsx`, `useColaborador.js` e modo `/demo`) exibe saldo de vagas, sinaliza turnos conflitantes/bloqueados preventivamente e apresenta toasts contextuais claros.




