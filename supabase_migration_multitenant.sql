-- ============================================================
-- Escala CRM / EscalaFácil — Migração Fase 1: Multi-Tenancy B2B
-- Isolamento de Empresas, RLS e RPCs atualizadas
-- ============================================================

-- 1. Criar tabela de empresas (tenants)
CREATE TABLE IF NOT EXISTS empresas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  logo_url     TEXT,
  cor_primaria TEXT NOT NULL DEFAULT '#3b82f6',
  admin_pin    TEXT NOT NULL DEFAULT '1234',
  plano        TEXT NOT NULL DEFAULT 'trial',
  status       TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'inativo', 'bloqueado'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único no slug para buscas ultra rápidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_slug ON empresas(lower(slug));

-- 2. Migração segura: Criar empresa padrão com os dados existentes
-- Se a tabela config tiver um PIN personalizado, reaproveita esse PIN
DO $$
DECLARE
  v_admin_pin TEXT := '1234';
  v_empresa_id UUID;
BEGIN
  -- Tenta recuperar o PIN existente na tabela config
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config') THEN
    SELECT admin_pin INTO v_admin_pin FROM config WHERE id = 1;
    IF v_admin_pin IS NULL OR trim(v_admin_pin) = '' THEN
      v_admin_pin := '1234';
    END IF;
  END IF;

  -- Insere a empresa padrão caso não exista
  INSERT INTO empresas (nome, slug, admin_pin, plano, status)
  VALUES ('Minha Imobiliária', 'demo', v_admin_pin, 'ilimitado', 'ativo')
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- 3. Adicionar coluna empresa_id nas tabelas existentes (pontos, turnos, reservas)
-- PONTOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pontos' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE pontos ADD COLUMN empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- TURNOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'turnos' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE turnos ADD COLUMN empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- RESERVAS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservas' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE reservas ADD COLUMN empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Associar todos os registros legados à empresa padrão 'demo'
DO $$
DECLARE
  v_default_empresa_id UUID;
BEGIN
  SELECT id INTO v_default_empresa_id FROM empresas WHERE slug = 'demo' LIMIT 1;

  IF v_default_empresa_id IS NOT NULL THEN
    -- Atualiza pontos órfãos
    UPDATE pontos SET empresa_id = v_default_empresa_id WHERE empresa_id IS NULL;

    -- Atualiza turnos: se o ponto tiver empresa_id, usa ela; senão usa default
    UPDATE turnos t
    SET empresa_id = COALESCE(p.empresa_id, v_default_empresa_id)
    FROM pontos p
    WHERE t.ponto_id = p.id AND t.empresa_id IS NULL;

    UPDATE turnos SET empresa_id = v_default_empresa_id WHERE empresa_id IS NULL;

    -- Atualiza reservas: se o turno tiver empresa_id, usa ela; senão usa default
    UPDATE reservas r
    SET empresa_id = COALESCE(t.empresa_id, v_default_empresa_id)
    FROM turnos t
    WHERE r.turno_id = t.id AND r.empresa_id IS NULL;

    UPDATE reservas SET empresa_id = v_default_empresa_id WHERE empresa_id IS NULL;
  END IF;
END $$;

-- 5. Tornar empresa_id NOT NULL e criar índices de performance
ALTER TABLE pontos ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE turnos ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE reservas ALTER COLUMN empresa_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pontos_empresa_id ON pontos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_turnos_empresa_id ON turnos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_empresa_id ON reservas(empresa_id);

-- 6. Atualização das RPCs críticas para suporte multi-tenant

-- 6.1 RPC: reservar_vaga (com lock e herança de empresa_id)
CREATE OR REPLACE FUNCTION reservar_vaga(
  p_turno_id      UUID,
  p_corretor_nome TEXT,
  p_device_id     TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacidade INT;
  v_atual      INT;
  v_empresa_id UUID;
BEGIN
  -- Trava a linha do turno contra race condition
  SELECT capacidade, empresa_id INTO v_capacidade, v_empresa_id
  FROM turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
  END IF;

  -- Conta reservas atuais no turno
  SELECT COUNT(*) INTO v_atual
  FROM reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE;
  END IF;

  -- Impede reserva repetida do mesmo corretor/device no mesmo turno
  IF EXISTS (
    SELECT 1 FROM reservas
    WHERE turno_id = p_turno_id AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'Você já possui uma reserva neste turno';
  END IF;

  -- Insere a reserva vinculada à empresa do turno
  INSERT INTO reservas (turno_id, corretor_nome, device_id, empresa_id)
  VALUES (p_turno_id, p_corretor_nome, p_device_id, v_empresa_id);

  RETURN TRUE;
END;
$$;

-- 6.2 RPC: cancelar_vaga
CREATE OR REPLACE FUNCTION cancelar_vaga(
  p_reserva_id UUID,
  p_device_id  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6.3 RPC: limpar_escala (isolado por empresa_id)
CREATE OR REPLACE FUNCTION limpar_escala(
  p_empresa_id UUID,
  p_ponto_id   UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- 6.4 RPC: verificar_admin_pin (por empresa)
CREATE OR REPLACE FUNCTION verificar_admin_pin(
  p_empresa_id UUID,
  p_pin        TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valido BOOLEAN;
BEGIN
  SELECT (admin_pin = p_pin) INTO v_valido
  FROM empresas
  WHERE id = p_empresa_id AND status = 'ativo';

  RETURN COALESCE(v_valido, FALSE);
END;
$$;

-- 6.5 RPC: alterar_admin_pin (por empresa)
CREATE OR REPLACE FUNCTION alterar_admin_pin(
  p_empresa_id UUID,
  p_pin_atual  TEXT,
  p_novo_pin   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF length(trim(p_novo_pin)) < 4 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM empresas
    WHERE id = p_empresa_id AND admin_pin = p_pin_atual
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE empresas
  SET admin_pin = p_novo_pin
  WHERE id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- 6.6 RPC: criar_nova_empresa (onboarding self-service / demo)
CREATE OR REPLACE FUNCTION criar_nova_empresa(
  p_nome      TEXT,
  p_slug      TEXT,
  p_admin_pin TEXT DEFAULT '1234'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slug_limpo TEXT;
  v_nova_empresa RECORD;
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

  RETURN to_jsonb(v_nova_empresa);
END;
$$;

-- 7. Configuração de RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas_select_public"
  ON empresas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "empresas_insert_public"
  ON empresas FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "empresas_update_public"
  ON empresas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Publicação Realtime para Empresas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'empresas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE empresas;
  END IF;
END $$;

