# PROJECT_MEMORY.md — Escala CRM (Controle de Captação)

> **Instrução para a IA**: Este documento serve como **memória persistente** e **contexto de arquitetura** do projeto. Leia este arquivo integralmente no início de cada novo chat para entender os objetivos, estrutura de dados, fluxos de UI/UX e regras de negócio antes de propor alterações.

---

## 1. Visão Geral e Objetivo
O **Escala CRM - Controle de Captação** é uma Single Page Application (SPA) mobile-first voltada para imobiliárias e corretores de imóveis.  
**Objetivo principal**: Substituir listas informais e manuais do WhatsApp por uma plataforma web moderna, rápida e em tempo real, onde corretores garantem e cancelam vagas em pontos de captação física sem sobreposição ou conflitos (*race conditions*).

---

## 2. Stack Tecnológica
- **Frontend**: React 18 (SPA) com Vite 5
- **Estilização**: Tailwind CSS com tema Dark Mode por padrão (paleta dark/surface, detalhes neon/brand)
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
   - `dia` (text: 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO')
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
├── PROJECT_MEMORY.md            # Este arquivo de contexto/memória da IA
└── src/
    ├── main.jsx                 # Ponto de entrada do React
    ├── index.css                # Tailwind + classes utilitárias (.card, .btn-*, scrollbar dark)
    ├── App.jsx                  # Estado raiz, roteamento por view, canal Realtime, autenticação de PIN
    ├── lib/
    │   └── supabaseClient.js    # Instância do createClient configurada
    └── components/
        ├── CorretorView.jsx     # Tela pública do corretor (seleção de ponto, turnos e copiar WhatsApp)
        ├── TurnoCard.jsx        # Card de turno na visão do corretor (progresso, botões contextuais)
        ├── NomeModal.jsx        # Modal bottom-sheet para solicitar nome do corretor no 1º uso
        ├── ConfirmModal.jsx     # Modal universal assíncrono de confirmação/exclusão (useConfirm)
        ├── AdminView.jsx        # Painel do Administrador (turnos e acordeon)
        ├── PontosManager.jsx    # Gestão de pontos (criação limpa, drag-and-drop de reordenação, duplicar e renomear)
        ├── TurnosDiaList.jsx    # Lista de turnos por dia com drag-and-drop animado (SortableJS) e gestão de corretores
        └── Toast.jsx            # Notificações visuais animadas
```

---

## 5. Fluxos e Funcionalidades Detalhadas

### 5.1. Fluxo do Corretor (Visão Pública)
1. **Identificação transparente**: Ao carregar, o sistema obtém ou gera um `device_id` no `localStorage`.
2. **Seleção de Ponto de Captação**:
   - Exibe os pontos cadastrados (ex: Mercado Roldão, Mercado Extra, Padaria Di Cunto) com status de vagas disponíveis em tempo real.
3. **Quadro de Horários**:
   - Agrupado pelos dias da semana na ordem cronológica natural (Segunda a Domingo).
   - Mostra horário, contagem de vagas (ex: `1/3`), barra de progresso e nomes de quem já reservou.
   - Se houver vaga: Botão verde **"Garantir Vaga"** (se o nome não estiver salvo, abre o modal para digitação rápida e salva no `localStorage`).
   - Se o usuário já tiver vaga: Botão vermelho **"Cancelar Minha Vaga"**.
   - Se lotado: Botão desabilitado **"Esgotado"**.
4. **Copiar Escala (WhatsApp)**:
   - Sticky footer com botão de copiar escala em texto estruturado e formatado com emojis (ótimo para colar em grupos de WhatsApp).

### 5.2. Fluxo do Admin (Protegido por PIN)
1. **Acesso**: Ícone de escudo discreto no header com PIN verificado no Supabase (`1234`).
2. **Gestão de Pontos de Captação ([PontosManager.jsx](file:///e:/Escala/src/components/PontosManager.jsx))**:
   - Criar novos pontos com ordem calculada automaticamente (sem campo de número manual).
   - **Arrastar e Soltar (SortableJS)**: Reordenar pontos via pegador `⠿` (`GripVertical`) com animação fluida e salvamento em tempo real no Supabase.
   - Renomear inline com o botão de lápis.
   - **Duplicar Ponto Inteiro**: Ícone de cópia 📋 que clona todos os turnos de um ponto existente para o novo ponto, iniciando as reservas zeradas.
   - Limpar reservas de um ponto específico (ícone de alerta ⚠️).
   - Excluir ponto (com cascade nos turnos e reservas).
3. **Criação e Gestão de Turnos ([TurnosDiaList.jsx](file:///e:/Escala/src/components/TurnosDiaList.jsx))**:
   - Criar turnos por ponto, dia, horário e capacidade (ordem calculada automaticamente ao fim do dia).
   - **Arrastar e Soltar nos Turnos**: Reordenar horários dentro de cada dia arrastando pelo pegador `⠿`, com animação física e persistência imediata no Supabase.
   - **Duplicar Horários de um Dia**: Botão `Duplicar horários` ao lado de cada dia para replicar a grade (ex: Segunda) para outros dias selecionados ou atalhos ("Seg a Sex", "Fim de Semana", "Marcar Todos"), preservando a ordem personalizada.
4. **Gestão de Pessoas por Turno (Excluir e Incluir)**:
   - Exibe lista de corretores escalados com chips visuais individuais.
   - **Excluir corretor**: Botão `✖` em cada corretor para cancelar apenas a reserva dele sem apagar o turno.
   - **Incluir corretor manual**: Botão `+ Incluir` para adicionar um corretor diretamente pelo Admin (via modal com validação). Atualiza silenciosamente sem resetar o scroll da página.
   - **Excluir turno**: Botão de lixeira 🗑️ para deletar o horário por completo.
5. **Accordion / Sanfona de Pontos**:
   - Setinha 🔽 retrátil em cada ponto cadastrado para recolher/expandir dias e horários, permitindo navegar entre múltiplos pontos rapidamente. Inicia recolhido por padrão e salva a preferência do usuário no `localStorage` (`escala_admin_pontos_expandidos`).
   - Atalhos de "Recolher todos" e "Expandir todos".
6. **Zona de Perigo**:
   - Botão para limpar a escala inteira da semana (reseta todas as reservas de todos os pontos).

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
- **Dark Mode**: Manter a consistência das classes `surface-900`, `surface-800`, `surface-700`, `brand-500` e estados de hover/active.
- **Realtime**: Qualquer alteração em `reservas`, `turnos` ou `pontos` deve ser sincronizada via Supabase Channel para evitar divergência de telas entre corretores simultâneos.
- **Race Condition**: Toda lógica de reserva de novas vagas deve passar pela RPC `reservar_vaga` com row-level lock.

