-- ============================================================
-- 03_functions.sql
-- Funções PLPGSQL isoladas (RPCs, Hooks, Lógica atômica)
-- Todas as funções usam SET search_path = '' para evitar
-- ataques de search_path hijacking (Supabase Security Advisor)
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE OR REPLACE FUNCTION protect_profile_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'Não é permitido alterar account_type diretamente';
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Não é permitido alterar is_admin diretamente';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      RAISE EXCEPTION 'Não é permitido alterar is_verified diretamente';
    END IF;
    IF NEW.is_founder IS DISTINCT FROM OLD.is_founder THEN
      RAISE EXCEPTION 'Não é permitido alterar is_founder diretamente';
    END IF;
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      RAISE EXCEPTION 'Não é permitido alterar approval_status diretamente';
    END IF;
    -- Campos financeiros: apenas service_role pode alterar (H5)
    IF NEW.available_balance IS DISTINCT FROM OLD.available_balance THEN
      RAISE EXCEPTION 'Não é permitido alterar available_balance diretamente';
    END IF;
    IF NEW.payouts_blocked IS DISTINCT FROM OLD.payouts_blocked THEN
      RAISE EXCEPTION 'Não é permitido alterar payouts_blocked diretamente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE OR REPLACE FUNCTION reset_daily_question_counts()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles SET questions_answered_today = 0;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE OR REPLACE FUNCTION expire_pending_questions()
RETURNS void AS $$
DECLARE
    expired_question RECORD;
    v_default_deadline INTEGER;
BEGIN
    -- Buscar deadline padrão da plataforma (fallback 36h)
    SELECT COALESCE(response_deadline_hours, 36) INTO v_default_deadline
    FROM public.platform_settings WHERE id = 1;

    FOR expired_question IN
        SELECT q.id, t.mp_payment_id, t.amount
        FROM public.questions q
        JOIN public.transactions t ON t.question_id = q.id
        JOIN public.profiles p ON p.id = q.creator_id
        WHERE q.status = 'pending'
          -- Respeitar deadline customizado do criador, senão usar o da plataforma
          AND q.created_at < NOW() - INTERVAL '1 hour' * COALESCE(p.custom_deadline_hours, v_default_deadline)
    LOOP
        -- Guard contra race condition: só expirar se ainda estiver pending
        UPDATE public.questions SET status = 'expired' WHERE id = expired_question.id AND status = 'pending';
        IF FOUND THEN
            INSERT INTO public.refund_queue (question_id, mp_payment_id, amount)
            VALUES (expired_question.id, expired_question.mp_payment_id, expired_question.amount);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION cleanup_stale_payment_intents()
RETURNS void AS $$
BEGIN
  -- Mercado Pago pode retentar webhooks por até 48h — manter intents compatíveis
  DELETE FROM public.payment_intents WHERE created_at < NOW() - INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Restrito a service_role — impede que usuários inflem contadores de outros criadores
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

-- Restrito a service_role — impede DoS via row lock e unpause não autorizado.
-- p_exclude_intent_id: quando chamado pelo webhook, passar o UUID do intent sendo processado
-- para excluí-lo da contagem de pendentes. Sem isso, o próprio intent do fã sendo confirmado
-- seria contabilizado, causando falso-positivo de "limite atingido" para criadores com daily_limit baixo.
CREATE OR REPLACE FUNCTION can_accept_question(p_creator_id UUID, p_exclude_intent_id UUID DEFAULT NULL)
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

  -- Excluir o intent atual (p_exclude_intent_id) da contagem quando chamado pelo webhook,
  -- pois ele representa o pagamento em confirmação — não um slot adicional ocupado por outro fã.
  SELECT COUNT(*) INTO v_pending_intents
    FROM public.payment_intents
    WHERE creator_id = p_creator_id
      AND created_at > NOW() - INTERVAL '2 hours'
      AND (p_exclude_intent_id IS NULL OR id != p_exclude_intent_id);

  RETURN (v_answered_today + v_pending_intents) < v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION update_creator_stats_on_answer()
