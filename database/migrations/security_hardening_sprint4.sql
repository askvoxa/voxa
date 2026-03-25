-- ============================================================
-- MIGRATION: Security Hardening Sprint 4
-- Data: 2026-03-25
-- Descrição: Correções de segurança identificadas no audit
--
-- INSTRUÇÕES:
--   1. Executar no Supabase SQL Editor (Dashboard > SQL Editor)
--   2. Executar em STAGING primeiro para validar
--   3. Verificar que nenhum erro ocorre antes de rodar em PROD
--   4. Cada bloco é idempotente (seguro re-executar)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CHECK CONSTRAINTS (ALTER TABLE)
--    Adiciona validações que faltavam no schema original
-- ============================================================

-- 1a. bio: limitar tamanho a 500 caracteres
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'profiles_bio_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_check CHECK (LENGTH(bio) <= 500);
  END IF;
END $$;

-- 1b. custom_creator_rate: limitar entre 0 e 95% (previne platform_fee negativo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'profiles_custom_creator_rate_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_custom_creator_rate_check
      CHECK (custom_creator_rate BETWEEN 0.0000 AND 0.9500);
  END IF;
END $$;

-- 1c. refund_queue.status: restringir a valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'refund_queue_status_check'
  ) THEN
    ALTER TABLE public.refund_queue ADD CONSTRAINT refund_queue_status_check
      CHECK (status IN ('pending', 'processed', 'failed', 'exhausted'));
  END IF;
END $$;

-- 1d. payment_intents.question_data: validar campos obrigatórios no JSONB
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'payment_intents_question_data_check'
  ) THEN
    ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_question_data_check
      CHECK (question_data ? 'creator_id' AND question_data ? 'content' AND question_data ? 'price_paid');
  END IF;
END $$;


-- ============================================================
-- 2. FUNÇÕES COM AUTH GUARDS (CREATE OR REPLACE)
--    Todas idempotentes por natureza do CREATE OR REPLACE
-- ============================================================

-- 2a. increment_answered_today: restrito a service_role
-- Previne que usuários inflem contadores de outros criadores (sabotagem)
CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;
  UPDATE public.profiles SET questions_answered_today = questions_answered_today + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- 2b. can_accept_question: restrito a service_role
-- Previne DoS via row lock (FOR UPDATE) e unpause não autorizado
CREATE OR REPLACE FUNCTION can_accept_question(p_creator_id UUID)
RETURNS boolean AS $$
DECLARE
  v_daily_limit integer;
  v_answered_today integer;
  v_pending_intents integer;
  v_is_paused boolean;
  v_paused_until timestamptz;
  v_approval_status text;
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  SELECT daily_limit, questions_answered_today, is_paused, paused_until, approval_status
    INTO v_daily_limit, v_answered_today, v_is_paused, v_paused_until, v_approval_status
    FROM public.profiles WHERE id = p_creator_id FOR UPDATE;

  IF v_approval_status IS NOT NULL AND v_approval_status != 'approved' THEN
    RETURN FALSE;
  END IF;

  IF v_is_paused = TRUE THEN
    IF v_paused_until IS NULL OR v_paused_until > NOW() THEN
      RETURN FALSE;
    ELSE
      UPDATE public.profiles SET is_paused = FALSE, paused_until = NULL WHERE id = p_creator_id;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_pending_intents FROM public.payment_intents WHERE creator_id = p_creator_id AND created_at > NOW() - INTERVAL '2 hours';
  RETURN (v_answered_today + v_pending_intents) < v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- 2c. get_top_supporters: auth check — apenas o próprio criador ou service_role
-- Previne enumeração de PII (email hashes via MD5) por usuários não autorizados
CREATE OR REPLACE FUNCTION get_top_supporters(p_creator_id UUID)
RETURNS TABLE (display_name TEXT, is_anonymous BOOLEAN, total_paid DECIMAL, email_hash TEXT) AS $$
BEGIN
  IF current_setting('role', true) != 'service_role'
     AND auth.uid() != p_creator_id THEN
    RAISE EXCEPTION 'Acesso negado: apenas o próprio criador pode consultar top supporters';
  END IF;

  RETURN QUERY
  SELECT
    (array_agg(sub.sender_name ORDER BY sub.created_at DESC))[1]::TEXT AS display_name,
    bool_or(sub.is_anonymous) AS is_anonymous,
    SUM(sub.price_paid)::DECIMAL AS total_paid,
    (array_agg(sub.email_hash))[1]::TEXT AS email_hash
  FROM (
    SELECT
      q.sender_name,
      q.is_anonymous,
      q.price_paid,
      q.created_at,
      COALESCE(q.sender_id::TEXT, LOWER(TRIM(q.sender_email))) AS group_key,
      COALESCE(
        (SELECT md5(LOWER(TRIM(au.email))) FROM auth.users au WHERE au.id = q.sender_id),
        md5(LOWER(TRIM(q.sender_email)))
      ) AS email_hash
    FROM public.questions q
    WHERE q.creator_id = p_creator_id
      AND q.status IN ('pending', 'answered')
      AND q.created_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
      AND (q.sender_id IS NOT NULL OR q.sender_email IS NOT NULL)
  ) sub
  GROUP BY sub.group_key
  ORDER BY total_paid DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- 2d. insert_question_and_transaction: validação de status
