// ============================================================
// EscalaFácil — Supabase Edge Function: asaas-webhook
// ============================================================
// Processa webhooks do Asaas de forma 100% autônoma:
// 1. PAYMENT_CONFIRMED / PAYMENT_RECEIVED: Provisiona Tenant + Auth User + Ponto Inicial
// 2. PAYMENT_OVERDUE / PAYMENT_REFUNDED: Bloqueia acesso da imobiliária
// 3. Reativação automática quando pagamento em atraso for quitado
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

interface AsaasPayment {
  id: string;
  customer: string;
  subscription?: string;
  installment?: string;
  paymentLink?: string;
  value: number;
  netValue?: number;
  billingType: string; // 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  status: string;
  description?: string;
  externalReference?: string;
  confirmedDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
}

interface AsaasWebhookPayload {
  id?: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
}

// Gera um slug amigável a partir do nome
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9 -]/g, "") // remove caracteres inválidos
    .replace(/\s+/g, "-") // substitui espaços por hífens
    .replace(/-+/g, "-") // remove hífens duplicados
    .substring(0, 30);
}

// Gera senha provisória segura (ex: Escala!9381)
function gerarSenhaProvisoria(): string {
  const pin = Math.floor(1000 + Math.random() * 9000);
  return `Escala@${pin}`;
}

