-- ============================================================
-- ESCALAFÁCIL — MIGRATION FASE 4: LINKS SEGUROS & PORTAL DO GESTOR
-- ============================================================
-- 1. Cria gerador de token alfanumérico seguro de 12 caracteres
-- 2. Adiciona coluna codigo_escala na tabela empresas (com unicidade e default)
-- 3. Preenche empresas existentes com códigos de 12 caracteres únicos
-- 4. Cria RPC redefinir_codigo_escala para revogação e regeneração
-- 5. Atualiza RPCs de criação de empresas (provisionar_empresa_asaas e criar_nova_empresa)
-- ============================================================

-- 1. Função auxiliar para gerar token seguro de 12 caracteres alfanuméricos
-- Utiliza caracteres [a-zA-Z0-9] (62^12 combinações possíveis — ~3,22 x 10^21)
CREATE OR REPLACE FUNCTION public.gerar_codigo_escala()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_codigo_escala() TO anon, authenticated, service_role;

-- 2. Adiciona a coluna codigo_escala na tabela empresas se ainda não existir
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS codigo_escala TEXT;

-- 3. Popula todas as empresas existentes que estejam sem codigo_escala
-- Garante que cada uma receba um código de 12 caracteres estritamente único
DO $$
DECLARE
  r RECORD;
  v_novo_codigo TEXT;
BEGIN
  FOR r IN SELECT id FROM public.empresas WHERE codigo_escala IS NULL OR length(codigo_escala) < 12 LOOP
    LOOP
      v_novo_codigo := public.gerar_codigo_escala();
      IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE codigo_escala = v_novo_codigo) THEN
        EXIT;
      END IF;
    END LOOP;

    UPDATE public.empresas
    SET codigo_escala = v_novo_codigo
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Aplica o DEFAULT automático e a restrição NOT NULL
ALTER TABLE public.empresas 
ALTER COLUMN codigo_escala SET DEFAULT public.gerar_codigo_escala();

ALTER TABLE public.empresas 
ALTER COLUMN codigo_escala SET NOT NULL;

-- Garante índice único para consultas ultra-rápidas e sem colisão
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo_escala ON public.empresas(codigo_escala);

-- 4. RPC: redefinir_codigo_escala
-- Permite que administradores da empresa ou superadmins revoguem o link antigo
-- e gerem um novo token aleatório de 12 caracteres imediatamente.
CREATE OR REPLACE FUNCTION public.redefinir_codigo_escala(
  p_empresa_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_codigo TEXT;
  v_tentativas INT := 0;
BEGIN
  -- Se a chamada for realizada por usuário autenticado via Supabase Auth,
  -- valida se ele possui o papel de 'admin' na empresa ou se é 'superadmin' global.
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem redefinir o link seguro da escala.';
    END IF;
  END IF;

  -- Gera um código único de 12 caracteres (loop de segurança contra colisão improvável)
  LOOP
    v_novo_codigo := public.gerar_codigo_escala();
    v_tentativas := v_tentativas + 1;
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE codigo_escala = v_novo_codigo) THEN
      EXIT;
    END IF;
    IF v_tentativas > 100 THEN
      RAISE EXCEPTION 'Não foi possível gerar um código único após múltiplas tentativas.';
    END IF;
  END LOOP;

  -- Atualiza a empresa com o novo código
  UPDATE public.empresas
  SET codigo_escala = v_novo_codigo
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  RETURN v_novo_codigo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redefinir_codigo_escala(UUID) TO anon, authenticated, service_role;

-- 5. Atualização da RPC: provisionar_empresa_asaas
-- Já gera automaticamente o codigo_escala ao provisionar tenant via webhook do Asaas
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
  v_codigo_escala TEXT;
