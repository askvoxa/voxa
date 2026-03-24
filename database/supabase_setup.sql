-- ============================================================
-- VOXA — Setup completo do banco no Supabase
-- Rodar INTEIRO no SQL Editor do Supabase (uma vez)
-- Arquivo unificado e limpo contendo todas as definições.
-- ============================================================

-- 1. Enum de status da pergunta
CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired');

-- 2. Tabela de Perfis (usuários: fãs, influencers, admins)
-- Nota: o `id` usa o mesmo UUID do auth.users para facilitar RLS
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL CHECK (LENGTH(username) >= 3 AND username ~ '^[a-z0-9_-]+$'),
    bio TEXT,
    avatar_url TEXT,
    min_price DECIMAL(10, 2) DEFAULT 10.00 CHECK (min_price >= 1.00),
    daily_limit INTEGER DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 100),
    questions_answered_today INTEGER DEFAULT 0,
    referred_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    account_type TEXT DEFAULT 'fan' CHECK (account_type IN ('fan', 'influencer', 'admin')),
    creator_setup_completed BOOLEAN DEFAULT FALSE,
    custom_creator_rate DECIMAL(5, 4),      -- NULL = usa default da plataforma
    custom_deadline_hours INTEGER,          -- NULL = usa default da plataforma
    fast_ask_suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    price_paid DECIMAL(10, 2) NOT NULL CHECK (price_paid > 0),
    service_type TEXT NOT NULL DEFAULT 'base',
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_shareable BOOLEAN DEFAULT FALSE,
    is_support_only BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_audio_url TEXT,
    sender_id UUID REFERENCES profiles(id),  -- fã que enviou a pergunta (NULL para perguntas legadas)
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Convites de Influencer
CREATE TABLE invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id),
    used_by UUID REFERENCES profiles(id),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Transações
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    processing_fee DECIMAL(10, 2),   -- Taxa cobrada pelo Mercado Pago (fee_details)
    platform_fee DECIMAL(10, 2),     -- Taxa da plataforma VOXA sobre (amount - processing_fee)
    creator_net DECIMAL(10, 2),      -- Valor líquido repassado ao criador
    status TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    mp_payment_id TEXT UNIQUE,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Configurações da Plataforma (Singleton)
CREATE TABLE platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    platform_fee_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
    response_deadline_hours INTEGER NOT NULL DEFAULT 36,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserir valores padrão da plataforma
INSERT INTO platform_settings (id, platform_fee_rate, response_deadline_hours)
VALUES (1, 0.1000, 36)
ON CONFLICT (id) DO NOTHING;

