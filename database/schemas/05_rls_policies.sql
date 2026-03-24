-- ============================================================
-- 05_rls_policies.sql
-- Restrições lógicas de segurança (Row Level Security)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Profiles:
CREATE POLICY "Perfis são públicos" ON profiles FOR SELECT USING (true);
CREATE POLICY "Criador insere próprio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Criador atualiza próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Questions:
CREATE POLICY "Criador vê suas perguntas" ON questions FOR SELECT USING (creator_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Fã vê suas perguntas enviadas" ON questions FOR SELECT USING (sender_id = auth.uid());
CREATE POLICY "Respostas públicas visíveis" ON questions FOR SELECT USING (status = 'answered' AND is_shareable = true);
CREATE POLICY "Webhook insere perguntas" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Criador responde pergunta" ON questions FOR UPDATE USING (creator_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- Invite Links:
CREATE POLICY "Admins gerenciam convites" ON invite_links FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
CREATE POLICY "Usuários leem convites" ON invite_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuário usa convite" ON invite_links FOR UPDATE USING (used_by IS NULL) WITH CHECK (auth.uid() = used_by);

-- Transactions:
CREATE POLICY "Criador vê suas transações" ON transactions FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE creator_id IN (SELECT id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Webhook insere transações" ON transactions FOR INSERT WITH CHECK (true);

-- Platform Settings:
CREATE POLICY "Service role manages platform_settings" ON platform_settings USING (true) WITH CHECK (true);

-- Daily Activity & Stats:
CREATE POLICY "Atividade diária é pública" ON daily_activity FOR SELECT USING (true);
CREATE POLICY "Stats são públicos" ON creator_stats FOR SELECT USING (true);

-- Question Reports:
CREATE POLICY "Criador vê seus reports" ON question_reports FOR SELECT USING (creator_id = auth.uid());
CREATE POLICY "Criador cria report" ON question_reports FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Admin vê todos reports" ON question_reports FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- Verification Requests:
CREATE POLICY "Criador vê suas verificações" ON verification_requests FOR SELECT USING (creator_id = auth.uid());
CREATE POLICY "Criador solicita verificação" ON verification_requests FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Admin vê todas verificações" ON verification_requests FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));

-- Niches:
CREATE POLICY "Nichos de criador são públicos" ON creator_niches FOR SELECT USING (true);
CREATE POLICY "Criador gerencia seus nichos" ON creator_niches FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Criador remove seus nichos" ON creator_niches FOR DELETE USING (auth.uid() = creator_id);
CREATE POLICY "Nichos são públicos" ON niches FOR SELECT USING (true);

-- Waitlist:
CREATE POLICY "Admin vê waitlist" ON waitlist FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
