-- ==============================================================================
-- MIGRATION: Fase 13 - Onboarding Multi-Tenant & Erradicação de Superadmin
-- 1. Remove qualquer acesso global de Superadmin (isolamento estrito por tenant).
-- 2. Atualiza get_minhas_empresas() para retornar ESTRITAMENTE as empresas vinculadas em usuarios_empresas.
-- 3. Atualiza handle_new_auth_user() para nunca mais promover usuários a superadmin
--    e provisionar automaticamente o tenant se 'empresa_nome' for informado no cadastro.
-- 4. Atualiza criar_nova_empresa() tornando p_slug opcional (geração automática e anti-colisão).
-- 5. Limpa qualquer vínculo incorreto entre contas distintas.
-- ==============================================================================

-- 1. Erradica privilégios de superadmin existentes na tabela de perfis
UPDATE public.perfis 
SET is_superadmin = false 
WHERE is_superadmin = true;

-- 2. Atualiza get_minhas_empresas: Isolamento 100% estrito por vínculo em usuarios_empresas
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

  -- Retorna APENAS as empresas onde o usuário possui vínculo ativo na tabela usuarios_empresas
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

GRANT EXECUTE ON FUNCTION public.get_minhas_empresas() TO authenticated;

-- 3. Atualização robusta da RPC criar_nova_empresa
-- Torna p_slug opcional (deriva do nome e gera slug único com sufixo numérico anti-colisão)
CREATE OR REPLACE FUNCTION public.criar_nova_empresa(
    p_nome TEXT,
    p_slug TEXT DEFAULT NULL,
    p_admin_pin TEXT DEFAULT '1234',
    p_termos JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_empresa_id UUID;
    v_slug_base TEXT;
    v_slug_final TEXT;
    v_contador INT := 1;
    v_codigo_seguro TEXT;
    v_resultado JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem criar uma nova empresa.';
    END IF;

    IF trim(COALESCE(p_nome, '')) = '' THEN
        RAISE EXCEPTION 'Informe o nome da empresa ou imobiliária.';
    END IF;

    -- Se slug não foi fornecido, gera a partir do nome com remoção de acentos e caracteres especiais
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
        v_slug_base := 'imobiliaria';
    END IF;

    -- Garante que o slug seja 100% único no banco de dados
    v_slug_final := v_slug_base;
    WHILE EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug_final) LOOP
        v_contador := v_contador + 1;
        v_slug_final := v_slug_base || '-' || v_contador::text;
    END LOOP;

    -- Gera código seguro de 12 caracteres anti-espionagem
    v_codigo_seguro := public.gerar_codigo_escala();

    -- Insere o novo Tenant
    INSERT INTO public.empresas (
        nome,
        slug,
        codigo_escala,
        admin_pin,
        status,
        plano,
        termos
    )
    VALUES (
        trim(p_nome),
        v_slug_final,
        v_codigo_seguro,
        COALESCE(p_admin_pin, '1234'),
        'ativo',
        'trial',
        COALESCE(p_termos, '{}'::jsonb)
    )
    RETURNING id INTO v_empresa_id;

    -- Vincula o usuário criador como Administrador Geral da empresa
    INSERT INTO public.usuarios_empresas (
        user_id,
        empresa_id,
        role,
        ativo
    )
    VALUES (
        v_user_id,
        v_empresa_id,
        'admin',
        true
    )
    ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET role = 'admin', ativo = true;

    SELECT jsonb_build_object(
        'empresa_id', v_empresa_id,
        'id', v_empresa_id,
        'nome', trim(p_nome),
        'slug', v_slug_final,
        'codigo_escala', v_codigo_seguro,
        'mensagem', 'Empresa criada com sucesso!'
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_nova_empresa(TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- 4. Atualização do Trigger de Cadastro de Usuário (handle_new_auth_user)
-- Nunca promove a superadmin e provisiona automaticamente a empresa se empresa_nome for informado
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
  -- Extrai nome e nome da empresa dos metadados
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    split_part(NEW.email, '@', 1)
  );
  v_empresa_nome := trim(COALESCE(NEW.raw_user_meta_data->>'empresa_nome', ''));

  -- 1. Cria ou atualiza o perfil pessoal (is_superadmin = false sempre)
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

  -- 3. Se NÃO havia convite pendente e foi informado um nome de empresa, provisiona o Tenant imediatamente
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
      admin_pin,
      status,
      plano,
      termos
    )
    VALUES (
      v_empresa_nome,
      v_slug_final,
      v_codigo_seguro,
      '1234',
      'ativo',
      'trial',
      '{}'::jsonb
    )
    RETURNING id INTO v_empresa_id;

    -- Vincula o usuário criador como Administrador Geral da nova empresa
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

-- 5. Desvincula o Elias (elias.oli2019@gmail.com) da empresa do Edmilson se tiver sido vinculado por engano
DO $$
DECLARE
  v_elias_id UUID;
  v_edmilson_id UUID;
BEGIN
  SELECT id INTO v_elias_id FROM auth.users WHERE lower(email) = 'elias.oli2019@gmail.com';
  SELECT id INTO v_edmilson_id FROM auth.users WHERE lower(email) = 'edinvest.oliver@gmail.com';

  -- Se ambos existirem, remove o Elias de qualquer empresa criada pelo Edmilson
  IF v_elias_id IS NOT NULL AND v_edmilson_id IS NOT NULL THEN
    DELETE FROM public.usuarios_empresas ue
    WHERE ue.user_id = v_elias_id
      AND ue.empresa_id IN (
        SELECT ue2.empresa_id 
        FROM public.usuarios_empresas ue2 
        WHERE ue2.user_id = v_edmilson_id
      );
  END IF;
END $$;

