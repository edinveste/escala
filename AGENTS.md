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
O **Escala CRM - Controle de Captação** é uma Single Page Application (SPA) mobile-first voltada para imobiliárias e corretores de imóveis.  
**Objetivo principal**: Substituir listas informais e manuais do WhatsApp por uma plataforma web moderna, rápida e em tempo real, onde corretores garantem e cancelam vagas em pontos de captação física sem sobreposição ou conflitos (*race conditions*).

---

## 2. Stack Tecnológica
- **Frontend**: React 18 (SPA) com Vite 5
- **Estilização**: Tailwind CSS com suporte completo a Modo Escuro (padrão) e Modo Claro, alternável via CSS variables dinâmicas e tokens semânticos
- **Ícones**: `lucide-react`
- **Backend / BaaS**: Supabase
  - PostgreSQL 15+ com Row Level Security (RLS)
  - Supabase Realtime via WebSockets (escutando `INSERT`, `UPDATE`, `DELETE`)
  - Postgres Functions / RPCs com transações e row-level locking (`FOR UPDATE`)
- **Autenticação de Usuários**: Sem login tradicional para corretores. Identidade mantida via `localStorage` com `device_id` (UUID) e `corretor_nome`.
- **Acesso Gerencial**: Protegido por PIN simples na tabela `config` (padrão: `1234`).

---

## 3. Modelo de Dados e Banco (Supabase)

### Tabelas Principais:
1. **`config`**:
   - `id` (int, PK default 1)
   - `admin_pin` (text, padrão `'1234'`)
2. **`pontos`** (Pontos de Captação, ex: Mercado Extra, Mercado Roldão, Padaria Di Cunto):
   - `id` (uuid, PK)
   - `nome` (text)
   - `ordem` (int)
   - `ativo` (boolean)
   - `created_at` (timestamptz)
