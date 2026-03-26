-- ============================================================
-- 04_triggers.sql
-- Gatilhos engatados nas tabelas chamando funções PLPGSQL
-- (Requer 01_tables e 03_functions rodados antes)
-- ============================================================

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_platform_settings_updated_at BEFORE UPDATE ON platform_settings
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_protect_profile_admin_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_admin_fields();

CREATE TRIGGER trg_update_stats_on_answer AFTER UPDATE ON questions 
FOR EACH ROW EXECUTE FUNCTION update_creator_stats_on_answer();

CREATE TRIGGER trg_update_stats_on_expire AFTER UPDATE ON questions 
FOR EACH ROW EXECUTE FUNCTION update_creator_stats_on_expire();

CREATE TRIGGER trg_question_reports_updated_at BEFORE UPDATE ON question_reports
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_verification_requests_updated_at BEFORE UPDATE ON verification_requests
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Protege campos sensíveis de questions (financeiros, identidade) contra alteração por criadores
CREATE TRIGGER trg_protect_question_fields
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION protect_question_fields();

-- Sanitiza sender_name em perguntas anônimas (proteção no nível do banco)
CREATE TRIGGER trg_sanitize_anonymous_sender
  BEFORE INSERT ON questions
  FOR EACH ROW EXECUTE FUNCTION sanitize_anonymous_sender_name();

-- ============================================================
-- Triggers do sistema de Payouts
-- ============================================================

-- Atualiza available_balance no profile a cada lançamento no ledger
CREATE TRIGGER trg_ledger_update_balance
  AFTER INSERT ON creator_ledger
  FOR EACH ROW EXECUTE FUNCTION update_balance_on_ledger_insert();

-- Atualiza updated_at na tabela de chaves PIX
CREATE TRIGGER trg_pix_keys_updated_at
  BEFORE UPDATE ON creator_pix_keys
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
