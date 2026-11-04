-- ============================================================
-- Escala CRM / EscalaFácil — Migração Fase 2: Autenticação de Gestores & RBAC
-- Integração com Supabase Auth (auth.users), Perfis, Membros e Superadmin
-- ============================================================

-- 1. Tabela de perfis vinculada ao auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.perfis (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  nome           TEXT,
  is_superadmin  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de relação entre Usuários e Empresas (Multi-Tenant Memberships)
CREATE TABLE IF NOT EXISTS public.usuarios_empresas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'gestor' CHECK (role IN ('admin', 'gestor')),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);

-- Índices para consultas ultra rápidas de permissão
CREATE INDEX IF NOT EXISTS idx_perfis_is_superadmin ON public.perfis(is_superadmin);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_user ON public.usuarios_empresas(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_empresa ON public.usuarios_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_user_empresa ON public.usuarios_empresas(user_id, empresa_id);

-- ============================================================
-- 3. Funções Utilitárias de Segurança (SECURITY DEFINER)
-- Evitam recursão infinita de RLS e oferecem alta performance
-- ============================================================

-- Verifica se o usuário atual é Superadmin do SaaS
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

-- Verifica se o usuário tem um dos papéis informados na empresa
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

-- Retorna as empresas às quais o usuário logado possui acesso
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

-- ============================================================
-- 4. Trigger: Criação Automática de Perfil ao Cadastrar no Supabase Auth
-- ============================================================
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
  -- Extrai o nome dos metadados ou usa a parte antes do @ no e-mail
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    split_part(NEW.email, '@', 1)
  );

  -- Se for o primeiro usuário de todo o sistema, promove automaticamente a Superadmin
  SELECT COUNT(*) INTO v_count_usuarios FROM public.perfis;

  INSERT INTO public.perfis (id, email, nome, is_superadmin)
  VALUES (
    NEW.id,
    NEW.email,
    v_nome,
    (v_count_usuarios = 0) -- Primeiro usuário vira superadmin do SaaS
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

-- Sincroniza usuários que já possam existir no auth.users antes desta migração
INSERT INTO public.perfis (id, email, nome, is_superadmin)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  false
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Se houver pelo menos um usuário e nenhum superadmin, torna o primeiro usuário superadmin
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
-- 5. Atualização das Políticas de RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresas ENABLE ROW LEVEL SECURITY;

-- ─── PERFIS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "perfis_select" ON public.perfis;
CREATE POLICY "perfis_select"
  ON public.perfis FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR public.is_superadmin()
  );

DROP POLICY IF EXISTS "perfis_update" ON public.perfis;
CREATE POLICY "perfis_update"
  ON public.perfis FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_superadmin());

-- ─── USUARIOS_EMPRESAS ───────────────────────────────────────
DROP POLICY IF EXISTS "usuarios_empresas_select" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_select"
  ON public.usuarios_empresas FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_superadmin()
    OR public.has_empresa_role(empresa_id, ARRAY['admin'])
  );

DROP POLICY IF EXISTS "usuarios_empresas_insert" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_insert"
  ON public.usuarios_empresas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin() 
    OR public.has_empresa_role(empresa_id, ARRAY['admin'])
  );

DROP POLICY IF EXISTS "usuarios_empresas_update" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_update"
  ON public.usuarios_empresas FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin() 
    OR public.has_empresa_role(empresa_id, ARRAY['admin'])
  )
  WITH CHECK (
    public.is_superadmin() 
    OR public.has_empresa_role(empresa_id, ARRAY['admin'])
  );

DROP POLICY IF EXISTS "usuarios_empresas_delete" ON public.usuarios_empresas;
CREATE POLICY "usuarios_empresas_delete"
  ON public.usuarios_empresas FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin() 
    OR public.has_empresa_role(empresa_id, ARRAY['admin'])
  );

-- ─── EMPRESAS ────────────────────────────────────────────────
-- Leitura pública para carregar página por slug (corretores e clientes)
DROP POLICY IF EXISTS "empresas_select_public" ON public.empresas;
CREATE POLICY "empresas_select_public"
  ON public.empresas FOR SELECT
  TO anon, authenticated
  USING (true);

