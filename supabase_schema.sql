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
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,
  codigo_escala          TEXT NOT NULL UNIQUE DEFAULT public.gerar_codigo_escala(),
  logo_url               TEXT,
  cor_primaria           TEXT NOT NULL DEFAULT '#3b82f6',
  admin_pin              TEXT NOT NULL DEFAULT '1234',
  plano                  TEXT NOT NULL DEFAULT 'trial',
  status                 TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'inativo', 'bloqueado'
  exigir_cadastro_previo BOOLEAN NOT NULL DEFAULT false,
  asaas_customer_id      TEXT,
  asaas_subscription_id  TEXT,
  asaas_payment_id       TEXT,
  email_cobranca         TEXT,
  telefone_cobranca      TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_slug ON public.empresas(lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo_escala ON public.empresas(codigo_escala);
CREATE INDEX IF NOT EXISTS idx_empresas_asaas_customer ON public.empresas(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_empresas_asaas_subscription ON public.empresas(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_empresas_status ON public.empresas(status);

-- Inserção da empresa demonstrativa padrão
INSERT INTO public.empresas (nome, slug, admin_pin, plano, status)
VALUES ('Minha Imobiliária', 'demo', '1234', 'ilimitado', 'ativo')
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
  ordem      INT  NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pontos_empresa_id ON public.pontos(empresa_id);

-- 1.5 Tabela de turnos (vinculados ao ponto e à empresa)
CREATE TABLE IF NOT EXISTS public.turnos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ponto_id   UUID NOT NULL REFERENCES public.pontos(id) ON DELETE CASCADE,
  dia        TEXT NOT NULL,          -- ex: 'SEGUNDA-FEIRA', 'SÁBADO'
  horario    TEXT NOT NULL,          -- ex: '08:00 às 12:00'
  capacidade INT  NOT NULL DEFAULT 1,
  ordem      INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turnos_empresa_id ON public.turnos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_turnos_ponto_id ON public.turnos(ponto_id);

-- 1.6 Tabela de reservas (vinculadas ao turno e à empresa)
CREATE TABLE IF NOT EXISTS public.reservas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  turno_id          UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  corretor_nome     TEXT NOT NULL,
  corretor_whatsapp TEXT,
  device_id         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_empresa_id ON public.reservas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_turno_id ON public.reservas(turno_id);

-- 1.7 Tabela de corretores autorizados da imobiliária (Equipe)
CREATE TABLE IF NOT EXISTS public.equipe_corretores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  whatsapp    TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipe_corretores_empresa ON public.equipe_corretores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_whatsapp ON public.equipe_corretores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_ativo ON public.equipe_corretores(empresa_id, ativo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipe_corretores_empresa_zap_clean ON public.equipe_corretores (empresa_id, (regexp_replace(whatsapp, '[^0-9]', '', 'g')));

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

-- 2.1 Verifica se o usuário atual é Superadmin do SaaS
CREATE OR REPLACE FUNCTION public.is_superadmin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM public.perfis WHERE id = p_user_id),
    false
  );
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
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_empresas
    WHERE user_id = p_user_id
      AND empresa_id = p_empresa_id
      AND role = ANY(p_roles)
      AND ativo = true
  ) OR public.is_superadmin(p_user_id);
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
  v_is_super BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_is_super := public.is_superadmin(v_user_id);

  IF v_is_super THEN
    RETURN QUERY
    SELECT 
      e.id AS empresa_id,
      e.nome AS empresa_nome,
      e.slug AS empresa_slug,
      e.status AS empresa_status,
      'admin'::TEXT AS role,
      true AS is_superadmin
    FROM public.empresas e
    ORDER BY e.nome ASC;
  ELSE
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
  END IF;
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
  v_count_usuarios INT;
BEGIN
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    split_part(NEW.email, '@', 1)
  );

  SELECT COUNT(*) INTO v_count_usuarios FROM public.perfis;

  INSERT INTO public.perfis (id, email, nome, is_superadmin)
  VALUES (
    NEW.id,
    NEW.email,
    v_nome,
    (v_count_usuarios = 0) -- O primeiro usuário do banco torna-se Superadmin do SaaS
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(public.perfis.nome, EXCLUDED.nome);

  -- Converte convites pendentes deste e-mail em vínculos reais de gestor
  INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
  SELECT NEW.id, cg.empresa_id, cg.role, true
  FROM public.convites_gestores cg
  WHERE lower(cg.email) = lower(trim(NEW.email))
  ON CONFLICT (user_id, empresa_id) DO UPDATE
  SET role = EXCLUDED.role, ativo = true;

  DELETE FROM public.convites_gestores
  WHERE lower(email) = lower(trim(NEW.email));

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

-- Garante que se houver pelo menos um usuário e nenhum superadmin, o primeiro seja superadmin
DO $$
DECLARE
  v_primeiro_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE is_superadmin = true) THEN
    SELECT id INTO v_primeiro_id FROM public.perfis ORDER BY created_at ASC LIMIT 1;
    IF v_primeiro_id IS NOT NULL THEN
      UPDATE public.perfis SET is_superadmin = true WHERE id = v_primeiro_id;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ============================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_corretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhooks_log ENABLE ROW LEVEL SECURITY;

