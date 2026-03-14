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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Perguntas
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
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