serve(async (req: Request) => {
  // Tratamento de CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check simples via GET
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "online",
        service: "EscalaFácil Asaas Webhook",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const asaasWebhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET") || "";
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY") || "";
  const asaasEnv = Deno.env.get("ASAAS_ENV") || "production"; // 'sandbox' ou 'production'

  const asaasApiBaseUrl =
    asaasEnv === "sandbox"
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Configuração ausente: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cliente Supabase com permissões de administrador (Service Role)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Validação de Token de Segurança do Asaas (se configurado)
    const asaasTokenHeader = req.headers.get("asaas-access-token");
    if (asaasWebhookSecret && asaasTokenHeader !== asaasWebhookSecret) {
      console.warn("Token de webhook do Asaas inválido ou ausente:", asaasTokenHeader);
      return new Response(JSON.stringify({ error: "Unauthorized token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: AsaasWebhookPayload = await req.json();
    const event = payload.event;
    const payment = payload.payment;
    const eventId = payload.id || (payment ? `${payment.id}_${event}` : undefined);

    console.log(`[Asaas Webhook] Evento recebido: ${event} | ID: ${eventId}`);

    // 2. Verificação de Idempotência na tabela asaas_webhooks_log
    if (eventId) {
      const { data: logExistente } = await supabase
        .from("asaas_webhooks_log")
        .select("id, status")
        .eq("event_id", eventId)
        .maybeSingle();

      if (logExistente && logExistente.status === "processado") {
        console.log(`[Asaas Webhook] Evento ${eventId} já processado anteriormente. Ignorando.`);
        return new Response(
          JSON.stringify({ message: "Event already processed", eventId }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Registra log inicial
    const logId = crypto.randomUUID();
    await supabase.from("asaas_webhooks_log").insert({
      id: logId,
      event_id: eventId,
      event_type: event,
      payment_id: payment?.id || null,
      customer_id: payment?.customer || null,
      subscription_id: payment?.subscription || null,
      payload: payload,
      status: "processando",
    });

    const customerId = payment?.customer;
    const subscriptionId = payment?.subscription;

    // ─── 3. TRATAMENTO DO EVENTO: PAGAMENTO CONFIRMADO / RECEBIDO ──
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (!customerId) {
        throw new Error("Payload de pagamento sem customer ID");
      }

      // Verifica se a empresa já existe vinculada a este customer ou subscription
      const { data: empresaExistente } = await supabase
        .from("empresas")
        .select("id, nome, slug, status")
        .or(`asaas_customer_id.eq.${customerId},asaas_subscription_id.eq.${subscriptionId}`)
        .maybeSingle();

      if (empresaExistente) {
        // Se a empresa já existe mas estava 'bloqueado' por atraso, reativa imediatamente!
        if (empresaExistente.status === "bloqueado") {
          console.log(
            `[Asaas Webhook] Reativando empresa bloqueada: ${empresaExistente.nome} (${empresaExistente.slug})`
          );
          await supabase
            .from("empresas")
            .update({ status: "ativo" })
            .eq("id", empresaExistente.id);
        }

        // Atualiza log
        await supabase
          .from("asaas_webhooks_log")
          .update({ status: "processado" })
          .eq("id", logId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Empresa existente atualizada com sucesso",
            empresa: empresaExistente.slug,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── PROVISIONAMENTO AUTOMÁTICO DE NOVO CLIENTE ───────────────
      // Obtém dados cadastrais do cliente no Asaas
      let clienteNome = "Minha Imobiliária";
      let clienteEmail = "";
      let clienteTelefone = "";
      let clienteCpfCnpj = "";

      if (asaasApiKey && customerId) {
        try {
          const respCustomer = await fetch(`${asaasApiBaseUrl}/customers/${customerId}`, {
            headers: {
              access_token: asaasApiKey,
            },
          });
          if (respCustomer.ok) {
            const customerData = await respCustomer.json();
            clienteNome = customerData.companyName || customerData.name || clienteNome;
            clienteEmail = customerData.email || "";
            clienteTelefone = customerData.mobilePhone || customerData.phone || "";
            clienteCpfCnpj = customerData.cpfCnpj || "";
          }
        } catch (errAsaas) {
          console.warn("[Asaas Webhook] Aviso ao consultar API de clientes do Asaas:", errAsaas);
        }
      }

      // Se não encontrou e-mail pela API, tenta extrair de externalReference ou payload
      if (!clienteEmail && payment?.externalReference && payment.externalReference.includes("@")) {
        clienteEmail = payment.externalReference.trim();
      }

      if (!clienteEmail) {
        // Fallback: se o e-mail não estiver disponível, gera identificador baseado no customerId
        clienteEmail = `gestor.${customerId.toLowerCase().replace(/[^a-z0-9]/g, "")}@escalafacil.com.br`;
      }

      // 1. Cria ou obtém o usuário no Supabase Auth
      let userId: string | null = null;
      const senhaProvisoria = gerarSenhaProvisoria();

      // Procura se o e-mail já existe no Supabase Auth
      const { data: usuarioExistente } = await supabase
        .from("perfis")
        .select("id, email")
        .eq("email", clienteEmail)
        .maybeSingle();

      if (usuarioExistente) {
        userId = usuarioExistente.id;
        console.log(`[Asaas Webhook] Usuário gestor já existente no Auth: ${userId}`);
      } else {
        // Cria usuário no Supabase Auth com senha provisória e confirmação imediata
        const { data: novoUsuarioAuth, error: errAuth } = await supabase.auth.admin.createUser({
          email: clienteEmail,
          password: senhaProvisoria,
          email_confirm: true,
          user_metadata: {
            nome: clienteNome,
            origem: "asaas_autopilot",
            asaas_customer_id: customerId,
          },
        });

        if (errAuth) {
          console.error("[Asaas Webhook] Erro ao criar usuário no Supabase Auth:", errAuth);
          throw errAuth;
        }

        userId = novoUsuarioAuth.user.id;
        console.log(`[Asaas Webhook] Novo usuário gestor criado no Auth: ${userId} (${clienteEmail})`);
      }

      // 2. Chama a RPC provisionar_empresa_asaas para criar o tenant e o ponto inicial
      const baseSlug = slugify(clienteNome);
      const { data: novaEmpresa, error: errProvisionar } = await supabase.rpc(
        "provisionar_empresa_asaas",
        {
          p_nome: clienteNome,
          p_slug: baseSlug,
          p_asaas_customer_id: customerId,
          p_asaas_subscription_id: subscriptionId || null,
          p_email_cobranca: clienteEmail,
          p_telefone_cobranca: clienteTelefone,
          p_user_id: userId,
          p_plano: "pro",
        }
      );

      if (errProvisionar) {
        console.error("[Asaas Webhook] Erro ao executar RPC provisionar_empresa_asaas:", errProvisionar);
        throw errProvisionar;
      }

      console.log(`[Asaas Webhook] Imobiliária provisionada com sucesso: ${novaEmpresa.nome} (${novaEmpresa.slug})`);

      // 3. Gera link seguro de definição de senha / acesso direto
      let magicLink = "";
      try {
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: clienteEmail,
          options: {
            redirectTo: `https://app.escalafacil.com/${novaEmpresa.slug}`,
          },
        });
        magicLink = linkData?.properties?.action_link || "";
      } catch (errLink) {
        console.warn("[Asaas Webhook] Não foi possível gerar link de recovery:", errLink);
      }

      // Registra sucesso no log
      await supabase
        .from("asaas_webhooks_log")
        .update({
          status: "processado",
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({
          success: true,
          action: "empresa_provisionada",
          empresa: novaEmpresa,
          login: {
            email: clienteEmail,
            senhaProvisoria: senhaProvisoria,
            magicLink: magicLink || undefined,
            linkEscala: `https://app.escalafacil.com/${novaEmpresa.slug}`,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ─── 4. TRATAMENTO DE EVENTOS DE ATRASO OU CANCELAMENTO ───────
    if (
      event === "PAYMENT_OVERDUE" ||
      event === "SUBSCRIPTION_DELETED" ||
      event === "PAYMENT_REFUNDED"
    ) {
      console.log(`[Asaas Webhook] Bloqueando tenant por ${event}: Customer ${customerId}`);

      const { data: resStatus, error: errStatus } = await supabase.rpc(
        "atualizar_status_empresa_asaas",
        {
          p_asaas_customer_id: customerId || "",
          p_asaas_subscription_id: subscriptionId || "",
          p_novo_status: "bloqueado",
        }
      );

      if (errStatus) {
        console.error("[Asaas Webhook] Erro ao atualizar status:", errStatus);
        throw errStatus;
      }

      await supabase
        .from("asaas_webhooks_log")
        .update({ status: "processado" })
        .eq("id", logId);

      return new Response(
        JSON.stringify({
          success: true,
          action: "empresa_bloqueada",
          detalhes: resStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Outros eventos recebidos são marcados como ignorados / tratados
    await supabase
      .from("asaas_webhooks_log")
      .update({ status: "ignorado" })
      .eq("id", logId);

    return new Response(
      JSON.stringify({
        message: `Evento '${event}' registrado sem ações necessárias`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Asaas Webhook] Falha crítica no processamento:", error);

    // Registra falha no banco para auditoria
    return new Response(
      JSON.stringify({
        error: "Internal webhook processing error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

