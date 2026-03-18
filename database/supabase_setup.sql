-- ============================================================
-- VOXA — Setup completo do banco no Supabase
-- Rodar INTEIRO no SQL Editor do Supabase (uma vez)
-- ============================================================

-- 1. Enum de status da pergunta
CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired');

-- 2. Tabela de Perfis (criadores)
-- Nota: o `id` usa o mesmo UUID do auth.users para facilitar RLS
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    min_price DECIMAL(10, 2) DEFAULT 10.00,
    daily_limit INTEGER DEFAULT 10,
    questions_answered_today INTEGER DEFAULT 0,
    referred_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Perguntas
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_email TEXT,
    content TEXT NOT NULL,
    media_url TEXT,
    status question_status DEFAULT 'pending',
    price_paid DECIMAL(10, 2) NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'base',
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_shareable BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_audio_url TEXT,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Transações
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    mp_payment_id TEXT,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- profiles: qualquer um pode ler (perfis são públicos)
CREATE POLICY "Perfis são públicos" ON profiles
    FOR SELECT USING (true);

-- profiles: usuário autenticado pode inserir o próprio perfil
CREATE POLICY "Criador insere próprio perfil" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- profiles: usuário autenticado pode atualizar o próprio perfil
CREATE POLICY "Criador atualiza próprio perfil" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- questions: criador vê suas próprias perguntas no dashboard
CREATE POLICY "Criador vê suas perguntas" ON questions
    FOR SELECT USING (
        creator_id IN (SELECT id FROM profiles WHERE id = auth.uid())
    );

-- questions: respostas públicas são visíveis a qualquer um
CREATE POLICY "Respostas públicas visíveis" ON questions
    FOR SELECT USING (
        status = 'answered' AND is_shareable = true
    );

-- questions: qualquer um (inclusive anônimo) pode inserir uma pergunta
-- (inserção acontece via webhook do MP com service role key)
CREATE POLICY "Webhook insere perguntas" ON questions
    FOR INSERT WITH CHECK (true);

-- questions: criador pode atualizar suas perguntas (para responder)
CREATE POLICY "Criador responde pergunta" ON questions
    FOR UPDATE USING (
        creator_id IN (SELECT id FROM profiles WHERE id = auth.uid())
    );

-- transactions: apenas o criador da pergunta pode ver a transação
CREATE POLICY "Criador vê suas transações" ON transactions
    FOR SELECT USING (
        question_id IN (
            SELECT id FROM questions
            WHERE creator_id IN (SELECT id FROM profiles WHERE id = auth.uid())
        )
    );

-- transactions: inserção via webhook (service role)
CREATE POLICY "Webhook insere transações" ON transactions
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- Tabela de intenções de pagamento (temporária, limpa após webhook)
-- Vincula o external_reference do MP com os dados da pergunta
-- ============================================================
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_data JSONB NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- payment_intents: apenas service role acessa (sem políticas públicas)
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Função para resetar questions_answered_today à meia-noite
-- ============================================================
CREATE OR REPLACE FUNCTION reset_daily_question_counts()
RETURNS void AS $$
BEGIN
    UPDATE profiles SET questions_answered_today = 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Tabela de fila de reembolsos
-- Populada automaticamente pela função expire_pending_questions()
-- Processada pelo endpoint GET /api/refunds/process
-- ============================================================
CREATE TABLE IF NOT EXISTS refund_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    mp_payment_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | processed | failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE refund_queue ENABLE ROW LEVEL SECURITY;
-- Apenas service role acessa (sem políticas públicas)

-- ============================================================
-- Função para expirar perguntas pendentes após 36h e enfileirar reembolso
-- Chamada a cada 30 minutos via cron
-- ============================================================
CREATE OR REPLACE FUNCTION expire_pending_questions()
RETURNS void AS $$
DECLARE
    expired_question RECORD;
BEGIN
    FOR expired_question IN
        SELECT q.id, t.mp_payment_id, t.amount
        FROM questions q
        JOIN transactions t ON t.question_id = q.id
        WHERE q.status = 'pending'
          AND q.created_at < NOW() - INTERVAL '36 hours'
    LOOP
        UPDATE questions SET status = 'expired' WHERE id = expired_question.id;
        INSERT INTO refund_queue (question_id, mp_payment_id, amount)
        VALUES (expired_question.id, expired_question.mp_payment_id, expired_question.amount);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Cron jobs (requerem extensão pg_cron — habilitar no painel Supabase)
-- Painel: Database > Extensions > pg_cron
-- ============================================================

-- Habilitar pg_cron (rodar uma vez se não estiver ativo):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Reset diário às 03:00 UTC (meia-noite BRT = UTC-3)
-- SELECT cron.schedule('reset-daily-counts', '0 3 * * *', $$SELECT reset_daily_question_counts()$$);

-- Expirar perguntas antigas a cada 30 minutos
-- SELECT cron.schedule('expire-questions', '*/30 * * * *', $$SELECT expire_pending_questions()$$);

