-- ============================================================
-- 00_enums.sql
-- Tipos enumerados e complexos compartilhados
-- ============================================================

CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired', 'reported', 'rejected');

-- Migração para bancos já existentes (rodar manualmente se o enum já foi criado):
-- ALTER TYPE question_status ADD VALUE IF NOT EXISTS 'rejected';
