-- Migration 002: Platform settings table + individual creator overrides
-- Run this in the Supabase SQL Editor

-- ============================================================
-- 1. Platform settings (singleton row)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id                       INT DEFAULT 1 PRIMARY KEY CHECK (id = 1),
  platform_fee_rate        DECIMAL(5,4) NOT NULL DEFAULT 0.1000, -- 10%
  response_deadline_hours  INT NOT NULL DEFAULT 36,
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row (runs only if empty)
INSERT INTO platform_settings (id, platform_fee_rate, response_deadline_hours)
VALUES (1, 0.1000, 36)
ON CONFLICT (id) DO NOTHING;

-- RLS: only service_role can write; admins can read via service_role anyway
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages platform_settings"
  ON platform_settings
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. Individual creator overrides on profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS custom_creator_rate    DECIMAL(5,4) NULL,  -- NULL = use platform default
  ADD COLUMN IF NOT EXISTS custom_deadline_hours  INT NULL;            -- NULL = use platform default

-- ============================================================
-- 3. Avatars storage bucket (public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete their own avatar
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
