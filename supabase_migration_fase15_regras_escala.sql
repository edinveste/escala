-- ==============================================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 15: REGRAS INTELIGENTES DE ESCALA
-- ==============================================================================
-- Feature 1: Bloqueio de Conflito de Horário (Turnos Simultâneos / Sobrepostos)
--   - Adiciona hora_inicio (TIME) e hora_fim (TIME) em public.turnos
--   - Backfill idempotente a partir de textos legados (ex: "8 as 10 hs", "11:30 às 14hrs")
--   - Trigger automático de preenchimento e normalização para inserções/atualizações
--   - Adiciona bloquear_conflito_horario (BOOLEAN) em public.empresas
--
-- Feature 2: Cotas / Limites Justos por Colaborador ("Anti-Monopólio")
--   - Adiciona limite_vagas_semana, limite_vagas_dia, limite_vagas_ponto em public.empresas
--   - RPC segura atualizar_regras_escala() restrita a administradores autenticados
--   - Validação transacional com pg_advisory_xact_lock + FOR UPDATE em reservar_vaga()
--   - Exposição segura dos novos campos em get_empresa_publica() e get_escala_publica()
--   - Mantém 100% da blindagem de segurança e grants da Fase 14
-- ==============================================================================

-- ─── 1. ALTERAÇÕES DE SCHEMA (IDEMPOTENTES) ────────────────────────────────────

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fim    TIME;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS bloquear_conflito_horario BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limite_vagas_semana       INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS limite_vagas_dia          INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS limite_vagas_ponto        INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cotas_pontos_ids          UUID[] DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresas_limite_vagas_semana_check'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_limite_vagas_semana_check
      CHECK (limite_vagas_semana IS NULL OR limite_vagas_semana >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresas_limite_vagas_dia_check'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_limite_vagas_dia_check
      CHECK (limite_vagas_dia IS NULL OR limite_vagas_dia >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresas_limite_vagas_ponto_check'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_limite_vagas_ponto_check
      CHECK (limite_vagas_ponto IS NULL OR limite_vagas_ponto >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_turnos_empresa_dia_horas
  ON public.turnos(empresa_id, dia, hora_inicio, hora_fim);

-- ─── 2. FUNÇÕES AUXILIARES DE NORMALIZAÇÃO DE DIA E PARSING DE HORÁRIOS ────────

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

  -- Tentativa 1 (prioritária): pelo menos o horário inicial possui ':' ou indicador 'h'
  -- Evita falsos positivos como "Grupo 1 - 08:00 às 12:00"
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
    -- Tentativa 2 (fallback legado): formatos como "8 as 10 hs" ou "8 às 12"
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

-- Trigger de preenchimento automático de hora_inicio/hora_fim e horario
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

-- Backfill idempotente para todos os turnos legados já existentes
UPDATE public.turnos t
SET
  hora_inicio = COALESCE(t.hora_inicio, (SELECT e.hora_inicio FROM public.extrair_horarios_turno(t.horario) e LIMIT 1)),
  hora_fim    = COALESCE(t.hora_fim,    (SELECT e.hora_fim    FROM public.extrair_horarios_turno(t.horario) e LIMIT 1)),
  dia         = public.normalizar_dia_semana(t.dia)
WHERE t.hora_inicio IS NULL
   OR t.hora_fim IS NULL
   OR t.dia IS DISTINCT FROM public.normalizar_dia_semana(t.dia);

-- ─── 3. ATUALIZAÇÃO DAS RPCS PÚBLICAS SANITIZADAS (FASE 14+) ───────────────────

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

-- ─── 4. RPC ADMINISTRATIVA SEGURA: atualizar_regras_escala ─────────────────────

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
  v_empresa           RECORD;
  v_pontos_filtrados  UUID[] := NULL;
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

  -- NULL = aplica a todos os pontos; array não vazio = apenas pontos válidos desta empresa
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

-- ─── 5. RPC TRANSACIONAL DE RESERVA: CONFLITO DE HORÁRIO + COTAS + ADVISORY LOCK ─

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
  IF trim(COALESCE(p_device_id, '')) = '' THEN
    RAISE EXCEPTION 'Dispositivo não identificado. Atualize a página e tente novamente.';
  END IF;

  -- Identifica a empresa do turno alvo antes dos advisory locks para evitar inversão de locks
  SELECT empresa_id INTO v_empresa_id
  FROM public.turnos
  WHERE id = p_turno_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado.';
  END IF;

  v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');
  IF length(v_zap_limpo) IN (12, 13) AND v_zap_limpo LIKE '55%' THEN
    v_zap_limpo := substr(v_zap_limpo, 3);
  END IF;

  v_email_limpo := lower(trim(COALESCE(p_corretor_email, '')));
  v_nome_final  := trim(COALESCE(p_corretor_nome, ''));

  -- 0. Advisory Lock transacional ordenado por identificador do colaborador na empresa
  -- Impede que 2 requisições simultâneas do mesmo colaborador ultrapassem cotas ou reservem horários conflitantes
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

  -- 1. Trava o turno contra concorrência simultânea de outros colaboradores (Race Condition)
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

  -- 2. Valida o status da empresa, configurações de equipe e regras de escala
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

  -- 3. Proteção contra invasores (correspondência estrita por credencial configurada, SEM fallback por nome)
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

    -- Trava estrita de aparelho celular
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

  -- Identificadores normalizados para rastreamento consistente de conflitos e cotas
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

  -- 4. Anti-Spoofing em reservas
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
    RETURN FALSE;
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

  -- 7. Feature 1: Bloqueio de Conflito de Horário (mesmo dia normalizado, qualquer ponto ativo)
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

  -- 9. Insere a reserva
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

-- ─── 6. PRIVILÉGIOS GRANULARES (REVOKE / GRANT - PADRÃO FASE 14) ──────────────

REVOKE ALL ON FUNCTION public.normalizar_dia_semana(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extrair_horarios_turno(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_turnos_preencher_horas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_regras_escala(UUID, BOOLEAN, INT, INT, INT, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_empresa_publica(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_escala_publica(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_empresa_publica(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_escala_publica(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reservar_vaga(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.normalizar_dia_semana(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extrair_horarios_turno(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_regras_escala(UUID, BOOLEAN, INT, INT, INT, UUID[]) TO authenticated, service_role;

