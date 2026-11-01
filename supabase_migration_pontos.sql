-- ============================================================
-- MIGRAÇÃO: Adicionar Pontos de Captação
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Criar tabela de pontos de captação
CREATE TABLE IF NOT EXISTS pontos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,              -- ex: 'Mercado Extra', 'Padaria Di Cunto'
  ordem      INT  NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS na tabela pontos
ALTER TABLE pontos ENABLE ROW LEVEL SECURITY;

-- Políticas para pontos
CREATE POLICY "pontos_select_public"
  ON pontos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "pontos_insert_anon"
  ON pontos FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "pontos_update_anon"
  ON pontos FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "pontos_delete_anon"
  ON pontos FOR DELETE
  TO anon, authenticated
  USING (true);

-- 3. Adicionar coluna ponto_id na tabela turnos
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS ponto_id UUID REFERENCES pontos(id) ON DELETE CASCADE;

-- 4. Criar índice para buscas por ponto
CREATE INDEX IF NOT EXISTS idx_turnos_ponto_id ON turnos(ponto_id);

-- 5. Atualizar a função limpar_escala para aceitar ponto_id opcional
CREATE OR REPLACE FUNCTION limpar_escala(p_ponto_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_ponto_id IS NOT NULL THEN
    -- Limpa apenas reservas dos turnos deste ponto
    DELETE FROM reservas
    WHERE turno_id IN (
      SELECT id FROM turnos WHERE ponto_id = p_ponto_id
    );
  ELSE
    -- Limpa todas as reservas
    DELETE FROM reservas;
  END IF;
END;
$$;

-- 6. Habilitar Realtime para pontos e turnos também
ALTER PUBLICATION supabase_realtime ADD TABLE pontos;
ALTER PUBLICATION supabase_realtime ADD TABLE turnos;

