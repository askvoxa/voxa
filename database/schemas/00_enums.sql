-- ============================================================
-- 00_enums.sql
-- Tipos enumerados e complexos compartilhados
-- ============================================================

CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired', 'reported');
