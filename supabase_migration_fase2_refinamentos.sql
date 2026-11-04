-- ============================================================
-- Escala CRM / EscalaFácil — Migração Fase 2 (Refinamentos Finais)
-- 1. Tabela equipe_corretores e chave exigir_cadastro_previo
-- 2. Atualização da RPC reservar_vaga com proteção contra invasores
-- 3. Coluna corretor_whatsapp na tabela reservas
-- 4. RPC get_metricas_empresas para o painel Superadmin
-- ============================================================

-- 1. Adicionar chave opcional de controle em empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS exigir_cadastro_previo BOOLEAN NOT NULL DEFAULT false;

-- 2. Criar tabela de corretores autorizados da imobiliária (Equipe)
CREATE TABLE IF NOT EXISTS public.equipe_corretores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  whatsapp    TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_empresa ON public.equipe_corretores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_whatsapp ON public.equipe_corretores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_equipe_corretores_ativo ON public.equipe_corretores(empresa_id, ativo);

-- 3. Adicionar coluna corretor_whatsapp na tabela reservas (opcional e enriquecedora)
ALTER TABLE public.reservas
ADD COLUMN IF NOT EXISTS corretor_whatsapp TEXT;

-- 4. Habilitar RLS para equipe_corretores
ALTER TABLE public.equipe_corretores ENABLE ROW LEVEL SECURITY;

-- Leitura pública para validação de reservas de corretores
DROP POLICY IF EXISTS "equipe_corretores_select" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_select"
  ON public.equipe_corretores FOR SELECT
  TO anon, authenticated
  USING (true);

