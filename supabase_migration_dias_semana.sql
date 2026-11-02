-- ============================================================
-- Migração: Formato Completo dos Dias da Semana
-- ============================================================
-- Atualiza os turnos existentes com nomes curtos para o formato completo:
-- 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA',
-- 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO'.

UPDATE turnos 
SET dia = 'SEGUNDA-FEIRA' 
WHERE UPPER(TRIM(dia)) = 'SEGUNDA';

UPDATE turnos 
SET dia = 'TERÇA-FEIRA' 
WHERE UPPER(TRIM(dia)) IN ('TERÇA', 'TERCA');

UPDATE turnos 
SET dia = 'QUARTA-FEIRA' 
WHERE UPPER(TRIM(dia)) = 'QUARTA';

UPDATE turnos 
SET dia = 'QUINTA-FEIRA' 
WHERE UPPER(TRIM(dia)) = 'QUINTA';

UPDATE turnos 
SET dia = 'SEXTA-FEIRA' 
WHERE UPPER(TRIM(dia)) = 'SEXTA';

UPDATE turnos 
SET dia = 'SÁBADO' 
WHERE UPPER(TRIM(dia)) = 'SABADO';

-- Confirmação
SELECT dia, COUNT(*) as total_turnos
FROM turnos
GROUP BY dia
ORDER BY total_turnos DESC;

