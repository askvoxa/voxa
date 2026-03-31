-- ============================================================
-- MIGRAÇÃO: Sistema de Payouts
-- Data: 2026-03-26
-- Descrição: Adiciona ENUMs, tabelas, colunas, funções,
--            triggers, RLS e indexes para o sistema de saques.
-- ============================================================
-- INSTRUÇÕES:
-- 1. Execute este script inteiro no SQL Editor do Supabase
-- 2. Substitua 'SUA_PIX_ENCRYPTION_KEY_AQUI' pelo valor real
--    da variável PIX_ENCRYPTION_KEY (apenas se quiser testar
--    encriptação diretamente no SQL — a app usa env var)
-- 3. Após executar, verifique com as queries de validação no final
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Extensão pgcrypto (necessária para encriptação de chaves PIX)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. ENUMs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE pix_key_type AS ENUM ('cpf', 'cnpj');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ledger_reference_type AS ENUM ('transaction', 'payout');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Novas colunas em tabelas existentes
-- ============================================================

-- profiles: saldo materializado e flag de bloqueio
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00
    CHECK (available_balance >= 0);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payouts_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- platform_settings: parâmetros de payout
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS payout_day_of_week INTEGER NOT NULL DEFAULT 1
    CHECK (payout_day_of_week BETWEEN 0 AND 6);

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS min_payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 50.00
    CHECK (min_payout_amount > 0);

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS payout_release_days INTEGER NOT NULL DEFAULT 7
    CHECK (payout_release_days >= 1);

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS payouts_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 4. Novas tabelas
-- ============================================================

-- Chaves PIX dos criadores (valor encriptado via pgcrypto)
CREATE TABLE IF NOT EXISTS creator_pix_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key_type pix_key_type NOT NULL,
    key_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Apenas 1 chave PIX ativa por criador
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_pix_keys_unique_active
    ON creator_pix_keys(creator_id) WHERE is_active = TRUE;

-- Ledger contábil (credit/debit) — source of truth do saldo
CREATE TABLE IF NOT EXISTS creator_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type ledger_entry_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    reference_type ledger_reference_type NOT NULL,
    reference_id UUID NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ledger_reference UNIQUE (reference_type, reference_id, type)
);

-- Solicitações de saque
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    pix_key_id UUID NOT NULL REFERENCES creator_pix_keys(id),
    status payout_status DEFAULT 'pending',
    mp_payout_id TEXT,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- 5. Funções PL/pgSQL
-- ============================================================