-- Verificar agendamentos ativos:
-- SELECT * FROM cron.job;

-- ============================================================
-- Índices de performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_questions_creator_status ON questions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_creator_answered_at ON questions(creator_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_payment_intents_creator ON payment_intents(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_preference ON payment_intents(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_refund_queue_status ON refund_queue(status, created_at);

-- Constraint de idempotência: evita transações duplicadas pelo mesmo pagamento MP
ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_mp_payment_id_unique UNIQUE (mp_payment_id);

-- ============================================================
-- Função: incremento atômico do contador diário (chamada ao responder pergunta)
-- Rodar no SQL Editor se ainda não existir:
-- ============================================================
CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET questions_answered_today = questions_answered_today + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Função: verificação atômica do limite diário com lock pessimista
-- Evita race condition quando múltiplos fãs enviam perguntas simultaneamente
-- Conta perguntas já respondidas + payment_intents ativos (em processamento)
-- ============================================================
CREATE OR REPLACE FUNCTION can_accept_question(p_creator_id UUID)
RETURNS boolean AS $$
DECLARE
  v_daily_limit integer;
  v_answered_today integer;
  v_pending_intents integer;
BEGIN
  -- Lock pessimista: serializa verificações concorrentes para o mesmo criador
  SELECT daily_limit, questions_answered_today
  INTO v_daily_limit, v_answered_today
  FROM profiles
  WHERE id = p_creator_id
  FOR UPDATE;

  -- Conta payment_intents ativos nas últimas 2h (pagamentos em andamento)
  SELECT COUNT(*)
  INTO v_pending_intents
  FROM payment_intents
  WHERE creator_id = p_creator_id
    AND created_at > NOW() - INTERVAL '2 hours';

  RETURN (v_answered_today + v_pending_intents) < v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Storage: criar bucket 'responses' para áudios
-- (fazer via Dashboard: Storage > New Bucket > "responses" > Public)
-- Ou via SQL:
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('responses', 'responses', true)
ON CONFLICT DO NOTHING;

-- Política de storage: criadores fazem upload dos próprios áudios
CREATE POLICY "Criadores fazem upload de áudio"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'responses'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política de storage: áudios são públicos para leitura
CREATE POLICY "Áudios são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'responses');

-- ============================================================
-- MARCOS / CONQUISTAS — Sistema de gamificação para criadores
-- ============================================================

-- 5. Tabela de atividade diária (base para streak, sold-out, maratonista)
CREATE TABLE daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    was_soldout BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, activity_date)
);

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atividade diária é pública" ON daily_activity
    FOR SELECT USING (true);

CREATE INDEX idx_daily_activity_creator_date
    ON daily_activity(creator_id, activity_date DESC);

-- 6. Tabela de stats materializados por criador
CREATE TABLE creator_stats (
    creator_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    total_answered INTEGER DEFAULT 0,
    total_received INTEGER DEFAULT 0,
    total_expired INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    last_active_date DATE,
    avg_response_seconds BIGINT DEFAULT 0,
    soldout_days_last30 INTEGER DEFAULT 0,
    marathon_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE creator_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stats são públicos" ON creator_stats
    FOR SELECT USING (true);

-- 7. Trigger: atualiza stats quando criador responde uma pergunta
CREATE OR REPLACE FUNCTION update_creator_stats_on_answer()
RETURNS TRIGGER AS $$
DECLARE
    v_today DATE;
    v_daily_limit INTEGER;
    v_day_answered INTEGER;
    v_total_answered BIGINT;
    v_total_expired BIGINT;
    v_avg_seconds BIGINT;
    v_streak INTEGER;
    v_max_streak INTEGER;
    v_last_date DATE;
    v_marathon_count INTEGER;
    v_soldout_days INTEGER;
BEGIN
    IF NEW.status <> 'answered' OR OLD.status = 'answered' THEN
        RETURN NEW;
    END IF;

    v_today := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    -- Upsert daily_activity
    INSERT INTO daily_activity (creator_id, activity_date, questions_answered, was_soldout)
    VALUES (NEW.creator_id, v_today, 1, FALSE)
    ON CONFLICT (creator_id, activity_date)
    DO UPDATE SET questions_answered = daily_activity.questions_answered + 1;

    -- Checar sold-out
    SELECT daily_limit INTO v_daily_limit FROM profiles WHERE id = NEW.creator_id;
    SELECT questions_answered INTO v_day_answered
        FROM daily_activity WHERE creator_id = NEW.creator_id AND activity_date = v_today;
    IF v_day_answered >= v_daily_limit THEN
        UPDATE daily_activity SET was_soldout = TRUE
            WHERE creator_id = NEW.creator_id AND activity_date = v_today;
    END IF;

    -- Aggregates
    SELECT COUNT(*) INTO v_total_answered FROM questions
        WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM questions
        WHERE creator_id = NEW.creator_id AND status = 'expired';
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (answered_at - created_at)))::BIGINT, 0)
        INTO v_avg_seconds FROM questions
        WHERE creator_id = NEW.creator_id AND status = 'answered';

    -- Streak
    SELECT current_streak, max_streak, last_active_date
        INTO v_streak, v_max_streak, v_last_date
        FROM creator_stats WHERE creator_id = NEW.creator_id;

    IF v_last_date IS NULL OR v_last_date < v_today - 1 THEN
        v_streak := 1;
    ELSIF v_last_date = v_today - 1 THEN
        v_streak := COALESCE(v_streak, 0) + 1;
    ELSE
        v_streak := COALESCE(v_streak, 1);
    END IF;

    IF v_streak > COALESCE(v_max_streak, 0) THEN
        v_max_streak := v_streak;
    END IF;

    -- Marathon (dias com 10+ respostas)
    SELECT COUNT(*) INTO v_marathon_count FROM daily_activity
        WHERE creator_id = NEW.creator_id AND questions_answered >= 10;

    -- Sold-out últimos 30 dias
    SELECT COUNT(*) INTO v_soldout_days FROM daily_activity
        WHERE creator_id = NEW.creator_id
          AND was_soldout = TRUE
          AND activity_date >= v_today - 30;

    -- Upsert creator_stats
    INSERT INTO creator_stats (
        creator_id, total_answered, total_received, total_expired,
        current_streak, max_streak, last_active_date,
        avg_response_seconds, soldout_days_last30, marathon_count, updated_at
    ) VALUES (
        NEW.creator_id, v_total_answered, v_total_answered + v_total_expired, v_total_expired,
        v_streak, v_max_streak, v_today,
        v_avg_seconds, v_soldout_days, v_marathon_count, NOW()
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

CREATE TRIGGER trg_update_stats_on_answer
    AFTER UPDATE ON questions
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_stats_on_answer();

-- 8. Trigger: atualiza stats quando pergunta expira (para taxa de resposta)
CREATE OR REPLACE FUNCTION update_creator_stats_on_expire()
RETURNS TRIGGER AS $$
DECLARE
    v_total_answered BIGINT;
    v_total_expired BIGINT;
BEGIN
    IF NEW.status <> 'expired' OR OLD.status = 'expired' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_total_answered FROM questions
        WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM questions
        WHERE creator_id = NEW.creator_id AND status = 'expired';

    INSERT INTO creator_stats (creator_id, total_answered, total_received, total_expired, updated_at)
    VALUES (NEW.creator_id, v_total_answered, v_total_answered + v_total_expired, v_total_expired, NOW())
    ON CONFLICT (creator_id) DO UPDATE SET
        total_expired = EXCLUDED.total_expired,
        total_received = EXCLUDED.total_received,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_stats_on_expire
    AFTER UPDATE ON questions
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_stats_on_expire();

-- 9. Backfill: popular daily_activity e creator_stats a partir de dados existentes
-- (rodar UMA VEZ após criar as tabelas acima)
/*
INSERT INTO daily_activity (creator_id, activity_date, questions_answered, was_soldout)
SELECT
    creator_id,
    (answered_at AT TIME ZONE 'America/Sao_Paulo')::DATE as activity_date,
    COUNT(*) as questions_answered,
    FALSE as was_soldout
FROM questions
WHERE status = 'answered' AND answered_at IS NOT NULL
GROUP BY creator_id, (answered_at AT TIME ZONE 'America/Sao_Paulo')::DATE
ON CONFLICT (creator_id, activity_date) DO NOTHING;

-- Após rodar o INSERT acima, popular creator_stats para cada criador:
INSERT INTO creator_stats (creator_id, total_answered, total_received, total_expired, avg_response_seconds, marathon_count, updated_at)
SELECT
    q.creator_id,
    COUNT(*) FILTER (WHERE q.status = 'answered') as total_answered,
    COUNT(*) FILTER (WHERE q.status IN ('answered', 'expired')) as total_received,
    COUNT(*) FILTER (WHERE q.status = 'expired') as total_expired,
    COALESCE(AVG(EXTRACT(EPOCH FROM (q.answered_at - q.created_at))) FILTER (WHERE q.status = 'answered')::BIGINT, 0) as avg_response_seconds,
    (SELECT COUNT(*) FROM daily_activity da WHERE da.creator_id = q.creator_id AND da.questions_answered >= 10) as marathon_count,
    NOW() as updated_at
FROM questions q
GROUP BY q.creator_id
ON CONFLICT (creator_id) DO UPDATE SET
    total_answered = EXCLUDED.total_answered,
    total_received = EXCLUDED.total_received,
    total_expired = EXCLUDED.total_expired,
    avg_response_seconds = EXCLUDED.avg_response_seconds,
    marathon_count = EXCLUDED.marathon_count,
    updated_at = NOW();
*/
