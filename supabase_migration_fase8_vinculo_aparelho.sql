-- ============================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 8: TRAVA DE IDENTIDADE POR APARELHO (ANTI-SABOTAGEM & ZERO-ATRITO)
-- 1. Coluna device_id na tabela equipe_corretores
-- 2. Atualização da RPC reservar_vaga com vínculo estrito de aparelho no primeiro uso
-- 3. Atualização da RPC cancelar_vaga com trava estrita de device_id
-- 4. Nova RPC desvincular_aparelho_corretor para o gestor liberar novo celular
-- ============================================================

-- 1. Adiciona coluna device_id na tabela equipe_corretores
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'equipe_corretores' 
      AND column_name = 'device_id'
  ) THEN
    ALTER TABLE public.equipe_corretores ADD COLUMN device_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipe_corretores_device 
ON public.equipe_corretores (empresa_id, device_id);

-- 2. RPC para o gestor desvincular o aparelho do colaborador (ex: troca de celular)
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
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  UPDATE public.equipe_corretores
  SET device_id = NULL
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- 3. Atualiza RPC reservar_vaga com trava estrita de aparelho
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
  v_capacidade       INT;
  v_atual            INT;
  v_empresa_id       UUID;
  v_status           TEXT;
  v_exigir_cadastro  BOOLEAN;
  v_tipo_validacao   TEXT;
  v_zap_limpo        TEXT;
  v_email_limpo      TEXT;
  v_membro_id        UUID;
  v_nome_oficial     TEXT;
  v_device_cadastrado TEXT;
  v_nome_existente   TEXT;
  v_nome_final       TEXT;
BEGIN
  -- Validação de device_id
  IF trim(COALESCE(p_device_id, '')) = '' THEN
    RAISE EXCEPTION 'Dispositivo não identificado. Atualize a página e tente novamente.';
  END IF;

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

  -- 3. Proteção contra invasores (Equipe Autorizada da Empresa com Vínculo de Aparelho)
  IF v_exigir_cadastro THEN
    IF v_tipo_validacao = 'whatsapp' THEN
      IF v_zap_limpo = '' THEN
        RAISE EXCEPTION 'O WhatsApp é obrigatório para garantir vaga nesta empresa.';
      END IF;

      SELECT id, nome, device_id 
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND regexp_replace(regexp_replace(whatsapp, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      LIMIT 1;

    ELSIF v_tipo_validacao = 'email' THEN
      IF v_email_limpo = '' THEN
        RAISE EXCEPTION 'O E-mail corporativo é obrigatório para garantir vaga nesta empresa.';
      END IF;

      SELECT id, nome, device_id 
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;

    ELSIF v_tipo_validacao = 'ambos' THEN
      IF v_zap_limpo = '' OR v_email_limpo = '' THEN
        RAISE EXCEPTION 'WhatsApp e E-mail corporativo são obrigatórios para garantir vaga nesta empresa.';
      END IF;

      SELECT id, nome, device_id 
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
        AND lower(trim(COALESCE(email, ''))) = v_email_limpo
      LIMIT 1;
    ELSE
      SELECT id, nome, device_id 
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND (
          (v_zap_limpo <> '' AND regexp_replace(regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo)
          OR (v_email_limpo <> '' AND lower(trim(COALESCE(email, ''))) = v_email_limpo)
        )
      LIMIT 1;
    END IF;

    -- Fallback final por nome
    IF v_nome_oficial IS NULL AND v_nome_final <> '' THEN
      SELECT id, nome, device_id 
      INTO v_membro_id, v_nome_oficial, v_device_cadastrado
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

  -- 7. Insere a reserva vinculando automaticamente empresa, device_id, whatsapp e email
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
    NULLIF(trim(p_corretor_whatsapp), ''),
    NULLIF(v_email_limpo, '')
  );

  RETURN TRUE;
END;
$$;

-- 4. Atualiza RPC cancelar_vaga com trava estrita de device_id
-- Somente o aparelho físico que realizou a reserva tem permissão para cancelá-la
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
  -- Cancelamento estrito por device_id: impede sabotagem por terceiros
  DELETE FROM public.reservas
  WHERE id = p_reserva_id
    AND device_id = p_device_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

