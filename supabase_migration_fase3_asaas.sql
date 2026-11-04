-- ============================================================
-- EscalaFácil — Migração Fase 3: Piloto Automático de Vendas com Asaas
-- ============================================================
-- Este script adiciona as colunas de integração com o gateway Asaas,
-- tabela de auditoria e idempotência de webhooks, RPCs de provisionamento
-- automático e bloqueio por inadimplência.
-- ============================================================

-- 1. Novos campos na tabela 'empresas' para vincular com o Asaas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS asaas_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id      TEXT,
  ADD COLUMN IF NOT EXISTS email_cobranca        TEXT,
  ADD COLUMN IF NOT EXISTS telefone_cobranca     TEXT;

-- Índices para buscas ultrarrápidas pelo webhook
CREATE INDEX IF NOT EXISTS idx_empresas_asaas_customer ON public.empresas(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_empresas_asaas_subscription ON public.empresas(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_empresas_status ON public.empresas(status);

-- 2. Tabela de logs de webhooks para auditoria e idempotência
CREATE TABLE IF NOT EXISTS public.asaas_webhooks_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT UNIQUE,
  event_type      TEXT NOT NULL,
  payment_id      TEXT,
  customer_id     TEXT,
  subscription_id TEXT,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'processado', -- 'processado', 'ignorado', 'erro'
  mensagem_erro   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhooks_log_event ON public.asaas_webhooks_log(event_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhooks_log_customer ON public.asaas_webhooks_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhooks_log_payment ON public.asaas_webhooks_log(payment_id);

-- RLS na tabela de logs de webhooks
ALTER TABLE public.asaas_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asaas_webhooks_log_select_superadmin"
  ON public.asaas_webhooks_log FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- 3. RPC: Bloqueio de reservas em empresas com status diferente de 'ativo'
-- Atualiza reservar_vaga para validar se a empresa está bloqueada
CREATE OR REPLACE FUNCTION public.reservar_vaga(
  p_turno_id          UUID,
  p_corretor_nome     TEXT,
  p_device_id         TEXT,
  p_corretor_whatsapp TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacidade INT;
  v_atual      INT;
  v_empresa_id UUID;
  v_status     TEXT;
  v_exigir_cadastro BOOLEAN;
  v_zap_limpo  TEXT;
BEGIN
  -- 1. Trava o turno contra concorrência simultânea (Race Condition)
  SELECT capacidade, empresa_id INTO v_capacidade, v_empresa_id
  FROM turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
  END IF;

  -- 2. Valida o status da empresa (Bloqueio por inadimplência ou inatividade)
  SELECT status, COALESCE(exigir_cadastro_previo, false) 
  INTO v_status, v_exigir_cadastro
  FROM empresas
  WHERE id = v_empresa_id;

  IF v_status = 'bloqueado' THEN
    RAISE EXCEPTION 'Acesso temporariamente suspenso: A escala desta imobiliária está com pendência cadastral ou financeira. Fale com seu coordenador.';
  ELSIF v_status = 'inativo' THEN
    RAISE EXCEPTION 'Esta imobiliária está inativa no momento.';
  END IF;

  -- 3. Proteção contra invasores (Equipe de Corretores da Imobiliária)
  IF v_exigir_cadastro THEN
    v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');

    IF NOT EXISTS (
      SELECT 1 FROM equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND (
          (v_zap_limpo <> '' AND regexp_replace(whatsapp, '[^0-9]', '', 'g') = v_zap_limpo)
          OR (lower(trim(nome)) = lower(trim(p_corretor_nome)))
        )
    ) THEN
      RAISE EXCEPTION 'Acesso restrito: Seu cadastro não foi encontrado na equipe autorizada desta imobiliária. Fale com seu coordenador.';
    END IF;
  END IF;

  -- 4. Valida vagas disponíveis no turno
  SELECT COUNT(*) INTO v_atual
  FROM reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE;
  END IF;

  -- 5. Impede reserva duplicada do mesmo corretor (device_id) no mesmo turno
  IF EXISTS (
    SELECT 1 FROM reservas
    WHERE turno_id = p_turno_id AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'Você já possui uma reserva neste turno';
  END IF;

  -- 6. Insere a reserva vinculando automaticamente a empresa e WhatsApp
  INSERT INTO reservas (turno_id, corretor_nome, device_id, empresa_id, corretor_whatsapp)
  VALUES (p_turno_id, trim(p_corretor_nome), p_device_id, v_empresa_id, p_corretor_whatsapp);

  RETURN TRUE;
END;
$$;

-- 4. RPC: provisionar_empresa_asaas
-- Executada pelo webhook após confirmação de pagamento para criar o tenant,
-- vincular o gestor e montar um ponto de captação inicial pronto para uso.
CREATE OR REPLACE FUNCTION public.provisionar_empresa_asaas(
  p_nome                  TEXT,
  p_slug                  TEXT,
  p_asaas_customer_id     TEXT,
  p_asaas_subscription_id TEXT,
  p_email_cobranca        TEXT,
  p_telefone_cobranca     TEXT,
  p_user_id               UUID,
  p_plano                 TEXT DEFAULT 'pro'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug_limpo TEXT;
  v_slug_final TEXT;
  v_contador   INT := 1;
  v_nova_empresa RECORD;
  v_novo_ponto_id UUID;
  v_pin_aleatorio TEXT;
BEGIN
  -- 1. Normaliza o slug
  v_slug_limpo := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9_-]', '', 'g'));
  IF length(v_slug_limpo) < 2 THEN
    v_slug_limpo := 'imobiliaria-' || substr(md5(random()::text), 1, 6);
  END IF;

  -- 2. Garante unicidade do slug sem gerar colisão
  v_slug_final := v_slug_limpo;
  WHILE EXISTS (SELECT 1 FROM empresas WHERE slug = v_slug_final) LOOP
    v_contador := v_contador + 1;
    v_slug_final := v_slug_limpo || '-' || v_contador::text;
  END LOOP;

  -- 3. Gera PIN de contingência aleatório de 4 dígitos (ex: '4892')
  v_pin_aleatorio := lpad((floor(random() * 9000 + 1000)::int)::text, 4, '0');

  -- 4. Cria o novo Tenant com o plano contratado no Asaas
  INSERT INTO empresas (
    nome,
    slug,
    admin_pin,
    plano,
    status,
    asaas_customer_id,
    asaas_subscription_id,
    email_cobranca,
    telefone_cobranca
  )
  VALUES (
    trim(p_nome),
    v_slug_final,
    v_pin_aleatorio,
    COALESCE(p_plano, 'pro'),
    'ativo',
    p_asaas_customer_id,
    p_asaas_subscription_id,
    p_email_cobranca,
    p_telefone_cobranca
  )
  RETURNING * INTO v_nova_empresa;

  -- 5. Vincula o gestor recém-criado como Administrador ('admin') da imobiliária
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (p_user_id, v_nova_empresa.id, 'admin', true)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = 'admin', ativo = true;
  END IF;

  -- 6. Cria automaticamente um Ponto de Captação inicial pronto para uso
  INSERT INTO public.pontos (empresa_id, nome, ordem, ativo)
  VALUES (v_nova_empresa.id, 'Plantão Principal', 1, true)
  RETURNING id INTO v_novo_ponto_id;

  -- 7. Cria turnos de exemplo para os dias úteis no ponto inicial
  INSERT INTO public.turnos (empresa_id, ponto_id, dia, horario, capacidade, ordem)
  VALUES
    (v_nova_empresa.id, v_novo_ponto_id, 'SEGUNDA-FEIRA', '08:00 às 12:00', 2, 1),
    (v_nova_empresa.id, v_novo_ponto_id, 'SEGUNDA-FEIRA', '13:00 às 17:00', 2, 2),
    (v_nova_empresa.id, v_novo_ponto_id, 'TERÇA-FEIRA', '08:00 às 12:00', 2, 1),
    (v_nova_empresa.id, v_novo_ponto_id, 'TERÇA-FEIRA', '13:00 às 17:00', 2, 2),
    (v_nova_empresa.id, v_novo_ponto_id, 'SÁBADO', '09:00 às 13:00', 3, 1),
    (v_nova_empresa.id, v_novo_ponto_id, 'DOMINGO', '09:00 às 13:00', 3, 1);

  RETURN to_jsonb(v_nova_empresa);
END;
$$;

-- 5. RPC: atualizar_status_empresa_asaas
-- Chamada pelo webhook para ativar, suspender ou cancelar uma empresa
CREATE OR REPLACE FUNCTION public.atualizar_status_empresa_asaas(
  p_asaas_customer_id     TEXT,
  p_asaas_subscription_id TEXT,
  p_novo_status           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_afetados INT := 0;
  v_empresa RECORD;
BEGIN
  IF p_novo_status NOT IN ('ativo', 'inativo', 'bloqueado') THEN
    RAISE EXCEPTION 'Status inválido. Use ativo, inativo ou bloqueado.';
  END IF;

  UPDATE public.empresas
  SET status = p_novo_status
  WHERE (asaas_customer_id = p_asaas_customer_id OR asaas_subscription_id = p_asaas_subscription_id)
  RETURNING * INTO v_empresa;

  GET DIAGNOSTICS v_afetados = ROW_COUNT;

  RETURN jsonb_build_object(
    'linhas_afetadas', v_afetados,
    'novo_status', p_novo_status,
    'empresa_id', v_empresa.id,
    'empresa_slug', v_empresa.slug
  );
END;
$$;