-- Gestão por gestores/admins da empresa ou Superadmin
DROP POLICY IF EXISTS "equipe_corretores_all_gestores" ON public.equipe_corretores;
CREATE POLICY "equipe_corretores_all_gestores"
  ON public.equipe_corretores FOR ALL
  TO authenticated
  USING (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']))
  WITH CHECK (public.has_empresa_role(empresa_id, ARRAY['admin', 'gestor']));

-- 5. Atualizar RPC reservar_vaga com suporte a WhatsApp e verificação de equipe
-- Remove a assinatura antiga de 3 argumentos para evitar ambiguidade de sobrecarga
DROP FUNCTION IF EXISTS public.reservar_vaga(UUID, TEXT, TEXT);

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
  v_capacidade INT;
  v_atual INT;
  v_empresa_id UUID;
  v_exigir_cadastro BOOLEAN;
  v_zap_limpo TEXT;
BEGIN
  -- Trava a linha do turno contra concorrência simultânea (race conditions)
  SELECT capacidade, empresa_id INTO v_capacidade, v_empresa_id
  FROM turnos
  WHERE id = p_turno_id
  FOR UPDATE;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Turno não encontrado';
  END IF;

  -- ─── Proteção contra invasores (Equipe de Corretores) ────────
  SELECT COALESCE(exigir_cadastro_previo, false) INTO v_exigir_cadastro
  FROM empresas
  WHERE id = v_empresa_id;

  IF v_exigir_cadastro THEN
    v_zap_limpo := regexp_replace(COALESCE(p_corretor_whatsapp, ''), '[^0-9]', '', 'g');

    -- Se a empresa exige cadastro, precisa ter WhatsApp ou Nome cadastrado na equipe ativa
    IF NOT EXISTS (
      SELECT 1 FROM equipe_corretores
      WHERE empresa_id = v_empresa_id
        AND ativo = true
        AND (
          (v_zap_limpo <> '' AND regexp_replace(whatsapp, '[^0-9]', '', 'g') = v_zap_limpo)
          OR (lower(trim(nome)) = lower(trim(p_corretor_nome)))
        )
    ) THEN
      RAISE EXCEPTION 'Acesso restrito: Seu cadastro não foi encontrado na equipe autorizada desta imobiliária. Fale com seu coordenador.';
    END IF;
  END IF;

  -- ─── Verificação de capacidade ───────────────────────────────
  SELECT COUNT(*) INTO v_atual
  FROM reservas
  WHERE turno_id = p_turno_id;

  IF v_atual >= v_capacidade THEN
    RETURN FALSE;
  END IF;

  -- ─── Prevenção de reserva duplicada pelo mesmo dispositivo ───
  IF EXISTS (
    SELECT 1 FROM reservas
    WHERE turno_id = p_turno_id AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'Você já possui uma reserva neste turno';
  END IF;

  -- ─── Inserção da nova reserva ────────────────────────────────
  INSERT INTO reservas (turno_id, corretor_nome, device_id, empresa_id, corretor_whatsapp)
  VALUES (p_turno_id, trim(p_corretor_nome), p_device_id, v_empresa_id, p_corretor_whatsapp);

  RETURN TRUE;
END;
$$;

-- 6. RPC para Métricas de Consumo no Painel Superadmin
CREATE OR REPLACE FUNCTION public.get_metricas_empresas()
RETURNS TABLE (
  empresa_id UUID,
  total_pontos_ativos BIGINT,
  total_turnos BIGINT,
  total_reservas BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    e.id AS empresa_id,
    COALESCE(p.total_pontos, 0)::BIGINT AS total_pontos_ativos,
    COALESCE(t.total_turnos, 0)::BIGINT AS total_turnos,
    COALESCE(r.total_reservas, 0)::BIGINT AS total_reservas
  FROM public.empresas e
  LEFT JOIN (
    SELECT empresa_id, COUNT(*) AS total_pontos
    FROM public.pontos
    WHERE ativo = true
    GROUP BY empresa_id
  ) p ON p.empresa_id = e.id
  LEFT JOIN (
    SELECT empresa_id, COUNT(*) AS total_turnos
    FROM public.turnos
    GROUP BY empresa_id
  ) t ON t.empresa_id = e.id
  LEFT JOIN (
    SELECT empresa_id, COUNT(*) AS total_reservas
    FROM public.reservas
    GROUP BY empresa_id
  ) r ON r.empresa_id = e.id;
$$;

-- 7. Habilitar Realtime para equipe_corretores
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe_corretores;

-- 8. RPC: vincular_com_pin
-- Permite que um usuário autenticado que conheça o PIN da imobiliária se auto-vincule como admin
CREATE OR REPLACE FUNCTION public.vincular_com_pin(
  p_empresa_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pin_correto TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT admin_pin INTO v_pin_correto
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_pin_correto IS NULL THEN
    RAISE EXCEPTION 'Imobiliária não encontrada.';
  END IF;

  IF v_pin_correto <> trim(p_pin) THEN
    RETURN FALSE;
  END IF;

  -- Se o PIN estiver correto, vincula o usuário autenticado como admin
  INSERT INTO public.usuarios_empresas (user_id, empresa_id, role, ativo)
  VALUES (v_user_id, p_empresa_id, 'admin', true)
  ON CONFLICT (user_id, empresa_id) DO UPDATE
  SET role = 'admin', ativo = true;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 7. RPCs Auxiliares para Gestão Segura de Equipe (Suporte a Auth e PIN)
-- ============================================================

-- RPC: alternar_protecao_equipe
CREATE OR REPLACE FUNCTION public.alternar_protecao_equipe(
  p_empresa_id UUID,
  p_exigir     BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a política de acesso.';
    END IF;
  END IF;

  UPDATE public.empresas
  SET exigir_cadastro_previo = p_exigir
  WHERE id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- RPC: adicionar_corretor_equipe
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
  v_novo RECORD;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Acesso restrito a gestores e administradores.';
    END IF;
  END IF;

  INSERT INTO public.equipe_corretores (empresa_id, nome, whatsapp, ativo)
  VALUES (p_empresa_id, trim(p_nome), trim(p_whatsapp), true)
  RETURNING * INTO v_novo;

  RETURN to_jsonb(v_novo);
END;
$$;

-- RPC: alternar_status_corretor
CREATE OR REPLACE FUNCTION public.alternar_status_corretor(
  p_corretor_id UUID,
  p_empresa_id  UUID,
  p_ativo       BOOLEAN
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
  SET ativo = p_ativo
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
END;
$$;

-- RPC: remover_corretor_equipe
CREATE OR REPLACE FUNCTION public.remover_corretor_equipe(
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
    IF NOT (public.has_empresa_role(p_empresa_id, ARRAY['admin']) OR public.is_superadmin()) THEN
      RAISE EXCEPTION 'Apenas administradores podem remover corretores da equipe.';
    END IF;
  END IF;

  DELETE FROM public.equipe_corretores
  WHERE id = p_corretor_id AND empresa_id = p_empresa_id;

  RETURN TRUE;
END;
$$;


