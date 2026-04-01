# Banco de Dados — VOXA

## Fonte da Verdade

Toda lógica de negócio e restrições de integridade habitam o **Supabase (PostgreSQL)**. O Next.js nunca recalcula no servidor o que pode ser computado por Views, RPCs ou Triggers no banco.

Os schemas estão em `database/schemas/`, executados em ordem:

| Arquivo | Conteúdo |
|---------|----------|
| `00_enums.sql` | Tipos ENUM: `question_status`, `pix_key_type`, `ledger_entry_type`, `ledger_reference_type`, `payout_status` |
| `01_tables.sql` | Todas as tabelas do sistema |
| `02_storage.sql` | Buckets e políticas de Storage |
| `03_functions.sql` | Funções PL/pgSQL (RPCs, helpers de trigger) |
| `04_triggers.sql` | Triggers engatados nas tabelas |
| `05_rls_policies.sql` | Row Level Security de todas as tabelas |
| `06_indexes_and_seed.sql` | Índices de performance e seed do `platform_settings` |

---

## Tabelas

### `profiles`
Tabela mestre de usuários. Criada automaticamente via trigger do Supabase Auth no primeiro login Google.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK — mesmo ID do `auth.users` |
| `username` | TEXT UNIQUE | Slug do perfil (minúsculas, `a-z0-9_-`, mín. 3 chars) |
| `bio` | TEXT | Biografia pública (máx. 500 chars) |
| `avatar_url` | TEXT | URL do bucket `avatars` |
| `account_type` | TEXT | `fan` / `influencer` / `admin` |
| `is_admin` | BOOLEAN | Consistente com `account_type = 'admin'` (CHECK constraint) |
| `is_active` | BOOLEAN | `false` = conta banida |
| `is_verified` | BOOLEAN | Badge de identidade verificada |
| `is_founder` | BOOLEAN | Badge de criador fundador |
| `is_paused` | BOOLEAN | Criador não aceita novas perguntas temporariamente |
| `paused_until` | TIMESTAMPTZ | Data/hora de fim da pausa (null = indefinido) |
| `approval_status` | TEXT | `pending_review` / `approved` / `rejected` |
| `min_price` | DECIMAL | Preço mínimo por pergunta (padrão R$ 10,00, mín. R$ 1,00) |
| `daily_limit` | INTEGER | Vagas diárias (padrão 10, máx. 100) |
| `questions_answered_today` | INTEGER | Contador zerado pelo cron `reset-daily` à meia-noite |
| `fast_ask_suggestions` | JSONB | Sugestões de perguntas rápidas configuradas pelo criador |
| `custom_creator_rate` | DECIMAL | Taxa customizada pelo admin (sobrescreve taxa da plataforma) |
| `custom_deadline_hours` | INTEGER | Prazo customizado (sobrescreve `platform_settings.response_deadline_hours`) |
| `available_balance` | DECIMAL | Cache do saldo — atualizado pelo trigger `trg_ledger_update_balance` |
| `payouts_blocked` | BOOLEAN | Admin pode bloquear saques individualmente |
| `social_link` | TEXT | Link da rede social principal |
| `referred_by_id` | UUID | FK para `profiles` (referral) |
| `creator_setup_completed` | BOOLEAN | Setup do criador concluído |

> **Proteção**: o trigger `trg_protect_profile_admin_fields` impede que roles não-service_role alterem `account_type`, `is_admin`, `is_verified`, `is_founder`, `approval_status`, `available_balance` e `payouts_blocked`.

---