BEGIN
  -- 1. Normaliza o slug
  v_slug_limpo := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9_-]', '', 'g'));
  IF length(v_slug_limpo) < 2 THEN
    v_slug_limpo := 'imobiliaria-' || substr(md5(random()::text), 1, 6);
  END IF;

  -- 2. Garante unicidade do slug sem colisão
  v_slug_final := v_slug_limpo;
  WHILE EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_final) LOOP
    v_contador := v_contador + 1;
    v_slug_final := v_slug_limpo || '-' || v_contador::text;
  END LOOP;

  -- 3. Gera PIN de contingência aleatório de 4 dígitos (ex: '4892')
  v_pin_aleatorio := lpad((floor(random() * 9000 + 1000)::int)::text, 4, '0');

  -- 4. Gera código de escala seguro de 12 caracteres único
  LOOP
    v_codigo_escala := public.gerar_codigo_escala();
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE codigo_escala = v_codigo_escala) THEN
      EXIT;
    END IF;
  END LOOP;

  -- 5. Cria o novo Tenant com o plano contratado no Asaas e codigo_escala
  INSERT INTO public.empresas (
    nome,
    slug,
    codigo_escala,
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
    v_codigo_escala,
    v_pin_aleatorio,
    COALESCE(p_plano, 'pro'),
    'ativo',
    p_asaas_customer_id,
    p_asaas_subscription_id,
    p_email_cobranca,
    p_telefone_cobranca
  )
  RETURNING * INTO v_nova_empresa;

  -- 6. Vincula o gestor recém-criado como Administrador ('admin') da imobiliária
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (p_user_id, v_nova_empresa.id, 'admin', true)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = 'admin', ativo = true;
  END IF;

  -- 7. Cria automaticamente um Ponto de Captação inicial pronto para uso
  INSERT INTO public.pontos (empresa_id, nome, ordem, ativo)
  VALUES (v_nova_empresa.id, 'Plantão Principal', 1, true)
  RETURNING id INTO v_novo_ponto_id;

  -- 8. Cria turnos de exemplo para os dias úteis no ponto inicial
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

GRANT EXECUTE ON FUNCTION public.provisionar_empresa_asaas(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO anon, authenticated, service_role;

-- 6. Atualização da RPC: criar_nova_empresa (onboarding self-service / demo)
CREATE OR REPLACE FUNCTION public.criar_nova_empresa(
  p_nome      TEXT,
  p_slug      TEXT,
  p_admin_pin TEXT DEFAULT '1234'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug_limpo TEXT;
  v_nova_empresa RECORD;
  v_user_id UUID := auth.uid();
  v_novo_ponto_id UUID;
  v_codigo_escala TEXT;
BEGIN
  v_slug_limpo := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9_-]', '', 'g'));

  IF length(v_slug_limpo) < 2 THEN
    RAISE EXCEPTION 'Slug inválido ou muito curto.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_limpo) THEN
    RAISE EXCEPTION 'Este slug/endereço já está em uso.';
  END IF;

  -- Gera código seguro de 12 caracteres
  LOOP
    v_codigo_escala := public.gerar_codigo_escala();
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE codigo_escala = v_codigo_escala) THEN
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.empresas (nome, slug, codigo_escala, admin_pin, plano, status)
  VALUES (
    trim(p_nome),
    v_slug_limpo,
    v_codigo_escala,
    COALESCE(NULLIF(trim(p_admin_pin), ''), '1234'),
    'trial',
    'ativo'
  )
  RETURNING * INTO v_nova_empresa;

  -- Se o criador estiver autenticado, vincula-o imediatamente como 'admin'
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (v_user_id, v_nova_empresa.id, 'admin', true)
    ON CONFLICT (user_id, empresa_id) DO NOTHING;
  END IF;

  -- Cria ponto de captação inicial com turnos de exemplo
  INSERT INTO public.pontos (empresa_id, nome, ordem, ativo)
  VALUES (v_nova_empresa.id, 'Plantão Principal', 1, true)
  RETURNING id INTO v_novo_ponto_id;

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

GRANT EXECUTE ON FUNCTION public.criar_nova_empresa(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

