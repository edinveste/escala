-- ============================================================
-- Escala CRM / EscalaFácil — Schema SQL Completo Multi-Tenant B2B
-- Fases 1, 2 e 3 (Multi-Tenancy, Supabase Auth, RBAC & Asaas Billing)
-- ============================================================
-- Este script é 100% idempotente e pronto para ser executado
-- diretamente no SQL Editor de um projeto Supabase novo ou existente.
-- ============================================================

-- Extensões necessárias para funções de criptografia e UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. TABELAS PRINCIPAIS
-- ============================================================

-- 1.0 Função para gerar código aleatório seguro de 12 caracteres (Anti-Espionagem)
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

-- 1.1 Tabela de empresas (Tenants)
CREATE TABLE IF NOT EXISTS public.empresas (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                       TEXT NOT NULL,
  slug                       TEXT NOT NULL UNIQUE,
  codigo_escala              TEXT NOT NULL UNIQUE DEFAULT public.gerar_codigo_escala(),
  logo_url                   TEXT,
  cor_primaria               TEXT NOT NULL DEFAULT '#3b82f6',
  plano                      TEXT NOT NULL DEFAULT 'trial',
  status                     TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'inativo', 'bloqueado'
  exigir_cadastro_previo     BOOLEAN NOT NULL DEFAULT false,
  tipo_validacao_equipe      TEXT NOT NULL DEFAULT 'whatsapp' CHECK (tipo_validacao_equipe IN ('whatsapp', 'email', 'ambos')),
  asaas_customer_id          TEXT,
  asaas_subscription_id      TEXT,
  asaas_payment_id           TEXT,
  email_cobranca             TEXT,
  telefone_cobranca          TEXT,
  termos                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  msg_whatsapp_geral         TEXT,
  rodape_whatsapp_geral      TEXT,
  copia_whatsapp_geral_ativa BOOLEAN NOT NULL DEFAULT true,
  ocultar_nomes_escala       BOOLEAN NOT NULL DEFAULT false,
  bloquear_conflito_horario  BOOLEAN NOT NULL DEFAULT false,
  limite_vagas_semana        INT DEFAULT NULL CHECK (limite_vagas_semana IS NULL OR limite_vagas_semana >= 1),
  limite_vagas_dia           INT DEFAULT NULL CHECK (limite_vagas_dia IS NULL OR limite_vagas_dia >= 1),
  limite_vagas_ponto         INT DEFAULT NULL CHECK (limite_vagas_ponto IS NULL OR limite_vagas_ponto >= 1),
  cotas_pontos_ids           UUID[] DEFAULT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_slug ON public.empresas(lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo_escala ON public.empresas(codigo_escala);
CREATE INDEX IF NOT EXISTS idx_empresas_asaas_customer ON public.empresas(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_empresas_asaas_subscription ON public.empresas(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_empresas_status ON public.empresas(status);

-- Inserção da empresa demonstrativa padrão
INSERT INTO public.empresas (nome, slug, plano, status)
VALUES ('Minha Imobiliária', 'demo', 'ilimitado', 'ativo')
ON CONFLICT (slug) DO NOTHING;

-- 1.2 Tabela de perfis vinculada ao auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.perfis (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  nome           TEXT,
  is_superadmin  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfis_is_superadmin ON public.perfis(is_superadmin);

-- 1.3 Tabela de relação entre Usuários e Empresas (Multi-Tenant Memberships)
CREATE TABLE IF NOT EXISTS public.usuarios_empresas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'gestor' CHECK (role IN ('admin', 'gestor')),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_user ON public.usuarios_empresas(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_empresa ON public.usuarios_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_user_empresa ON public.usuarios_empresas(user_id, empresa_id);

-- 1.4 Tabela de pontos de captação (vinculados à empresa)
CREATE TABLE IF NOT EXISTS public.pontos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,              -- ex: 'Mercado Extra', 'Padaria Di Cunto'
  ordem              INT  NOT NULL DEFAULT 0,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  cabecalho_whatsapp    TEXT,
  rodape_whatsapp       TEXT,
  copia_whatsapp_ativa  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pontos_empresa_id ON public.pontos(empresa_id);

-- 1.5 Tabela de turnos (vinculados ao ponto e à empresa)
CREATE TABLE IF NOT EXISTS public.turnos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ponto_id    UUID NOT NULL REFERENCES public.pontos(id) ON DELETE CASCADE,
  dia         TEXT NOT NULL,          -- ex: 'SEGUNDA-FEIRA', 'SÁBADO'
  horario     TEXT NOT NULL,          -- ex: '08:00 às 12:00'
  hora_inicio TIME,
  hora_fim    TIME,
  capacidade  INT  NOT NULL DEFAULT 1,
  ordem       INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turnos_empresa_id ON public.turnos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_turnos_ponto_id ON public.turnos(ponto_id);
CREATE INDEX IF NOT EXISTS idx_turnos_empresa_dia_horas ON public.turnos(empresa_id, dia, hora_inicio, hora_fim);

-- 1.5.1 Helpers de normalização de dia e extração de hora_inicio/hora_fim
CREATE OR REPLACE FUNCTION public.normalizar_dia_semana(p_dia TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p_dia, '')))
    WHEN 'SEGUNDA'       THEN 'SEGUNDA-FEIRA'
    WHEN 'SEGUNDA-FEIRA' THEN 'SEGUNDA-FEIRA'
    WHEN 'TERÇA'         THEN 'TERÇA-FEIRA'
    WHEN 'TERCA'         THEN 'TERÇA-FEIRA'
    WHEN 'TERÇA-FEIRA'   THEN 'TERÇA-FEIRA'
    WHEN 'TERCA-FEIRA'   THEN 'TERÇA-FEIRA'
    WHEN 'QUARTA'        THEN 'QUARTA-FEIRA'
    WHEN 'QUARTA-FEIRA'  THEN 'QUARTA-FEIRA'
    WHEN 'QUINTA'        THEN 'QUINTA-FEIRA'
    WHEN 'QUINTA-FEIRA'  THEN 'QUINTA-FEIRA'
    WHEN 'SEXTA'         THEN 'SEXTA-FEIRA'
    WHEN 'SEXTA-FEIRA'   THEN 'SEXTA-FEIRA'
    WHEN 'SÁBADO'        THEN 'SÁBADO'
    WHEN 'SABADO'        THEN 'SÁBADO'
    WHEN 'DOMINGO'       THEN 'DOMINGO'
    ELSE upper(trim(COALESCE(p_dia, '')))
  END;
$$;

CREATE OR REPLACE FUNCTION public.extrair_horarios_turno(p_horario TEXT)
RETURNS TABLE (hora_inicio TIME, hora_fim TIME)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_txt   TEXT := trim(COALESCE(p_horario, ''));
  v_match TEXT[];
  v_h1    INT;
  v_m1    INT;
  v_h2    INT;
  v_m2    INT;
  v_t1    TIME;
  v_t2    TIME;
BEGIN
  IF v_txt = '' THEN
    RETURN;
  END IF;

  v_match := regexp_match(
    v_txt,
    '([0-9]{1,2})\s*(?:(?::|[hH]\.?)\s*([0-9]{2})|[hH](?:rs?|s)?)\s*(?:às|as|até|ate|a|-|–|—|~|/)\s*([0-9]{1,2})\s*(?:(?::|[hH]\.?)\s*([0-9]{2})|[hH](?:rs?|s)?)?',
    'i'
  );

  IF v_match IS NOT NULL THEN
    v_h1 := v_match[1]::int;
    v_m1 := COALESCE(NULLIF(v_match[2], ''), '0')::int;
    v_h2 := v_match[3]::int;
    v_m2 := COALESCE(NULLIF(v_match[4], ''), '0')::int;
  ELSE
    v_match := regexp_match(
      v_txt,
      '([0-9]{1,2})\s*(?:às|as|até|ate|a|-|–|—|~|/)\s*([0-9]{1,2})\s*(?:(?::|[hH]\.?)\s*([0-9]{2})|[hH](?:rs?|s)?)?',
      'i'
    );

    IF v_match IS NULL THEN
      RETURN;
    END IF;

    v_h1 := v_match[1]::int;
    v_m1 := 0;
    v_h2 := v_match[2]::int;
    v_m2 := COALESCE(NULLIF(v_match[3], ''), '0')::int;
  END IF;

  IF v_h1 < 0 OR v_h1 > 23 OR v_m1 < 0 OR v_m1 > 59 THEN
    RETURN;
  END IF;

  IF NOT ((v_h2 BETWEEN 0 AND 23 AND v_m2 BETWEEN 0 AND 59) OR (v_h2 = 24 AND v_m2 = 0)) THEN
    RETURN;
  END IF;

  v_t1 := make_time(v_h1, v_m1, 0);
  v_t2 := CASE WHEN v_h2 = 24 THEN '24:00:00'::time ELSE make_time(v_h2, v_m2, 0) END;

  IF v_t1 = v_t2 THEN
    RETURN;
  END IF;

  hora_inicio := v_t1;
  hora_fim    := v_t2;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_turnos_preencher_horas()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_extraido RECORD;
BEGIN
  IF (NEW.hora_inicio IS NULL OR NEW.hora_fim IS NULL) AND trim(COALESCE(NEW.horario, '')) <> '' THEN
    SELECT * INTO v_extraido
    FROM public.extrair_horarios_turno(NEW.horario)
    LIMIT 1;

    IF v_extraido.hora_inicio IS NOT NULL AND v_extraido.hora_fim IS NOT NULL THEN
      NEW.hora_inicio := COALESCE(NEW.hora_inicio, v_extraido.hora_inicio);
      NEW.hora_fim    := COALESCE(NEW.hora_fim, v_extraido.hora_fim);
    END IF;
  END IF;

  IF trim(COALESCE(NEW.horario, '')) = '' AND NEW.hora_inicio IS NOT NULL AND NEW.hora_fim IS NOT NULL THEN
    NEW.horario := to_char(NEW.hora_inicio, 'HH24:MI') || ' às ' || to_char(NEW.hora_fim, 'HH24:MI');
  END IF;

  IF NEW.dia IS NOT NULL THEN
    NEW.dia := public.normalizar_dia_semana(NEW.dia);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_preencher_horas ON public.turnos;
CREATE TRIGGER trg_turnos_preencher_horas
  BEFORE INSERT OR UPDATE ON public.turnos
  FOR EACH ROW EXECUTE FUNCTION public.fn_turnos_preencher_horas();

-- 1.6 Tabela de reservas (vinculadas ao turno e à empresa)
CREATE TABLE IF NOT EXISTS public.reservas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  turno_id          UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  corretor_nome     TEXT NOT NULL,
  corretor_whatsapp TEXT,
  corretor_email    TEXT,
  device_id         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_empresa_id ON public.reservas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_turno_id ON public.reservas(turno_id);
CREATE INDEX IF NOT EXISTS idx_reservas_corretor_email ON public.reservas(empresa_id, lower(trim(corretor_email)));

-- 1.7 Tabela de colaboradores autorizados da empresa (Equipe)
CREATE TABLE IF NOT EXISTS public.equipe_corretores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  whatsapp    TEXT,
  email       TEXT,
  device_id   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipe_corretores_empresa ON public.equipe_corretores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_whatsapp ON public.equipe_corretores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_ativo ON public.equipe_corretores(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_device ON public.equipe_corretores(empresa_id, device_id);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_email_lower ON public.equipe_corretores(empresa_id, lower(trim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipe_corretores_empresa_zap_clean ON public.equipe_corretores (empresa_id, (regexp_replace(whatsapp, '[^0-9]', '', 'g')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipe_corretores_empresa_email_unico ON public.equipe_corretores (empresa_id, lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';

-- 1.8 Tabela de logs de webhooks Asaas (Auditoria e Idempotência)
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

-- 1.8.1 Tabela de convites pendentes de gestores
CREATE TABLE IF NOT EXISTS public.convites_gestores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'gestor' CHECK (role IN ('admin', 'gestor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, email)
);

CREATE INDEX IF NOT EXISTS idx_convites_gestores_empresa ON public.convites_gestores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_convites_gestores_email_lower ON public.convites_gestores(lower(email));

-- 1.8.2 Tabela de sinalização Realtime sem PII para visão pública
CREATE TABLE IF NOT EXISTS public.escala_sync (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.escala_sync (empresa_id, updated_at)
SELECT id, now() FROM public.empresas
ON CONFLICT (empresa_id) DO NOTHING;

-- 1.9 População inicial de turnos e pontos para a empresa de demonstração 'demo'
DO $$
DECLARE
  v_demo_empresa_id UUID;
  v_demo_ponto_id UUID;
BEGIN
  SELECT id INTO v_demo_empresa_id FROM public.empresas WHERE slug = 'demo' LIMIT 1;
  IF v_demo_empresa_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.pontos WHERE empresa_id = v_demo_empresa_id) THEN
      INSERT INTO public.pontos (empresa_id, nome, ordem, ativo)
      VALUES (v_demo_empresa_id, 'Plantão Principal', 1, true)
      RETURNING id INTO v_demo_ponto_id;

      INSERT INTO public.turnos (empresa_id, ponto_id, dia, horario, capacidade, ordem)
      VALUES
        (v_demo_empresa_id, v_demo_ponto_id, 'SEGUNDA-FEIRA', '08:00 às 12:00', 2, 1),
        (v_demo_empresa_id, v_demo_ponto_id, 'SEGUNDA-FEIRA', '13:00 às 17:00', 2, 2),
        (v_demo_empresa_id, v_demo_ponto_id, 'TERÇA-FEIRA', '08:00 às 12:00', 2, 1),
        (v_demo_empresa_id, v_demo_ponto_id, 'TERÇA-FEIRA', '13:00 às 17:00', 2, 2),
        (v_demo_empresa_id, v_demo_ponto_id, 'QUARTA-FEIRA', '08:00 às 12:00', 2, 1),
        (v_demo_empresa_id, v_demo_ponto_id, 'QUINTA-FEIRA', '08:00 às 12:00', 2, 1),
        (v_demo_empresa_id, v_demo_ponto_id, 'SEXTA-FEIRA', '08:00 às 12:00', 2, 1),
        (v_demo_empresa_id, v_demo_ponto_id, 'SÁBADO', '09:00 às 13:00', 3, 1),
        (v_demo_empresa_id, v_demo_ponto_id, 'DOMINGO', '09:00 às 13:00', 3, 1);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2. FUNÇÕES DE AUTENTICAÇÃO E PERMISSÕES (SECURITY DEFINER)
-- ============================================================

-- 2.1 Superadmin desativado (isolamento multi-tenant estrito)
CREATE OR REPLACE FUNCTION public.is_superadmin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT false;
$$;

-- 2.2 Verifica se o usuário tem um dos papéis informados na empresa
CREATE OR REPLACE FUNCTION public.has_empresa_role(
  p_empresa_id UUID,
  p_roles TEXT[] DEFAULT ARRAY['admin', 'gestor'],
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.usuarios_empresas
      WHERE user_id = p_user_id
        AND empresa_id = p_empresa_id
        AND role = ANY(p_roles)
        AND ativo = true
    );
$$;

-- 2.3 Retorna as empresas às quais o usuário logado possui acesso
CREATE OR REPLACE FUNCTION public.get_minhas_empresas()
RETURNS TABLE (
  empresa_id UUID,
  empresa_nome TEXT,
  empresa_slug TEXT,
  empresa_status TEXT,
  role TEXT,
  is_superadmin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    e.id AS empresa_id,
    e.nome AS empresa_nome,
    e.slug AS empresa_slug,
    e.status AS empresa_status,
    ue.role AS role,
    false AS is_superadmin
  FROM public.usuarios_empresas ue
  JOIN public.empresas e ON e.id = ue.empresa_id
  WHERE ue.user_id = v_user_id
    AND ue.ativo = true
  ORDER BY e.nome ASC;
END;
$$;

-- 2.4 Trigger: Auto-criar perfil quando usuário se cadastra no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
  v_empresa_nome TEXT;
  v_empresa_id UUID;
  v_slug_base TEXT;
  v_slug_final TEXT;
  v_contador INT := 1;
  v_codigo_seguro TEXT;
  v_tem_convite BOOLEAN := false;
BEGIN
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    split_part(NEW.email, '@', 1)
  );
  v_empresa_nome := trim(COALESCE(NEW.raw_user_meta_data->>'empresa_nome', ''));

  -- 1. Cria ou atualiza o perfil pessoal (is_superadmin = false)
  INSERT INTO public.perfis (id, email, nome, is_superadmin)
  VALUES (
    NEW.id,
    NEW.email,
    v_nome,
    false
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(public.perfis.nome, EXCLUDED.nome),
      is_superadmin = false;

  -- 2. Converte convites pendentes deste e-mail em vínculos reais de gestor
  IF EXISTS (SELECT 1 FROM public.convites_gestores WHERE lower(email) = lower(trim(NEW.email))) THEN
    v_tem_convite := true;
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    SELECT NEW.id, cg.empresa_id, cg.role, true
    FROM public.convites_gestores cg
    WHERE lower(cg.email) = lower(trim(NEW.email))
    ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET role = EXCLUDED.role, ativo = true;

    DELETE FROM public.convites_gestores
    WHERE lower(email) = lower(trim(NEW.email));
  END IF;

  -- 3. Se NÃO havia convite pendente e foi informado nome da empresa, provisiona o Tenant imediatamente
  IF NOT v_tem_convite AND v_empresa_nome <> '' THEN
    v_slug_base := lower(regexp_replace(
      translate(v_empresa_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9_-]', '', 'g'
    ));
    IF v_slug_base = '' THEN
      v_slug_base := 'imobiliaria';
    END IF;

    v_slug_final := v_slug_base;
    WHILE EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_final) LOOP
      v_contador := v_contador + 1;
      v_slug_final := v_slug_base || '-' || v_contador::text;
    END LOOP;

    v_codigo_seguro := public.gerar_codigo_escala();

    INSERT INTO public.empresas (
      nome,
      slug,
      codigo_escala,
      status,
      plano,
      termos
    )
    VALUES (
      v_empresa_nome,
      v_slug_final,
      v_codigo_seguro,
      'ativo',
      'trial',
      '{}'::jsonb
    )
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.usuarios_empresas (
      user_id,
      empresa_id,
      role,
      ativo
    )
    VALUES (
      NEW.id,
      v_empresa_id,
      'admin',
      true
    )
    ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET role = 'admin', ativo = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Sincroniza usuários que já possam ter sido criados no auth.users antes deste script
INSERT INTO public.perfis (id, email, nome, is_superadmin)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  false
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Garante que nenhum perfil permaneça marcado como superadmin
UPDATE public.perfis SET is_superadmin = false WHERE is_superadmin = true;

-- ============================================================
-- 3. POLÍTICAS DE RLS (ROW LEVEL SECURITY ESTRITO)
-- ============================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites_gestores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_corretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhooks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_sync ENABLE ROW LEVEL SECURITY;

-- 3.1 PERFIS
DROP POLICY IF EXISTS "perfis_select" ON public.perfis;
CREATE POLICY "perfis_select"
  ON public.perfis FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "perfis_update" ON public.perfis;
CREATE POLICY "perfis_update"
  ON public.perfis FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3.2 USUARIOS_EMPRESAS
DROP POLICY IF EXISTS "usuarios_empresas_select" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_select"
  ON public.usuarios_empresas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

DROP POLICY IF EXISTS "usuarios_empresas_insert" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_insert"
  ON public.usuarios_empresas FOR INSERT TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin']));

DROP POLICY IF EXISTS "usuarios_empresas_update" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_update"
  ON public.usuarios_empresas FOR UPDATE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin']));

DROP POLICY IF EXISTS "usuarios_empresas_delete" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_delete"
  ON public.usuarios_empresas FOR DELETE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin']));

-- 3.2.1 CONVITES_GESTORES
DROP POLICY IF EXISTS "convites_gestores_admin" ON public.convites_gestores;
CREATE POLICY "convites_gestores_admin"
  ON public.convites_gestores FOR ALL TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin']));

-- 3.3 EMPRESAS
DROP POLICY IF EXISTS "empresas_select_public" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_gestores" ON public.empresas;
CREATE POLICY "empresas_select_gestores"
  ON public.empresas FOR SELECT TO authenticated
  USING (public.has_empresa_role(id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "empresas_insert_authenticated" ON public.empresas;
DROP POLICY IF EXISTS "empresas_delete_superadmin" ON public.empresas;

DROP POLICY IF EXISTS "empresas_update_auth" ON public.empresas;
CREATE POLICY "empresas_update_auth"
  ON public.empresas FOR UPDATE TO authenticated
  USING (public.has_empresa_role(id, ARRAY['admin']))
  WITH CHECK (public.has_empresa_role(id, ARRAY['admin']));

-- 3.4 PONTOS
DROP POLICY IF EXISTS "pontos_select_public" ON public.pontos;
DROP POLICY IF EXISTS "pontos_select_gestores" ON public.pontos;
CREATE POLICY "pontos_select_gestores"
  ON public.pontos FOR SELECT TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "pontos_insert_gestores" ON public.pontos;
CREATE POLICY "pontos_insert_gestores"
  ON public.pontos FOR INSERT TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "pontos_update_gestores" ON public.pontos;
CREATE POLICY "pontos_update_gestores"
  ON public.pontos FOR UPDATE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "pontos_delete_gestores" ON public.pontos;
CREATE POLICY "pontos_delete_gestores"
  ON public.pontos FOR DELETE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- 3.5 TURNOS
DROP POLICY IF EXISTS "turnos_select_public" ON public.turnos;
DROP POLICY IF EXISTS "turnos_select_gestores" ON public.turnos;
CREATE POLICY "turnos_select_gestores"
  ON public.turnos FOR SELECT TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "turnos_insert_gestores" ON public.turnos;
CREATE POLICY "turnos_insert_gestores"
  ON public.turnos FOR INSERT TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "turnos_update_gestores" ON public.turnos;
CREATE POLICY "turnos_update_gestores"
  ON public.turnos FOR UPDATE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "turnos_delete_gestores" ON public.turnos;
CREATE POLICY "turnos_delete_gestores"
  ON public.turnos FOR DELETE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- 3.6 RESERVAS
DROP POLICY IF EXISTS "reservas_select_public" ON public.reservas;
DROP POLICY IF EXISTS "reservas_insert_allowed" ON public.reservas;
DROP POLICY IF EXISTS "reservas_delete_gestor_or_own" ON public.reservas;

DROP POLICY IF EXISTS "reservas_select_gestores" ON public.reservas;
CREATE POLICY "reservas_select_gestores"
  ON public.reservas FOR SELECT TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "reservas_insert_gestores" ON public.reservas;
CREATE POLICY "reservas_insert_gestores"
  ON public.reservas FOR INSERT TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "reservas_update_gestores" ON public.reservas;
CREATE POLICY "reservas_update_gestores"
  ON public.reservas FOR UPDATE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "reservas_delete_gestores" ON public.reservas;
CREATE POLICY "reservas_delete_gestores"
  ON public.reservas FOR DELETE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- 3.7 EQUIPE_CORRETORES
DROP POLICY IF EXISTS "equipe_corretores_select" ON public.equipe_corretores;
DROP POLICY IF EXISTS "equipe_corretores_select_gestores" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_select_gestores"
  ON public.equipe_corretores FOR SELECT TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "equipe_corretores_all_gestores" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_all_gestores"
  ON public.equipe_corretores FOR ALL TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- 3.8 ESCALA_SYNC (Realtime público sem dados sensíveis)
DROP POLICY IF EXISTS "escala_sync_select_public" ON public.escala_sync;
CREATE POLICY "escala_sync_select_public"
  ON public.escala_sync FOR SELECT TO anon, authenticated
  USING (true);

-- 3.9 ASAAS_WEBHOOKS_LOG (exclusivo service_role)
DROP POLICY IF EXISTS "asaas_webhooks_log_select_superadmin" ON public.asaas_webhooks_log;

-- ============================================================
-- 4. RPCS CRÍTICAS DO CORE (PL/PGSQL COM SECURITY DEFINER)
-- ============================================================

-- 4.1 RPC: reservar_vaga (com advisory lock, conflito de horário, cotas, FOR UPDATE, WhatsApp, E-mail, equipe autorizada, vínculo de aparelho e anti-spoofing)
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.reservar_vaga(
  p_turno_id          UUID,
  p_corretor_nome     TEXT,
  p_device_id         TEXT,
  p_corretor_whatsapp TEXT DEFAULT NULL,
  p_corretor_email    TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacidade        INT;
  v_atual             INT;
  v_empresa_id        UUID;
  v_ponto_id          UUID;
  v_ponto_nome        TEXT;
  v_ponto_ativo       BOOLEAN;
  v_dia_norm          TEXT;
  v_horario_alvo      TEXT;
  v_novo_inicio       TIME;
  v_novo_fim          TIME;
  v_novo_ini_min      INT;
  v_novo_fim_min      INT;
  v_status            TEXT;
  v_exigir_cadastro   BOOLEAN;
  v_tipo_validacao    TEXT;
  v_bloquear_conflito BOOLEAN;
  v_limite_semana     INT;
  v_limite_dia        INT;
  v_limite_ponto      INT;
  v_cotas_pontos_ids  UUID[];
  v_ponto_tem_cota    BOOLEAN;
  v_zap_limpo         TEXT;
  v_email_limpo       TEXT;
  v_zap_busca         TEXT;
  v_email_busca       TEXT;
  v_membro_id         UUID;
  v_nome_oficial      TEXT;
  v_device_cadastrado TEXT;
  v_membro_zap        TEXT;
  v_membro_email      TEXT;
  v_nome_existente    TEXT;
  v_nome_final        TEXT;
  v_lock_keys         TEXT[];
  v_lock_key          TEXT;
  v_conflito_ponto    TEXT;
  v_conflito_horario  TEXT;
  v_conflito_dia      TEXT;
  v_qtd_semana        INT := 0;
  v_qtd_dia           INT := 0;
  v_qtd_ponto         INT := 0;
BEGIN
  -- Validação de device_id
  IF trim(COALESCE(p_device_id, '')) = '' THEN
    RAISE EXCEPTION 'Dispositivo não identificado. Atualize a página e tente novamente.';
  END IF;

  -- Identifica a empresa do turno antes do advisory lock para evitar deadlock entre locks
  SELECT empresa_id INTO v_empresa_id
  FROM public.turnos
  WHERE id = p_turno_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado.';
  END IF;

  -- Normaliza o WhatsApp (apenas dígitos, removendo DDI 55 de 12 ou 13 dígitos)
  v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  -- Normaliza E-mail
  v_email_limpo := lower(trim(COALESCE(p_corretor_email, '')));
  v_nome_final := trim(COALESCE(p_corretor_nome, ''));

  -- 0. Advisory Lock transacional ordenado por identificador do colaborador na empresa
  v_lock_keys := ARRAY[v_empresa_id::text || ':dev:' || trim(p_device_id)];
  IF v_zap_limpo <> '' THEN
    v_lock_keys := array_append(v_lock_keys, v_empresa_id::text || ':zap:' || v_zap_limpo);
  END IF;
  IF v_email_limpo <> '' THEN
    v_lock_keys := array_append(v_lock_keys, v_empresa_id::text || ':mail:' || v_email_limpo);
  END IF;

  FOR v_lock_key IN
    SELECT DISTINCT k FROM unnest(v_lock_keys) AS k ORDER BY k ASC
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_lock_key));
  END LOOP;

  -- 1. Trava o turno contra concorrência simultânea (Race Condition)
  SELECT
    t.capacidade,
    t.empresa_id,
    t.ponto_id,
    public.normalizar_dia_semana(t.dia),
    t.horario,
    COALESCE(t.hora_inicio, (SELECT eh.hora_inicio FROM public.extrair_horarios_turno(t.horario) eh LIMIT 1)),
    COALESCE(t.hora_fim,    (SELECT eh.hora_fim    FROM public.extrair_horarios_turno(t.horario) eh LIMIT 1)),
    COALESCE(p.ativo, true),
    p.nome
  INTO
    v_capacidade,
    v_empresa_id,
    v_ponto_id,
    v_dia_norm,
    v_horario_alvo,
    v_novo_inicio,
    v_novo_fim,
    v_ponto_ativo,
    v_ponto_nome
  FROM public.turnos t
  JOIN public.pontos p ON p.id = t.ponto_id
  WHERE t.id = p_turno_id
  FOR UPDATE OF t;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado.';
  END IF;

  IF NOT v_ponto_ativo THEN
    RAISE EXCEPTION 'Este ponto de escala está pausado no momento.';
  END IF;

  -- 2. Valida o status da empresa, configurações de equipe e regras inteligentes de escala
  SELECT 
    status, 
    COALESCE(exigir_cadastro_previo, false),
    COALESCE(tipo_validacao_equipe, 'whatsapp'),
    COALESCE(bloquear_conflito_horario, false),
    limite_vagas_semana,
    limite_vagas_dia,
    limite_vagas_ponto,
    cotas_pontos_ids
  INTO 
    v_status, 
    v_exigir_cadastro,
    v_tipo_validacao,
    v_bloquear_conflito,
    v_limite_semana,
    v_limite_dia,
    v_limite_ponto,
    v_cotas_pontos_ids
  FROM public.empresas
  WHERE id = v_empresa_id;

  IF v_status = 'bloqueado' THEN
    RAISE EXCEPTION 'Acesso temporariamente suspenso: A escala desta empresa está com pendência cadastral ou financeira. Fale com seu coordenador.';
  ELSIF v_status = 'inativo' THEN
    RAISE EXCEPTION 'Esta empresa está inativa no momento.';
  END IF;

  -- 3. Proteção contra invasores (Equipe Autorizada da Empresa com Vínculo de Aparelho)
  IF v_exigir_cadastro THEN
    IF v_tipo_validacao = 'whatsapp' THEN
      IF v_zap_limpo = '' THEN
        RAISE EXCEPTION 'O WhatsApp é obrigatório para garantir vaga nesta empresa.';
      END IF;

      SELECT id, nome, device_id, whatsapp, email
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado, v_membro_zap, v_membro_email
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      LIMIT 1;

    ELSIF v_tipo_validacao = 'email' THEN
      IF v_email_limpo = '' THEN
        RAISE EXCEPTION 'O E-mail corporativo é obrigatório para garantir vaga nesta empresa.';
      END IF;

      SELECT id, nome, device_id, whatsapp, email
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado, v_membro_zap, v_membro_email
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;

    ELSIF v_tipo_validacao = 'ambos' THEN
      IF v_zap_limpo = '' OR v_email_limpo = '' THEN
        RAISE EXCEPTION 'WhatsApp e E-mail corporativo são obrigatórios para garantir vaga nesta empresa.';
      END IF;

      SELECT id, nome, device_id, whatsapp, email
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado, v_membro_zap, v_membro_email
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;
    ELSE
      SELECT id, nome, device_id, whatsapp, email
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado, v_membro_zap, v_membro_email
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND (
          (v_zap_limpo <> '' AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo)
          OR (v_email_limpo <> '' AND lower(trim(COALESCE(email, ''))) = v_email_limpo)
        )
      LIMIT 1;
    END IF;

    IF v_nome_oficial IS NULL THEN
      IF v_tipo_validacao = 'email' THEN
        RAISE EXCEPTION 'Acesso restrito: Seu e-mail corporativo não foi encontrado na equipe autorizada desta empresa. Fale com seu coordenador.';
      ELSIF v_tipo_validacao = 'ambos' THEN
        RAISE EXCEPTION 'Acesso restrito: Seus dados não foram encontrados na equipe autorizada desta empresa. Fale com seu coordenador.';
      ELSE
        RAISE EXCEPTION 'Acesso restrito: Seu cadastro não foi encontrado na equipe autorizada desta empresa. Fale com seu coordenador.';
      END IF;
    END IF;

    -- ─── BLINDAGEM ANTI-SABOTAGEM: TRAVA DE APARELHO CELULAR ───
    IF v_device_cadastrado IS NOT NULL AND v_device_cadastrado <> p_device_id THEN
      RAISE EXCEPTION 'Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular. Por segurança contra uso indevido, cada colaborador deve acessar exclusivamente pelo seu próprio aparelho. Solicite ao coordenador a liberação caso tenha trocado de celular.';
    ELSIF v_device_cadastrado IS NULL AND v_membro_id IS NOT NULL THEN
      -- Vincula o celular ao colaborador automaticamente no 1º uso
      UPDATE public.equipe_corretores
      SET device_id = p_device_id
      WHERE id = v_membro_id;
    END IF;

    -- REGRA CRÍTICA: Se a empresa exige cadastro, utiliza SEMPRE o nome oficial cadastrado pelo gestor
    v_nome_final := v_nome_oficial;
  ELSE
    IF length(trim(COALESCE(v_nome_final, ''))) < 2 THEN
      RAISE EXCEPTION 'Informe seu nome completo para reservar uma vaga.';
    END IF;
  END IF;

  v_zap_busca := COALESCE(
    NULLIF(v_zap_limpo, ''),
    NULLIF(regexp_replace(regexp_replace(COALESCE(v_membro_zap, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g'), ''),
    ''
  );
  v_email_busca := COALESCE(
    NULLIF(v_email_limpo, ''),
    NULLIF(lower(trim(COALESCE(v_membro_email, ''))), ''),
    ''
  );

  -- 4. Anti-Spoofing: Impede que o mesmo WhatsApp ou E-mail seja utilizado por nomes diferentes
  IF v_zap_limpo <> '' THEN
    SELECT corretor_nome INTO v_nome_existente
    FROM public.reservas
    WHERE empresa_id = v_empresa_id
      AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      AND lower(trim(corretor_nome)) <> lower(trim(v_nome_final))
    LIMIT 1;

    IF v_nome_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Este WhatsApp já está associado a "%". Cada colaborador deve utilizar seu próprio número de WhatsApp.', v_nome_existente;
    END IF;
  END IF;

  IF v_email_limpo <> '' THEN
    SELECT corretor_nome INTO v_nome_existente
    FROM public.reservas
    WHERE empresa_id = v_empresa_id
      AND lower(trim(COALESCE(corretor_email, ''))) = v_email_limpo
      AND lower(trim(corretor_nome)) <> lower(trim(v_nome_final))
    LIMIT 1;

    IF v_nome_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Este e-mail corporativo já está associado a "%". Cada colaborador deve utilizar seu próprio e-mail.', v_nome_existente;
    END IF;
  END IF;

  -- 5. Valida vagas disponíveis no turno
  SELECT COUNT(*) INTO v_atual
  FROM public.reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE; -- Turno esgotado
  END IF;

  -- 6. Impede reserva duplicada do mesmo colaborador no mesmo turno
  IF EXISTS (
    SELECT 1 FROM public.reservas
    WHERE turno_id = p_turno_id
      AND (
        device_id = p_device_id
        OR (v_zap_busca <> '' AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_busca)
        OR (v_email_busca <> '' AND lower(trim(COALESCE(corretor_email, ''))) = v_email_busca)
        OR (lower(trim(corretor_nome)) = lower(trim(v_nome_final)))
      )
  ) THEN
    RAISE EXCEPTION 'Você já possui uma vaga reservada neste horário.';
  END IF;

  -- 7. Feature 1: Bloqueio de Conflito de Horário (turnos simultâneos ou sobrepostos no mesmo dia)
  IF v_bloquear_conflito AND v_novo_inicio IS NOT NULL AND v_novo_fim IS NOT NULL THEN
    v_novo_ini_min := EXTRACT(HOUR FROM v_novo_inicio)::int * 60 + EXTRACT(MINUTE FROM v_novo_inicio)::int;
    v_novo_fim_min := EXTRACT(HOUR FROM v_novo_fim)::int * 60 + EXTRACT(MINUTE FROM v_novo_fim)::int;
    IF v_novo_fim_min <= v_novo_ini_min THEN
      v_novo_fim_min := v_novo_fim_min + 1440;
    END IF;

    SELECT
      p2.nome,
      t2.horario,
      public.normalizar_dia_semana(t2.dia)
    INTO
      v_conflito_ponto,
      v_conflito_horario,
      v_conflito_dia
    FROM public.reservas r2
    JOIN public.turnos t2 ON t2.id = r2.turno_id
    JOIN public.pontos p2 ON p2.id = t2.ponto_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(t2.hora_inicio, (SELECT eh.hora_inicio FROM public.extrair_horarios_turno(t2.horario) eh LIMIT 1)) AS hi,
        COALESCE(t2.hora_fim,    (SELECT eh.hora_fim    FROM public.extrair_horarios_turno(t2.horario) eh LIMIT 1)) AS hf
    ) h2
    WHERE r2.empresa_id = v_empresa_id
      AND p2.ativo = true
      AND t2.id <> p_turno_id
      AND public.normalizar_dia_semana(t2.dia) = v_dia_norm
      AND h2.hi IS NOT NULL
      AND h2.hf IS NOT NULL
      AND (
        r2.device_id = p_device_id
        OR (v_zap_busca <> '' AND regexp_replace(regexp_replace(COALESCE(r2.corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_busca)
        OR (v_email_busca <> '' AND lower(trim(COALESCE(r2.corretor_email, ''))) = v_email_busca)
      )
      AND (
        (EXTRACT(HOUR FROM h2.hi)::int * 60 + EXTRACT(MINUTE FROM h2.hi)::int) < v_novo_fim_min
        AND (
          CASE
            WHEN (EXTRACT(HOUR FROM h2.hf)::int * 60 + EXTRACT(MINUTE FROM h2.hf)::int) <= (EXTRACT(HOUR FROM h2.hi)::int * 60 + EXTRACT(MINUTE FROM h2.hi)::int)
            THEN (EXTRACT(HOUR FROM h2.hf)::int * 60 + EXTRACT(MINUTE FROM h2.hf)::int) + 1440
            ELSE (EXTRACT(HOUR FROM h2.hf)::int * 60 + EXTRACT(MINUTE FROM h2.hf)::int)
          END
        ) > v_novo_ini_min
      )
    LIMIT 1;

    IF v_conflito_ponto IS NOT NULL THEN
      RAISE EXCEPTION 'Conflito de horário: você já está escalado em % das % na %.',
        v_conflito_ponto, v_conflito_horario, v_conflito_dia;
    END IF;
  END IF;

  -- 8. Feature 2: Cotas / Limites Justos por Colaborador ("Anti-Monopólio")
  v_ponto_tem_cota := (
    v_cotas_pontos_ids IS NULL
    OR cardinality(v_cotas_pontos_ids) = 0
    OR v_ponto_id = ANY(v_cotas_pontos_ids)
  );

  IF v_ponto_tem_cota AND (v_limite_semana IS NOT NULL OR v_limite_dia IS NOT NULL OR v_limite_ponto IS NOT NULL) THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE public.normalizar_dia_semana(t2.dia) = v_dia_norm),
      COUNT(*) FILTER (WHERE t2.ponto_id = v_ponto_id)
    INTO
      v_qtd_semana,
      v_qtd_dia,
      v_qtd_ponto
    FROM public.reservas r2
    JOIN public.turnos t2 ON t2.id = r2.turno_id
    JOIN public.pontos p2 ON p2.id = t2.ponto_id
    WHERE r2.empresa_id = v_empresa_id
      AND p2.ativo = true
      AND (
        v_cotas_pontos_ids IS NULL
        OR cardinality(v_cotas_pontos_ids) = 0
        OR t2.ponto_id = ANY(v_cotas_pontos_ids)
      )
      AND (
        r2.device_id = p_device_id
        OR (v_zap_busca <> '' AND regexp_replace(regexp_replace(COALESCE(r2.corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_busca)
        OR (v_email_busca <> '' AND lower(trim(COALESCE(r2.corretor_email, ''))) = v_email_busca)
      );

    IF v_limite_semana IS NOT NULL AND v_qtd_semana >= v_limite_semana THEN
      RAISE EXCEPTION 'Limite de vagas na semana atingido (%/%). Cancele outra vaga para reservar esta.',
        v_qtd_semana, v_limite_semana;
    END IF;

    IF v_limite_dia IS NOT NULL AND v_qtd_dia >= v_limite_dia THEN
      RAISE EXCEPTION 'Limite de vagas na % atingido (%/%).',
        v_dia_norm, v_qtd_dia, v_limite_dia;
    END IF;

    IF v_limite_ponto IS NOT NULL AND v_qtd_ponto >= v_limite_ponto THEN
      RAISE EXCEPTION 'Limite por ponto atingido em "%" (%/%).',
        v_ponto_nome, v_qtd_ponto, v_limite_ponto;
    END IF;
  END IF;

  -- 9. Insere a reserva vinculando automaticamente a empresa, device_id, whatsapp e email
  INSERT INTO public.reservas (
    turno_id,
    corretor_nome,
    device_id,
    empresa_id,
    corretor_whatsapp,
    corretor_email
  ) VALUES (
    p_turno_id,
    v_nome_final,
    p_device_id,
    v_empresa_id,
    NULLIF(trim(COALESCE(p_corretor_whatsapp, '')), ''),
    NULLIF(v_email_limpo, '')
  );

  RETURN TRUE;
END;
$$;

-- 4.2 RPC: cancelar_vaga (com trava estrita de device_id: apenas o celular que reservou pode cancelar)
DROP FUNCTION IF EXISTS public.cancelar_vaga(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancelar_vaga(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cancelar_vaga(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancelar_vaga(
  p_reserva_id          UUID,
  p_device_id           TEXT,
  p_corretor_whatsapp   TEXT DEFAULT NULL,
  p_corretor_email      TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  IF trim(COALESCE(p_device_id, '')) = '' THEN
    RETURN FALSE;
  END IF;

  -- Apenas o aparelho físico que realizou a reserva tem autorização para cancelá-la
  DELETE FROM public.reservas
  WHERE id = p_reserva_id
    AND device_id = p_device_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- 4.2.1 RPC Pública: get_empresa_publica (retorna apenas metadados públicos não-sensíveis)
CREATE OR REPLACE FUNCTION public.get_empresa_publica(p_identificador TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_raw     TEXT := trim(COALESCE(p_identificador, ''));
  v_slug    TEXT;
  v_empresa RECORD;
BEGIN
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;

  IF length(v_raw) = 12 AND v_raw ~ '^[A-Za-z0-9]{12}$' THEN
    SELECT
      id, nome, slug, codigo_escala, logo_url, cor_primaria, plano, status,
      exigir_cadastro_previo, tipo_validacao_equipe, termos,
      msg_whatsapp_geral, rodape_whatsapp_geral, copia_whatsapp_geral_ativa,
      ocultar_nomes_escala,
      bloquear_conflito_horario, limite_vagas_semana, limite_vagas_dia, limite_vagas_ponto,
      cotas_pontos_ids, created_at
    INTO v_empresa
    FROM public.empresas
    WHERE codigo_escala = v_raw
    LIMIT 1;
  END IF;

  IF v_empresa.id IS NULL THEN
    v_slug := lower(regexp_replace(
      translate(v_raw, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9_-]', '', 'g'
    ));

    IF v_slug <> '' THEN
      SELECT
        id, nome, slug, codigo_escala, logo_url, cor_primaria, plano, status,
        exigir_cadastro_previo, tipo_validacao_equipe, termos,
        msg_whatsapp_geral, rodape_whatsapp_geral, copia_whatsapp_geral_ativa,
        ocultar_nomes_escala,
        bloquear_conflito_horario, limite_vagas_semana, limite_vagas_dia, limite_vagas_ponto,
        cotas_pontos_ids, created_at
      INTO v_empresa
      FROM public.empresas
      WHERE lower(slug) = v_slug
      LIMIT 1;
    END IF;
  END IF;

  IF v_empresa.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_empresa);
END;
$$;

-- 4.2.2 RPC Pública: get_escala_publica (sem device_id, whatsapp, email e com Modo Anônimo aplicado no servidor)
CREATE OR REPLACE FUNCTION public.get_escala_publica(
  p_empresa_id UUID,
  p_device_id  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_status        TEXT;
  v_ocultar_nomes BOOLEAN := false;
  v_device_limpo  TEXT := trim(COALESCE(p_device_id, ''));
BEGIN
  SELECT
    status,
    (COALESCE(ocultar_nomes_escala, false) OR COALESCE((termos->>'ocultarNomesEscala')::boolean, false))
  INTO v_status, v_ocultar_nomes
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_status IS NULL OR v_status <> 'ativo' THEN
    RETURN jsonb_build_object(
      'pontos', '[]'::jsonb,
      'turnos', '[]'::jsonb,
      'reservas', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'pontos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'empresa_id', p.empresa_id,
          'nome', p.nome,
          'ordem', p.ordem,
          'ativo', p.ativo,
          'cabecalho_whatsapp', p.cabecalho_whatsapp,
          'rodape_whatsapp', p.rodape_whatsapp,
          'copia_whatsapp_ativa', p.copia_whatsapp_ativa,
          'created_at', p.created_at
        )
        ORDER BY p.ordem ASC
      )
      FROM public.pontos p
      WHERE p.empresa_id = p_empresa_id
        AND p.ativo = true
    ), '[]'::jsonb),
    'turnos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'empresa_id', t.empresa_id,
          'ponto_id', t.ponto_id,
          'dia', t.dia,
          'horario', t.horario,
          'hora_inicio', t.hora_inicio,
          'hora_fim', t.hora_fim,
          'capacidade', t.capacidade,
          'ordem', t.ordem,
          'created_at', t.created_at
        )
        ORDER BY t.ordem ASC
      )
      FROM public.turnos t
      JOIN public.pontos p ON p.id = t.ponto_id
      WHERE t.empresa_id = p_empresa_id
        AND p.empresa_id = p_empresa_id
        AND p.ativo = true
    ), '[]'::jsonb),
    'reservas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'empresa_id', r.empresa_id,
          'turno_id', r.turno_id,
          'eh_minha', (v_device_limpo <> '' AND r.device_id = v_device_limpo),
          'corretor_nome', CASE
            WHEN v_ocultar_nomes AND NOT (v_device_limpo <> '' AND r.device_id = v_device_limpo)
              THEN 'Reservado'
            ELSE r.corretor_nome
          END,
          'created_at', r.created_at
        )
        ORDER BY r.created_at ASC
      )
      FROM public.reservas r
      JOIN public.turnos t ON t.id = r.turno_id
      JOIN public.pontos p ON p.id = t.ponto_id
      WHERE r.empresa_id = p_empresa_id
        AND p.ativo = true
    ), '[]'::jsonb)
  );
END;
$$;

-- 4.2.3 RPC Pública: verificar_identidade_colaborador (checagem pontual sem listar equipe_corretores)
CREATE OR REPLACE FUNCTION public.verificar_identidade_colaborador(
  p_empresa_id UUID,
  p_whatsapp   TEXT DEFAULT NULL,
  p_email      TEXT DEFAULT NULL,
  p_device_id  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_exigir_cadastro BOOLEAN;
  v_tipo_validacao  TEXT;
  v_zap_limpo       TEXT;
  v_email_limpo     TEXT;
  v_device_limpo    TEXT := trim(COALESCE(p_device_id, ''));
  v_membro          RECORD;
  v_tem_equipe      BOOLEAN := false;
  v_tem_zap         BOOLEAN := false;
  v_tem_email       BOOLEAN := false;
  v_nome_conflito   TEXT;
BEGIN
  SELECT
    COALESCE(exigir_cadastro_previo, false),
    COALESCE(tipo_validacao_equipe, 'whatsapp')
  INTO v_exigir_cadastro, v_tipo_validacao
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_exigir_cadastro IS NULL THEN
    RETURN jsonb_build_object(
      'autorizado', false,
      'nao_encontrado', true,
      'mensagem_erro', 'Empresa não encontrada.'
    );
  END IF;

  v_zap_limpo := regexp_replace(COALESCE(p_whatsapp, ''), '[^0-9]', '', 'g');
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;
  v_email_limpo := lower(trim(COALESCE(p_email, '')));

  IF v_exigir_cadastro THEN
    SELECT EXISTS (
      SELECT 1 FROM public.equipe_corretores
      WHERE empresa_id = p_empresa_id AND ativo = true
    ) INTO v_tem_equipe;

    IF NOT v_tem_equipe THEN
      RETURN jsonb_build_object(
        'autorizado', false,
        'nao_encontrado', true,
        'mensagem_erro', 'Nenhum colaborador autorizado foi cadastrado na coordenação ainda.'
      );
    END IF;

    IF v_tipo_validacao = 'whatsapp' THEN
      SELECT id, nome, device_id INTO v_membro
      FROM public.equipe_corretores
      WHERE empresa_id = p_empresa_id
        AND ativo = true
        AND v_zap_limpo <> ''
        AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      LIMIT 1;
    ELSIF v_tipo_validacao = 'email' THEN
      SELECT id, nome, device_id INTO v_membro
      FROM public.equipe_corretores
      WHERE empresa_id = p_empresa_id
        AND ativo = true
        AND v_email_limpo <> ''
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;
    ELSIF v_tipo_validacao = 'ambos' THEN
      SELECT id, nome, device_id INTO v_membro
      FROM public.equipe_corretores
      WHERE empresa_id = p_empresa_id
        AND ativo = true
        AND v_zap_limpo <> ''
        AND v_email_limpo <> ''
        AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;
    END IF;

    IF v_membro.id IS NOT NULL THEN
      IF v_membro.device_id IS NOT NULL AND v_device_limpo <> '' AND v_membro.device_id <> v_device_limpo THEN
        RETURN jsonb_build_object(
          'autorizado', false,
          'nao_encontrado', true,
          'dispositivo_diferente', true,
          'mensagem_erro', 'Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular. Por segurança contra uso indevido, cada colaborador deve acessar exclusivamente pelo seu próprio aparelho.'
        );
      END IF;

      RETURN jsonb_build_object(
        'autorizado', true,
        'nome_oficial', v_membro.nome,
        'nao_encontrado', false,
        'dispositivo_diferente', false,
        'mensagem_erro', NULL
      );
    END IF;

    IF v_tipo_validacao = 'email' THEN
      RETURN jsonb_build_object(
        'autorizado', false,
        'nao_encontrado', true,
        'mensagem_erro', 'Este e-mail corporativo não consta na equipe autorizada.'
      );
    ELSIF v_tipo_validacao = 'ambos' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.equipe_corretores
        WHERE empresa_id = p_empresa_id AND ativo = true AND v_zap_limpo <> ''
          AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      ) INTO v_tem_zap;

      SELECT EXISTS (
        SELECT 1 FROM public.equipe_corretores
        WHERE empresa_id = p_empresa_id AND ativo = true AND v_email_limpo <> ''
          AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      ) INTO v_tem_email;

      RETURN jsonb_build_object(
        'autorizado', false,
        'nao_encontrado', true,
        'mensagem_erro', CASE
          WHEN v_tem_zap OR v_tem_email THEN 'WhatsApp e E-mail não coincidem com o cadastro oficial da equipe.'
          ELSE 'Dados não encontrados na equipe autorizada.'
        END
      );
    ELSE
      RETURN jsonb_build_object(
        'autorizado', false,
        'nao_encontrado', true,
        'mensagem_erro', 'Este número de WhatsApp não consta na equipe autorizada.'
      );
    END IF;
  END IF;

  IF v_zap_limpo <> '' THEN
    SELECT corretor_nome INTO v_nome_conflito
    FROM public.reservas
    WHERE empresa_id = p_empresa_id
      AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
    LIMIT 1;
  END IF;

  IF v_nome_conflito IS NULL AND v_email_limpo <> '' THEN
    SELECT corretor_nome INTO v_nome_conflito
    FROM public.reservas
    WHERE empresa_id = p_empresa_id
      AND lower(trim(COALESCE(corretor_email, ''))) = v_email_limpo
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'autorizado', false,
    'nao_encontrado', false,
    'nome_existente_reservas', v_nome_conflito
  );
END;
$$;

-- 4.3 RPC: desvincular_aparelho_corretor (liberar celular para novo aparelho)
CREATE OR REPLACE FUNCTION public.desvincular_aparelho_corretor(
  p_corretor_id UUID,
  p_empresa_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
  END IF;

  UPDATE public.equipe_corretores
  SET device_id = NULL
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- 4.4 RPC: limpar_escala (restrita estritamente a administradores autenticados)
CREATE OR REPLACE FUNCTION public.limpar_escala(
  p_empresa_id UUID,
  p_ponto_id   UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores autenticados podem limpar a escala.';
  END IF;

  IF p_ponto_id IS NOT NULL THEN
    DELETE FROM public.reservas
    WHERE empresa_id = p_empresa_id
      AND turno_id IN (
        SELECT id FROM public.turnos WHERE ponto_id = p_ponto_id AND empresa_id = p_empresa_id
      );
  ELSE
    DELETE FROM public.reservas
    WHERE empresa_id = p_empresa_id;
  END IF;
END;
$$;

-- 4.5 RPC: criar_nova_empresa (onboarding self-service com slug único e sem PIN)
DROP FUNCTION IF EXISTS public.criar_nova_empresa(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.criar_nova_empresa(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.criar_nova_empresa(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.criar_nova_empresa(
  p_nome   TEXT,
  p_slug   TEXT DEFAULT NULL,
  p_termos JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_empresa_id    UUID;
  v_slug_base     TEXT;
  v_slug_final    TEXT;
  v_contador      INT := 1;
  v_codigo_seguro TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Apenas usuários autenticados podem criar uma nova empresa.';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Informe o nome da empresa ou imobiliária.';
  END IF;

  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    v_slug_base := lower(regexp_replace(
      translate(trim(p_nome), 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9_-]', '', 'g'
    ));
  ELSE
    v_slug_base := lower(regexp_replace(
      translate(trim(p_slug), 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9_-]', '', 'g'
    ));
  END IF;

  IF v_slug_base = '' THEN
    v_slug_base := 'empresa';
  END IF;

  v_slug_final := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_final) LOOP
    v_contador := v_contador + 1;
    v_slug_final := v_slug_base || '-' || v_contador::text;
  END LOOP;

  v_codigo_seguro := public.gerar_codigo_escala();

  INSERT INTO public.empresas (
    nome,
    slug,
    codigo_escala,
    status,
    plano,
    termos
  )
  VALUES (
    trim(p_nome),
    v_slug_final,
    v_codigo_seguro,
    'ativo',
    'trial',
    COALESCE(p_termos, '{}'::jsonb)
  )
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
  VALUES (v_user_id, v_empresa_id, 'admin', true)
  ON CONFLICT (user_id, empresa_id) DO UPDATE
  SET role = 'admin', ativo = true;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'id', v_empresa_id,
    'nome', trim(p_nome),
    'slug', v_slug_final,
    'codigo_escala', v_codigo_seguro,
    'mensagem', 'Empresa criada com sucesso!'
  );
END;
$$;

-- ============================================================
-- 5. FUNÇÕES DE GESTÃO E EQUIPE
-- ============================================================

-- 5.2 Vincular usuário a uma empresa por e-mail (com suporte a pré-convite)
CREATE OR REPLACE FUNCTION public.vincular_usuario_empresa(
  p_email TEXT,
  p_empresa_id UUID,
  p_role TEXT DEFAULT 'gestor'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email_limpo TEXT := lower(trim(p_email));
  v_resultado JSONB;
BEGIN
  IF NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Você não tem permissão para adicionar membros a esta empresa.';
  END IF;

  IF p_role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Papel inválido. Escolha admin ou gestor.';
  END IF;

  SELECT id INTO v_user_id
  FROM public.perfis
  WHERE lower(email) = v_email_limpo;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (v_user_id, p_empresa_id, p_role, true)
    ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET role = EXCLUDED.role, ativo = true;

    DELETE FROM public.convites_gestores 
    WHERE empresa_id = p_empresa_id AND lower(email) = v_email_limpo;

    RETURN json_build_object(
      'status', 'vinculado',
      'user_id', v_user_id,
      'empresa_id', p_empresa_id,
      'role', p_role,
      'ativo', true
    )::jsonb;
  ELSE
    INSERT INTO public.convites_gestores (empresa_id, email, role)
    VALUES (p_empresa_id, v_email_limpo, p_role)
    ON CONFLICT (empresa_id, email) DO UPDATE
    SET role = EXCLUDED.role;

    RETURN json_build_object(
      'status', 'convidado',
      'email', v_email_limpo,
      'empresa_id', p_empresa_id,
      'role', p_role
    )::jsonb;
  END IF;
END;
$$;

-- 5.3 Desvincular usuário de uma empresa
CREATE OR REPLACE FUNCTION public.desvincular_usuario_empresa(
  p_user_id UUID,
  p_empresa_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Você não tem permissão para remover membros desta empresa.';
  END IF;

  DELETE FROM public.usuarios_empresas
  WHERE user_id = p_user_id AND empresa_id = p_empresa_id;

  RETURN FOUND;
END;
$$;

-- 5.4 Listar Gestores, Coordenadores e Convites Pendentes de uma Empresa
DROP FUNCTION IF EXISTS public.get_gestores_empresa(UUID);

CREATE OR REPLACE FUNCTION public.get_gestores_empresa(p_empresa_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  nome TEXT,
  role TEXT,
  ativo BOOLEAN,
  pendente BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem visualizar a lista de gestores.';
  END IF;

  RETURN QUERY
  SELECT 
    ue.id,
    ue.user_id,
    p.email,
    COALESCE(p.nome, split_part(p.email, '@', 1)) AS nome,
    ue.role,
    ue.ativo,
    false AS pendente,
    ue.created_at
  FROM public.usuarios_empresas ue
  JOIN public.perfis p ON p.id = ue.user_id
  WHERE ue.empresa_id = p_empresa_id

  UNION ALL

  SELECT
    cg.id,
    NULL::UUID AS user_id,
    cg.email,
    split_part(cg.email, '@', 1) AS nome,
    cg.role,
    true AS ativo,
    true AS pendente,
    cg.created_at
  FROM public.convites_gestores cg
  WHERE cg.empresa_id = p_empresa_id

  ORDER BY created_at ASC;
END;
$$;

-- 5.5 Cancelar convite pendente
CREATE OR REPLACE FUNCTION public.cancelar_convite_gestor(
  p_convite_id UUID,
  p_empresa_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Você não tem permissão para remover convites desta empresa.';
  END IF;

  DELETE FROM public.convites_gestores
  WHERE id = p_convite_id AND empresa_id = p_empresa_id;

  RETURN FOUND;
END;
$$;

-- 5.5 Métricas agregadas de consumo das empresas do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_metricas_empresas()
RETURNS TABLE (
  empresa_id UUID,
  total_pontos_ativos BIGINT,
  total_turnos BIGINT,
  total_reservas BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    e.id AS empresa_id,
    COALESCE(p.total_pontos, 0)::BIGINT AS total_pontos_ativos,
    COALESCE(t.total_turnos, 0)::BIGINT AS total_turnos,
    COALESCE(r.total_reservas, 0)::BIGINT AS total_reservas
  FROM public.empresas e
  LEFT JOIN (
    SELECT empresa_id, COUNT(*) AS total_pontos
    FROM public.pontos
    WHERE ativo = true
    GROUP BY empresa_id
  ) p ON p.empresa_id = e.id
  LEFT JOIN (
    SELECT empresa_id, COUNT(*) AS total_turnos
    FROM public.turnos
    GROUP BY empresa_id
  ) t ON t.empresa_id = e.id
  LEFT JOIN (
    SELECT empresa_id, COUNT(*) AS total_reservas
    FROM public.reservas
    GROUP BY empresa_id
  ) r ON r.empresa_id = e.id
  WHERE auth.uid() IS NOT NULL
    AND public.has_empresa_role(e.id, ARRAY['admin', 'gestor']);
$$;

-- 5.5 Gestão da Equipe Autorizada de Corretores (Proteção contra invasores)
CREATE OR REPLACE FUNCTION public.alternar_protecao_equipe(
  p_empresa_id UUID,
  p_exigir     BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a política de acesso.';
  END IF;

  UPDATE public.empresas
  SET exigir_cadastro_previo = p_exigir
  WHERE id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- 5.6 Redefinição de Link Seguro da Escala (Anti-Espionagem)
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
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Apenas administradores podem redefinir o link seguro da escala.';
  END IF;

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

  UPDATE public.empresas
  SET codigo_escala = v_novo_codigo
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  RETURN v_novo_codigo;
END;
$$;

-- 5.7 Política de Validação da Equipe (WhatsApp, E-mail ou Ambos)
CREATE OR REPLACE FUNCTION public.alternar_tipo_validacao_equipe(
  p_empresa_id     UUID,
  p_tipo_validacao TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a política de identificação da equipe.';
  END IF;

  IF p_tipo_validacao NOT IN ('whatsapp', 'email', 'ambos') THEN
    RAISE EXCEPTION 'Tipo de validação inválido. Escolha "whatsapp", "email" ou "ambos".';
  END IF;

  UPDATE public.empresas
  SET tipo_validacao_equipe = p_tipo_validacao
  WHERE id = p_empresa_id;

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.adicionar_corretor_equipe(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.adicionar_corretor_equipe(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.adicionar_corretor_equipe(
  p_empresa_id UUID,
  p_nome       TEXT,
  p_whatsapp   TEXT DEFAULT NULL,
  p_email      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zap_limpo      TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_email_limpo    TEXT := lower(trim(COALESCE(p_email, '')));
  v_nome_existente TEXT;
  v_tipo_validacao TEXT;
  v_novo           RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'O nome completo do colaborador é obrigatório.';
  END IF;

  SELECT COALESCE(tipo_validacao_equipe, 'whatsapp')
  INTO v_tipo_validacao
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  IF v_tipo_validacao = 'whatsapp' THEN
    IF length(v_zap_limpo) < 10 THEN
      RAISE EXCEPTION 'WhatsApp inválido. Informe o número com DDD.';
    END IF;
  ELSIF v_tipo_validacao = 'email' THEN
    IF v_email_limpo = '' OR v_email_limpo NOT LIKE '%_@__%.__%' THEN
      RAISE EXCEPTION 'E-mail corporativo inválido. Informe um endereço válido.';
    END IF;
  ELSIF v_tipo_validacao = 'ambos' THEN
    IF length(v_zap_limpo) < 10 THEN
      RAISE EXCEPTION 'WhatsApp obrigatório. Informe o número com DDD.';
    END IF;
    IF v_email_limpo = '' OR v_email_limpo NOT LIKE '%_@__%.__%' THEN
      RAISE EXCEPTION 'E-mail corporativo obrigatório. Informe um endereço válido.';
    END IF;
  ELSE
    IF length(v_zap_limpo) < 10 AND (v_email_limpo = '' OR v_email_limpo NOT LIKE '%_@__%.__%') THEN
      RAISE EXCEPTION 'Informe um WhatsApp ou E-mail válido para cadastrar o colaborador.';
    END IF;
  END IF;

  IF length(v_zap_limpo) >= 10 THEN
    SELECT nome INTO v_nome_existente
    FROM public.equipe_corretores
    WHERE empresa_id = p_empresa_id
      AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
    LIMIT 1;

    IF v_nome_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Este WhatsApp já está cadastrado para o colaborador "%". Cada membro deve ter um número único.', v_nome_existente;
    END IF;
  END IF;

  IF v_email_limpo <> '' THEN
    SELECT nome INTO v_nome_existente
    FROM public.equipe_corretores
    WHERE empresa_id = p_empresa_id
      AND lower(trim(COALESCE(email, ''))) = v_email_limpo
    LIMIT 1;

    IF v_nome_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Este e-mail já está cadastrado para o colaborador "%". Cada membro deve ter um e-mail único.', v_nome_existente;
    END IF;
  END IF;

  INSERT INTO public.equipe_corretores (
    empresa_id,
    nome,
    whatsapp,
    email,
    ativo
  ) VALUES (
    p_empresa_id,
    trim(p_nome),
    NULLIF(trim(COALESCE(p_whatsapp, '')), ''),
    NULLIF(v_email_limpo, ''),
    true
  )
  RETURNING * INTO v_novo;

  RETURN to_jsonb(v_novo);
END;
$$;

CREATE OR REPLACE FUNCTION public.alternar_status_corretor(
  p_corretor_id UUID,
  p_empresa_id  UUID,
  p_ativo       BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
  END IF;

  UPDATE public.equipe_corretores
  SET ativo = p_ativo
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_corretor_equipe(
  p_corretor_id UUID,
  p_empresa_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Apenas administradores podem remover corretores da equipe.';
  END IF;

  DELETE FROM public.equipe_corretores
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_corretor_equipe(
  p_corretor_id UUID,
  p_empresa_id  UUID,
  p_nome        TEXT,
  p_whatsapp    TEXT DEFAULT NULL,
  p_email       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zap_limpo   TEXT;
  v_email_limpo TEXT;
  v_nome_limpo  TEXT;
  v_atualizado  RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
  END IF;

  v_nome_limpo := trim(p_nome);
  IF length(v_nome_limpo) < 2 THEN
    RAISE EXCEPTION 'O nome deve ter pelo menos 2 caracteres.';
  END IF;

  IF p_whatsapp IS NOT NULL AND trim(p_whatsapp) <> '' THEN
    v_zap_limpo := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
    IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
      v_zap_limpo := substr(v_zap_limpo, 3);
    END IF;
    IF length(v_zap_limpo) < 10 OR length(v_zap_limpo) > 11 THEN
      RAISE EXCEPTION 'WhatsApp inválido. Digite o DDD e o número (10 ou 11 dígitos).';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.equipe_corretores
      WHERE empresa_id = p_empresa_id
        AND id <> p_corretor_id
        AND regexp_replace(regexp_replace(whatsapp, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
    ) THEN
      RAISE EXCEPTION 'Este número de WhatsApp já está cadastrado para outro colaborador nesta empresa.';
    END IF;
  ELSE
    v_zap_limpo := NULL;
  END IF;

  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    v_email_limpo := lower(trim(p_email));
    IF length(v_email_limpo) < 5 OR v_email_limpo NOT LIKE '%@%.%' THEN
      RAISE EXCEPTION 'E-mail corporativo inválido.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.equipe_corretores
      WHERE empresa_id = p_empresa_id
        AND id <> p_corretor_id
        AND lower(trim(email)) = v_email_limpo
    ) THEN
      RAISE EXCEPTION 'Este e-mail corporativo já está cadastrado para outro colaborador nesta empresa.';
    END IF;
  ELSE
    v_email_limpo := NULL;
  END IF;

  UPDATE public.equipe_corretores
  SET
    nome = v_nome_limpo,
    whatsapp = CASE 
      WHEN v_zap_limpo IS NOT NULL THEN trim(p_whatsapp) 
      ELSE NULL 
    END,
    email = v_email_limpo
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id
  RETURNING * INTO v_atualizado;

  IF v_atualizado.id IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado.';
  END IF;

  RETURN to_jsonb(v_atualizado);
END;
$$;

-- ============================================================
-- 6. INTEGRAÇÃO PILOTO AUTOMÁTICO ASAAS
-- ============================================================

-- 6.1 RPC: Provisionamento automático acionado via Webhook do Asaas
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
BEGIN
  v_slug_limpo := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9_-]', '', 'g'));
  IF length(v_slug_limpo) < 2 THEN
    v_slug_limpo := 'imobiliaria-' || substr(md5(random()::text), 1, 6);
  END IF;

  v_slug_final := v_slug_limpo;
  WHILE EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_final) LOOP
    v_contador := v_contador + 1;
    v_slug_final := v_slug_limpo || '-' || v_contador::text;
  END LOOP;

  INSERT INTO public.empresas (
    nome,
    slug,
    codigo_escala,
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
    public.gerar_codigo_escala(),
    COALESCE(p_plano, 'pro'),
    'ativo',
    p_asaas_customer_id,
    p_asaas_subscription_id,
    p_email_cobranca,
    p_telefone_cobranca
  )
  RETURNING * INTO v_nova_empresa;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (p_user_id, v_nova_empresa.id, 'admin', true)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = 'admin', ativo = true;
  END IF;

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

-- 6.2 RPC: Atualização de status da empresa pelo Asaas (bloqueio por inadimplência ou reativação)
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

-- ============================================================
-- 7. CONFIGURAÇÕES DE REALTIME (REPLICA IDENTITY & PUBLICATION)
-- ============================================================

-- Replica Identity FULL garante que payloads de DELETE e UPDATE contenham todas as colunas
ALTER TABLE public.empresas REPLICA IDENTITY FULL;
ALTER TABLE public.pontos REPLICA IDENTITY FULL;
ALTER TABLE public.turnos REPLICA IDENTITY FULL;
ALTER TABLE public.reservas REPLICA IDENTITY FULL;
ALTER TABLE public.perfis REPLICA IDENTITY FULL;
ALTER TABLE public.usuarios_empresas REPLICA IDENTITY FULL;
ALTER TABLE public.equipe_corretores REPLICA IDENTITY FULL;
ALTER TABLE public.escala_sync REPLICA IDENTITY FULL;

-- Publicação Realtime idempotente (não gera erro caso já pertença à publicação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'empresas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.empresas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pontos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pontos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'turnos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.turnos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'perfis'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.perfis;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'usuarios_empresas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios_empresas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'equipe_corretores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe_corretores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'escala_sync'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_sync;
  END IF;
END $$;

-- Trigger de sincronização automática da tabela não-sensível escala_sync
CREATE OR REPLACE FUNCTION public.fn_sync_escala_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'empresas' THEN
    v_empresa_id := NEW.id;
  ELSE
    v_empresa_id := COALESCE(NEW.empresa_id, OLD.empresa_id);
  END IF;

  IF v_empresa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.empresas WHERE id = v_empresa_id) THEN
    INSERT INTO public.escala_sync (empresa_id, updated_at)
    VALUES (v_empresa_id, now())
    ON CONFLICT (empresa_id) DO UPDATE
    SET updated_at = now();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_escala_empresas ON public.empresas;
CREATE TRIGGER trg_sync_escala_empresas
  AFTER INSERT OR UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_escala_empresa();

DROP TRIGGER IF EXISTS trg_sync_escala_pontos ON public.pontos;
CREATE TRIGGER trg_sync_escala_pontos
  AFTER INSERT OR UPDATE OR DELETE ON public.pontos
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_escala_empresa();

DROP TRIGGER IF EXISTS trg_sync_escala_turnos ON public.turnos;
CREATE TRIGGER trg_sync_escala_turnos
  AFTER INSERT OR UPDATE OR DELETE ON public.turnos
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_escala_empresa();

DROP TRIGGER IF EXISTS trg_sync_escala_reservas ON public.reservas;
CREATE TRIGGER trg_sync_escala_reservas
  AFTER INSERT OR UPDATE OR DELETE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_escala_empresa();

-- 4.19 RPC: atualizar_termos_empresa (Fase 5 - Vocabulário & Nicho Dinâmico)
CREATE OR REPLACE FUNCTION public.atualizar_termos_empresa(
    p_empresa_id UUID,
    p_termos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
        RAISE EXCEPTION 'Acesso negado para atualizar os termos desta empresa.';
    END IF;

    UPDATE public.empresas
    SET termos = COALESCE(p_termos, '{}'::jsonb)
    WHERE id = p_empresa_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'mensagem', 'Termos atualizados com sucesso.',
        'termos', p_termos
    );
END;
$$;

-- 4.20 RPC: atualizar_whatsapp_ponto (Fase 10 - Customização WhatsApp Ponto)
CREATE OR REPLACE FUNCTION public.atualizar_whatsapp_ponto(
  p_ponto_id   UUID,
  p_empresa_id UUID,
  p_cabecalho  TEXT DEFAULT NULL,
  p_rodape     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ponto RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
  END IF;

  UPDATE public.pontos
  SET
    cabecalho_whatsapp = NULLIF(trim(p_cabecalho), ''),
    rodape_whatsapp = NULLIF(trim(p_rodape), '')
  WHERE id = p_ponto_id AND empresa_id = p_empresa_id
  RETURNING * INTO v_ponto;

  IF v_ponto.id IS NULL THEN
    RAISE EXCEPTION 'Ponto de captação não encontrado.';
  END IF;

  RETURN to_jsonb(v_ponto);
END;
$$;

-- 4.21 RPC: atualizar_whatsapp_empresa (Fase 10 - Customização WhatsApp Escala Completa)
CREATE OR REPLACE FUNCTION public.atualizar_whatsapp_empresa(
  p_empresa_id UUID,
  p_cabecalho  TEXT DEFAULT NULL,
  p_rodape     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
  END IF;

  UPDATE public.empresas
  SET
    msg_whatsapp_geral = NULLIF(trim(p_cabecalho), ''),
    rodape_whatsapp_geral = NULLIF(trim(p_rodape), '')
  WHERE id = p_empresa_id
  RETURNING * INTO v_empresa;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  RETURN to_jsonb(v_empresa);
END;
$$;

-- 4.22 RPC: atualizar_regras_escala (Fase 15 - Bloqueio de Conflito de Horário e Cotas Anti-Monopólio)
DROP FUNCTION IF EXISTS public.atualizar_regras_escala(UUID, BOOLEAN, INT, INT, INT);
DROP FUNCTION IF EXISTS public.atualizar_regras_escala(UUID, BOOLEAN, INT, INT, INT, UUID[]);

CREATE OR REPLACE FUNCTION public.atualizar_regras_escala(
  p_empresa_id        UUID,
  p_bloquear_conflito BOOLEAN,
  p_limite_semana     INT DEFAULT NULL,
  p_limite_dia        INT DEFAULT NULL,
  p_limite_ponto      INT DEFAULT NULL,
  p_cotas_pontos_ids  UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa          RECORD;
  v_pontos_filtrados UUID[] := NULL;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores autenticados podem alterar as regras da escala.';
  END IF;

  IF p_limite_semana IS NOT NULL AND p_limite_semana < 1 THEN
    RAISE EXCEPTION 'O limite semanal deve ser de pelo menos 1 vaga (ou nulo para ilimitado).';
  END IF;

  IF p_limite_dia IS NOT NULL AND p_limite_dia < 1 THEN
    RAISE EXCEPTION 'O limite diário deve ser de pelo menos 1 vaga (ou nulo para ilimitado).';
  END IF;

  IF p_limite_ponto IS NOT NULL AND p_limite_ponto < 1 THEN
    RAISE EXCEPTION 'O limite por local deve ser de pelo menos 1 vaga (ou nulo para ilimitado).';
  END IF;

  IF p_cotas_pontos_ids IS NOT NULL THEN
    SELECT array_agg(id ORDER BY ordem ASC)
    INTO v_pontos_filtrados
    FROM public.pontos
    WHERE empresa_id = p_empresa_id
      AND id = ANY(p_cotas_pontos_ids);

    IF v_pontos_filtrados IS NULL OR cardinality(v_pontos_filtrados) = 0 THEN
      RAISE EXCEPTION 'Selecione pelo menos um ponto válido ou escolha "Todos os pontos".';
    END IF;
  END IF;

  UPDATE public.empresas
  SET
    bloquear_conflito_horario = COALESCE(p_bloquear_conflito, false),
    limite_vagas_semana       = p_limite_semana,
    limite_vagas_dia          = p_limite_dia,
    limite_vagas_ponto        = p_limite_ponto,
    cotas_pontos_ids          = v_pontos_filtrados
  WHERE id = p_empresa_id
  RETURNING * INTO v_empresa;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  RETURN to_jsonb(v_empresa);
END;
$$;

-- ============================================================
-- 8. PERMISSÕES E PRIVILÉGIOS GRANULARES (GRANTS / REVOKES)
-- ============================================================

REVOKE ALL ON TABLE
  public.empresas,
  public.perfis,
  public.usuarios_empresas,
  public.convites_gestores,
  public.pontos,
  public.turnos,
  public.reservas,
  public.equipe_corretores,
  public.asaas_webhooks_log,
  public.escala_sync
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.gerar_codigo_escala() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalizar_dia_semana(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extrair_horarios_turno(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_turnos_preencher_horas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_escala_empresa() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_superadmin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_empresa_role(UUID, TEXT[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_minhas_empresas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_nova_empresa(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_empresa_publica(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_escala_publica(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verificar_identidade_colaborador(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_vaga(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limpar_escala(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alternar_protecao_equipe(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redefinir_codigo_escala(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alternar_tipo_validacao_equipe(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adicionar_corretor_equipe(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.editar_corretor_equipe(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alternar_status_corretor(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desvincular_aparelho_corretor(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remover_corretor_equipe(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_termos_empresa(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_whatsapp_ponto(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_whatsapp_empresa(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_regras_escala(UUID, BOOLEAN, INT, INT, INT, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vincular_usuario_empresa(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desvincular_usuario_empresa(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_gestores_empresa(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_convite_gestor(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_metricas_empresas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provisionar_empresa_asaas(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_status_empresa_asaas(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.escala_sync TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_empresa_publica(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_escala_publica(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verificar_identidade_colaborador(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_vaga(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.empresas,
  public.perfis,
  public.usuarios_empresas,
  public.convites_gestores,
  public.pontos,
  public.turnos,
  public.reservas,
  public.equipe_corretores
TO authenticated;

GRANT EXECUTE ON FUNCTION public.gerar_codigo_escala() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalizar_dia_semana(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extrair_horarios_turno(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_superadmin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_empresa_role(UUID, TEXT[], UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_minhas_empresas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.criar_nova_empresa(TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.limpar_escala(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.alternar_protecao_equipe(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redefinir_codigo_escala(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.alternar_tipo_validacao_equipe(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adicionar_corretor_equipe(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editar_corretor_equipe(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.alternar_status_corretor(UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.desvincular_aparelho_corretor(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remover_corretor_equipe(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_termos_empresa(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_whatsapp_ponto(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_whatsapp_empresa(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_regras_escala(UUID, BOOLEAN, INT, INT, INT, UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vincular_usuario_empresa(TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.desvincular_usuario_empresa(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gestores_empresa(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_convite_gestor(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_metricas_empresas() TO authenticated, service_role;

GRANT ALL ON TABLE
  public.empresas,
  public.perfis,
  public.usuarios_empresas,
  public.convites_gestores,
  public.pontos,
  public.turnos,
  public.reservas,
  public.equipe_corretores,
  public.asaas_webhooks_log,
  public.escala_sync
TO service_role;

GRANT EXECUTE ON FUNCTION public.provisionar_empresa_asaas(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_status_empresa_asaas(TEXT, TEXT, TEXT) TO service_role;
