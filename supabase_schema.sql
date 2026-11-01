-- ============================================================
-- Escala CRM - Controle de Captação
-- Schema SQL COMPLETO para Supabase (com Pontos de Captação)
-- ============================================================

-- 1. Tabela de configuração (linha única com PIN do admin)
CREATE TABLE IF NOT EXISTS config (
  id   INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_pin TEXT NOT NULL DEFAULT '1234'
);

INSERT INTO config (id, admin_pin) VALUES (1, '1234')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de pontos de captação
CREATE TABLE IF NOT EXISTS pontos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,              -- ex: 'Mercado Extra', 'Padaria Di Cunto'
  ordem      INT  NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de turnos (vinculados a um ponto)
CREATE TABLE IF NOT EXISTS turnos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ponto_id   UUID REFERENCES pontos(id) ON DELETE CASCADE,
  dia        TEXT NOT NULL,          -- ex: 'SÁBADO', 'DOMINGO'
  horario    TEXT NOT NULL,          -- ex: '11:30 às 14hrs'
  capacidade INT  NOT NULL DEFAULT 1,
  ordem      INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de reservas
CREATE TABLE IF NOT EXISTS reservas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id       UUID NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  corretor_nome  TEXT NOT NULL,
  device_id      TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_turnos_ponto_id ON turnos(ponto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_turno_id ON reservas(turno_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- CONFIG
CREATE POLICY "config_select_public"
  ON config FOR SELECT TO anon, authenticated USING (true);

-- PONTOS
CREATE POLICY "pontos_select_public"
  ON pontos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pontos_insert_anon"
  ON pontos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pontos_update_anon"
  ON pontos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pontos_delete_anon"
  ON pontos FOR DELETE TO anon, authenticated USING (true);

-- TURNOS
CREATE POLICY "turnos_select_public"
  ON turnos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "turnos_insert_anon"
  ON turnos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "turnos_delete_anon"
  ON turnos FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "turnos_update_anon"
  ON turnos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RESERVAS
CREATE POLICY "reservas_select_public"
  ON reservas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reservas_insert_public"
  ON reservas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "reservas_delete_own_device"
  ON reservas FOR DELETE TO anon, authenticated
  USING (true); -- Controle feito via RPC cancelar_vaga

-- ============================================================
-- RPC: reservar_vaga (com LOCK contra race conditions)
-- ============================================================
CREATE OR REPLACE FUNCTION reservar_vaga(
  p_turno_id     UUID,
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
BEGIN
  SELECT capacidade INTO v_capacidade
  FROM turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
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

  INSERT INTO reservas (turno_id, corretor_nome, device_id)
  VALUES (p_turno_id, p_corretor_nome, p_device_id);

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
-- RPC: limpar_escala (por ponto ou tudo)
-- ============================================================
CREATE OR REPLACE FUNCTION limpar_escala(p_ponto_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_ponto_id IS NOT NULL THEN
    DELETE FROM reservas
    WHERE turno_id IN (
      SELECT id FROM turnos WHERE ponto_id = p_ponto_id
    );
  ELSE
    DELETE FROM reservas;
  END IF;
END;
$$;

-- ============================================================
-- Habilitar Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pontos;
ALTER PUBLICATION supabase_realtime ADD TABLE turnos;
ALTER PUBLICATION supabase_realtime ADD TABLE reservas;