-- Inserção: Superadmin ou RPC de onboarding criar_nova_empresa (SECURITY DEFINER)
DROP POLICY IF EXISTS "empresas_insert_public" ON public.empresas;
CREATE POLICY "empresas_insert_authenticated"
  ON public.empresas FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

-- Atualização: Superadmin ou admin da própria empresa
DROP POLICY IF EXISTS "empresas_update_public" ON public.empresas;
CREATE POLICY "empresas_update_auth"
  ON public.empresas FOR UPDATE
  TO authenticated
  USING (public.has_empresa_role(id, ARRAY['admin']))
  WITH CHECK (public.has_empresa_role(id, ARRAY['admin']));

-- Exclusão: Apenas Superadmin
DROP POLICY IF EXISTS "empresas_delete_superadmin" ON public.empresas;
CREATE POLICY "empresas_delete_superadmin"
  ON public.empresas FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

-- ─── PONTOS ──────────────────────────────────────────────────
-- Leitura pública para corretores visualizarem os pontos disponíveis
DROP POLICY IF EXISTS "pontos_select_public" ON public.pontos;
CREATE POLICY "pontos_select_public"
  ON public.pontos FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita restrita a gestores/admins da empresa ou Superadmin
DROP POLICY IF EXISTS "pontos_insert_anon" ON public.pontos;
CREATE POLICY "pontos_insert_gestores"
  ON public.pontos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "pontos_update_anon" ON public.pontos;
CREATE POLICY "pontos_update_gestores"
  ON public.pontos FOR UPDATE
  TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "pontos_delete_anon" ON public.pontos;
CREATE POLICY "pontos_delete_gestores"
  ON public.pontos FOR DELETE
  TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- ─── TURNOS ──────────────────────────────────────────────────
-- Leitura pública para corretores visualizarem os horários
DROP POLICY IF EXISTS "turnos_select_public" ON public.turnos;
CREATE POLICY "turnos_select_public"
  ON public.turnos FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita restrita a gestores/admins da empresa ou Superadmin
DROP POLICY IF EXISTS "turnos_insert_anon" ON public.turnos;
CREATE POLICY "turnos_insert_gestores"
  ON public.turnos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "turnos_update_anon" ON public.turnos;
CREATE POLICY "turnos_update_gestores"
  ON public.turnos FOR UPDATE
  TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

DROP POLICY IF EXISTS "turnos_delete_anon" ON public.turnos;
CREATE POLICY "turnos_delete_gestores"
  ON public.turnos FOR DELETE
  TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- ─── RESERVAS ────────────────────────────────────────────────
-- Leitura pública (corretores visualizam escala em tempo real)
DROP POLICY IF EXISTS "reservas_select_public" ON public.reservas;
CREATE POLICY "reservas_select_public"
  ON public.reservas FOR SELECT
  TO anon, authenticated
  USING (true);

-- Inserção pública permitida (além da RPC reservar_vaga, permite alocação via UI gestor)
DROP POLICY IF EXISTS "reservas_insert_public" ON public.reservas;
CREATE POLICY "reservas_insert_allowed"
  ON public.reservas FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Exclusão: Permite que o gestor/admin remova reservas OU o próprio corretor via RPC
DROP POLICY IF EXISTS "reservas_delete_own_device" ON public.reservas;
CREATE POLICY "reservas_delete_gestor_or_own"
  ON public.reservas FOR DELETE
  TO anon, authenticated
  USING (
    -- Gestor ou Superadmin autenticado
    public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor'])
    -- Ou próprio corretor pelo device_id (quando chamado diretamente)
    OR device_id IS NOT NULL
  );

-- ============================================================
-- 6. RPC: limpar_escala com Validação de Gestor / Superadmin
-- ============================================================
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
  -- Se o usuário estiver autenticado, valida se ele é gestor da empresa ou superadmin
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

-- ============================================================
-- 7. Funções de Administração de Usuários (Superadmin / Gestão)
-- ============================================================

-- Promover usuário a Superadmin por e-mail
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

-- Vincular Gestor ou Admin a uma Empresa por E-mail
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
  -- Verifica permissão de quem está chamando (Superadmin ou Admin da empresa)
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

-- Remover vínculo de um usuário com uma Empresa
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

-- Habilitar Realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.perfis;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios_empresas;

