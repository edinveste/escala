-- ============================================================
-- Escala CRM / EscalaFácil — Schema SQL Completo Multi-Tenant B2B
-- Fase 1 (Multi-Tenancy) & Fase 2 (Supabase Auth & RBAC)
-- ============================================================

-- 1. Tabela de empresas (Tenants)
CREATE TABLE IF NOT EXISTS public.empresas (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,
  logo_url               TEXT,
  cor_primaria           TEXT NOT NULL DEFAULT '#3b82f6',
  admin_pin              TEXT NOT NULL DEFAULT '1234',
  plano                  TEXT NOT NULL DEFAULT 'trial',
  status                 TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'inativo', 'bloqueado'
  exigir_cadastro_previo BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_slug ON public.empresas(lower(slug));

-- Empresa padrão demonstrativa
INSERT INTO public.empresas (nome, slug, admin_pin, plano, status)
VALUES ('Minha Imobiliária', 'demo', '1234', 'ilimitado', 'ativo')
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabela de perfis vinculada ao auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.perfis (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  nome           TEXT,
  is_superadmin  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de relação entre Usuários e Empresas (Multi-Tenant Memberships)
CREATE TABLE IF NOT EXISTS public.usuarios_empresas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'gestor' CHECK (role IN ('admin', 'gestor')),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);

-- 4. Tabela de pontos de captação (vinculados à empresa)
CREATE TABLE IF NOT EXISTS public.pontos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,              -- ex: 'Mercado Extra', 'Padaria Di Cunto'
  ordem      INT  NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabela de turnos (vinculados ao ponto e à empresa)
CREATE TABLE IF NOT EXISTS public.turnos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ponto_id   UUID NOT NULL REFERENCES public.pontos(id) ON DELETE CASCADE,
  dia        TEXT NOT NULL,          -- ex: 'SEGUNDA-FEIRA', 'SÁBADO'
  horario    TEXT NOT NULL,          -- ex: '11:30 às 14hrs'
  capacidade INT  NOT NULL DEFAULT 1,
  ordem      INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Tabela de reservas (vinculadas ao turno e à empresa)
CREATE TABLE IF NOT EXISTS public.reservas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  turno_id          UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  corretor_nome     TEXT NOT NULL,
  corretor_whatsapp TEXT,
  device_id         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabela de corretores autorizados da imobiliária (Equipe)
CREATE TABLE IF NOT EXISTS public.equipe_corretores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  whatsapp    TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_perfis_is_superadmin ON public.perfis(is_superadmin);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_user ON public.usuarios_empresas(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_empresa ON public.usuarios_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pontos_empresa_id ON public.pontos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_turnos_empresa_id ON public.turnos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_turnos_ponto_id ON public.turnos(ponto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_empresa_id ON public.reservas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_turno_id ON public.reservas(turno_id);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_empresa ON public.equipe_corretores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_whatsapp ON public.equipe_corretores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_ativo ON public.equipe_corretores(empresa_id, ativo);

-- ============================================================
-- Funções Utilitárias de Segurança (SECURITY DEFINER)
-- ============================================================

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

-- Trigger para auto-criar perfil quando usuário se cadastra no Supabase Auth
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
    (v_count_usuarios = 0)
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(public.perfis.nome, EXCLUDED.nome);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- PERFIS
CREATE POLICY "perfis_select"
  ON public.perfis FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());

CREATE POLICY "perfis_update"
  ON public.perfis FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_superadmin());

-- USUARIOS_EMPRESAS
CREATE POLICY "usuarios_empresas_select"
  ON public.usuarios_empresas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

CREATE POLICY "usuarios_empresas_insert"
  ON public.usuarios_empresas FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

CREATE POLICY "usuarios_empresas_update"
  ON public.usuarios_empresas FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']))
  WITH CHECK (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

CREATE POLICY "usuarios_empresas_delete"
  ON public.usuarios_empresas FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.has_empresa_role(empresa_id, ARRAY['admin']));

-- EMPRESAS
CREATE POLICY "empresas_select_public"
  ON public.empresas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "empresas_insert_authenticated"
  ON public.empresas FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());

CREATE POLICY "empresas_update_auth"
  ON public.empresas FOR UPDATE TO authenticated
  USING (public.has_empresa_role(id, ARRAY['admin']))
  WITH CHECK (public.has_empresa_role(id, ARRAY['admin']));

CREATE POLICY "empresas_delete_superadmin"
  ON public.empresas FOR DELETE TO authenticated USING (public.is_superadmin());

-- PONTOS
CREATE POLICY "pontos_select_public"
  ON public.pontos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "pontos_insert_gestores"
  ON public.pontos FOR INSERT TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

CREATE POLICY "pontos_update_gestores"
  ON public.pontos FOR UPDATE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

CREATE POLICY "pontos_delete_gestores"
  ON public.pontos FOR DELETE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- TURNOS
CREATE POLICY "turnos_select_public"
  ON public.turnos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "turnos_insert_gestores"
  ON public.turnos FOR INSERT TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

