-- ============================================================
-- 06_indexes_and_seed.sql
-- Otimização e Preenchimento Inicial
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
CREATE INDEX IF NOT EXISTS idx_daily_activity_creator_date ON daily_activity(creator_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON question_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_question_reports_question ON question_reports(question_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_verification_requests_creator ON verification_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_creator_niches_creator ON creator_niches(creator_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status, created_at);

-- Indexes do sistema de Payouts
CREATE INDEX IF NOT EXISTS idx_creator_pix_keys_creator_active ON creator_pix_keys(creator_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator ON creator_ledger(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_ledger_reference ON creator_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON payout_requests(creator_id, requested_at DESC);

-- Seed de platform settings (com parâmetros de payout)
INSERT INTO platform_settings (id, platform_fee_rate, response_deadline_hours, payout_day_of_week, min_payout_amount, payout_release_days, payouts_paused)
VALUES (1, 0.1000, 36, 1, 50.00, 7, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Seed de Nichos
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

-- Seed marcar the first 50 influencers as founders
UPDATE profiles
SET is_founder = TRUE
WHERE id IN (
  SELECT id FROM profiles
  WHERE account_type = 'influencer'
  ORDER BY created_at ASC
  LIMIT 50
);
