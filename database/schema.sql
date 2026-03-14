-- ============================================================
-- VOXA — Schema de referência simplificado
-- ATENÇÃO: Este arquivo é apenas referência de leitura.
-- Para setup em ambiente novo, use supabase_setup.sql (inclui RLS + Storage).
-- ============================================================

-- Enum de status da pergunta
CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired');

-- Tabela de Perfis (criadores)
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

-- Tabela de Perguntas
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

-- Tabela de Transações
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

-- Tabela temporária de intenções de pagamento
-- Vincula external_reference do MP com dados da pergunta.
-- Deletada pelo webhook após confirmação do pagamento.
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_data JSONB NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fila de reembolsos — perguntas expiradas (>36h sem resposta) aguardando reembolso no MP.
-- Processada por /api/refunds/process (cron externo ou Render.com Cron Jobs).
CREATE TABLE refund_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL,
    mp_payment_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending | processed | failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);