CREATE POLICY "turnos_update_gestores"
  ON public.turnos FOR UPDATE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

CREATE POLICY "turnos_delete_gestores"
  ON public.turnos FOR DELETE TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- RESERVAS
CREATE POLICY "reservas_select_public"
  ON public.reservas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "reservas_insert_allowed"
  ON public.reservas FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "reservas_delete_gestor_or_own"
  ON public.reservas FOR DELETE TO anon, authenticated
  USING (
    public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor'])
    OR device_id IS NOT NULL
  );

-- ============================================================
-- RPC: reservar_vaga (com LOCK FOR UPDATE, suporte a WhatsApp e verificação de equipe)
-- ============================================================
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION reservar_vaga(
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
  v_exigir_cadastro BOOLEAN;
  v_zap_limpo TEXT;
BEGIN
  SELECT capacidade, empresa_id INTO v_capacidade, v_empresa_id
  FROM turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
  END IF;

  -- Proteção contra invasores (Equipe de Corretores da Imobiliária)
  SELECT COALESCE(exigir_cadastro_previo, false) INTO v_exigir_cadastro
  FROM empresas
  WHERE id = v_empresa_id;

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

  SELECT COUNT(*) INTO v_atual
  FROM reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM reservas
    WHERE turno_id = p_turno_id AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'Você já possui uma reserva neste turno';
  END IF;

  INSERT INTO reservas (turno_id, corretor_nome, device_id, empresa_id, corretor_whatsapp)
  VALUES (p_turno_id, trim(p_corretor_nome), p_device_id, v_empresa_id, p_corretor_whatsapp);

  RETURN TRUE;
END;
$$;

-- ============================================================
-- RPC: cancelar_vaga
-- ============================================================
CREATE OR REPLACE FUNCTION cancelar_vaga(
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
  DELETE FROM reservas
  WHERE id = p_reserva_id AND device_id = p_device_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ============================================================
-- RPC: limpar_escala (com checagem de permissão se autenticado)
-- ============================================================
CREATE OR REPLACE FUNCTION limpar_escala(
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
    DELETE FROM reservas
    WHERE empresa_id = p_empresa_id
      AND turno_id IN (
        SELECT id FROM turnos WHERE ponto_id = p_ponto_id AND empresa_id = p_empresa_id
      );
  ELSE
    DELETE FROM reservas
    WHERE empresa_id = p_empresa_id;
  END IF;
END;
$$;

-- ============================================================
-- RPC: criar_nova_empresa (onboarding self-service / demo)
-- ============================================================
CREATE OR REPLACE FUNCTION criar_nova_empresa(
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
BEGIN
  v_slug_limpo := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9_-]', '', 'g'));

  IF length(v_slug_limpo) < 2 THEN
    RAISE EXCEPTION 'Slug inválido ou muito curto.';
  END IF;

  IF EXISTS (SELECT 1 FROM empresas WHERE slug = v_slug_limpo) THEN
    RAISE EXCEPTION 'Este slug/endereço já está em uso.';
  END IF;

  INSERT INTO empresas (nome, slug, admin_pin, plano, status)
  VALUES (trim(p_nome), v_slug_limpo, COALESCE(NULLIF(trim(p_admin_pin), ''), '1234'), 'trial', 'ativo')
  RETURNING * INTO v_nova_empresa;

  -- Se o criador estiver autenticado, vincula-o imediatamente como 'admin' desta nova empresa
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
    VALUES (v_user_id, v_nova_empresa.id, 'admin', true)
    ON CONFLICT (user_id, empresa_id) DO NOTHING;
  END IF;

  RETURN to_jsonb(v_nova_empresa);
END;
$$;

-- ============================================================
-- Funções de Gestão e Superadmin
-- ============================================================

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
  WHERE lower(email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com e-mail % ainda não se cadastrou na plataforma.', p_email;
  END IF;

  INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
  VALUES (v_user_id, p_empresa_id, p_role, true)
  ON CONFLICT (user_id, empresa_id) DO UPDATE
  SET role = EXCLUDED.role, ativo = true
  RETURNING json_build_object(
    'user_id', user_id,
    'empresa_id', empresa_id,
    'role', role,
    'ativo', ativo
  )::jsonb INTO v_resultado;

  RETURN v_resultado;
END;
$$;

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

-- ============================================================
-- Políticas de RLS para equipe_corretores
-- ============================================================
ALTER TABLE public.equipe_corretores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe_corretores_select" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_select"
  ON public.equipe_corretores FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "equipe_corretores_all_gestores" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_all_gestores"
  ON public.equipe_corretores FOR ALL
  TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- ============================================================
-- RPC: get_metricas_empresas (para o Painel Superadmin)
-- ============================================================
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

-- ============================================================
-- RPC: vincular_com_pin (auto-vinculação segura com o PIN)
-- ============================================================
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
-- RPCs Auxiliares para Gestão Segura de Equipe (Suporte a Auth e PIN)
-- ============================================================

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
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
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
-- Habilitar Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.empresas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pontos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turnos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perfis;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios_empresas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe_corretores;