RETURNS TRIGGER AS $$
DECLARE
    v_today DATE;
    v_daily_limit INTEGER;
    v_day_answered INTEGER;
    v_total_answered BIGINT;
    v_total_expired BIGINT;
    v_total_received BIGINT;
    v_avg_seconds BIGINT;
    v_streak INTEGER;
    v_max_streak INTEGER;
    v_last_date DATE;
    v_marathon_count INTEGER;
    v_soldout_days INTEGER;
BEGIN
    IF NEW.status <> 'answered' OR OLD.status = 'answered' THEN RETURN NEW; END IF;

    v_today := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    INSERT INTO public.daily_activity (creator_id, activity_date, questions_answered, was_soldout)
    VALUES (NEW.creator_id, v_today, 1, FALSE)
    ON CONFLICT (creator_id, activity_date)
    DO UPDATE SET questions_answered = public.daily_activity.questions_answered + 1;

    SELECT daily_limit INTO v_daily_limit FROM public.profiles WHERE id = NEW.creator_id;
    SELECT questions_answered INTO v_day_answered FROM public.daily_activity WHERE creator_id = NEW.creator_id AND activity_date = v_today;
    IF v_day_answered >= v_daily_limit THEN
        UPDATE public.daily_activity SET was_soldout = TRUE WHERE creator_id = NEW.creator_id AND activity_date = v_today;
    END IF;

    SELECT COUNT(*) INTO v_total_answered FROM public.questions WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM public.questions WHERE creator_id = NEW.creator_id AND status = 'expired';
    -- total_received = TODAS as perguntas (pending, answered, expired, reported, rejected)
    SELECT COUNT(*) INTO v_total_received FROM public.questions WHERE creator_id = NEW.creator_id;
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (answered_at - created_at)))::BIGINT, 0) INTO v_avg_seconds FROM public.questions WHERE creator_id = NEW.creator_id AND status = 'answered';

    SELECT current_streak, max_streak, last_active_date INTO v_streak, v_max_streak, v_last_date FROM public.creator_stats WHERE creator_id = NEW.creator_id;

    IF v_last_date IS NULL OR v_last_date < v_today - 1 THEN v_streak := 1;
    ELSIF v_last_date = v_today - 1 THEN v_streak := COALESCE(v_streak, 0) + 1;
    ELSE  v_streak := COALESCE(v_streak, 1);
    END IF;

    IF v_streak > COALESCE(v_max_streak, 0) THEN v_max_streak := v_streak; END IF;

    SELECT COUNT(*) INTO v_marathon_count FROM public.daily_activity WHERE creator_id = NEW.creator_id AND questions_answered >= 10;
    SELECT COUNT(*) INTO v_soldout_days FROM public.daily_activity WHERE creator_id = NEW.creator_id AND was_soldout = TRUE AND activity_date >= v_today - 30;

    INSERT INTO public.creator_stats (
        creator_id, total_answered, total_received, total_expired, current_streak, max_streak, last_active_date, avg_response_seconds, soldout_days_last30, marathon_count, updated_at
    ) VALUES (
        NEW.creator_id, v_total_answered, v_total_received, v_total_expired, v_streak, v_max_streak, v_today, v_avg_seconds, v_soldout_days, v_marathon_count, NOW()
    )
    ON CONFLICT (creator_id) DO UPDATE SET
        total_answered = EXCLUDED.total_answered,
        total_received = EXCLUDED.total_received,
        total_expired = EXCLUDED.total_expired,
        current_streak = EXCLUDED.current_streak,
        max_streak = EXCLUDED.max_streak,
        last_active_date = EXCLUDED.last_active_date,
        avg_response_seconds = EXCLUDED.avg_response_seconds,
        soldout_days_last30 = EXCLUDED.soldout_days_last30,
        marathon_count = EXCLUDED.marathon_count,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION update_creator_stats_on_expire()
RETURNS TRIGGER AS $$
DECLARE
    v_total_answered BIGINT;
    v_total_expired BIGINT;
    v_total_received BIGINT;
