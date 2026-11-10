-- ============================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 10: CUSTOMIZAÇÃO DE TEXTO DO WHATSAPP
-- 1. Novas colunas na tabela pontos (cabecalho_whatsapp, rodape_whatsapp)
-- 2. Novas colunas na tabela empresas (msg_whatsapp_geral, rodape_whatsapp_geral)
-- 3. RPCs seguras para atualização por gestores/administradores
-- ============================================================

-- 1. Colunas na tabela pontos
ALTER TABLE public.pontos 
ADD COLUMN IF NOT EXISTS cabecalho_whatsapp TEXT DEFAULT NULL;

ALTER TABLE public.pontos 
ADD COLUMN IF NOT EXISTS rodape_whatsapp TEXT DEFAULT NULL;

-- 2. Colunas na tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS msg_whatsapp_geral TEXT DEFAULT NULL;

ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS rodape_whatsapp_geral TEXT DEFAULT NULL;

-- 3. RPC para atualizar o texto do WhatsApp de um ponto específico
CREATE OR REPLACE FUNCTION public.atualizar_whatsapp_ponto(
  p_ponto_id   UUID,
  p_empresa_id UUID,
  p_cabecalho  TEXT DEFAULT NULL,
  p_rodape     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ponto RECORD;
BEGIN
  -- Validação de permissões de gestão
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  UPDATE public.pontos
  SET
    cabecalho_whatsapp = NULLIF(trim(p_cabecalho), ''),
    rodape_whatsapp = NULLIF(trim(p_rodape), '')
  WHERE id = p_ponto_id AND empresa_id = p_empresa_id
  RETURNING * INTO v_ponto;

  IF v_ponto.id IS NULL THEN
    RAISE EXCEPTION 'Ponto de captação não encontrado.';
  END IF;

  RETURN to_jsonb(v_ponto);
END;
$$;

-- 4. RPC para atualizar o texto geral do WhatsApp da empresa
CREATE OR REPLACE FUNCTION public.atualizar_whatsapp_empresa(
  p_empresa_id UUID,
  p_cabecalho  TEXT DEFAULT NULL,
  p_rodape     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa RECORD;
BEGIN
  -- Validação de permissões de gestão
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  UPDATE public.empresas
  SET
    msg_whatsapp_geral = NULLIF(trim(p_cabecalho), ''),
    rodape_whatsapp_geral = NULLIF(trim(p_rodape), '')
  WHERE id = p_empresa_id
  RETURNING * INTO v_empresa;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  RETURN to_jsonb(v_empresa);
END;
$$;