### `questions`
Entidade central da plataforma. Cada pergunta representa uma transação paga.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `creator_id` | UUID | FK `profiles` |
| `sender_id` | UUID | FK `profiles` (null se fã não logado) |
| `sender_name` | TEXT | Nome do remetente (substituído por "Anônimo" se `is_anonymous`) |
| `sender_email` | TEXT | Email para notificações |
| `content` | TEXT | Texto da pergunta |
| `status` | question_status | `pending` → `answered` / `expired` / `rejected` / `reported` |
| `price_paid` | DECIMAL | Valor pago pelo fã |
| `service_type` | TEXT | `base` (pergunta) ou outro tipo de serviço |
| `is_anonymous` | BOOLEAN | Remetente anônimo |
| `is_shareable` | BOOLEAN | Criador permite exibição pública da resposta |
| `is_support_only` | BOOLEAN | Apoio financeiro sem pergunta |
| `response_text` | TEXT | Resposta em texto do criador |
| `response_audio_url` | TEXT | URL do áudio (bucket `responses`, apenas URLs Supabase) |
| `answered_at` | TIMESTAMPTZ | Timestamp da resposta |

> **Proteção**: `trg_protect_question_fields` impede alteração de campos financeiros e de identidade por roles não-service_role. `trg_sanitize_anonymous_sender` substitui `sender_name` por "Anônimo" na inserção quando `is_anonymous = true`.

---

### `transactions`
Extrato financeiro vinculado a cada pergunta aprovada. Idempotência garantida via `mp_payment_id UNIQUE`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `question_id` | UUID | FK `questions` |
| `amount` | DECIMAL | Valor bruto pago pelo fã |
| `processing_fee` | DECIMAL | Taxa do Mercado Pago |
| `platform_fee` | DECIMAL | Taxa da plataforma VOXA |
| `creator_net` | DECIMAL | Valor líquido que vai para o criador |
| `status` | TEXT | `pending` / `approved` / `refunded` / `cancelled` |
| `mp_payment_id` | TEXT UNIQUE | ID do pagamento no Mercado Pago |
| `mp_preference_id` | TEXT | ID da preferência criada no MP |

---

### `payment_intents`
Reserva temporária criada antes do redirect ao Mercado Pago. Evita overselling durante o checkout.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `creator_id` | UUID | FK `profiles` |
| `question_data` | JSONB | Dados do formulário (creator_id, content, price_paid obrigatórios) |
| `amount` | DECIMAL | Valor da intenção |
| `mp_preference_id` | TEXT | ID da preferência gerada no MP |
| `created_at` | TIMESTAMPTZ | Limpos pelo cron `cleanup-intents` após 48h |

---

### `platform_settings`
Configurações globais da plataforma. Tabela singleton (`id = 1`).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `platform_fee_rate` | DECIMAL | 0.10 | Taxa da plataforma (10%) |
| `response_deadline_hours` | INTEGER | 36 | Prazo padrão de resposta em horas |
| `min_payout_amount` | DECIMAL | 50.00 | Saldo mínimo para solicitar saque |
| `payout_release_days` | INTEGER | 7 | Dias de carência antes de liberar ganhos |
| `payout_day_of_week` | INTEGER | 1 | Dia da semana para processamento de saques (0=Dom) |
| `payouts_paused` | BOOLEAN | false | Pausa global de saques (admin) |

---

### `refund_queue`
Fila de reembolsos a processar. Alimentada pelo cron `expire-questions` e pelo webhook quando há overselling.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `question_id` | UUID | FK `questions` |
| `mp_payment_id` | TEXT | ID do pagamento no MP |
| `amount` | DECIMAL | Valor a reembolsar |
| `status` | TEXT | `pending` / `processed` / `failed` / `exhausted` |
| `retry_count` | INTEGER | Tentativas realizadas |
| `last_error` | TEXT | Mensagem de erro da última tentativa |

---

### `creator_stats`
Contadores de gamificação do criador. **Atualizado exclusivamente por triggers** — nunca pelo Next.js.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `creator_id` | UUID | PK e FK `profiles` |
| `total_answered` | INTEGER | Total de perguntas respondidas |
| `total_received` | INTEGER | Total de perguntas recebidas (todos os status) |
| `total_expired` | INTEGER | Total de perguntas expiradas |
| `current_streak` | INTEGER | Streak atual de dias com resposta |
| `max_streak` | INTEGER | Maior streak histórico |
| `last_active_date` | DATE | Último dia com resposta |
| `avg_response_seconds` | BIGINT | Tempo médio de resposta em segundos |
| `soldout_days_last30` | INTEGER | Dias com limite esgotado nos últimos 30 dias |
| `marathon_count` | INTEGER | Dias com ≥ 10 perguntas respondidas |

