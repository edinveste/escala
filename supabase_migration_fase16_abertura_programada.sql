-- ==============================================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 16: ABERTURA PROGRAMADA COM CONTAGEM REGRESSIVA
-- ==============================================================================
-- Suporte a:
--   1. Abertura Global (para todos os pontos da empresa)
--   2. Abertura para Pontos Específicos selecionados pelo gestor (escala_abre_pontos_ids)
--   3. Abertura Individual com data própria por ponto (pontos.escala_abre_em)
-- ==============================================================================

-- ─── 1. ALTERAÇÃO DE SCHEMA IDEMPOTENTE ────────────────────────────────────────

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS escala_abre_em TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escala_abre_pontos_ids UUID[] DEFAULT NULL;

ALTER TABLE public.pontos
  ADD COLUMN IF NOT EXISTS escala_abre_em TIMESTAMPTZ DEFAULT NULL;

-- ─── 2. RPC PÚBLICA SANITIZADA: get_empresa_publica ────────────────────────────

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
  v_empresa public.empresas%ROWTYPE;
  v_achou   BOOLEAN := false;
BEGIN
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Tentativa por Código Seguro de 12 caracteres
  IF length(v_raw) = 12 AND v_raw ~ '^[A-Za-z0-9]{12}$' THEN
    SELECT *
    INTO v_empresa
    FROM public.empresas
    WHERE codigo_escala = v_raw
    LIMIT 1;

    IF FOUND THEN
      v_achou := true;
    END IF;
  END IF;

  -- 2. Tentativa por Slug público
  IF NOT v_achou THEN
    v_slug := lower(regexp_replace(
      translate(v_raw, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9_-]', '', 'g'
    ));

    IF v_slug <> '' THEN
      SELECT *
      INTO v_empresa
      FROM public.empresas
      WHERE lower(slug) = v_slug
      LIMIT 1;

      IF FOUND THEN
        v_achou := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_achou THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_empresa.id,
    'nome', v_empresa.nome,
    'slug', v_empresa.slug,
    'codigo_escala', v_empresa.codigo_escala,
    'logo_url', v_empresa.logo_url,
    'cor_primaria', v_empresa.cor_primaria,
    'plano', v_empresa.plano,
    'status', v_empresa.status,
    'exigir_cadastro_previo', v_empresa.exigir_cadastro_previo,
    'tipo_validacao_equipe', v_empresa.tipo_validacao_equipe,
    'termos', v_empresa.termos,
    'msg_whatsapp_geral', v_empresa.msg_whatsapp_geral,
    'rodape_whatsapp_geral', v_empresa.rodape_whatsapp_geral,
    'copia_whatsapp_geral_ativa', v_empresa.copia_whatsapp_geral_ativa,
    'ocultar_nomes_escala', v_empresa.ocultar_nomes_escala,
    'bloquear_conflito_horario', v_empresa.bloquear_conflito_horario,
    'limite_vagas_semana', v_empresa.limite_vagas_semana,
    'limite_vagas_dia', v_empresa.limite_vagas_dia,
    'limite_vagas_ponto', v_empresa.limite_vagas_ponto,
    'cotas_pontos_ids', v_empresa.cotas_pontos_ids,
    'escala_abre_em', v_empresa.escala_abre_em,
    'escala_abre_pontos_ids', v_empresa.escala_abre_pontos_ids,
    'created_at', v_empresa.created_at
  );
END;
$$;

-- ─── 3. RPC PÚBLICA SANITIZADA: get_escala_publica (com escala_abre_em por ponto) ───

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
          'escala_abre_em', p.escala_abre_em,
          'created_at', p.created_at
        )
        ORDER BY p.ordem ASC, p.created_at ASC
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
        ORDER BY t.ordem ASC, t.created_at ASC
      )
      FROM public.turnos t
      JOIN public.pontos p ON p.id = t.ponto_id
      WHERE t.empresa_id = p_empresa_id
        AND p.ativo = true
    ), '[]'::jsonb),

    'reservas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'empresa_id', r.empresa_id,
          'turno_id', r.turno_id,
          'eh_minha', CASE
            WHEN v_device_limpo <> '' AND r.device_id = v_device_limpo THEN true
            ELSE false
          END,
          'corretor_nome', CASE
            WHEN v_ocultar_nomes AND (v_device_limpo = '' OR r.device_id <> v_device_limpo)
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

-- ─── 4. RPC ADMINISTRATIVA SEGURA: atualizar_agendamento_escala ────────────────

