-- ============================================================
-- MIGRATION: Fase 11 - Controle de Visibilidade da Cópia da Escala
-- Permite que gestores ocultem ou exibam o botão de copiar escala
-- no WhatsApp tanto para a Escala Completa quanto para Pontos Individuais.
-- ============================================================

-- 1. Adiciona coluna para controle de cópia por ponto de captação
ALTER TABLE public.pontos
ADD COLUMN IF NOT EXISTS copia_whatsapp_ativa BOOLEAN NOT NULL DEFAULT true;

-- 2. Adiciona coluna para controle de cópia da escala completa da empresa
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS copia_whatsapp_geral_ativa BOOLEAN NOT NULL DEFAULT true;