3. **`turnos`** (Horários vinculados a um ponto e dia):
   - `id` (uuid, PK)
   - `ponto_id` (uuid, FK `pontos.id` ON DELETE CASCADE)
   - `dia` (text: 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO')
   - `horario` (text, ex: '8 as 10 hs', '11:30 às 14hrs')
   - `capacidade` (int)
   - `ordem` (int)
   - `created_at` (timestamptz)
4. **`reservas`** (Vagas preenchidas por corretores):
   - `id` (uuid, PK)
   - `turno_id` (uuid, FK `turnos.id` ON DELETE CASCADE)
   - `corretor_nome` (text)
   - `device_id` (text)
   - `created_at` (timestamptz)

### RPCs Críticas (PostgreSQL):
- **`reservar_vaga(p_turno_id, p_corretor_nome, p_device_id)`**:
  - Utiliza `SELECT ... FROM turnos FOR UPDATE` para travar o turno contra concorrência simultânea (*race conditions*).
  - Impede reserva duplicada do mesmo `device_id` no mesmo turno.
  - Verifica capacidade antes de inserir. Retorna `TRUE` se reservado, `FALSE` se lotado.
- **`cancelar_vaga(p_reserva_id, p_device_id)`**:
  - Permite que o corretor delete apenas sua própria vaga comparando `device_id`.
- **`limpar_escala(p_ponto_id UUID DEFAULT NULL)`**:
  - Se `p_ponto_id` for informado, deleta apenas as reservas dos turnos daquele ponto. Se for `NULL`, limpa todas as reservas do sistema.
- **`verificar_admin_pin(p_pin)`**:
  - Valida o PIN informado sem expor a senha no tráfego de rede HTTP.
- **`alterar_admin_pin(p_pin_atual, p_novo_pin)`**:
  - Valida o PIN atual e define uma nova senha (mínimo de 4 dígitos, recomendado 8).

### Políticas de RLS (Row Level Security):
- `config`, `pontos`, `turnos`: Leitura pública (`SELECT` liberado para `anon`). Modificação permitida para MVP/Admin.
- `reservas`: Leitura pública, `INSERT` público (via RPC ou admin manual), `DELETE` permitido para o próprio device ou operações administrativas.
- Realtime ativado para as tabelas: `pontos`, `turnos`, `reservas`.

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
├── supabase_schema.sql          # Schema SQL completo e atualizado
├── supabase_migration_pontos.sql# Migração para introdução de múltiplos pontos
├── supabase_migration_pin.sql   # Migração para alteração e segurança de senha/PIN
├── supabase_migration_dias_semana.sql # Migração para nomes completos dos dias
├── AGENTS.md                    # Diretrizes e memória para Agentes de IA (este arquivo)
├── PROJECT_MEMORY.md            # Memória técnica persistente
└── src/
    ├── main.jsx                 # Ponto de entrada do React
    ├── index.css                # Tailwind + classes utilitárias (.card, .btn-*, scrollbar dark)
    ├── App.jsx                  # Estado raiz, roteamento por view, canal Realtime, autenticação de PIN
    ├── lib/
    │   ├── supabaseClient.js    # Instância do createClient configurada
    │   └── diasSemana.js        # Utilitários, ordenação e normalização de dias da semana
    └── components/
        ├── CorretorView.jsx     # Tela pública do corretor (seleção de ponto, turnos e copiar WhatsApp)
        ├── TurnoCard.jsx        # Card de turno na visão do corretor (progresso, botões contextuais)
        ├── NomeModal.jsx        # Modal bottom-sheet para solicitar nome do corretor no 1º uso
        ├── ConfirmModal.jsx     # Modal universal assíncrono de confirmação/exclusão (useConfirm)
        ├── AdminLoginModal.jsx  # Modal estilizado para login do administrador com visibilidade de PIN
        ├── AlterarSenhaModal.jsx# Modal para alteração segura de PIN pelo próprio administrador
        ├── AdminView.jsx        # Painel do Administrador (gestão de senha, turnos e acordeon)
        ├── PontosManager.jsx    # Gestão de pontos (criação limpa, drag-and-drop de reordenação, duplicar e renomear)
        ├── TurnosDiaList.jsx    # Lista de turnos por dia com drag-and-drop animado (SortableJS) e gestão de corretores
        ├── ThemeToggle.jsx      # Botão animado de alternância Modo Claro / Escuro (Sun/Moon com persistência)
        └── Toast.jsx            # Notificações visuais animadas
```

---

## 5. Fluxos e Funcionalidades Detalhadas

### 5.1. Fluxo do Corretor (Visão Pública)
1. **Identificação transparente**: Ao carregar, o sistema obtém ou gera um `device_id` no `localStorage`.
2. **Seleção de Ponto de Captação**:
   - Exibe os pontos cadastrados (ex: Mercado Roldão, Mercado Extra, Padaria Di Cunto) com status de vagas disponíveis em tempo real.
3. **Quadro de Horários e Acordeon por Dia da Semana**:
   - Agrupado pelos dias da semana na ordem cronológica natural (Segunda a Domingo).
   - **Acordeon expansivo com memória**: Cada dia possui um cabeçalho clicável com seta animada (`ChevronDown`), indicador de total de turnos, status de vagas do dia e badge discreto de identificação caso o corretor já tenha vaga garantida no dia.
   - **Padrão fechado e persistência**: Inicia por padrão 100% recolhido na primeira abertura e memoriza a preferência de cada dia no `localStorage` (`escala_corretor_dias_expandidos`).
   - **Atalhos rápidos**: Botões de "Recolher todos" e "Expandir todos" no topo da listagem para navegação ágil.
   - Agrupado pelos dias da semana na ordem cronológica natural (Segunda a Domingo).
   - Mostra horário, contagem de vagas (ex: `1/3`), barra de progresso e nomes de quem já reservou.
   - Se houver vaga: Botão verde **"Garantir Vaga"** (se o nome não estiver salvo, abre o modal para digitação rápida e salva no `localStorage`).
   - Se o usuário já tiver vaga: Botão vermelho **"Cancelar Minha Vaga"**.
   - Se lotado: Botão desabilitado **"Esgotado"**.
4. **Copiar Escala (WhatsApp)**:
   - Sticky footer com botão de copiar escala em texto estruturado e formatado com emojis (ótimo para colar em grupos de WhatsApp).

### 5.2. Fluxo do Admin (Protegido por PIN)
1. **Acesso e Sessão**: Ícone de escudo discreto no header abrindo modal moderno de PIN com revelação de senha (`AdminLoginModal.jsx`) validado no Supabase. A seta de voltar (←) apenas alterna para a visualização pública mantendo a sessão ativa para navegação rápida. O botão explícito de **"Sair"** encerra a sessão (`isAdminAuth = false`), exigindo o PIN a cada novo acesso.
2. **Alteração de Senha ([AlterarSenhaModal.jsx](file:///e:/Escala/src/components/AlterarSenhaModal.jsx))**:
   - Card dedicado no topo do Painel com botão "Alterar Senha".
   - Permite que o comprador altere o PIN sozinho, validando a senha atual, exigindo no mínimo 4 dígitos (com recomendação de 8 dígitos) e confirmação.
3. **Gestão de Pontos de Captação ([PontosManager.jsx](file:///e:/Escala/src/components/PontosManager.jsx))**:
   - Criar novos pontos com ordem calculada automaticamente (iniciam como rascunho `ativo: false`, ocultos para os corretores enquanto o gestor monta a grade).
   - **Controle de Visibilidade (Ícone de Olho 👁️ / 👁️‍🗨️)**: Permite ao gestor alternar entre Visível (`ativo: true`) e Oculto (`ativo: false`) com o ícone no mesmo padrão cinza discreto dos demais botões, sem poluição visual ou tags extras. Pontos ocultos não aparecem para corretores nem na exportação do WhatsApp.
   - **Arrastar e Soltar (SortableJS)**: Reordenar pontos via pegador `⠿` (`GripVertical`) com animação fluida e salvamento em tempo real no Supabase.
   - **Responsividade e Limpeza Visual**: Sem ícones desnecessários ao lado do nome; no mobile as ações ficam centralizadas exclusivamente no botão de 3 pontinhos (`⋮` `MoreVertical`) com menu dropdown (incluindo publicação/visibilidade, renomear, duplicar, limpar e excluir), e no desktop todos os botões ficam inline.
   - Renomear inline com validação e atalhos Enter/Esc.
   - **Duplicar Ponto Inteiro**: Clona todos os turnos de um ponto existente para o novo ponto, iniciando as reservas zeradas e status oculto para revisão prévia.
   - Limpar reservas de um ponto específico (ícone de alerta ⚠️).
   - Excluir ponto (com cascade nos turnos e reservas).
4. **Criação e Gestão de Turnos ([TurnosDiaList.jsx](file:///e:/Escala/src/components/TurnosDiaList.jsx))**:
   - Criar turnos por ponto, dia, horário e capacidade (ordem calculada automaticamente ao fim do dia). O campo Dia inicia por padrão em "SEGUNDA" na primeira utilização e memoriza a última escolha no `localStorage` (`escala_admin_ultimo_dia`).
   - **Arrastar e Soltar nos Turnos**: Reordenar horários dentro de cada dia arrastando pelo pegador `⠿`, com animação física e persistência imediata no Supabase.
   - **Duplicar Horários de um Dia**: Botão `Duplicar horários` ao lado de cada dia para replicar a grade (ex: Segunda) para outros dias selecionados ou atalhos ("Seg a Sex", "Fim de Semana", "Marcar Todos"), preservando a ordem personalizada.
5. **Gestão de Pessoas por Turno (Excluir e Incluir)**:
   - Exibe os corretores escalados diretamente com chips visuais individuais (sem rótulo redundante de "Corretores escalados" para economizar altura), ou *"Nenhum corretor escalado neste horário"* quando vazio.
   - **Layout Vertical Otimizado**: O badge `0/2 vagas` fica no canto superior direito, com os botões de ação empilhados na vertical abaixo dele (ícone `+👤` para incluir e `🗑️` para excluir turno), liberando largura horizontal máxima para o horário não sofrer truncamento.
   - **Excluir corretor**: Botão `✖` em cada corretor para cancelar apenas a reserva dele sem apagar o turno.
   - **Incluir corretor manual**: Botão de ícone `+👤` para adicionar um corretor diretamente pelo Admin (via modal com validação). Atualiza silenciosamente sem resetar o scroll da página.
   - **Excluir turno**: Botão de lixeira 🗑️ para deletar o horário por completo.
6. **Accordion / Sanfona de Pontos**:
   - Setinha 🔽 retrátil em cada ponto cadastrado para recolher/expandir dias e horários, permitindo navegar entre múltiplos pontos rapidamente. Inicia recolhido por padrão e salva a preferência do usuário no `localStorage` (`escala_admin_pontos_expandidos`).
   - Atalhos de "Recolher todos" e "Expandir todos".
7. **Zona de Perigo**:
   - Botão para limpar a escala inteira da semana (reseta todas as reservas de todos os pontos).

---

### 5.3. Sistema de Temas (Modo Claro & Modo Escuro)
- **Alternador Rápido no Header ([ThemeToggle.jsx](file:///e:/Escala/src/components/ThemeToggle.jsx))**:
  - Disponível no cabeçalho tanto na visão do corretor quanto na visão do administrador.
  - Exibe Sol ☀️ em tom âmbar no Modo Escuro (convite ao Modo Claro) e Lua 🌙 em azul no Modo Claro (convite ao Modo Escuro).
  - Microinterações animadas ao passar o mouse ou tocar, com área de clique mínima de 44px (touch-friendly).
  - Persistência da preferência no `localStorage` (`escala_theme`), mantendo o Modo Escuro como padrão inicial caso o usuário nunca tenha escolhido.
- **Anti-FOUC (Prevenção de Flash)**:
  - Script nativo no `<head>` do `index.html` que lê o `localStorage` e injeta a classe `dark` e a meta `theme-color` antes do primeiro paint, evitando qualquer piscar indesejado.
- **Arquitetura de Tokens e CSS Variables**:
  - Tokens dinâmicos no `tailwind.config.js` mapeados para variáveis CSS em `:root` e `.dark` no `index.css`:
    - `surface-900` a `500`: adaptam automaticamente fundo, cards, chips e divisores.
    - `gray-50` a `950`: textos e ícones ajustados para alto contraste imediato.
- **Calibração de Contraste e Estados de Hover**:
  - **Botão "Duplicar horários"**: no Modo Claro utiliza `bg-brand-50`, `text-brand-700` e `border-brand-200`, transitando no hover para `hover:bg-brand-100` e `hover:text-brand-900` (nunca desbota nem some); no Modo Escuro preserva `dark:text-brand-300` e `dark:hover:text-brand-200`.
  - **Botão "Alterar Senha"**: no Modo Claro hover utiliza `hover:bg-amber-50`, `hover:border-amber-500/50` e `hover:text-amber-800` (evitando texto amarelo claro invisível no fundo branco); no Modo Escuro preserva `dark:hover:text-amber-300`.
  - **Badges de Vagas e Toasts**: configurados com cores de alto contraste e legibilidade perfeita em qualquer superfície.

---

## 6. Comandos e Execução
```bash
# Instalação de dependências
npm install

# Execução em ambiente de desenvolvimento (porta 5173 / host exposto para mobile)
npm run dev

# Build de produção
npm run build
```

---

## 7. Diretrizes para Manutenção e Futuras Extensões
- **Mobile First**: Sempre manter botões com área de toque mínima de `48px` (`min-h-[48px]`), fontes legíveis e espaçamentos adequados para smartphones.
- **Dark Mode & Light Mode**: Manter a consistência das classes `surface-900` a `500` e `text-gray-*`. Jamais utilizar cores claras (como `text-amber-300`, `text-brand-200`, `hover:text-white`) em botões ou textos sem o prefixo `dark:`, garantindo que no Modo Claro sempre haja alto contraste e legibilidade imediata (WCAG AA).
- **Realtime**: Qualquer alteração em `reservas`, `turnos` ou `pontos` deve ser sincronizada via Supabase Channel para evitar divergência de telas entre corretores simultâneos.
- **Race Condition**: Toda lógica de reserva de novas vagas deve passar pela RPC `reservar_vaga` com row-level lock.
- **Mobile Touch e Drag-and-Drop**: O arrasto com SortableJS em telas touch deve sempre usar `delay: 150`, `delayOnTouchOnly: true` e `touchStartThreshold: 5`, restringindo a classe de handle (`.drag-handle`) exclusivamente ao ícone pegador (`⠿`). Evitar `forceFallback: true`, `touch-none` em cartões inteiros e `backdrop-blur` em headers fixos/pegajosos para prevenir desync do compositor do Chrome e artefatos visuais (smear/clones).
- **Modais e Portals (React Portals)**: Todos os modais devem utilizar `createPortal(..., document.body)` e posicionamento centralizado com `fixed inset-0 z-50 flex items-center justify-center p-4` (com `max-h-[90vh] overflow-y-auto` e bloqueio de rolagem do body `overflow: hidden`). Jamais aplicar propriedades `transform` ou `filter` no elemento `<main>` ou containers pais, pois criam um novo *containing block* que desalinha elementos `fixed` da viewport.