BEGIN
    IF NEW.status <> 'expired' OR OLD.status = 'expired' THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO v_total_answered FROM public.questions WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM public.questions WHERE creator_id = NEW.creator_id AND status = 'expired';
    -- total_received = TODAS as perguntas (não apenas answered + expired)
    SELECT COUNT(*) INTO v_total_received FROM public.questions WHERE creator_id = NEW.creator_id;

    INSERT INTO public.creator_stats (creator_id, total_answered, total_received, total_expired, updated_at)
    VALUES (NEW.creator_id, v_total_answered, v_total_received, v_total_expired, NOW())
    ON CONFLICT (creator_id) DO UPDATE SET total_expired = EXCLUDED.total_expired, total_received = EXCLUDED.total_received, updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- Inserção atômica de pergunta + transação (chamada pelo webhook de pagamento)
-- Garante que não existe question órfã sem transaction
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
        v_status::public.question_status,
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

-- Auth check: apenas o próprio criador pode consultar seus top supporters
-- Previne enumeração de PII (email hashes) por usuários não autorizados
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

-- Protege campos sensíveis de questions contra alteração direta por criadores
-- Apenas service_role (webhook) pode alterar campos financeiros e de identidade
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

-- Sanitiza sender_name quando a pergunta é anônima (proteção de privacidade no DB)
-- Evita que o nome real do fã fique armazenado quando is_anonymous=true
CREATE OR REPLACE FUNCTION sanitize_anonymous_sender_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_anonymous = TRUE THEN
    NEW.sender_name := 'Anônimo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================================
-- Funções do sistema de Payouts
-- ============================================================

-- RPC: cadastra/atualiza chave PIX de forma atômica (desativa anterior + insere nova + criptografa)
-- Garante que o criador nunca fique sem chave ativa em caso de erro parcial
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

  -- Desativar chave anterior (se existir)
  UPDATE public.creator_pix_keys
  SET is_active = FALSE
  WHERE creator_id = p_creator_id AND is_active = TRUE;

  -- Inserir nova chave com valor encriptado via pgcrypto
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

-- RPC: decripta chave PIX para uso no processamento de payouts
-- Apenas service_role pode chamar (usado pelo cron de process-payouts)
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

-- RPC: retorna chave PIX mascarada para exibição (sem expor valor real)
-- Decripta internamente, retorna apenas os dígitos centrais mascarados
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

  -- Mascarar: CPF → ***.456.789-** | CNPJ → **.345.678/0001-**
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

-- RPC: retorna transações elegíveis para liberação de saldo (elimina N+1 do cron)
-- Filtra transações approved+answered fora do período de carência e sem credit no ledger
CREATE OR REPLACE FUNCTION get_eligible_earnings_for_release(p_release_days INTEGER)
RETURNS TABLE (
  transaction_id UUID,
  creator_id UUID,
  creator_net DECIMAL,
  question_id UUID
) AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  RETURN QUERY
  SELECT
    t.id AS transaction_id,
    q.creator_id,
    t.creator_net,
    q.id AS question_id
  FROM public.transactions t
  JOIN public.questions q ON q.id = t.question_id
  WHERE t.status = 'approved'
    AND q.status = 'answered'
    AND q.answered_at <= NOW() - INTERVAL '1 day' * p_release_days
    AND t.creator_net IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.creator_ledger cl
      WHERE cl.reference_type = 'transaction'
        AND cl.reference_id = t.id
        AND cl.type = 'credit'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Trigger: atualiza available_balance no profile quando um lançamento é inserido no ledger
-- O UPDATE implícito do PostgreSQL garante atomicidade por row lock
CREATE OR REPLACE FUNCTION update_balance_on_ledger_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'credit' THEN
    UPDATE public.profiles
    SET available_balance = available_balance + NEW.amount
    WHERE id = NEW.creator_id;
  ELSIF NEW.type = 'debit' THEN
    -- O CHECK constraint (available_balance >= 0) protege contra saldo negativo
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