-- 3.1 PERFIS
DROP POLICY IF EXISTS "perfis_select" ON public.perfis;
CREATE POLICY "perfis_select"
  ON public.perfis FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());

DROP POLICY IF EXISTS "perfis_update" ON public.perfis;
CREATE POLICY "perfis_update"
  ON public.perfis FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_superadmin());

-- 3.2 USUARIOS_EMPRESAS
DROP POLICY IF EXISTS "usuarios_empresas_select" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_select"
  ON public.usuarios_empresas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

DROP POLICY IF EXISTS "usuarios_empresas_insert" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_insert"
  ON public.usuarios_empresas FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

DROP POLICY IF EXISTS "usuarios_empresas_update" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_update"
  ON public.usuarios_empresas FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']))
  WITH CHECK (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

DROP POLICY IF EXISTS "usuarios_empresas_delete" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_delete"
  ON public.usuarios_empresas FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

-- 3.3 EMPRESAS
DROP POLICY IF EXISTS "empresas_select_public" ON public.empresas;
CREATE POLICY "empresas_select_public"
  ON public.empresas FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "empresas_insert_authenticated" ON public.empresas;
CREATE POLICY "empresas_insert_authenticated"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "empresas_update_auth" ON public.empresas;
CREATE POLICY "empresas_update_auth"
  ON public.empresas FOR UPDATE TO authenticated
  USING (public.has_empresa_role(id, ARRAY['admin']))
  WITH CHECK (public.has_empresa_role(id, ARRAY['admin']));

DROP POLICY IF EXISTS "empresas_delete_superadmin" ON public.empresas;
CREATE POLICY "empresas_delete_superadmin"
  ON public.empresas FOR DELETE TO authenticated
  USING (public.is_superadmin());

-- 3.4 PONTOS
DROP POLICY IF EXISTS "pontos_select_public" ON public.pontos;
CREATE POLICY "pontos_select_public"
  ON public.pontos FOR SELECT TO anon, authenticated
  USING (true);

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
CREATE POLICY "turnos_select_public"
  ON public.turnos FOR SELECT TO anon, authenticated
  USING (true);

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
CREATE POLICY "reservas_select_public"
  ON public.reservas FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "reservas_insert_allowed" ON public.reservas;
CREATE POLICY "reservas_insert_allowed"
  ON public.reservas FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "reservas_delete_gestor_or_own" ON public.reservas;
CREATE POLICY "reservas_delete_gestor_or_own"
  ON public.reservas FOR DELETE TO anon, authenticated
  USING (
    public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor'])
    OR device_id IS NOT NULL
  );

-- 3.7 EQUIPE_CORRETORES
DROP POLICY IF EXISTS "equipe_corretores_select" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_select"
  ON public.equipe_corretores FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "equipe_corretores_all_gestores" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_all_gestores"
  ON public.equipe_corretores FOR ALL TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- 3.8 ASAAS_WEBHOOKS_LOG
DROP POLICY IF EXISTS "asaas_webhooks_log_select_superadmin" ON public.asaas_webhooks_log;
CREATE POLICY "asaas_webhooks_log_select_superadmin"
  ON public.asaas_webhooks_log FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- ============================================================
-- 4. RPCS CRÍTICAS DO CORE (PL/PGSQL COM SECURITY DEFINER)
-- ============================================================

-- 4.1 RPC: reservar_vaga (com concorrência FOR UPDATE, WhatsApp, equipe e validação de inadimplência)
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT, TEXT);

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
  v_capacidade      INT;
  v_atual           INT;
  v_empresa_id      UUID;
  v_status          TEXT;
  v_exigir_cadastro BOOLEAN;
  v_zap_limpo       TEXT;
