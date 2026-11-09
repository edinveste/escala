-- ============================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 7: VALIDAÇÃO POR E-MAIL CORPORATIVO E IDENTIFICAÇÃO FLEXÍVEL
-- 1. Coluna tipo_validacao_equipe na tabela empresas ('whatsapp', 'email', 'ambos')
-- 2. Coluna email na tabela equipe_corretores (flexibilização de whatsapp NOT NULL e índices)
-- 3. Coluna corretor_email na tabela reservas
-- 4. RPC alternar_tipo_validacao_equipe
-- 5. Atualização da RPC adicionar_corretor_equipe (suporte a e-mail e checagem de duplicidade)
-- 6. Atualização da RPC reservar_vaga (validação por e-mail, whatsapp ou ambos com anti-spoofing)
-- 7. Atualização da RPC cancelar_vaga (suporte a cancelamento com e-mail)
-- ============================================================

-- 1. Adiciona coluna tipo_validacao_equipe na tabela empresas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'empresas' 
      AND column_name = 'tipo_validacao_equipe'
  ) THEN
    ALTER TABLE public.empresas 
    ADD COLUMN tipo_validacao_equipe TEXT NOT NULL DEFAULT 'whatsapp';

    ALTER TABLE public.empresas 
    ADD CONSTRAINT chk_empresas_tipo_validacao 
    CHECK (tipo_validacao_equipe IN ('whatsapp', 'email', 'ambos'));
  END IF;
END $$;

-- 2. Flexibiliza equipe_corretores: permite whatsapp nulo (para empresas que usam apenas e-mail) e adiciona coluna email
DO $$ 
BEGIN
  -- Permite whatsapp nulo se a coluna existir e tiver NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'equipe_corretores' 
      AND column_name = 'whatsapp'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.equipe_corretores ALTER COLUMN whatsapp DROP NOT NULL;
  END IF;

  -- Adiciona coluna email se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'equipe_corretores' 
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.equipe_corretores ADD COLUMN email TEXT;
  END IF;
END $$;

-- Cria índice de busca rápida case-insensitive para email na equipe
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_email_lower 
ON public.equipe_corretores (empresa_id, lower(trim(email)));

-- Cria índice único condicional para impedir múltiplos colaboradores com o mesmo e-mail na mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipe_corretores_empresa_email_unico 
ON public.equipe_corretores (empresa_id, lower(trim(email))) 
WHERE email IS NOT NULL AND trim(email) <> '';

-- 3. Adiciona coluna corretor_email na tabela reservas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'reservas' 
      AND column_name = 'corretor_email'
  ) THEN
    ALTER TABLE public.reservas ADD COLUMN corretor_email TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservas_corretor_email 
ON public.reservas (empresa_id, lower(trim(corretor_email)));

-- 4. RPC para alternar a política de validação de equipe da empresa
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
  -- Se o usuário estiver autenticado, exige ser admin da empresa ou superadmin
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a política de identificação da equipe.';
    END IF;
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

-- 5. Atualiza a RPC adicionar_corretor_equipe para aceitar whatsapp e/ou email
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
  -- Validação de permissão
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'O nome completo do colaborador é obrigatório.';
  END IF;

  -- Consulta a configuração da empresa
  SELECT COALESCE(tipo_validacao_equipe, 'whatsapp')
  INTO v_tipo_validacao
  FROM public.empresas
  WHERE id = p_empresa_id;

  -- Normaliza WhatsApp (remove 55 de 12/13 dígitos)
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  -- Validações de acordo com a política ativa
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
    -- Fallback seguro: exige ao menos um canal de contato
    IF length(v_zap_limpo) < 10 AND (v_email_limpo = '' OR v_email_limpo NOT LIKE '%_@__%.__%') THEN
      RAISE EXCEPTION 'Informe um WhatsApp ou E-mail válido para cadastrar o colaborador.';
    END IF;
  END IF;

  -- Checagem de duplicidade por WhatsApp (se fornecido)
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

  -- Checagem de duplicidade por E-mail (se fornecido)
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

-- 6. Atualiza a RPC reservar_vaga com suporte flexível a E-mail, WhatsApp ou Ambos
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
  v_capacidade      INT;
  v_atual           INT;
  v_empresa_id      UUID;
  v_status          TEXT;
  v_exigir_cadastro BOOLEAN;
  v_tipo_validacao  TEXT;
  v_zap_limpo       TEXT;
  v_email_limpo     TEXT;
  v_nome_oficial    TEXT;
  v_nome_existente  TEXT;
  v_nome_final      TEXT;
