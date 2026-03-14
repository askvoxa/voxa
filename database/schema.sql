-- Criação do tipo Enum para o status da pergunta
CREATE TYPE question_status AS ENUM ('pending', 'answered', 'expired');

-- Tabela de Perfis
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    min_price DECIMAL(10, 2) DEFAULT 0.00,
    daily_limit INTEGER DEFAULT 10,
    questions_answered_today INTEGER DEFAULT 0,
    referred_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Transações
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL,
    payment_method TEXT NOT NULL
);
