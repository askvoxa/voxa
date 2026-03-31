# Documentação do Banco de Dados - VOXA

## Fonte da Verdade

Toda lógica central e restrições de integridade habitam estritamente o **Supabase Database** (PostgreSQL Serverless) e não o servidor web.

O schema está organizado em arquivos modulares em `database/schemas/`, executados em ordem numérica:

| Arquivo | Conteúdo |
|---------|----------|
| `00_enums.sql` | Tipos ENUM: `question_status`, `pix_key_type`, `ledger_entry_type`, `payout_status` |
| `01_tables.sql` | Todas as tabelas do sistema |
| `02_storage.sql` | Buckets e políticas de Storage (avatars, responses) |
| `03_functions.sql` | Funções RPC em PL/pgSQL |
| `04_triggers.sql` | Triggers de integridade, timestamps e gamificação |
| `05_rls_policies.sql` | Row Level Security de todas as tabelas |
| `06_indexes_and_seed.sql` | Índices de performance e seed inicial do `platform_settings` |

## Estruturas de Tabelas

### Core
1. **`profiles`** — Tabela mestre de usuários. Define `account_type` (`fan`/`influencer`/`admin`), limites diários, preços, status de aprovação, `available_balance` (saldo materializado) e `payouts_blocked`.
2. **`questions`** — Entidade principal de interações. Status rígidos: `pending` → `answered` / `expired` / `rejected`. Triggers bloqueiam transições de estado inválidas.
3. **`transactions`** — Extrato financeiro vinculado a cada question aprovada. Mantém idempotência via `mp_payment_id` único.
4. **`payment_intents`** — Reserva temporária criada antes do redirect ao Mercado Pago. Limpa automaticamente pelo cron `cleanup-intents`.
5. **`creator_stats`** — Contadores de gamificação (streak, total respondido, marathons). Atualizado exclusivamente por triggers — nunca pelo Next.js.

### Sistema de Payouts
6. **`creator_pix_keys`** — Chave PIX do criador armazenada criptografada via `pgp_sym_encrypt` (pgcrypto). Apenas 1 chave ativa por criador (unique index parcial).
7. **`creator_ledger`** — Livro-razão contábil (credit/debit) que é o source of truth do saldo. Escrita exclusiva via service_role (RLS bloqueia INSERT/UPDATE/DELETE direto).
8. **`payout_requests`** — Solicitações de saque. Criadas atomicamente pela RPC `request_payout`, que garante lock no saldo e debit simultâneo no ledger.

## RLS (Row Level Security - Segurança Absoluta)
- **Criadores:** Possuem direitos apenas de leitura total a tudo indexado com o seu próprio ID numérico ou referencial.
- **Administrador:** Ninguém além de contas contendo o _bit_ `is_admin = TRUE` tanto no Postgres quanto verificado no layout/Middlewares tem autorização de acesso a informações e painéis de roteamento `/admin`.
- **Worker (Webhooks/Cron):** Endpoints responsáveis por processadores assíncronos contam com bypass das políticas usuais via injeção segura de chamadas de cliente usando a `service_role_key`. Portanto, modificações no schema exigem a compatibilidade estrita dessas policies.
