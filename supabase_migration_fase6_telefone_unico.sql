-- ============================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 6: INTEGRIDADE DE TELEFONE E ANTI-SPOOFING
-- 1. Unicidade de WhatsApp na tabela equipe_corretores
-- 2. Atualização da RPC reservar_vaga com proteção contra múltiplos nomes com mesmo telefone
-- 3. Atualização da RPC adicionar_corretor_equipe com normalização estrita de telefone
-- ============================================================

-- 1. Cria índice único condicional para impedir múltiplos corretores com o mesmo WhatsApp na mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipe_corretores_empresa_zap_unico 
ON public.equipe_corretores (
  empresa_id, 
  regexp_replace(regexp_replace(whatsapp, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g')
);

-- 2. Atualiza a RPC reservar_vaga com integridade de telefone e garantia de nome oficial
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

  -- 2. Valida o status da empresa (Bloqueio por inadimplência ou inatividade)
  SELECT status, COALESCE(exigir_cadastro_previo, false) 
  INTO v_status, v_exigir_cadastro
  FROM public.empresas
  WHERE id = v_empresa_id;

  IF v_status = 'bloqueado' THEN
    RAISE EXCEPTION 'Acesso temporariamente suspenso: A escala desta empresa está com pendência cadastral ou financeira. Fale com seu coordenador.';
  ELSIF v_status = 'inativo' THEN
    RAISE EXCEPTION 'Esta empresa está inativa no momento.';
  END IF;

  -- Normaliza o WhatsApp (apenas dígitos, removendo DDI 55 de 12 ou 13 dígitos)
  v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  v_nome_final := trim(p_corretor_nome);

  -- 3. Proteção contra invasores (Equipe de Corretores da Imobiliária)
  IF v_exigir_cadastro THEN
    IF v_zap_limpo = '' THEN
      RAISE EXCEPTION 'O WhatsApp é obrigatório para garantir vaga nesta empresa.';
    END IF;

    -- Busca o corretor autorizado na equipe pelo WhatsApp limpo
    SELECT nome INTO v_nome_oficial
    FROM public.equipe_corretores
    WHERE empresa_id = v_empresa_id
      AND ativo = true
      AND regexp_replace(regexp_replace(whatsapp, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
    LIMIT 1;

    -- Fallback por nome exato caso WhatsApp não tenha sido encontrado
    IF v_nome_oficial IS NULL THEN
      SELECT nome INTO v_nome_oficial
      FROM public.equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND lower(trim(nome)) = lower(trim(p_corretor_nome))
      LIMIT 1;
    END IF;

    IF v_nome_oficial IS NULL THEN
      RAISE EXCEPTION 'Acesso restrito: Seu cadastro não foi encontrado na equipe desta imobiliária. Fale com seu coordenador.';
    END IF;

    -- REGRA CRÍTICA: Se a empresa exige cadastro, utiliza SEMPRE o nome oficial cadastrado pelo gestor
    v_nome_final := v_nome_oficial;
  END IF;

  -- 4. Impede que o mesmo WhatsApp seja utilizado por nomes diferentes na mesma empresa
  IF v_zap_limpo <> '' THEN
    SELECT corretor_nome INTO v_nome_existente
    FROM public.reservas
    WHERE empresa_id = v_empresa_id
      AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
      AND lower(trim(corretor_nome)) <> lower(trim(v_nome_final))
    LIMIT 1;

    IF v_nome_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Este WhatsApp já está associado a "%". Cada pessoa deve utilizar seu próprio número de WhatsApp.', v_nome_existente;
    END IF;
  END IF;

  -- 5. Valida vagas disponíveis no turno
  SELECT COUNT(*) INTO v_atual
  FROM public.reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE; -- Turno esgotado
  END IF;

  -- 6. Impede reserva duplicada do mesmo corretor no mesmo turno (por device_id, por WhatsApp ou por nome)
  IF EXISTS (
    SELECT 1 FROM public.reservas
    WHERE turno_id = p_turno_id
      AND (
        device_id = p_device_id
        OR (v_zap_limpo <> '' AND regexp_replace(regexp_replace(COALESCE(corretor_whatsapp, ''), '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo)
        OR (lower(trim(corretor_nome)) = lower(trim(v_nome_final)))
      )
  ) THEN
    RAISE EXCEPTION 'Você já possui uma vaga reservada neste turno.';
  END IF;

  -- 7. Insere a nova reserva vinculando empresa_id e WhatsApp
  INSERT INTO public.reservas (
    empresa_id,
    turno_id,
    corretor_nome,
    corretor_whatsapp,
    device_id
  ) VALUES (
    v_empresa_id,
    p_turno_id,
    v_nome_final,
    p_corretor_whatsapp,
    p_device_id
  );

  RETURN TRUE;
END;
$$;

-- 3. Atualiza RPC adicionar_corretor_equipe com normalização estrita de WhatsApp
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
  v_zap_limpo TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_nome_existente TEXT;
  v_novo RECORD;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  IF length(v_zap_limpo) < 10 THEN
    RAISE EXCEPTION 'WhatsApp inválido. Informe o número com DDD.';
  END IF;

  SELECT nome INTO v_nome_existente
  FROM public.equipe_corretores
  WHERE empresa_id = p_empresa_id
    AND regexp_replace(regexp_replace(whatsapp, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '', 'g') = v_zap_limpo
  LIMIT 1;

  IF v_nome_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Este WhatsApp já está cadastrado para o corretor "%". Cada membro deve ter um número único.', v_nome_existente;
  END IF;

  INSERT INTO public.equipe_corretores (empresa_id, nome, whatsapp, ativo)
  VALUES (p_empresa_id, trim(p_nome), trim(p_whatsapp), true)
  RETURNING * INTO v_novo;

  RETURN to_jsonb(v_novo);
END;
$$;

-- 4. Atualiza a RPC cancelar_vaga para permitir cancelamento seguro via device_id OU WhatsApp
DROP FUNCTION IF EXISTS public.cancelar_vaga(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancelar_vaga(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancelar_vaga(
  p_reserva_id          UUID,
  p_device_id           TEXT,
  p_corretor_whatsapp   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
  v_zap_limpo TEXT := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
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
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;


