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
-- INSERT de perguntas é feito exclusivamente via webhook (service_role), que ignora RLS.
-- Política aberta removida para impedir inserção direta por usuários autenticados.
CREATE POLICY "Criador responde pergunta" ON questions FOR UPDATE USING (creator_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- Invite Links:
CREATE POLICY "Admins gerenciam convites" ON invite_links FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
CREATE POLICY "Usuários leem convites" ON invite_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuário usa convite" ON invite_links FOR UPDATE USING (used_by IS NULL) WITH CHECK (auth.uid() = used_by);

-- Transactions:
CREATE POLICY "Criador vê suas transações" ON transactions FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE creator_id IN (SELECT id FROM profiles WHERE id = auth.uid())));
-- INSERT de transações é feito exclusivamente via webhook (service_role), que ignora RLS.
-- Política aberta removida para impedir inserção direta por usuários autenticados.

-- Platform Settings:
-- Leitura pública (necessária para calcular taxas no frontend e webhook)
CREATE POLICY "Leitura pública de platform_settings" ON platform_settings FOR SELECT USING (true);
-- Escrita restrita a admins (impede alteração de taxas por usuários comuns)
CREATE POLICY "Apenas admins alteram platform_settings" ON platform_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
-- INSERT/DELETE bloqueados — tabela singleton gerenciada apenas via service_role ou admin UPDATE

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

-- Payment Intents:
-- Tabela operacional interna — acesso exclusivo via service_role (webhooks e crons)
-- Nenhuma operação é feita pelo client do usuário; bloquear acesso público
CREATE POLICY "payment_intents bloqueado para usuários" ON payment_intents FOR ALL USING (false);

-- Refund Queue:
-- Tabela operacional interna — acesso exclusivo via service_role (cron de reembolsos)
-- Nenhuma operação é feita pelo client do usuário; bloquear acesso público
CREATE POLICY "refund_queue bloqueado para usuários" ON refund_queue FOR ALL USING (false);

-- Waitlist:
CREATE POLICY "Admin vê waitlist" ON waitlist FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
