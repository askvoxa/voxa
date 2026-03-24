-- ============================================================
-- 03_functions.sql
-- Funções PLPGSQL isoladas (RPCs, Hooks, Lógica atômica)
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_daily_question_counts()
RETURNS void AS $$
BEGIN
    UPDATE profiles SET questions_answered_today = 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expire_pending_questions()
RETURNS void AS $$
DECLARE
    expired_question RECORD;
    v_default_deadline INTEGER;
BEGIN
    -- Buscar deadline padrão da plataforma (fallback 36h)
    SELECT COALESCE(response_deadline_hours, 36) INTO v_default_deadline
    FROM platform_settings WHERE id = 1;

    FOR expired_question IN
        SELECT q.id, t.mp_payment_id, t.amount
        FROM questions q
        JOIN transactions t ON t.question_id = q.id
        JOIN profiles p ON p.id = q.creator_id
        WHERE q.status = 'pending'
          -- Respeitar deadline customizado do criador, senão usar o da plataforma
          AND q.created_at < NOW() - INTERVAL '1 hour' * COALESCE(p.custom_deadline_hours, v_default_deadline)
    LOOP
        -- Guard contra race condition: só expirar se ainda estiver pending
        UPDATE questions SET status = 'expired' WHERE id = expired_question.id AND status = 'pending';
        IF FOUND THEN
            INSERT INTO refund_queue (question_id, mp_payment_id, amount)
            VALUES (expired_question.id, expired_question.mp_payment_id, expired_question.amount);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_stale_payment_intents()
RETURNS void AS $$
BEGIN
  -- Mercado Pago pode retentar webhooks por até 48h — manter intents compatíveis
  DELETE FROM payment_intents WHERE created_at < NOW() - INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET questions_answered_today = questions_answered_today + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT daily_limit, questions_answered_today, is_paused, paused_until, approval_status
    INTO v_daily_limit, v_answered_today, v_is_paused, v_paused_until, v_approval_status
    FROM profiles WHERE id = p_creator_id FOR UPDATE;

  IF v_approval_status IS NOT NULL AND v_approval_status != 'approved' THEN
    RETURN FALSE;
  END IF;

  IF v_is_paused = TRUE THEN
    IF v_paused_until IS NULL OR v_paused_until > NOW() THEN
      RETURN FALSE;
    ELSE
      UPDATE profiles SET is_paused = FALSE, paused_until = NULL WHERE id = p_creator_id;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_pending_intents FROM payment_intents WHERE creator_id = p_creator_id AND created_at > NOW() - INTERVAL '2 hours';
  RETURN (v_answered_today + v_pending_intents) < v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

    INSERT INTO daily_activity (creator_id, activity_date, questions_answered, was_soldout)
    VALUES (NEW.creator_id, v_today, 1, FALSE)
    ON CONFLICT (creator_id, activity_date)
    DO UPDATE SET questions_answered = daily_activity.questions_answered + 1;

    SELECT daily_limit INTO v_daily_limit FROM profiles WHERE id = NEW.creator_id;
    SELECT questions_answered INTO v_day_answered FROM daily_activity WHERE creator_id = NEW.creator_id AND activity_date = v_today;
    IF v_day_answered >= v_daily_limit THEN
        UPDATE daily_activity SET was_soldout = TRUE WHERE creator_id = NEW.creator_id AND activity_date = v_today;
    END IF;

    SELECT COUNT(*) INTO v_total_answered FROM questions WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM questions WHERE creator_id = NEW.creator_id AND status = 'expired';
    -- total_received = TODAS as perguntas (pending, answered, expired, reported, rejected)
    SELECT COUNT(*) INTO v_total_received FROM questions WHERE creator_id = NEW.creator_id;
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (answered_at - created_at)))::BIGINT, 0) INTO v_avg_seconds FROM questions WHERE creator_id = NEW.creator_id AND status = 'answered';

    SELECT current_streak, max_streak, last_active_date INTO v_streak, v_max_streak, v_last_date FROM creator_stats WHERE creator_id = NEW.creator_id;

    IF v_last_date IS NULL OR v_last_date < v_today - 1 THEN v_streak := 1;
    ELSIF v_last_date = v_today - 1 THEN v_streak := COALESCE(v_streak, 0) + 1;
    ELSE  v_streak := COALESCE(v_streak, 1);
    END IF;

    IF v_streak > COALESCE(v_max_streak, 0) THEN v_max_streak := v_streak; END IF;

    SELECT COUNT(*) INTO v_marathon_count FROM daily_activity WHERE creator_id = NEW.creator_id AND questions_answered >= 10;
    SELECT COUNT(*) INTO v_soldout_days FROM daily_activity WHERE creator_id = NEW.creator_id AND was_soldout = TRUE AND activity_date >= v_today - 30;

    INSERT INTO creator_stats (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_creator_stats_on_expire()
RETURNS TRIGGER AS $$
DECLARE
    v_total_answered BIGINT;
    v_total_expired BIGINT;
    v_total_received BIGINT;
BEGIN
    IF NEW.status <> 'expired' OR OLD.status = 'expired' THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO v_total_answered FROM questions WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM questions WHERE creator_id = NEW.creator_id AND status = 'expired';
    -- total_received = TODAS as perguntas (não apenas answered + expired)
    SELECT COUNT(*) INTO v_total_received FROM questions WHERE creator_id = NEW.creator_id;

    INSERT INTO creator_stats (creator_id, total_answered, total_received, total_expired, updated_at)
    VALUES (NEW.creator_id, v_total_answered, v_total_received, v_total_expired, NOW())
    ON CONFLICT (creator_id) DO UPDATE SET total_expired = EXCLUDED.total_expired, total_received = EXCLUDED.total_received, updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Inserção atômica de pergunta + transação (chamada pelo webhook de pagamento)
-- Garante que não existe question órfã sem transaction
CREATE OR REPLACE FUNCTION insert_question_and_transaction(
    p_question JSONB,
    p_transaction JSONB
) RETURNS UUID AS $$
DECLARE
    v_question_id UUID;
BEGIN
    INSERT INTO questions (
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
        COALESCE(p_question->>'status', 'pending'),
        NULLIF(p_question->>'answered_at', '')::TIMESTAMPTZ,
        NULLIF(p_question->>'response_text', '')
    ) RETURNING id INTO v_question_id;

    INSERT INTO transactions (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_top_supporters(p_creator_id UUID)
RETURNS TABLE (display_name TEXT, is_anonymous BOOLEAN, total_paid DECIMAL, email_hash TEXT) AS $$
BEGIN
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
    FROM questions q
    WHERE q.creator_id = p_creator_id
      AND q.status IN ('pending', 'answered')
      AND q.created_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
      AND (q.sender_id IS NOT NULL OR q.sender_email IS NOT NULL)
  ) sub
  GROUP BY sub.group_key
  ORDER BY total_paid DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