-- Previne bypass do fluxo de pagamento inserindo status inválido
CREATE OR REPLACE FUNCTION insert_question_and_transaction(
    p_question JSONB,
    p_transaction JSONB
) RETURNS UUID AS $$
DECLARE
    v_question_id UUID;
    v_status TEXT;
BEGIN
    -- Validar status permitido (previne bypass do fluxo de pagamento)
    v_status := COALESCE(p_question->>'status', 'pending');
    IF v_status NOT IN ('pending', 'answered') THEN
      RAISE EXCEPTION 'Status de pergunta inválido: %', v_status;
    END IF;

    INSERT INTO public.questions (
        creator_id, sender_id, sender_name, sender_email, content,
        price_paid, service_type, is_anonymous, is_shareable, is_support_only,
        status, answered_at, response_text
    ) VALUES (
        (p_question->>'creator_id')::UUID,
        NULLIF(p_question->>'sender_id', '')::UUID,
        p_question->>'sender_name',
        NULLIF(p_question->>'sender_email', ''),
        p_question->>'content',
        (p_question->>'price_paid')::DECIMAL,
        COALESCE(p_question->>'service_type', 'base'),
        COALESCE((p_question->>'is_anonymous')::BOOLEAN, FALSE),
        COALESCE((p_question->>'is_shareable')::BOOLEAN, FALSE),
        COALESCE((p_question->>'is_support_only')::BOOLEAN, FALSE),
        v_status,
        NULLIF(p_question->>'answered_at', '')::TIMESTAMPTZ,
        NULLIF(p_question->>'response_text', '')
    ) RETURNING id INTO v_question_id;

    INSERT INTO public.transactions (
        question_id, amount, processing_fee, platform_fee, creator_net,
        status, payment_method, mp_payment_id, mp_preference_id
    ) VALUES (
        v_question_id,
        (p_transaction->>'amount')::DECIMAL,
        (p_transaction->>'processing_fee')::DECIMAL,
        (p_transaction->>'platform_fee')::DECIMAL,
        (p_transaction->>'creator_net')::DECIMAL,
        p_transaction->>'status',
        p_transaction->>'payment_method',
        p_transaction->>'mp_payment_id',
        NULLIF(p_transaction->>'mp_preference_id', '')
    );

    RETURN v_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- ============================================================
-- 3. TRIGGER: Proteção de campos sensíveis em questions
--    Impede criadores de alterar price_paid, content, sender_*, etc.
-- ============================================================

-- 3a. Criar a função do trigger
CREATE OR REPLACE FUNCTION protect_question_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    IF NEW.price_paid IS DISTINCT FROM OLD.price_paid THEN
      RAISE EXCEPTION 'Não é permitido alterar price_paid';
    END IF;
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'Não é permitido alterar content';
    END IF;
    IF NEW.sender_name IS DISTINCT FROM OLD.sender_name THEN
      RAISE EXCEPTION 'Não é permitido alterar sender_name';
    END IF;
    IF NEW.sender_email IS DISTINCT FROM OLD.sender_email THEN
      RAISE EXCEPTION 'Não é permitido alterar sender_email';
    END IF;
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
      RAISE EXCEPTION 'Não é permitido alterar creator_id';
    END IF;
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'Não é permitido alterar sender_id';
    END IF;
    IF NEW.is_support_only IS DISTINCT FROM OLD.is_support_only THEN
      RAISE EXCEPTION 'Não é permitido alterar is_support_only';
    END IF;
    IF NEW.is_anonymous IS DISTINCT FROM OLD.is_anonymous THEN
      RAISE EXCEPTION 'Não é permitido alterar is_anonymous';
    END IF;
    IF NEW.service_type IS DISTINCT FROM OLD.service_type THEN
      RAISE EXCEPTION 'Não é permitido alterar service_type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 3b. Criar o trigger (DROP IF EXISTS para idempotência)
DROP TRIGGER IF EXISTS trg_protect_question_fields ON public.questions;
CREATE TRIGGER trg_protect_question_fields
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION protect_question_fields();


COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- Execute estas queries para confirmar que tudo foi aplicado:
-- ============================================================

-- Verificar constraints adicionadas:
-- SELECT constraint_name FROM information_schema.check_constraints
-- WHERE constraint_schema = 'public'
-- ORDER BY constraint_name;

-- Verificar trigger criado:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_protect_question_fields';

-- Testar auth guard (deve dar erro):
-- SELECT can_accept_question('00000000-0000-0000-0000-000000000000');
-- Expected: ERROR: Acesso negado: apenas service_role pode chamar esta função

-- Testar proteção de campos (deve dar erro se não service_role):
-- UPDATE questions SET price_paid = 0.01 WHERE id = '...' ;
-- Expected: ERROR: Não é permitido alterar price_paid
