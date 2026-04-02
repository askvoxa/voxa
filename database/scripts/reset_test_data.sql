-- ============================================================
-- reset_test_data.sql
-- Limpa dados de teste mantendo cadastros de usuários.
--
-- PRESERVA:
--   profiles (fans, influencers, admins)
--   creator_niches
--   creator_pix_keys
--   niches
--   platform_settings
--   waitlist
--
-- REMOVE:
--   questions (cascade: transactions, question_reports, refund_queue)
--   payment_intents
--   invite_links
--   daily_activity
--   creator_stats
--   creator_ledger
--   payout_requests
--   verification_requests
--
-- RESETA em profiles:
--   available_balance → 0
--   questions_answered_today → 0
--   is_paused → false
--   paused_until → null
-- ============================================================

BEGIN;

-- 1. Perguntas (cascade derruba transactions, question_reports)
TRUNCATE TABLE questions CASCADE;

-- 2. Fila de reembolsos (pode ter ficado órfã)
TRUNCATE TABLE refund_queue;

-- 3. Intenções de pagamento temporárias
TRUNCATE TABLE payment_intents;

-- 4. Links de convite
TRUNCATE TABLE invite_links;

-- 5. Atividade diária dos criadores
TRUNCATE TABLE daily_activity;

-- 6. Estatísticas agregadas dos criadores
TRUNCATE TABLE creator_stats;

-- 7. Ledger financeiro
TRUNCATE TABLE creator_ledger;

-- 8. Solicitações de saque
TRUNCATE TABLE payout_requests;

-- 9. Solicitações de verificação de identidade
TRUNCATE TABLE verification_requests;

-- 10. Resetar campos financeiros e de status nos perfis
UPDATE profiles SET
    available_balance       = 0.00,
    questions_answered_today = 0,
    is_paused               = FALSE,
    paused_until            = NULL;

-- Confirmação
DO $$
BEGIN
    RAISE NOTICE 'Reset concluído. Perfis preservados: %', (SELECT COUNT(*) FROM profiles);
    RAISE NOTICE '  - fans:        %', (SELECT COUNT(*) FROM profiles WHERE account_type = 'fan');
    RAISE NOTICE '  - influencers: %', (SELECT COUNT(*) FROM profiles WHERE account_type = 'influencer');
    RAISE NOTICE '  - admins:      %', (SELECT COUNT(*) FROM profiles WHERE account_type = 'admin');
END;
$$;

COMMIT;