BEGIN
  -- 1. Trava o turno contra concorrência simultânea (Race Condition)
  SELECT capacidade, empresa_id INTO v_capacidade, v_empresa_id
  FROM public.turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
  END IF;

  -- 2. Valida o status da empresa e configurações de equipe
  SELECT 
    status, 
    COALESCE(exigir_cadastro_previo, false),
    COALESCE(tipo_validacao_equipe, 'whatsapp')
  INTO 
    v_status, 
    v_exigir_cadastro,
    v_tipo_validacao
  FROM public.empresas
  WHERE id = v_empresa_id;

  IF v_status = 'bloqueado' THEN
    RAISE EXCEPTION 'Acesso temporariamente suspenso: A escala desta empresa está com pendência cadastral ou financeira. Fale com seu coordenador.';
  ELSIF v_status = 'inativo' THEN
    RAISE EXCEPTION 'Esta empresa está inativa no momento.';
  END IF;

  -- Normaliza WhatsApp (apenas dígitos, removendo DDI 55 de 12 ou 13 dígitos)
  v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  -- Normaliza E-mail
  v_email_limpo := lower(trim(COALESCE(p_corretor_email, '')));

  v_nome_final := trim(p_corretor_nome);

  -- 3. Proteção contra invasores (Equipe Autorizada da Empresa)
  IF v_exigir_cadastro THEN
    IF v_tipo_validacao = 'whatsapp' THEN
      IF v_zap_limpo = '' THEN
        RAISE EXCEPTION 'O WhatsApp é obrigatório para garantir vaga nesta empresa.';
      END IF;

      SELECT nome INTO v_nome_oficial
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND regexp_replace(regexp_replace(whatsapp, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      LIMIT 1;

    ELSIF v_tipo_validacao = 'email' THEN
      IF v_email_limpo = '' THEN
        RAISE EXCEPTION 'O E-mail corporativo é obrigatório para garantir vaga nesta empresa.';
      END IF;

      SELECT nome INTO v_nome_oficial
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;

    ELSIF v_tipo_validacao = 'ambos' THEN
      IF v_zap_limpo = '' OR v_email_limpo = '' THEN
        RAISE EXCEPTION 'WhatsApp e E-mail corporativo são obrigatórios para garantir vaga nesta empresa.';
      END IF;

      -- Exige que AMBOS pertençam ao mesmo colaborador cadastrado
      SELECT nome INTO v_nome_oficial
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;

      IF v_nome_oficial IS NULL THEN
        -- Verifica se um dos dois existe isoladamente para dar mensagem mais amigável
        IF EXISTS (
          SELECT 1 FROM public.equipe_corretores 
          WHERE empresa_id = v_empresa_id AND ativo = true 
            AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
        ) OR EXISTS (
          SELECT 1 FROM public.equipe_corretores 
          WHERE empresa_id = v_empresa_id AND ativo = true 
            AND lower(trim(COALESCE(email, ''))) = v_email_limpo
        ) THEN
          RAISE EXCEPTION 'Os dados informados (WhatsApp e E-mail) não coincidem com o cadastro da equipe autorizada.';
        END IF;
      END IF;

    ELSE
      -- Fallback: busca por zap ou email
      SELECT nome INTO v_nome_oficial
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND (
          (v_zap_limpo <> '' AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo)
          OR (v_email_limpo <> '' AND lower(trim(COALESCE(email, ''))) = v_email_limpo)
        )
      LIMIT 1;
    END IF;

    -- Fallback final por nome exato
    IF v_nome_oficial IS NULL AND v_nome_final <> '' THEN
      SELECT nome INTO v_nome_oficial
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND lower(trim(nome)) = lower(v_nome_final)
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

    -- REGRA CRÍTICA: Se a empresa exige cadastro, utiliza SEMPRE o nome oficial cadastrado pelo gestor
    v_nome_final := v_nome_oficial;
  END IF;

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
        OR (v_zap_limpo <> '' AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo)
        OR (v_email_limpo <> '' AND lower(trim(COALESCE(corretor_email, ''))) = v_email_limpo)
        OR (lower(trim(corretor_nome)) = lower(trim(v_nome_final)))
      )
  ) THEN
    RAISE EXCEPTION 'Você já possui uma vaga reservada neste horário.';
  END IF;

  -- 7. Insere a nova reserva vinculando empresa_id, whatsapp e email
  INSERT INTO public.reservas (
    empresa_id,
    turno_id,
    corretor_nome,
    corretor_whatsapp,
    corretor_email,
    device_id
  ) VALUES (
    v_empresa_id,
    p_turno_id,
    v_nome_final,
    NULLIF(trim(p_corretor_whatsapp), ''),
    NULLIF(v_email_limpo, ''),
    p_device_id
  );

  RETURN TRUE;
END;
$$;

-- 7. Atualiza a RPC cancelar_vaga para suportar cancelamento também via e-mail
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
  v_rows        INT;
  v_zap_limpo   TEXT := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
  v_email_limpo TEXT := lower(trim(COALESCE(p_corretor_email, '')));
BEGIN
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  DELETE FROM public.reservas
  WHERE id = p_reserva_id
    AND (
      device_id = p_device_id
      OR (
        v_zap_limpo <> '' 
        AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      )
      OR (
        v_email_limpo <> '' 
        AND lower(trim(COALESCE(corretor_email, ''))) = v_email_limpo
      )
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

