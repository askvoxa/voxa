-- ============================================================
-- 00_enums.sql
-- Tipos enumerados e complexos compartilhados
-- ============================================================

-- Extensão necessária para criptografia de chaves PIX (pgp_sym_encrypt/decrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired', 'reported', 'rejected');

-- Migração para bancos já existentes (rodar manualmente se o enum já foi criado):
-- ALTER TYPE question_status ADD VALUE IF NOT EXISTS 'rejected';

-- ============================================================
-- Enums do sistema de Payouts
-- ============================================================

CREATE TYPE pix_key_type AS ENUM ('cpf', 'cnpj');
CREATE TYPE ledger_entry_type AS ENUM ('credit', 'debit');
CREATE TYPE ledger_reference_type AS ENUM ('transaction', 'payout');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
