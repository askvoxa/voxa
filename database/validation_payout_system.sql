-- ============================================================
-- VALIDAÇÃO: Sistema de Payouts
-- Executar no SQL Editor do Supabase
-- ============================================================
-- Este script verifica se a migration do payout system foi
-- executada corretamente. Execute linha por linha e verifique
-- os resultados.
-- ============================================================

-- ============================================================
-- 1. Verificar se pgcrypto está habilitado
-- ============================================================
SELECT 'PGCRYPTO' as "Check",
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN '✅ EXISTE' ELSE '❌ FALTA' END as Status;

-- ============================================================
-- 2. Verificar ENUMs criados
-- ============================================================
SELECT 'ENUMS' as "Check",
  COUNT(*) as "Total",
  STRING_AGG(typname, ', ') as "Tipos"
FROM pg_type
WHERE typname IN ('pix_key_type', 'ledger_entry_type', 'ledger_reference_type', 'payout_status')
AND typtype = 'e';

-- ============================================================
-- 3. Verificar se tabelas existem
-- ============================================================
SELECT 'TABELAS' as "Check",
  COUNT(*) as "Total",
  STRING_AGG(tablename, ', ') as "Tabelas"
FROM information_schema.tables
WHERE table_schema = 'public'
AND tablename IN ('creator_pix_keys', 'creator_ledger', 'payout_requests');

-- ============================================================
-- 4. Verificar colunas adicionadas em profiles
-- ============================================================
SELECT 'PROFILES COLUMNS' as "Check",
  CASE
    WHEN COUNT(*) = 2 THEN '✅ OK (2 colunas)'
    WHEN COUNT(*) = 1 THEN '⚠️  PARCIAL (1 coluna)'
    ELSE '❌ FALTA'
  END as Status
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('available_balance', 'payouts_blocked');

-- ============================================================
-- 5. Verificar colunas adicionadas em platform_settings
-- ============================================================
SELECT 'PLATFORM_SETTINGS COLUMNS' as "Check",
  CASE
    WHEN COUNT(*) = 4 THEN '✅ OK (4 colunas)'
    WHEN COUNT(*) > 0 THEN '⚠️  PARCIAL'
    ELSE '❌ FALTA'
  END as Status,
  STRING_AGG(column_name, ', ') as "Colunas"
FROM information_schema.columns
WHERE table_name = 'platform_settings'
AND column_name IN ('payout_day_of_week', 'min_payout_amount', 'payout_release_days', 'payouts_paused');

-- ============================================================
-- 6. Verificar RLS policies
-- ============================================================
SELECT 'RLS POLICIES' as "Check",
  COUNT(*) as "Total",
  STRING_AGG(policyname, ', ') as "Policies"
FROM pg_policies
WHERE tablename IN ('creator_pix_keys', 'creator_ledger', 'payout_requests');

-- ============================================================
-- 7. Verificar funções criadas
-- ============================================================
SELECT 'FUNÇÕES RPC' as "Check",
  COUNT(*) as "Total",
  STRING_AGG(routine_name, ', ') as "Funções"
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'upsert_pix_key',
  'get_masked_pix_key',
  'get_decrypted_pix_key_for_payout',
  'get_payout_summary',
  'get_eligible_earnings_for_release',
  'request_payout'
);

-- ============================================================
-- 8. Verificar índices criados
-- ============================================================
SELECT 'ÍNDICES' as "Check",
  COUNT(*) as "Total",
  STRING_AGG(indexname, ', ') as "Índices"
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('creator_pix_keys', 'creator_ledger', 'payout_requests');

-- ============================================================
-- 9. Dados de Verificação: platform_settings
-- ============================================================
SELECT 'PLATFORM_SETTINGS' as "Check", 'Configurações' as "Info",
  payout_day_of_week,
  min_payout_amount,
  payout_release_days,
  payouts_paused
FROM platform_settings
LIMIT 1;

-- ============================================================
-- 10. Contar registros nas novas tabelas
-- ============================================================
SELECT 'DATA COUNT' as "Check",
  'creator_pix_keys' as "Tabela",
  COUNT(*) as "Registros"
FROM creator_pix_keys
UNION ALL
SELECT 'DATA COUNT',
  'creator_ledger',
  COUNT(*)
FROM creator_ledger
UNION ALL
SELECT 'DATA COUNT',
  'payout_requests',
  COUNT(*)
FROM payout_requests;

-- ============================================================
-- 11. Verificar se há test users criados
-- ============================================================
SELECT 'TEST USERS' as "Check",
  COUNT(*) as "Total",
  'Usuários com perfil' as "Tipo"
FROM profiles
WHERE username LIKE 'test_%'
OR email LIKE 'test_%';

-- ============================================================
-- 12. Status Final - Resumo
-- ============================================================
WITH checks AS (
  SELECT 1 as id, 'pgcrypto' as check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
    THEN true ELSE false END as passed
  UNION ALL
  SELECT 2, 'enums',
    (SELECT COUNT(*) = 4 FROM pg_type WHERE typname IN ('pix_key_type', 'ledger_entry_type', 'ledger_reference_type', 'payout_status') AND typtype = 'e')
  UNION ALL
  SELECT 3, 'tabelas',
    (SELECT COUNT(*) = 3 FROM information_schema.tables WHERE table_schema = 'public' AND tablename IN ('creator_pix_keys', 'creator_ledger', 'payout_requests'))
  UNION ALL
  SELECT 4, 'profiles_columns',
    (SELECT COUNT(*) = 2 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('available_balance', 'payouts_blocked'))
  UNION ALL
  SELECT 5, 'platform_settings_columns',
    (SELECT COUNT(*) = 4 FROM information_schema.columns WHERE table_name = 'platform_settings' AND column_name IN ('payout_day_of_week', 'min_payout_amount', 'payout_release_days', 'payouts_paused'))
  UNION ALL
  SELECT 6, 'rls_policies',
    (SELECT COUNT(*) > 0 FROM pg_policies WHERE tablename IN ('creator_pix_keys', 'creator_ledger', 'payout_requests'))
  UNION ALL
  SELECT 7, 'funções',
    (SELECT COUNT(*) = 6 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('upsert_pix_key', 'get_masked_pix_key', 'get_decrypted_pix_key_for_payout', 'get_payout_summary', 'get_eligible_earnings_for_release', 'request_payout'))
)
SELECT 'RESULTADO FINAL' as "Status",
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) || ' de 7 checks passaram' as "Resultado"
FROM checks;

-- ============================================================
-- PRÓXIMOS PASSOS se algum check falhar:
-- ============================================================
-- 1. Se pgcrypto falhar:
--    CREATE EXTENSION pgcrypto;
--
-- 2. Se algum ENUM falhar:
--    Execute o bloco de criação de ENUMs da migration
--
-- 3. Se colunas falharem:
--    Execute o bloco ALTER TABLE da migration
--
-- 4. Se tabelas falharem:
--    Execute o bloco de criação de tabelas da migration
--
-- 5. Se funções falharem:
--    Execute o bloco de criação de funções da migration
--
-- Para executar a migration completa:
-- Vá para SQL Editor e copie todo o conteúdo de:
-- database/migrations/2026-03-26_payout_system.sql
-- ============================================================