-- 6. Tabela de intenções de pagamento (temporária, limpa após webhook)
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_data JSONB NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabela de fila de reembolsos
CREATE TABLE refund_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    mp_payment_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | processed | failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMPS (Triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_platform_settings_updated_at BEFORE UPDATE ON platform_settings
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- profiles:
CREATE POLICY "Perfis são públicos" ON profiles FOR SELECT USING (true);
CREATE POLICY "Criador insere próprio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Criador atualiza próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger: impedir que usuário altere campos protegidos (account_type, is_admin) via client
-- Apenas service_role (webhooks, admin APIs) pode alterar esses campos
CREATE OR REPLACE FUNCTION protect_profile_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role bypassa RLS e este trigger não se aplica a ele
  -- Mas em chamadas via client (com RLS ativo), bloqueamos mudanças em campos sensíveis
  IF current_setting('role', true) != 'service_role' THEN
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'Não é permitido alterar account_type diretamente';
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Não é permitido alterar is_admin diretamente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_profile_admin_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_admin_fields();

-- questions:
CREATE POLICY "Criador vê suas perguntas" ON questions FOR SELECT USING (creator_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Fã vê suas perguntas enviadas" ON questions FOR SELECT USING (sender_id = auth.uid());
CREATE POLICY "Respostas públicas visíveis" ON questions FOR SELECT USING (status = 'answered' AND is_shareable = true);
CREATE POLICY "Webhook insere perguntas" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Criador responde pergunta" ON questions FOR UPDATE USING (creator_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- invite_links:
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam convites" ON invite_links FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
CREATE POLICY "Usuários leem convites" ON invite_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuário usa convite" ON invite_links FOR UPDATE USING (used_by IS NULL) WITH CHECK (auth.uid() = used_by);

-- transactions:
CREATE POLICY "Criador vê suas transações" ON transactions FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE creator_id IN (SELECT id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Webhook insere transações" ON transactions FOR INSERT WITH CHECK (true);

-- platform_settings:
CREATE POLICY "Service role manages platform_settings" ON platform_settings USING (true) WITH CHECK (true);

-- payment_intents e refund_queue não têm políticas públicas (só service role acessa).

-- ============================================================
-- STORAGE E BUCKETS
-- ============================================================

-- Bucket 'responses' para áudios
INSERT INTO storage.buckets (id, name, public) VALUES ('responses', 'responses', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Criadores fazem upload de áudio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'responses' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Áudios são públicos" ON storage.objects FOR SELECT USING (bucket_id = 'responses');

-- Bucket 'avatars' para fotos de perfil
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatars publicly readable" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

-- ============================================================
-- FUNÇÕES DE ROTINA (CRON E REGRAS ATÔMICAS)
-- ============================================================

-- Reset diário de question_answered_today
CREATE OR REPLACE FUNCTION reset_daily_question_counts()
RETURNS void AS $$
BEGIN
    UPDATE profiles SET questions_answered_today = 0;
END;
$$ LANGUAGE plpgsql;

-- Expirar perguntas pendentes > 36h e mandar para reembolso
CREATE OR REPLACE FUNCTION expire_pending_questions()
RETURNS void AS $$
DECLARE
    expired_question RECORD;
BEGIN
    FOR expired_question IN
        SELECT q.id, t.mp_payment_id, t.amount
        FROM questions q
        JOIN transactions t ON t.question_id = q.id
        WHERE q.status = 'pending' AND q.created_at < NOW() - INTERVAL '36 hours'
    LOOP
        UPDATE questions SET status = 'expired' WHERE id = expired_question.id;
        INSERT INTO refund_queue (question_id, mp_payment_id, amount)
        VALUES (expired_question.id, expired_question.mp_payment_id, expired_question.amount);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup automático de intents pendentes
CREATE OR REPLACE FUNCTION cleanup_stale_payment_intents()
RETURNS void AS $$
BEGIN
  DELETE FROM payment_intents WHERE created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Incremento atômico de perguntas respondidas
CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET questions_answered_today = questions_answered_today + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificação atômica de limite diário (evita race conditions no checkout)
CREATE OR REPLACE FUNCTION can_accept_question(p_creator_id UUID)
RETURNS boolean AS $$
DECLARE
  v_daily_limit integer;
  v_answered_today integer;
  v_pending_intents integer;
BEGIN
  SELECT daily_limit, questions_answered_today INTO v_daily_limit, v_answered_today FROM profiles WHERE id = p_creator_id FOR UPDATE;
  SELECT COUNT(*) INTO v_pending_intents FROM payment_intents WHERE creator_id = p_creator_id AND created_at > NOW() - INTERVAL '2 hours';
  RETURN (v_answered_today + v_pending_intents) < v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MARCOS E GAMIFICAÇÃO (ACTIVITY & STATS)
-- ============================================================

-- Tabela de Atividade Diária
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
CREATE POLICY "Atividade diária é pública" ON daily_activity FOR SELECT USING (true);
CREATE INDEX idx_daily_activity_creator_date ON daily_activity(creator_id, activity_date DESC);

-- Tabela de Estatísticas Consolidadas
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
CREATE POLICY "Stats são públicos" ON creator_stats FOR SELECT USING (true);

-- Triggers de Gamificação
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
        NEW.creator_id, v_total_answered, v_total_answered + v_total_expired, v_total_expired, v_streak, v_max_streak, v_today, v_avg_seconds, v_soldout_days, v_marathon_count, NOW()
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

CREATE TRIGGER trg_update_stats_on_answer AFTER UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_creator_stats_on_answer();

CREATE OR REPLACE FUNCTION update_creator_stats_on_expire()
RETURNS TRIGGER AS $$
DECLARE
    v_total_answered BIGINT;
    v_total_expired BIGINT;
BEGIN
    IF NEW.status <> 'expired' OR OLD.status = 'expired' THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO v_total_answered FROM questions WHERE creator_id = NEW.creator_id AND status = 'answered';
    SELECT COUNT(*) INTO v_total_expired FROM questions WHERE creator_id = NEW.creator_id AND status = 'expired';

    INSERT INTO creator_stats (creator_id, total_answered, total_received, total_expired, updated_at)
    VALUES (NEW.creator_id, v_total_answered, v_total_answered + v_total_expired, v_total_expired, NOW())
    ON CONFLICT (creator_id) DO UPDATE SET total_expired = EXCLUDED.total_expired, total_received = EXCLUDED.total_received, updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_stats_on_expire AFTER UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_creator_stats_on_expire();

-- ============================================================
-- TOP SUPPORTERS RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_top_supporters(p_creator_id UUID)
RETURNS TABLE (display_name TEXT, is_anonymous BOOLEAN, total_paid DECIMAL, email_hash TEXT) AS $$
BEGIN
  RETURN QUERY
  -- Agrupa por sender_id (usuários cadastrados) com fallback para sender_email (perguntas antigas)
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

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_questions_creator_status ON questions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_creator_answered_at ON questions(creator_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_payment_intents_creator ON payment_intents(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_preference ON payment_intents(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_refund_queue_status ON refund_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_questions_sender_id ON questions(sender_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);

-- ============================================================
-- AGENDAMENTO DE CRON JOBS (PG_CRON)
-- Exige extensão pg_cron habilitada no painel Supabase
-- ============================================================

-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- SELECT cron.schedule('reset-daily-counts', '0 3 * * *', $$SELECT reset_daily_question_counts()$$);
-- SELECT cron.schedule('expire-questions', '*/30 * * * *', $$SELECT expire_pending_questions()$$);
-- SELECT cron.schedule('cleanup-payment-intents', '0 1 * * *', $$SELECT cleanup_stale_payment_intents()$$);

-- ============================================================
-- SISTEMA DE DENÚNCIAS (QUESTION REPORTS)
-- ============================================================

-- Novo status para perguntas denunciadas
ALTER TYPE question_status ADD VALUE 'reported';

-- Tabela de denúncias de perguntas
CREATE TABLE question_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('offensive', 'harassment', 'spam', 'threat', 'other')),
    reason_detail TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'admin_approved', 'dismissed')),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;

-- Criador vê seus próprios reports
CREATE POLICY "Criador vê seus reports" ON question_reports
    FOR SELECT USING (creator_id = auth.uid());

-- Criador cria report sobre suas perguntas
CREATE POLICY "Criador cria report" ON question_reports
    FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Admins veem todos os reports
CREATE POLICY "Admin vê todos reports" ON question_reports
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON question_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_question_reports_question ON question_reports(question_id);

-- Trigger de timestamp
CREATE TRIGGER trg_question_reports_updated_at BEFORE UPDATE ON question_reports
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- VERIFICAÇÃO DE IDENTIDADE (CREATOR VERIFICATION)
-- ============================================================

-- Novo campo no profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Proteger is_verified contra alteração via client (apenas service_role)
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de solicitações de verificação
CREATE TABLE verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    social_link TEXT NOT NULL,
    document_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- Criador vê suas próprias solicitações
CREATE POLICY "Criador vê suas verificações" ON verification_requests
    FOR SELECT USING (creator_id = auth.uid());

-- Criador cria solicitação de verificação
CREATE POLICY "Criador solicita verificação" ON verification_requests
    FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Admins veem todas as solicitações
CREATE POLICY "Admin vê todas verificações" ON verification_requests
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_verification_requests_creator ON verification_requests(creator_id);

-- Trigger de timestamp
CREATE TRIGGER trg_verification_requests_updated_at BEFORE UPDATE ON verification_requests
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Bucket privado para documentos de verificação
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT DO NOTHING;

-- Criador faz upload na própria pasta
CREATE POLICY "Criador upload verificação" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins leem documentos de verificação
CREATE POLICY "Admin lê docs verificação" ON storage.objects
    FOR SELECT USING (bucket_id = 'verification-docs' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- ============================================================
-- VOXA FOUNDERS BADGE
-- ============================================================

-- Novo campo no profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE;

-- Proteger is_founder contra alteração via client (apenas service_role)
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Seed: marcar os 50 primeiros influencers como founders
UPDATE profiles
SET is_founder = TRUE
WHERE id IN (
  SELECT id FROM profiles
  WHERE account_type = 'influencer'
  ORDER BY created_at ASC
  LIMIT 50
);

-- ============================================================
-- PAUSA PROGRAMADA (CREATOR PAUSE)
-- ============================================================

-- Novos campos no profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

-- Atualizar can_accept_question() para checar pausa + aprovação
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

  -- Criador precisa estar aprovado (NULL = legado, tratado como aprovado)
  IF v_approval_status IS NOT NULL AND v_approval_status != 'approved' THEN
    RETURN FALSE;
  END IF;

  -- Se está pausado e a pausa ainda não expirou, rejeita
  IF v_is_paused = TRUE THEN
    IF v_paused_until IS NULL OR v_paused_until > NOW() THEN
      RETURN FALSE;
    ELSE
      -- Pausa expirou: despausa automaticamente
      UPDATE profiles SET is_paused = FALSE, paused_until = NULL WHERE id = p_creator_id;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_pending_intents FROM payment_intents WHERE creator_id = p_creator_id AND created_at > NOW() - INTERVAL '2 hours';
  RETURN (v_answered_today + v_pending_intents) < v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ONBOARDING REDESIGN: NICHOS + APROVAÇÃO
-- ============================================================

-- Novas colunas no profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_link TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending_review', 'approved', 'rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_reviewed_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Tabela de nichos (categorias pré-definidas)
CREATE TABLE IF NOT EXISTS niches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL
);

-- Relação N:N entre criadores e nichos (máx 3 por criador)
CREATE TABLE IF NOT EXISTS creator_niches (
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
    PRIMARY KEY (creator_id, niche_id)
);

ALTER TABLE creator_niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nichos de criador são públicos" ON creator_niches FOR SELECT USING (true);
CREATE POLICY "Criador gerencia seus nichos" ON creator_niches FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Criador remove seus nichos" ON creator_niches FOR DELETE USING (auth.uid() = creator_id);

ALTER TABLE niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nichos são públicos" ON niches FOR SELECT USING (true);

-- Seed de nichos
INSERT INTO niches (slug, label) VALUES
  ('fitness', 'Fitness'),
  ('financas', 'Finanças'),
  ('tecnologia', 'Tecnologia'),
  ('beleza', 'Beleza'),
  ('musica', 'Música'),
  ('games', 'Games'),
  ('educacao', 'Educação'),
  ('humor', 'Humor'),
  ('lifestyle', 'Lifestyle'),
  ('saude', 'Saúde'),
  ('negocios', 'Negócios'),
  ('culinaria', 'Culinária'),
  ('moda', 'Moda'),
  ('outros', 'Outros')
ON CONFLICT (slug) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_creator_niches_creator ON creator_niches(creator_id);

-- Proteger approval_status contra alteração via client
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

-- ============================================================
-- WAITLIST DE FOUNDERS (PRÉ-CADASTRO)
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    instagram TEXT NOT NULL,
    followers_range TEXT NOT NULL CHECK (followers_range IN ('1k-10k', '10k-50k', '50k-100k', '100k-500k', '500k+')),
    niche TEXT NOT NULL,
    whatsapp TEXT,
    referral_code TEXT,
    referred_by UUID REFERENCES waitlist(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: apenas service_role acessa (formulário público insere via API route com service_role)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Admins veem a waitlist
CREATE POLICY "Admin vê waitlist" ON waitlist
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status, created_at);
