-- ==============================================================================
-- FASE 18: Integração de Endereço e Google Maps nos Pontos de Captação
--
-- 1. Adiciona coluna `endereco` na tabela `public.pontos` (TEXT, default NULL).
-- 2. Atualiza a RPC pública sanitizada `get_escala_publica` para retornar
--    o campo `endereco` no objeto JSON de cada ponto.
-- 3. Assegura permissões de execução para anon, authenticated e service_role.
-- ==============================================================================

-- ─── 1. COLUNA ENDERECO NA TABELA PONTOS ──────────────────────────────────────

ALTER TABLE public.pontos
  ADD COLUMN IF NOT EXISTS endereco TEXT DEFAULT NULL;

COMMENT ON COLUMN public.pontos.endereco IS
  'Endereço físico em texto ou link de compartilhamento do Google Maps do ponto de captação';

-- ─── 2. ATUALIZAÇÃO DA RPC PÚBLICA SANITIZADA: get_escala_publica ─────────────

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
          'endereco', p.endereco,
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

-- ─── 3. PERMISSÕES DA RPC ─────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_escala_publica(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_escala_publica(UUID, TEXT) TO anon, authenticated, service_role;