DROP FUNCTION IF EXISTS public.atualizar_agendamento_escala(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.atualizar_agendamento_escala(UUID, TIMESTAMPTZ, UUID[]);
DROP FUNCTION IF EXISTS public.atualizar_agendamento_escala(UUID, TIMESTAMPTZ, UUID[], UUID);

CREATE OR REPLACE FUNCTION public.atualizar_agendamento_escala(
  p_empresa_id UUID,
  p_abre_em    TIMESTAMPTZ DEFAULT NULL,
  p_pontos_ids UUID[] DEFAULT NULL,
  p_ponto_id   UUID DEFAULT NULL
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
  IF auth.uid() IS NULL OR NOT public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores autenticados podem agendar a abertura da escala.';
  END IF;

  IF p_abre_em IS NOT NULL AND p_abre_em <= clock_timestamp() THEN
    RAISE EXCEPTION 'A data de abertura programada deve ser futura ou nula para liberação imediata.';
  END IF;

  -- Cenário A: Agendamento individual para um ponto específico
  IF p_ponto_id IS NOT NULL THEN
    UPDATE public.pontos
    SET escala_abre_em = p_abre_em
    WHERE id = p_ponto_id
      AND empresa_id = p_empresa_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ponto de captação não encontrado nesta empresa.';
    END IF;

    -- Se liberando o ponto, limpa o espelho em termos se existir
    IF p_abre_em IS NULL THEN
      UPDATE public.empresas
      SET termos = jsonb_set(
        COALESCE(termos, '{}'::jsonb),
        '{aberturaPontos}',
        (COALESCE(termos->'aberturaPontos', '{}'::jsonb) - p_ponto_id::text)
      )
      WHERE id = p_empresa_id;
    END IF;

  -- Cenário B: Agendamento geral ou para grupo de pontos selecionados
  ELSE
    IF p_abre_em IS NOT NULL AND p_pontos_ids IS NOT NULL AND cardinality(p_pontos_ids) > 0 THEN
      SELECT array_agg(id ORDER BY ordem ASC)
      INTO v_pontos_filtrados
      FROM public.pontos
      WHERE empresa_id = p_empresa_id
        AND id = ANY(p_pontos_ids);
    ELSE
      v_pontos_filtrados := NULL;
    END IF;

    -- Se estiver liberando a escala imediatamente (p_abre_em IS NULL)
    IF p_abre_em IS NULL THEN
      -- Limpa também agendamentos individuais residuais nos pontos da empresa
      UPDATE public.pontos
      SET escala_abre_em = NULL
      WHERE empresa_id = p_empresa_id;

      UPDATE public.empresas
      SET
        escala_abre_em         = NULL,
        escala_abre_pontos_ids = NULL,
        termos                 = (COALESCE(termos, '{}'::jsonb) - 'escala_abre_em' - 'escala_abre_pontos_ids' - 'aberturaPontos')
      WHERE id = p_empresa_id
      RETURNING * INTO v_empresa;
    ELSE
      UPDATE public.empresas
      SET
        escala_abre_em         = p_abre_em,
        escala_abre_pontos_ids = v_pontos_filtrados,
        termos                 = (COALESCE(termos, '{}'::jsonb) - 'escala_abre_em' - 'escala_abre_pontos_ids')
      WHERE id = p_empresa_id
      RETURNING * INTO v_empresa;
    END IF;

    IF v_empresa.id IS NULL THEN
      RAISE EXCEPTION 'Empresa não encontrada.';
    END IF;
  END IF;

  -- Notificação Realtime imediata via escala_sync
  INSERT INTO public.escala_sync (empresa_id, updated_at)
  VALUES (p_empresa_id, now())
  ON CONFLICT (empresa_id) DO UPDATE
  SET updated_at = now();

  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  RETURN to_jsonb(v_empresa);
END;
$$;

-- ─── 5. BLINDAGEM ANTI-BYPASS NA RPC: reservar_vaga ────────────────────────────

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
  v_capacidade             INT;
  v_atual                  INT;
  v_empresa_id             UUID;
  v_ponto_id               UUID;
  v_ponto_nome             TEXT;
  v_ponto_ativo            BOOLEAN;
  v_ponto_abre_em          TIMESTAMPTZ;
  v_empresa_abre_em        TIMESTAMPTZ;
  v_empresa_abre_pontos    UUID[];
  v_data_efetiva_abertura  TIMESTAMPTZ := NULL;
  v_dia_norm               TEXT;
  v_horario_alvo           TEXT;
  v_novo_inicio            TIME;
  v_novo_fim               TIME;
  v_novo_ini_min           INT;
  v_novo_fim_min           INT;
  v_status                 TEXT;
  v_exigir_cadastro        BOOLEAN;
  v_tipo_validacao         TEXT;
  v_bloquear_conflito      BOOLEAN;
  v_limite_semana          INT;
  v_limite_dia             INT;
  v_limite_ponto           INT;
  v_cotas_pontos_ids       UUID[];
  v_ponto_tem_cota         BOOLEAN;
  v_zap_limpo              TEXT;
  v_email_limpo            TEXT;
  v_zap_busca              TEXT;
  v_email_busca            TEXT;
  v_membro_id              UUID;
  v_nome_oficial           TEXT;
  v_device_cadastrado      TEXT;
  v_membro_zap             TEXT;
  v_membro_email           TEXT;
  v_nome_existente         TEXT;
  v_nome_final             TEXT;
  v_lock_keys              TEXT[];
  v_lock_key               TEXT;
  v_conflito_ponto         TEXT;
  v_conflito_horario       TEXT;
  v_conflito_dia           TEXT;
  v_qtd_semana             INT := 0;
  v_qtd_dia                INT := 0;
  v_qtd_ponto              INT := 0;
BEGIN
  IF trim(COALESCE(p_device_id, '')) = '' THEN
    RAISE EXCEPTION 'Dispositivo não identificado. Atualize a página e tente novamente.';
  END IF;

  SELECT empresa_id, ponto_id INTO v_empresa_id, v_ponto_id
  FROM public.turnos
  WHERE id = p_turno_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado.';
  END IF;

  -- ─── BLINDAGEM DE ABERTURA PROGRAMADA (GLOBAL, GRUPO OU INDIVIDUAL) ───────────
  SELECT escala_abre_em INTO v_ponto_abre_em
  FROM public.pontos
  WHERE id = v_ponto_id;

  SELECT status, escala_abre_em, escala_abre_pontos_ids
  INTO v_status, v_empresa_abre_em, v_empresa_abre_pontos
  FROM public.empresas
  WHERE id = v_empresa_id;

  IF v_status = 'bloqueado' THEN
    RAISE EXCEPTION 'Acesso temporariamente suspenso: A escala desta empresa está com pendência cadastral ou financeira. Fale com seu coordenador.';
  ELSIF v_status = 'inativo' THEN
    RAISE EXCEPTION 'Esta empresa está inativa no momento.';
  END IF;

  -- Prioridade 1: Agendamento individual específico do ponto
  IF v_ponto_abre_em IS NOT NULL THEN
    v_data_efetiva_abertura := v_ponto_abre_em;
  -- Prioridade 2: Agendamento da empresa (se o ponto estiver no escopo)
  ELSIF v_empresa_abre_em IS NOT NULL THEN
    IF v_empresa_abre_pontos IS NULL
       OR cardinality(v_empresa_abre_pontos) = 0
       OR v_ponto_id = ANY(v_empresa_abre_pontos) THEN
      v_data_efetiva_abertura := v_empresa_abre_em;
    ELSE
      v_data_efetiva_abertura := NULL;
    END IF;
  ELSE
    v_data_efetiva_abertura := NULL;
  END IF;

  IF v_data_efetiva_abertura IS NOT NULL AND clock_timestamp() < v_data_efetiva_abertura THEN
    RAISE EXCEPTION 'A escala deste local ainda não está aberta para reservas. Abertura programada para %', 
      to_char(v_data_efetiva_abertura AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
  END IF;

  v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  v_email_limpo := lower(trim(COALESCE(p_corretor_email, '')));
  v_nome_final  := trim(COALESCE(p_corretor_nome, ''));

  -- 0. Advisory Lock transacional ordenado por colaborador
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

  -- 1. Trava o turno com FOR UPDATE
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

  SELECT
    COALESCE(exigir_cadastro_previo, false),
    COALESCE(tipo_validacao_equipe, 'whatsapp'),
    COALESCE(bloquear_conflito_horario, false),
    limite_vagas_semana,
    limite_vagas_dia,
    limite_vagas_ponto,
    cotas_pontos_ids
  INTO
    v_exigir_cadastro,
    v_tipo_validacao,
    v_bloquear_conflito,
    v_limite_semana,
    v_limite_dia,
    v_limite_ponto,
    v_cotas_pontos_ids
  FROM public.empresas
  WHERE id = v_empresa_id;

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
        AND lower(trim(COALESCE(email, '')));
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

    IF v_device_cadastrado IS NOT NULL AND v_device_cadastrado <> p_device_id THEN
      RAISE EXCEPTION 'Acesso bloqueado: Este cadastro já está vinculado a outro aparelho celular. Por segurança contra uso indevido, cada colaborador deve acessar exclusivamente pelo seu próprio aparelho. Solicite ao coordenador a liberação caso tenha trocado de celular.';
    ELSIF v_device_cadastrado IS NULL AND v_membro_id IS NOT NULL THEN
      UPDATE public.equipe_corretores
      SET device_id = p_device_id
      WHERE id = v_membro_id;
    END IF;

    v_nome_final := v_nome_oficial;
  ELSE
    IF length(v_nome_final) < 2 THEN
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

  SELECT COUNT(*) INTO v_atual
  FROM public.reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE;
  END IF;

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

-- ─── 6. PERMISSÕES E PRIVILÉGIOS (REVOKE / GRANT) ──────────────────────────────

REVOKE ALL ON FUNCTION public.get_empresa_publica(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_escala_publica(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_agendamento_escala(UUID, TIMESTAMPTZ, UUID[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_empresa_publica(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_escala_publica(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_agendamento_escala(UUID, TIMESTAMPTZ, UUID[], UUID) TO authenticated, service_role;