---

### `daily_activity`
Registro diário de atividade de cada criador. Usado para calcular streak e soldout_days.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `creator_id + activity_date` | UNIQUE | Uma entrada por criador por dia |
| `questions_answered` | INTEGER | Perguntas respondidas no dia |
| `was_soldout` | BOOLEAN | Limite diário atingido neste dia |

---

### `invite_links`
Convites gerados pelo admin para promover usuários a criadores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `code` | TEXT UNIQUE | Código do convite (URL `/invite/[code]`) |
| `created_by` | UUID | FK `profiles` (admin que criou) |
| `used_by` | UUID | FK `profiles` (quem usou) |
| `used_at` | TIMESTAMPTZ | Quando foi usado |
| `expires_at` | TIMESTAMPTZ | Data de expiração |

---

### `question_reports`
Perguntas marcadas como abusivas pelo criador.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `question_id` | UUID | FK `questions` |
| `creator_id` | UUID | FK `profiles` |
| `reason` | TEXT | `offensive` / `harassment` / `spam` / `threat` / `other` |
| `status` | TEXT | `pending_review` / `admin_approved` / `dismissed` |
| `reviewed_by` | UUID | FK `profiles` (admin) |

---

### `verification_requests`
Solicitações de verificação de identidade de criadores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `creator_id` | UUID | FK `profiles` |
| `social_link` | TEXT | Link da rede social para verificação |
| `document_url` | TEXT | URL do documento enviado (Storage) |
| `status` | TEXT | `pending` / `approved` / `rejected` |
| `rejection_reason` | TEXT | Motivo da rejeição (admin) |

---