-- RPC: cadastra/atualiza chave PIX atomicamente (desativa anterior + insere nova + criptografa)
CREATE OR REPLACE FUNCTION upsert_pix_key(
  p_creator_id UUID,
  p_key_type pix_key_type,
  p_key_value TEXT,
  p_encryption_key TEXT
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  UPDATE public.creator_pix_keys
  SET is_active = FALSE
  WHERE creator_id = p_creator_id AND is_active = TRUE;

  INSERT INTO public.creator_pix_keys (creator_id, key_type, key_value, is_active)
  VALUES (
    p_creator_id,
    p_key_type,
    pgp_sym_encrypt(p_key_value, p_encryption_key),
    TRUE
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: decripta chave PIX para processamento de payouts (apenas service_role)
CREATE OR REPLACE FUNCTION decrypt_pix_key(
  p_pix_key_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE (key_type pix_key_type, key_value TEXT) AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  RETURN QUERY
  SELECT
    pk.key_type,
    pgp_sym_decrypt(pk.key_value::BYTEA, p_encryption_key) AS key_value
  FROM public.creator_pix_keys pk
  WHERE pk.id = p_pix_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: retorna chave PIX mascarada (decripta internamente, retorna mascarada)
CREATE OR REPLACE FUNCTION get_masked_pix_key(
  p_creator_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE (id UUID, key_type pix_key_type, masked_value TEXT, created_at TIMESTAMPTZ) AS $$
DECLARE
  v_raw TEXT;
  v_type pix_key_type;
  v_id UUID;
  v_created TIMESTAMPTZ;
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  SELECT pk.id, pk.key_type,
         pgp_sym_decrypt(pk.key_value::BYTEA, p_encryption_key),
         pk.created_at
    INTO v_id, v_type, v_raw, v_created
    FROM public.creator_pix_keys pk
    WHERE pk.creator_id = p_creator_id AND pk.is_active = TRUE;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  IF v_type = 'cpf' AND LENGTH(v_raw) = 11 THEN
    RETURN QUERY SELECT v_id, v_type,
      '***.' || SUBSTRING(v_raw FROM 4 FOR 3) || '.' || SUBSTRING(v_raw FROM 7 FOR 3) || '-**',
      v_created;
  ELSIF v_type = 'cnpj' AND LENGTH(v_raw) = 14 THEN
    RETURN QUERY SELECT v_id, v_type,
      '**.' || SUBSTRING(v_raw FROM 3 FOR 3) || '.' || SUBSTRING(v_raw FROM 6 FOR 3) || '/' || SUBSTRING(v_raw FROM 9 FOR 4) || '-**',
      v_created;
  ELSE
    RETURN QUERY SELECT v_id, v_type, '***mascarado***'::TEXT, v_created;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Trigger: atualiza available_balance quando lançamento é inserido no ledger
CREATE OR REPLACE FUNCTION update_balance_on_ledger_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'credit' THEN
    UPDATE public.profiles
    SET available_balance = available_balance + NEW.amount
    WHERE id = NEW.creator_id;
  ELSIF NEW.type = 'debit' THEN
    UPDATE public.profiles
    SET available_balance = available_balance - NEW.amount
    WHERE id = NEW.creator_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado para creator_id: %', NEW.creator_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: solicita saque atômico (payout_request + debit no ledger)
CREATE OR REPLACE FUNCTION request_payout(p_creator_id UUID)
RETURNS UUID AS $$
DECLARE
  v_balance DECIMAL(10, 2);
  v_blocked BOOLEAN;
  v_min_amount DECIMAL(10, 2);
  v_paused BOOLEAN;
  v_pix_key_id UUID;
  v_payout_id UUID;
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  -- Lock no profile para evitar race condition
  SELECT available_balance, payouts_blocked
    INTO v_balance, v_blocked
    FROM public.profiles
    WHERE id = p_creator_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Criador não encontrado';
  END IF;

  IF v_blocked THEN
    RAISE EXCEPTION 'Saques bloqueados para este criador';
  END IF;

  -- Buscar parâmetros da plataforma
  SELECT min_payout_amount, payouts_paused
    INTO v_min_amount, v_paused
    FROM public.platform_settings
    WHERE id = 1;

  IF v_paused THEN
    RAISE EXCEPTION 'Saques estão pausados globalmente';
  END IF;

  IF v_balance < v_min_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Mínimo: R$%, disponível: R$%', v_min_amount, v_balance;
  END IF;

  -- Buscar chave PIX ativa
  SELECT id INTO v_pix_key_id
    FROM public.creator_pix_keys
    WHERE creator_id = p_creator_id AND is_active = TRUE;

  IF v_pix_key_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma chave PIX ativa cadastrada';
  END IF;

  -- Criar payout request
  INSERT INTO public.payout_requests (creator_id, amount, pix_key_id, status)
  VALUES (p_creator_id, v_balance, v_pix_key_id, 'pending')
  RETURNING id INTO v_payout_id;

  -- Inserir debit no ledger (trigger decrementa available_balance)
  INSERT INTO public.creator_ledger (creator_id, type, amount, reference_type, reference_id, description)
  VALUES (p_creator_id, 'debit', v_balance, 'payout', v_payout_id,
          'Saque solicitado #' || v_payout_id::TEXT);

  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: retorna saldo disponível, pendente de liberação e total sacado
CREATE OR REPLACE FUNCTION get_creator_balance(p_creator_id UUID)
RETURNS TABLE (
  available_balance DECIMAL,
  pending_release DECIMAL,
  total_withdrawn DECIMAL
) AS $$
DECLARE
  v_release_days INTEGER;
BEGIN
  SELECT COALESCE(payout_release_days, 7) INTO v_release_days
    FROM public.platform_settings WHERE id = 1;

  RETURN QUERY
  SELECT
    COALESCE(p.available_balance, 0)::DECIMAL AS available_balance,

    COALESCE((
      SELECT SUM(t.creator_net)
      FROM public.transactions t
      JOIN public.questions q ON q.id = t.question_id
      WHERE q.creator_id = p_creator_id
        AND t.status = 'approved'
        AND q.status = 'answered'
        AND q.answered_at > NOW() - INTERVAL '1 day' * v_release_days
        AND NOT EXISTS (
          SELECT 1 FROM public.creator_ledger cl
          WHERE cl.reference_type = 'transaction'
            AND cl.reference_id = t.id
            AND cl.type = 'credit'
        )
    ), 0)::DECIMAL AS pending_release,

    COALESCE((
      SELECT SUM(pr.amount)
      FROM public.payout_requests pr
      WHERE pr.creator_id = p_creator_id AND pr.status = 'completed'
    ), 0)::DECIMAL AS total_withdrawn

  FROM public.profiles p
  WHERE p.id = p_creator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================================
-- 6. Triggers
-- ============================================================

-- Atualiza available_balance a cada lançamento no ledger
DROP TRIGGER IF EXISTS trg_ledger_update_balance ON creator_ledger;
CREATE TRIGGER trg_ledger_update_balance
  AFTER INSERT ON creator_ledger
  FOR EACH ROW EXECUTE FUNCTION update_balance_on_ledger_insert();

-- Atualiza updated_at na tabela de chaves PIX
DROP TRIGGER IF EXISTS trg_pix_keys_updated_at ON creator_pix_keys;
CREATE TRIGGER trg_pix_keys_updated_at
  BEFORE UPDATE ON creator_pix_keys
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- 7. Row Level Security
-- ============================================================

-- Creator PIX Keys
ALTER TABLE creator_pix_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Criador vê suas chaves PIX" ON creator_pix_keys;
CREATE POLICY "Criador vê suas chaves PIX" ON creator_pix_keys
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Criador cadastra chave PIX" ON creator_pix_keys;
CREATE POLICY "Criador cadastra chave PIX" ON creator_pix_keys
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Criador atualiza sua chave PIX" ON creator_pix_keys;
CREATE POLICY "Criador atualiza sua chave PIX" ON creator_pix_keys
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Admin vê todas chaves PIX" ON creator_pix_keys;
CREATE POLICY "Admin vê todas chaves PIX" ON creator_pix_keys
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- Creator Ledger
ALTER TABLE creator_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Criador vê seus lançamentos" ON creator_ledger;
CREATE POLICY "Criador vê seus lançamentos" ON creator_ledger
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Admin vê todos lançamentos" ON creator_ledger;
CREATE POLICY "Admin vê todos lançamentos" ON creator_ledger
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

DROP POLICY IF EXISTS "creator_ledger bloqueado para escrita" ON creator_ledger;
CREATE POLICY "creator_ledger bloqueado para escrita" ON creator_ledger
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "creator_ledger bloqueado para update" ON creator_ledger;
CREATE POLICY "creator_ledger bloqueado para update" ON creator_ledger
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "creator_ledger bloqueado para delete" ON creator_ledger;
CREATE POLICY "creator_ledger bloqueado para delete" ON creator_ledger
  FOR DELETE USING (false);

-- Payout Requests
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Criador vê seus saques" ON payout_requests;
CREATE POLICY "Criador vê seus saques" ON payout_requests
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Admin vê todos saques" ON payout_requests;
CREATE POLICY "Admin vê todos saques" ON payout_requests
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

DROP POLICY IF EXISTS "payout_requests bloqueado para escrita" ON payout_requests;
CREATE POLICY "payout_requests bloqueado para escrita" ON payout_requests
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "payout_requests bloqueado para update" ON payout_requests;
CREATE POLICY "payout_requests bloqueado para update" ON payout_requests
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "payout_requests bloqueado para delete" ON payout_requests;
CREATE POLICY "payout_requests bloqueado para delete" ON payout_requests
  FOR DELETE USING (false);

-- ============================================================
-- 8. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_creator_pix_keys_creator_active
  ON creator_pix_keys(creator_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator
  ON creator_ledger(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_ledger_reference
  ON creator_ledger(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_status
  ON payout_requests(status, requested_at);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator
  ON payout_requests(creator_id, requested_at DESC);

-- ============================================================
-- 9. Atualizar seed do platform_settings (adiciona colunas de payout)
-- ============================================================

UPDATE platform_settings
SET payout_day_of_week = 1,
    min_payout_amount = 50.00,
    payout_release_days = 7,
    payouts_paused = FALSE
WHERE id = 1;

COMMIT;

-- ============================================================
-- QUERIES DE VALIDAÇÃO (execute após a migração para confirmar)
-- ============================================================

-- Verificar ENUMs criados
-- SELECT typname FROM pg_type WHERE typname IN ('pix_key_type', 'ledger_entry_type', 'ledger_reference_type', 'payout_status');

-- Verificar novas tabelas
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('creator_pix_keys', 'creator_ledger', 'payout_requests') AND table_schema = 'public';

-- Verificar colunas adicionadas em profiles
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('available_balance', 'payouts_blocked');

-- Verificar colunas adicionadas em platform_settings
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'platform_settings' AND column_name IN ('payout_day_of_week', 'min_payout_amount', 'payout_release_days', 'payouts_paused');

-- Verificar triggers
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_name IN ('trg_ledger_update_balance', 'trg_pix_keys_updated_at');

-- Verificar funções
-- SELECT proname FROM pg_proc WHERE proname IN ('update_balance_on_ledger_insert', 'request_payout', 'get_creator_balance');

-- Verificar RLS ativo
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('creator_pix_keys', 'creator_ledger', 'payout_requests');

-- Verificar platform_settings atualizado
-- SELECT payout_day_of_week, min_payout_amount, payout_release_days, payouts_paused FROM platform_settings WHERE id = 1;
