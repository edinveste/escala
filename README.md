# Escala CRM - Controle de Captação

Sistema web mobile-first de reservas em tempo real para pontos de captação imobiliária, substituindo listas manuais do WhatsApp e prevenindo sobreposições (*race conditions*).

---

## 🧠 Memória do Projeto & Arquitetura
Consulte o arquivo [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) para a documentação técnica completa, regras de negócio, schema do banco de dados, fluxos de Admin e Corretor e convenções de código.

---

## 🚀 Como Rodar o Projeto

### 1. Pré-requisitos
- Node.js 18+ instalado
- Projeto no [Supabase](https://supabase.com) configurado com o script `supabase_schema.sql`

### 2. Configurar Variáveis de Ambiente
Crie o arquivo `.env` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

### 3. Instalar e Executar
```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento
npm run dev

# Gerar build de produção
npm run build
```

---

## 📱 Principais Funcionalidades

- **Visão Corretor (Pública)**:
  - Seleção do Ponto de Captação (ex: Mercado Roldão, Mercado Extra, Padaria Di Cunto).
  - Listagem dos horários agrupados por dia da semana (Segunda a Domingo).
  - Reserva com garantia anti-race condition via Postgres RPC (`FOR UPDATE`).
  - Cancelamento da própria vaga pelo corretor.
  - Botão de rodapé para copiar a escala pronta para colar no WhatsApp.

- **Visão Admin (PIN: `1234`)**:
  - Cadastro, renomeação e exclusão de pontos de captação.
  - **Duplicação de Ponto Completo**: clona todos os turnos de um ponto para outro ponto novo.
  - **Duplicação de Horários de um Dia**: clona a grade de horários de um dia (ex: Segunda) para o resto da semana.
  - **Gestão de Pessoas por Turno**: visualização dos corretores escalados, botão para remover uma pessoa específica e botão `+ Incluir` para adicionar um corretor manualmente.
  - **Accordion / Sanfona**: botões de recolher e expandir pontos para facilitar navegação em telas pequenas.
  - Limpeza de escala semanal (por ponto ou geral).

