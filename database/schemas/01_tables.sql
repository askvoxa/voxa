-- ============================================================
-- 01_tables.sql
-- Definições estruturais puras (Tabelas)
-- (Requer 00_enums.sql rodado antes)
-- ============================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL CHECK (LENGTH(username) >= 3 AND username ~ '^[a-z0-9_-]+$'),
    bio TEXT CHECK (LENGTH(bio) <= 500),
    avatar_url TEXT,
    min_price DECIMAL(10, 2) DEFAULT 10.00 CHECK (min_price >= 1.00),
    daily_limit INTEGER DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 100),
    questions_answered_today INTEGER DEFAULT 0,
    referred_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    account_type TEXT DEFAULT 'fan' CHECK (account_type IN ('fan', 'influencer', 'admin')),
    -- Garante consistência: is_admin=true <-> account_type='admin'
    CONSTRAINT chk_admin_consistency CHECK ((account_type = 'admin') = is_admin),
    creator_setup_completed BOOLEAN DEFAULT FALSE,
    custom_creator_rate DECIMAL(5, 4) CHECK (custom_creator_rate BETWEEN 0.0000 AND 0.9500),
    custom_deadline_hours INTEGER,
    fast_ask_suggestions JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    is_founder BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    paused_until TIMESTAMPTZ,
    social_link TEXT,
    accepted_terms_at TIMESTAMPTZ,
    approval_status TEXT CHECK (approval_status IN ('pending_review', 'approved', 'rejected')),
    approval_reviewed_by UUID REFERENCES profiles(id),
    approval_reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    -- Campos de payout
    available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    payouts_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
    sender_id UUID REFERENCES profiles(id),
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id),
    used_by UUID REFERENCES profiles(id),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    processing_fee DECIMAL(10, 2),
    platform_fee DECIMAL(10, 2),
    creator_net DECIMAL(10, 2),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'refunded', 'cancelled')),
    payment_method TEXT NOT NULL,
    mp_payment_id TEXT UNIQUE,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    platform_fee_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
    response_deadline_hours INTEGER NOT NULL DEFAULT 36,
    -- Parâmetros de payout
    payout_day_of_week INTEGER NOT NULL DEFAULT 1 CHECK (payout_day_of_week BETWEEN 0 AND 6),
    min_payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 50.00 CHECK (min_payout_amount > 0),
    payout_release_days INTEGER NOT NULL DEFAULT 7 CHECK (payout_release_days >= 1),
    payouts_paused BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_data JSONB NOT NULL CHECK (question_data ? 'creator_id' AND question_data ? 'content' AND question_data ? 'price_paid'),
    amount DECIMAL(10, 2) NOT NULL,
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refund_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    mp_payment_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'exhausted')),
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    was_soldout BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, activity_date)
);

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

CREATE TABLE niches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL
);

CREATE TABLE creator_niches (
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
    PRIMARY KEY (creator_id, niche_id)
);

CREATE TABLE waitlist (
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

-- ============================================================
-- Tabelas do sistema de Payouts
-- (Requer 00_enums.sql com os tipos pix_key_type, ledger_entry_type, etc.)
-- ============================================================

CREATE TABLE creator_pix_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key_type pix_key_type NOT NULL,
    -- Valor encriptado via pgp_sym_encrypt (pgcrypto)
    key_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Apenas 1 chave PIX ativa por criador
CREATE UNIQUE INDEX idx_creator_pix_keys_unique_active
    ON creator_pix_keys(creator_id) WHERE is_active = TRUE;

CREATE TABLE creator_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type ledger_entry_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    reference_type ledger_reference_type NOT NULL,
    reference_id UUID NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Impede lançamento duplicado para a mesma referência
    CONSTRAINT uq_ledger_reference UNIQUE (reference_type, reference_id, type)
);

CREATE TABLE payout_requests (
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