### `waitlist`
Pré-cadastro de criadores interessados antes do convite.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name`, `email`, `instagram` | TEXT | Dados básicos |
| `followers_range` | TEXT | Faixa de seguidores |
| `niche` | TEXT | Nicho de conteúdo |
| `whatsapp` | TEXT | Contato opcional |
| `referral_code` | TEXT | Código de referral do indicador |
| `status` | TEXT | `pending` / `approved` / `rejected` |

---

### `niches` e `creator_niches`
Taxonomia de nichos de conteúdo. `creator_niches` é a tabela de junção N:N.

---

### Tabelas do Sistema de Payouts

#### `creator_pix_keys`
Chave PIX do criador armazenada criptografada via `pgp_sym_encrypt` (extensão pgcrypto).
- Apenas 1 chave ativa por criador (`UNIQUE INDEX` parcial em `is_active = TRUE`).
- Tipos suportados: `cpf` / `cnpj`.

#### `creator_ledger`
Livro-razão contábil. **A única fonte de verdade do saldo.**
- Escrita exclusiva via `service_role` — RLS bloqueia INSERT/UPDATE/DELETE direto.
- Constraint `uq_ledger_reference` impede lançamento duplicado para a mesma referência.
- O trigger `trg_ledger_update_balance` incrementa/decrementa `profiles.available_balance` a cada lançamento.

#### `payout_requests`
Solicitações de saque. Criadas atomicamente pela RPC `request_payout` (lock no saldo + debit simultâneo no ledger).

---

## RPCs (Funções PL/pgSQL chamáveis via API)

Todas as funções usam `SET search_path = ''` para prevenir ataques de search_path hijacking.

| Função | Acesso | Descrição |
|--------|--------|-----------|
| `can_accept_question(creator_id, exclude_intent_id?)` | service_role | Valida se o criador pode aceitar nova pergunta (limite, pausa, aprovação, slots) |
| `insert_question_and_transaction(question, transaction)` | service_role | Inserção atômica de pergunta + transação (chamada pelo webhook) |
| `request_payout(creator_id)` | service_role | Cria saque atômico com lock no saldo e debit no ledger |
| `get_creator_balance(creator_id)` | Autenticado | Retorna saldo disponível, pendente de liberação e total sacado |
| `get_top_supporters(creator_id)` | Criador próprio | Retorna top 5 apoiadores do mês com dados mascarados |
| `get_eligible_earnings_for_release(release_days)` | service_role | Transações elegíveis para liberação de saldo pelo cron |
| `get_payout_summary(week_ago)` | service_role | Resumo de saques para o painel admin |
| `upsert_pix_key(creator_id, key_type, key_value, encryption_key)` | service_role | Cadastra/atualiza chave PIX (desativa anterior + criptografa nova) |
| `get_masked_pix_key(creator_id, encryption_key)` | service_role | Retorna chave PIX mascarada para exibição |
| `get_decrypted_pix_key_for_payout(payout_id, encryption_key)` | service_role | Decripta chave PIX para uso no cron de processamento |
| `decrypt_pix_key(pix_key_id, encryption_key)` | service_role | Decripta chave PIX por ID |
| `increment_answered_today(profile_id)` | service_role | Incrementa contador diário de respostas |
| `expire_pending_questions()` | service_role | Varre perguntas vencidas e enfileira reembolsos |
| `cleanup_stale_payment_intents()` | service_role | Remove PaymentIntents com mais de 48h |
| `reset_daily_question_counts()` | service_role | Zera `questions_answered_today` em todos os perfis |

---

## Triggers

| Trigger | Tabela | Momento | Função chamada | O que faz |
|---------|--------|---------|----------------|-----------|
| `trg_profiles_updated_at` | profiles | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |
| `trg_protect_profile_admin_fields` | profiles | BEFORE UPDATE | `protect_profile_admin_fields` | Bloqueia alteração de campos admin/financeiros por roles não-service |
| `trg_questions_updated_at` | questions | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |
| `trg_protect_question_fields` | questions | BEFORE UPDATE | `protect_question_fields` | Bloqueia alteração de campos financeiros/identidade |
| `trg_sanitize_anonymous_sender` | questions | BEFORE INSERT | `sanitize_anonymous_sender_name` | Substitui sender_name por "Anônimo" quando is_anonymous |
| `trg_update_stats_on_answer` | questions | AFTER UPDATE | `update_creator_stats_on_answer` | Atualiza creator_stats e daily_activity ao responder |
| `trg_update_stats_on_expire` | questions | AFTER UPDATE | `update_creator_stats_on_expire` | Atualiza creator_stats ao expirar |
| `trg_transactions_updated_at` | transactions | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |
| `trg_platform_settings_updated_at` | platform_settings | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |
| `trg_question_reports_updated_at` | question_reports | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |
| `trg_verification_requests_updated_at` | verification_requests | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |
| `trg_ledger_update_balance` | creator_ledger | AFTER INSERT | `update_balance_on_ledger_insert` | Incrementa/decrementa `profiles.available_balance` atomicamente |
| `trg_pix_keys_updated_at` | creator_pix_keys | BEFORE UPDATE | `update_timestamp` | Atualiza `updated_at` |

---

## RLS (Row Level Security)

- **Fãs** — leem apenas seus próprios dados (questions, transactions onde sender_id = auth.uid()).
- **Criadores** — leem perguntas direcionadas ao seu `id`. Não podem escrever diretamente em `creator_ledger` ou `payout_requests`.
- **Admins** — acesso completo via `is_admin = TRUE`, verificado tanto no banco quanto no middleware.
- **service_role** — bypass total das políticas. Usado exclusivamente por rotas de API server-side (`/api/payment/webhook`, `/api/cron/*`, `/api/payout/*`). **Nunca expor a `SUPABASE_SERVICE_ROLE_KEY` no cliente.**

> Modificações no schema exigem revisão das políticas em `05_rls_policies.sql` para manter compatibilidade com os endpoints de cron e webhook.
