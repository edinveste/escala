# EscalaFácil — Edge Function `asaas-webhook`

Esta Supabase Edge Function processa as notificações de pagamento e assinaturas enviadas pelo gateway **Asaas** de forma 100% autônoma.

---

## 1. Variáveis de Ambiente no Supabase

No painel do Supabase (`Settings` > `Edge Functions` ou via CLI `supabase secrets set`), configure:

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `ASAAS_WEBHOOK_SECRET` | Token de autenticação configurado na fila de webhooks do Asaas | `escala_secret_token_123` |
| `ASAAS_API_KEY` | Chave de API gerada no Asaas para consultar dados do cliente | `$aact_YTU5YTE0M2M6...` |
| `ASAAS_ENV` | Ambiente do Asaas (`production` ou `sandbox`) | `production` |

> As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetadas nativamente pelo Supabase Edge Runtime.

---

## 2. Como Fazer o Deploy

Com a [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
# Login no Supabase (se ainda não estiver conectado)
supabase login

# Vincular ao seu projeto Supabase
supabase link --project-ref SEU_PROJECT_REF

# Fazer o deploy da função (sem exigir JWT de usuário, pois é chamada pelo Asaas)
supabase functions deploy asaas-webhook --no-verify-jwt
```

---

## 3. Configuração no Painel do Asaas

1. Acesse o **Painel do Asaas** > **Minha Conta** > **Integração** > **Webhooks**.
2. Clique em **Novo Webhook** ou configure a **Fila de Cobranças**:
   - **URL do Webhook**: `https://<SEU_PROJECT_REF>.supabase.co/functions/v1/asaas-webhook`
   - **Email de Notificação**: seu e-mail de suporte técnico.
   - **Token de Autenticação**: insira o mesmo valor definido em `ASAAS_WEBHOOK_SECRET`.
   - **Versão da API**: v3
   - **Eventos Selecionados**:
     - `PAYMENT_CONFIRMED` (Pagamento confirmado via Pix, Boleto ou Cartão)
     - `PAYMENT_RECEIVED` (Pagamento recebido na conta)
     - `PAYMENT_OVERDUE` (Boleto/fatura vencida sem pagamento)
     - `PAYMENT_REFUNDED` (Pagamento estornado)
     - `SUBSCRIPTION_DELETED` (Assinatura cancelada)
3. Salve as configurações.

---

## 4. O que a Função Faz Automaticamente

1. **Quando o cliente paga (`PAYMENT_CONFIRMED`)**:
   - Cria o tenant na tabela `empresas` com plano `pro` e status `ativo`.
   - Cria o usuário gestor no Supabase Auth com senha provisória e confirmação imediata.
   - Vincula o gestor como `admin` na tabela `usuarios_empresas`.
   - Cria o ponto de captação inicial `"Plantão Principal"` com turnos diários já configurados.
   - Gera o link da escala (`app.escalafacil.com/slug`) e link de primeiro acesso.
2. **Se o cliente atrasar a fatura (`PAYMENT_OVERDUE`) ou cancelar (`SUBSCRIPTION_DELETED`)**:
   - Atualiza o status da empresa para `bloqueado` instantaneamente.
3. **Se o cliente regularizar a fatura atrasada**:
   - Reativa a empresa para `ativo` automaticamente.

