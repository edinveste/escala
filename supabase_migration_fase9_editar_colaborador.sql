-- ============================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 9: EDIÇÃO DE COLABORADORES DA EQUIPE
-- 1. Criação da RPC editar_corretor_equipe com validações e anti-duplicidade
-- ============================================================

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
  -- 1. Validação de permissões de gestão
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  v_nome_limpo := trim(p_nome);
  IF length(v_nome_limpo) < 2 THEN
    RAISE EXCEPTION 'O nome deve ter pelo menos 2 caracteres.';
  END IF;

  -- 2. Limpeza e normalização do WhatsApp
  IF p_whatsapp IS NOT NULL AND trim(p_whatsapp) <> '' THEN
    v_zap_limpo := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
    IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
      v_zap_limpo := substr(v_zap_limpo, 3);
    END IF;
    IF length(v_zap_limpo) < 10 OR length(v_zap_limpo) > 11 THEN
      RAISE EXCEPTION 'WhatsApp inválido. Digite o DDD e o número (10 ou 11 dígitos).';
    END IF;

    -- Checa duplicidade com outro membro da mesma empresa
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

  -- 3. Limpeza e normalização do E-mail
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    v_email_limpo := lower(trim(p_email));
    IF length(v_email_limpo) < 5 OR v_email_limpo NOT LIKE '%@%.%' THEN
      RAISE EXCEPTION 'E-mail corporativo inválido.';
    END IF;

    -- Checa duplicidade com outro membro da mesma empresa
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

  -- 4. Atualiza o registro do colaborador
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

