-- Migration 005: Adicionar sender_email à tabela questions
-- Necessário para notificações por email ao fã quando criador responde
-- Rodar no SQL Editor do Supabase

ALTER TABLE questions ADD COLUMN IF NOT EXISTS sender_email TEXT;
