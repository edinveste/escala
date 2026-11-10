-- ============================================================
-- MIGRATION: Fase 12 - Privacidade da Escala (Modo Anônimo / Ocultar Nomes)
-- Permite que gestores ocultem os nomes dos participantes na visão
-- pública da escala, exibindo apenas "Reservado" para terceiros.
-- O participante logado continua vendo seu próprio nome (etiqueta VOCÊ),
-- e administradores continuam vendo todos os nomes normalmente no painel.
-- ============================================================

-- 1. Adiciona coluna para controle de privacidade/anonimato na escala pública
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS ocultar_nomes_escala BOOLEAN NOT NULL DEFAULT false;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.empresas.ocultar_nomes_escala IS 'Quando verdadeiro, oculta os nomes dos corretores para os colegas na escala pública, exibindo Reservado.';

