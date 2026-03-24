-- ============================================================
-- 02_storage.sql
-- Inserção de buckets no schema storage do supabase e suas RLS Puras
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('responses', 'responses', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Criadores fazem upload de áudio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'responses' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Áudios são públicos" ON storage.objects FOR SELECT USING (bucket_id = 'responses');

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatars publicly readable" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Criador upload verificação" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admin lê docs verificação" ON storage.objects FOR SELECT USING (bucket_id = 'verification-docs' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin'));