-- RPC: solicita saque atômico (cria payout_request + debit no ledger)
-- Apenas service_role pode chamar esta função
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

  -- Rejeitar se já existe payout pendente ou em processamento (H7)
  IF EXISTS (
    SELECT 1 FROM public.payout_requests
    WHERE creator_id = p_creator_id AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'Já existe um saque pendente ou em processamento';
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

  -- Inserir debit no ledger (o trigger decrementa available_balance automaticamente)
  INSERT INTO public.creator_ledger (creator_id, type, amount, reference_type, reference_id, description)
  VALUES (p_creator_id, 'debit', v_balance, 'payout', v_payout_id,
          'Saque solicitado #' || v_payout_id::TEXT);

  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: atualiza PIX key de forma atômica (C2: desativa anterior + insere nova criptografada)
-- Apenas service_role pode chamar esta função
CREATE OR REPLACE FUNCTION upsert_pix_key(
  p_creator_id UUID,
  p_key_type pix_key_type,
  p_key_value TEXT,
  p_encryption_key TEXT
)
RETURNS UUID AS $$
DECLARE
  v_new_key_id UUID;
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  -- Desativar chave anterior
  UPDATE public.creator_pix_keys
  SET is_active = FALSE
  WHERE creator_id = p_creator_id AND is_active = TRUE;

  -- Inserir nova chave criptografada
  INSERT INTO public.creator_pix_keys (creator_id, key_type, key_value, is_active)
  VALUES (p_creator_id, p_key_type, pgp_sym_encrypt(p_key_value, p_encryption_key), TRUE)
  RETURNING id INTO v_new_key_id;

  RETURN v_new_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: retorna chave PIX mascarada (decriptada apenas no DB, nunca no API layer)
CREATE OR REPLACE FUNCTION get_masked_pix_key(p_creator_id UUID, p_encryption_key TEXT)
RETURNS TABLE (key_type pix_key_type, masked_value TEXT, created_at TIMESTAMPTZ) AS $$
DECLARE
  v_decrypted TEXT;
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  RETURN QUERY
  SELECT
    cpk.key_type,
    CASE cpk.key_type
      WHEN 'cpf' THEN '***.***' || RIGHT(pgp_sym_decrypt(cpk.key_value::BYTEA, p_encryption_key), 5)
      WHEN 'cnpj' THEN '**.***.***' || RIGHT(pgp_sym_decrypt(cpk.key_value::BYTEA, p_encryption_key), 8)
    END AS masked_value,
    cpk.created_at
  FROM public.creator_pix_keys cpk
  WHERE cpk.creator_id = p_creator_id AND cpk.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: retorna chave PIX decriptada (apenas para cron/webhook via service_role)
-- Usada exclusivamente pelo cron de processamento de payouts
CREATE OR REPLACE FUNCTION get_decrypted_pix_key_for_payout(p_payout_id UUID, p_encryption_key TEXT)
RETURNS TABLE (key_type pix_key_type, key_value TEXT) AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  RETURN QUERY
  SELECT
    cpk.key_type,
    pgp_sym_decrypt(cpk.key_value::BYTEA, p_encryption_key) AS key_value
  FROM public.payout_requests pr
  JOIN public.creator_pix_keys cpk ON cpk.id = pr.pix_key_id
  WHERE pr.id = p_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: retorna resumo de saques para admin (week_total, pending_total, failed_count)
-- Elimina N+1 queries ao agregar no SQL em vez de JS
CREATE OR REPLACE FUNCTION get_payout_summary(p_week_ago TIMESTAMPTZ)
RETURNS TABLE (week_total DECIMAL, pending_total DECIMAL, failed_count BIGINT) AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode chamar esta função';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND processed_at >= p_week_ago), 0)::DECIMAL AS week_total,
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::DECIMAL AS pending_total,
    COUNT(*) FILTER (WHERE status = 'failed' AND retry_count < 3) AS failed_count
  FROM public.payout_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- RPC: retorna saldo disponível, pendente de liberação e total sacado do criador
CREATE OR REPLACE FUNCTION get_creator_balance(p_creator_id UUID)
RETURNS TABLE (
  available_balance DECIMAL,
  pending_release DECIMAL,
  total_withdrawn DECIMAL
) AS $$
DECLARE
  v_release_days INTEGER;
BEGIN
  -- Buscar dias de carência configurados
  SELECT COALESCE(payout_release_days, 7) INTO v_release_days
    FROM public.platform_settings WHERE id = 1;

  RETURN QUERY
  SELECT
    -- Saldo disponível (cache materializado no profile)
    COALESCE(p.available_balance, 0)::DECIMAL AS available_balance,

    -- Saldo pendente de liberação (respondidas dentro do período de carência, sem entry no ledger)
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

    -- Total já sacado com sucesso
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
