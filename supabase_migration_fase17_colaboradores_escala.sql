-- ==============================================================================
-- ESCALAFÁCIL — MIGRAÇÃO FASE 17: GESTÃO CONSOLIDADA DE COLABORADORES NA ESCALA
-- ==============================================================================
-- Esta migração introduz a RPC segura para renomear colaboradores em lote
-- em todas as suas reservas ativas na escala, com opção de sincronização
-- automática com a tabela de equipe autorizada (equipe_corretores) e
-- notificação em tempo real via canal WebSocket 'escala_sync'.
-- ==============================================================================

-- ─── 1. RPC DE RENOMEAÇÃO DE COLABORADOR NA ESCALA ───────────────────────────

CREATE OR REPLACE FUNCTION public.renomear_colaborador_escala(
  p_empresa_id UUID,
  p_nome_antigo TEXT,
  p_novo_nome TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_reserva_ids UUID[] DEFAULT NULL,
  p_sincronizar_equipe BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_permission BOOLEAN;
  v_novo_nome_limpo TEXT;
  v_nome_antigo_limpo TEXT;
  v_linhas_reservas INT := 0;
  v_linhas_equipe INT := 0;
BEGIN
  -- 1. Validação de autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Apenas usuários autenticados podem renomear colaboradores.';
  END IF;

  -- 2. Validação estrita de papel administrativo (admin ou gestor)
  v_has_permission := public.has_empresa_role(p_empresa_id, ARRAY['admin', 'gestor'], v_user_id);
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para alterar reservas nesta empresa.';
  END IF;

  -- 3. Sanitização e validação dos nomes
  v_novo_nome_limpo := trim(COALESCE(p_novo_nome, ''));
  v_nome_antigo_limpo := trim(COALESCE(p_nome_antigo, ''));

  IF v_novo_nome_limpo = '' OR length(v_novo_nome_limpo) < 2 THEN
    RAISE EXCEPTION 'O novo nome do colaborador deve conter pelo menos 2 caracteres.';
  END IF;

  -- 4. Atualização das reservas do colaborador na empresa
  IF p_reserva_ids IS NOT NULL AND array_length(p_reserva_ids, 1) > 0 THEN
    UPDATE public.reservas
    SET corretor_nome = v_novo_nome_limpo
    WHERE empresa_id = p_empresa_id
      AND id = ANY(p_reserva_ids);
    GET DIAGNOSTICS v_linhas_reservas = ROW_COUNT;
  ELSIF p_device_id IS NOT NULL AND p_device_id <> '' AND p_device_id NOT LIKE 'admin_manual_%' THEN
    UPDATE public.reservas
    SET corretor_nome = v_novo_nome_limpo
    WHERE empresa_id = p_empresa_id
      AND (
        device_id = p_device_id
        OR lower(trim(corretor_nome)) = lower(v_nome_antigo_limpo)
      );
    GET DIAGNOSTICS v_linhas_reservas = ROW_COUNT;
  ELSE
    UPDATE public.reservas
    SET corretor_nome = v_novo_nome_limpo
    WHERE empresa_id = p_empresa_id
      AND lower(trim(corretor_nome)) = lower(v_nome_antigo_limpo);
    GET DIAGNOSTICS v_linhas_reservas = ROW_COUNT;
  END IF;

  -- 5. Sincronização opcional com a equipe autorizada (se existir cadastro correspondente)
  IF p_sincronizar_equipe THEN
    IF p_device_id IS NOT NULL AND p_device_id <> '' AND p_device_id NOT LIKE 'admin_manual_%' THEN
      UPDATE public.equipe_corretores
      SET nome = v_novo_nome_limpo
      WHERE empresa_id = p_empresa_id
        AND (
          device_id_vinculado = p_device_id
          OR lower(trim(nome)) = lower(v_nome_antigo_limpo)
        );
      GET DIAGNOSTICS v_linhas_equipe = ROW_COUNT;
    ELSE
      UPDATE public.equipe_corretores
      SET nome = v_novo_nome_limpo
      WHERE empresa_id = p_empresa_id
        AND lower(trim(nome)) = lower(v_nome_antigo_limpo);
      GET DIAGNOSTICS v_linhas_equipe = ROW_COUNT;
    END IF;
  END IF;

  -- 6. Disparo do evento em tempo real via pg_notify para clientes conectados
  PERFORM pg_notify('escala_sync', json_build_object(
    'empresa_id', p_empresa_id,
    'tipo', 'reservas_renomeadas',
    'nome_antigo', v_nome_antigo_limpo,
    'novo_nome', v_novo_nome_limpo,
    'total_reservas', v_linhas_reservas,
    'total_equipe', v_linhas_equipe,
    'timestamp', now()
  )::text);

  RETURN jsonb_build_object(
    'success', true,
    'novo_nome', v_novo_nome_limpo,
    'total_reservas_afetadas', v_linhas_reservas,
    'total_equipe_afetadas', v_linhas_equipe
  );
END;
$$;

-- ─── 2. PERMISSÕES DE EXECUÇÃO ───────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.renomear_colaborador_escala(UUID, TEXT, TEXT, TEXT, UUID[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renomear_colaborador_escala(UUID, TEXT, TEXT, TEXT, UUID[], BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.renomear_colaborador_escala IS
  'Permite que administradores e gestores renomeiem um colaborador em todas as suas reservas ativas na escala, com sincronização opcional na equipe autorizada e notificação em tempo real.';
