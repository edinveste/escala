-- ============================================================
-- MIGRAÇÃO: SEGURANÇA E ALTERAÇÃO DE SENHA DO ADMIN (ESCALA CRM)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================

-- 1. Garante que a tabela config tem permissão de UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'config' AND policyname = 'config_update_public'
  ) THEN
    CREATE POLICY "config_update_public"
      ON config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Função segura para verificar PIN (não expõe o PIN na rede)
CREATE OR REPLACE FUNCTION verificar_admin_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valido BOOLEAN;
BEGIN
  SELECT (admin_pin = p_pin) INTO v_valido FROM config WHERE id = 1;
  RETURN COALESCE(v_valido, FALSE);
END;
$$;

-- 3. Função segura para alterar o PIN (com validação da senha atual)
CREATE OR REPLACE FUNCTION alterar_admin_pin(p_pin_atual TEXT, p_novo_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validação de tamanho mínimo
  IF length(trim(p_novo_pin)) < 4 THEN
    RETURN FALSE;
  END IF;

  -- Verifica se o PIN atual está correto
  IF NOT EXISTS (SELECT 1 FROM config WHERE id = 1 AND admin_pin = p_pin_atual) THEN
    RETURN FALSE;
  END IF;

  -- Atualiza para o novo PIN
  UPDATE config SET admin_pin = p_novo_pin WHERE id = 1;
  RETURN TRUE;
END;
$$;