BEGIN
  -- 1. Trava o turno contra concorrência simultânea (Race Condition)
  SELECT capacidade, empresa_id INTO v_capacidade, v_empresa_id
  FROM public.turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
  END IF;

  -- 2. Valida o status da empresa (Bloqueio por inadimplência ou inatividade)
  SELECT status, COALESCE(exigir_cadastro_previo, false) 
  INTO v_status, v_exigir_cadastro
  FROM public.empresas
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
      SELECT 1 FROM public.equipe_corretores
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
  FROM public.reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE;
  END IF;

  -- 5. Impede reserva duplicada do mesmo corretor (device_id) no mesmo turno
  IF EXISTS (
    SELECT 1 FROM public.reservas
    WHERE turno_id = p_turno_id AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'Você já possui uma reserva neste turno';
  END IF;

  -- 6. Insere a reserva vinculando automaticamente a empresa e WhatsApp
  INSERT INTO public.reservas (turno_id, corretor_nome, device_id, empresa_id, corretor_whatsapp)
  VALUES (p_turno_id, trim(p_corretor_nome), p_device_id, v_empresa_id, p_corretor_whatsapp);

  RETURN TRUE;
END;
$$;

-- 4.2 RPC: cancelar_vaga
CREATE OR REPLACE FUNCTION public.cancelar_vaga(
  p_reserva_id UUID,
  p_device_id  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  DELETE FROM public.reservas
  WHERE id = p_reserva_id AND device_id = p_device_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- 4.3 RPC: limpar_escala (com checagem de permissão se autenticado)
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
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
      RAISE EXCEPTION 'Acesso negado: Você não possui permissão para limpar a escala desta imobiliária.';
    END IF;
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

-- 4.4 RPC: criar_nova_empresa (onboarding self-service / demo)
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
BEGIN
  v_slug_limpo := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9_-]', '', 'g'));

  IF length(v_slug_limpo) < 2 THEN
    RAISE EXCEPTION 'Slug inválido ou muito curto.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_limpo) THEN
    RAISE EXCEPTION 'Este slug/endereço já está em uso.';
  END IF;

  INSERT INTO public.empresas (nome, slug, admin_pin, plano, status)
  VALUES (trim(p_nome), v_slug_limpo, COALESCE(NULLIF(trim(p_admin_pin), ''), '1234'), 'trial', 'ativo')
  RETURNING * INTO v_nova_empresa;

  -- Se o criador estiver autenticado, vincula-o imediatamente como 'admin' desta nova empresa
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (v_user_id, v_nova_empresa.id, 'admin', true)
    ON CONFLICT (user_id, empresa_id) DO NOTHING;
  END IF;

  -- Cria ponto de captação inicial com turnos de exemplo para a nova empresa
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

-- 4.5 RPC: verificar_admin_pin (por empresa - contingência e compatibilidade)
CREATE OR REPLACE FUNCTION public.verificar_admin_pin(
  p_empresa_id UUID,
  p_pin        TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valido BOOLEAN;
BEGIN
  SELECT (admin_pin = trim(p_pin)) INTO v_valido
  FROM public.empresas
  WHERE id = p_empresa_id AND status = 'ativo';

  RETURN COALESCE(v_valido, FALSE);
END;
$$;

-- 4.6 RPC: alterar_admin_pin (por empresa)
CREATE OR REPLACE FUNCTION public.alterar_admin_pin(
  p_empresa_id UUID,
  p_pin_atual  TEXT,
  p_novo_pin   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(trim(p_novo_pin)) < 4 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = p_empresa_id AND admin_pin = trim(p_pin_atual)
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.empresas
  SET admin_pin = trim(p_novo_pin)
  WHERE id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- 4.7 RPC: vincular_com_pin (auto-vinculação segura com o PIN do tenant)
CREATE OR REPLACE FUNCTION public.vincular_com_pin(
  p_empresa_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pin_correto TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT admin_pin INTO v_pin_correto
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_pin_correto IS NULL THEN
    RAISE EXCEPTION 'Imobiliária não encontrada.';
  END IF;

  IF v_pin_correto <> trim(p_pin) THEN
    RETURN FALSE;
  END IF;

  -- Se o PIN estiver correto, vincula o usuário autenticado como admin
  INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
  VALUES (v_user_id, p_empresa_id, 'admin', true)
  ON CONFLICT (user_id, empresa_id) DO UPDATE
  SET role = 'admin', ativo = true;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 5. FUNÇÕES DE GESTÃO, EQUIPE E SUPERADMIN
-- ============================================================

-- 5.1 Promover usuário a Superadmin do SaaS
CREATE OR REPLACE FUNCTION public.promover_superadmin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() AND EXISTS (SELECT 1 FROM public.perfis WHERE is_superadmin = true) THEN
    RAISE EXCEPTION 'Apenas um Superadmin pode promover outros usuários a Superadmin.';
  END IF;

  UPDATE public.perfis
  SET is_superadmin = true, updated_at = now()
  WHERE lower(email) = lower(trim(p_email));

  RETURN FOUND;
END;
$$;

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
  IF NOT (public.is_superadmin() OR public.has_empresa_role(p_empresa_id, ARRAY['admin'])) THEN
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
  IF NOT (public.is_superadmin() OR public.has_empresa_role(p_empresa_id, ARRAY['admin'])) THEN
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
  IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
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
  IF NOT (public.is_superadmin() OR public.has_empresa_role(p_empresa_id, ARRAY['admin'])) THEN
    RAISE EXCEPTION 'Você não tem permissão para remover convites desta empresa.';
  END IF;

  DELETE FROM public.convites_gestores
  WHERE id = p_convite_id AND empresa_id = p_empresa_id;

  RETURN FOUND;
END;
$$;

-- 5.5 Métricas agregadas de consumo das empresas (Painel Superadmin)
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
  ) r ON r.empresa_id = e.id;
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
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a política de acesso.';
    END IF;
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
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem redefinir o link seguro da escala.';
    END IF;
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

CREATE OR REPLACE FUNCTION public.adicionar_corretor_equipe(
  p_empresa_id UUID,
  p_nome       TEXT,
  p_whatsapp   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo RECORD;
  v_zap_limpo TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_nome_existente TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  IF length(v_zap_limpo) < 10 THEN
    RAISE EXCEPTION 'WhatsApp inválido. Informe o número com DDD.';
  END IF;

  SELECT nome INTO v_nome_existente
  FROM public.equipe_corretores
  WHERE empresa_id = p_empresa_id
    AND regexp_replace(whatsapp, '[^0-9]', '', 'g') = v_zap_limpo
  LIMIT 1;

  IF v_nome_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Este WhatsApp já está cadastrado para o corretor "%".', v_nome_existente;
  END IF;

  INSERT INTO public.equipe_corretores (empresa_id, nome, whatsapp, ativo)
  VALUES (p_empresa_id, trim(p_nome), trim(p_whatsapp), true)
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
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
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
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem remover corretores da equipe.';
    END IF;
  END IF;

  DELETE FROM public.equipe_corretores
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
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
  v_pin_aleatorio TEXT;
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

  v_pin_aleatorio := lpad((floor(random() * 9000 + 1000)::int)::text, 4, '0');

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
    public.gerar_codigo_escala(),
    v_pin_aleatorio,
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
END $$;

-- ============================================================
-- 8. PERMISSÕES E PRIVILÉGIOS (GRANTS)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
