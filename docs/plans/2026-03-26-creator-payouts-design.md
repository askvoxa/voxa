# Design: Sistema de Pagamento de Criadores (Payouts)

**Data:** 2026-03-26
**Status:** Aprovado

---

## Resumo

Sistema de saques para criadores do VOXA, permitindo cadastro de chave PIX (CPF/CNPJ) e solicitação de pagamento. Processamento semanal em dia parametrizado pelo admin, via API de Payouts do Mercado Pago. Controle financeiro via ledger contábil com saldo materializado.

---

## Decisões de Design

| Decisão | Escolha |
|---|---|
| Liberação do saldo | 7 dias após resposta (parametrizável) |
| Tipos de chave PIX | CPF e CNPJ apenas |
| Fluxo de saque | Sob demanda do criador, processado no dia semanal configurado |
| Valor mínimo | R$50,00 (parametrizável) |
| Valor do saque | Sempre o saldo total disponível (sem parcial) |
| Status do saque | `pending` → `processing` → `completed` / `failed` |
| Controle admin | Dashboard + bloqueio por criador + pausa global |
| Falhas | Retry automático até 3 tentativas nos ciclos seguintes |
| Modelo financeiro | Ledger contábil + saldo materializado em cache (Abordagem 2) |

---

## 1. Modelo de Dados

### Nova tabela: `creator_pix_keys`

Chave PIX do criador.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID, PK | Identificador |
| `creator_id` | UUID, FK → profiles | Criador dono da chave |
| `key_type` | ENUM (`'cpf'`, `'cnpj'`) | Tipo da chave |
| `key_value` | TEXT (encriptado via pgcrypto) | Valor da chave |
| `is_active` | BOOLEAN, default true | Se é a chave ativa |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

- Constraint: `UNIQUE(creator_id) WHERE is_active = true` — apenas 1 chave ativa por criador.

### Nova tabela: `creator_ledger`

Registro contábil de cada movimentação financeira.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID, PK | Identificador |
| `creator_id` | UUID, FK → profiles | Criador |
| `type` | ENUM (`'credit'`, `'debit'`) | Tipo do lançamento |
| `amount` | DECIMAL | Valor (sempre positivo) |
| `reference_type` | ENUM (`'transaction'`, `'payout'`) | Origem do lançamento |
| `reference_id` | UUID | FK para `transactions.id` ou `payout_requests.id` |
| `description` | TEXT | Descrição legível |
| `created_at` | TIMESTAMPTZ | Data do lançamento |

- Constraint: `UNIQUE(reference_type, reference_id, type)` — impede lançamento duplicado.

### Nova tabela: `payout_requests`

Solicitações de saque dos criadores.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID, PK | Identificador |
| `creator_id` | UUID, FK → profiles | Criador |
| `amount` | DECIMAL | Valor do saque |
| `pix_key_id` | UUID, FK → creator_pix_keys | Chave PIX utilizada |
| `status` | ENUM (`'pending'`, `'processing'`, `'completed'`, `'failed'`) | Status atual |
| `mp_payout_id` | TEXT | ID do payout no Mercado Pago |
| `failure_reason` | TEXT | Motivo da falha (se houver) |
| `retry_count` | INTEGER, default 0 | Tentativas realizadas (max 3) |
| `requested_at` | TIMESTAMPTZ | Data da solicitação |
| `processed_at` | TIMESTAMPTZ | Data do processamento |

### Alteração: `platform_settings`

Novos campos na tabela existente (single-row, id=1).

| Coluna | Tipo | Descrição |
|---|---|---|
| `payout_day_of_week` | INTEGER (0-6), default 1 | Dia da semana (0=domingo, 1=segunda) |
| `min_payout_amount` | DECIMAL, default 50.00 | Valor mínimo para saque |
| `payout_release_days` | INTEGER, default 7 | Dias após resposta para liberar valor |
| `payouts_paused` | BOOLEAN, default false | Pausa global de payouts |

### Alteração: `profiles`

Novos campos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `available_balance` | DECIMAL, default 0.00, CHECK ≥ 0 | Saldo disponível (cache do ledger) |
| `payouts_blocked` | BOOLEAN, default false | Bloqueio de saques pelo admin |

### Triggers

- **`after INSERT on creator_ledger`** → Atualiza `profiles.available_balance`: `+amount` se `credit`, `-amount` se `debit`. Usa `FOR UPDATE` row lock no profile.

### Cálculo de Saldo

- **Saldo disponível:** `available_balance` em `profiles` (cache, atualizado via trigger)
- **Saldo a liberar:** soma de `creator_net` das transactions approved/answered onde `answered_at > NOW() - payout_release_days` e sem lançamento no ledger
- **Reconciliação:** query periódica compara `available_balance` vs `SUM(credits) - SUM(debits)` do ledger. Divergências geram alerta no admin.

---

## 2. API Routes

### Rotas do Criador

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/payout/pix-key` | Cadastrar/atualizar chave PIX |
| `GET` | `/api/payout/balance` | Consultar saldo disponível e a liberar |
| `POST` | `/api/payout/request` | Solicitar saque |
| `GET` | `/api/payout/history` | Histórico de saques (paginado) |

**`POST /api/payout/pix-key`:**
- Valida formato CPF (11 dígitos, verificador) ou CNPJ (14 dígitos, verificador)
- Desativa chave anterior se existir, cria nova chave ativa
- Armazena valor encriptado via pgcrypto

**`POST /api/payout/request`:**
- Validações: chave PIX ativa, `available_balance ≥ min_payout_amount`, `payouts_paused = false`, `payouts_blocked = false`
- Operação atômica (PL/pgSQL): cria `payout_request` + insere `debit` no ledger + decrementa `available_balance`
- Rate limit: 1 request por hora por criador

### Rotas de Processamento (Cron)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/cron/release-earnings` | Liberar valores após período de carência (diário) |
| `POST` | `/api/cron/process-payouts` | Processar saques pendentes (semanal) |

**`POST /api/cron/release-earnings`** (diário):
- Protegido por `PAYOUT_SECRET` Bearer token
- Busca transactions approved/answered onde `answered_at ≤ NOW() - payout_release_days` sem lançamento no ledger
- Para cada: insere `credit` no `creator_ledger`

**`POST /api/cron/process-payouts`** (semanal, no dia configurado):
- Protegido por `PAYOUT_SECRET` Bearer token
- Verifica `payouts_paused = false`
- Busca `payout_requests` com status `pending` ou `failed` com `retry_count < 3`, onde criador não está bloqueado
- Para cada: chama `POST /v1/payouts` da API do Mercado Pago
- Sucesso → status `completed`, salva `mp_payout_id`
- Falha → status `failed`, salva `failure_reason`, incrementa `retry_count`

### Rotas Admin

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/payouts` | Listar payouts com filtros |
| `POST` | `/api/admin/payouts/retry` | Re-processar payout falho |
| `PATCH` | `/api/admin/payouts/settings` | Alterar parâmetros de payout |
| `PATCH` | `/api/admin/creator/:id/block-payout` | Bloquear/desbloquear saques de criador |

---

## 3. Integração Mercado Pago Payouts

**API:** `POST /v1/payouts` (Mercado Pago Disbursements)

**Payload de exemplo:**
```json
{
  "amount": 150.00,
  "currency_id": "BRL",
  "description": "VOXA - Saque criador @username",
  "payment_method_id": "pix",
  "bank_transfer_type": "pix",
  "receiver": {
    "identification": {
      "type": "CPF",
      "number": "12345678900"
    }
  }
}
```

**Credenciais:** `ACCESS_TOKEN` do Mercado Pago (conta precisa ter permissão de Payouts habilitada).

**Tratamento de erros:** Saldo insuficiente na conta MP tratado como falha temporária (retry no próximo ciclo).

---

## 4. UI/UX do Criador

### Tela de Saldo e Saques

**Painel de Saldo:**
- Saldo disponível (destaque grande, valor em R$)
- Saldo a liberar (valores dentro do período de carência, com tooltip explicativo)
- Botão "Solicitar Saque" — habilitado se saldo ≥ mínimo e chave PIX cadastrada

**Cadastro de Chave PIX:**
- Seletor: CPF ou CNPJ
- Input com máscara (000.000.000-00 ou 00.000.000/0000-00)
- Validação de dígitos verificadores em tempo real
- Indicador da chave ativa atual (valor mascarado: `***.456.789-**`)
- Troca de chave desativa a anterior automaticamente

**Solicitação de Saque:**
- Modal de confirmação: valor (saldo total), chave PIX destino, previsão de processamento (próximo dia parametrizado)
- Saque sempre do valor total disponível (sem parcial)

**Histórico de Saques:**
- Lista: data, valor, status (badge colorido), data de processamento
- Paginação

---

## 5. UI/UX do Admin

### Seção "Payouts" no painel admin — 3 abas

**Aba "Dashboard":**
- Cards: total pago na semana, total pendente, falhas ativas, status pausa
- Botão pausa/retomada global com confirmação
- Configurações inline: dia da semana (select), valor mínimo (input R$), dias de carência (input)

**Aba "Payouts":**
- Tabela com filtros: status, período, busca por criador
- Colunas: criador (avatar + nome), valor, chave PIX, status (badge), data solicitação, data processamento, tentativas
- Ação: botão "Re-tentar" em payouts failed
- Paginação

**Aba "Criadores":**
- Lista: nome, saldo disponível, saldo a liberar, chave PIX (sim/não), status saque (liberado/bloqueado)
- Toggle bloquear/desbloquear com input de motivo (salvo em log)

---

## 6. Segurança e RLS

### Row Level Security

- **`creator_pix_keys`:** criador vê/edita apenas suas chaves. Admin vê todas.
- **`creator_ledger`:** criador vê apenas seus lançamentos (somente leitura). Admin vê todos.
- **`payout_requests`:** criador vê apenas seus saques e pode inserir. Admin vê todos e pode atualizar.

### Proteções Críticas

- **Saque atômico:** criação do payout_request + debit no ledger + atualização do balance numa única transaction PL/pgSQL. Falha em qualquer etapa reverte tudo.
- **CHECK constraint:** `available_balance >= 0` no profiles — impede saldo negativo.
- **Chave PIX encriptada:** pgcrypto com chave em variável de ambiente. Frontend recebe valor mascarado.
- **Rate limiting:** endpoint de saque com limite de 1 request/hora por criador.
- **Crons protegidos:** `process-payouts` e `release-earnings` protegidos por Bearer token (`PAYOUT_SECRET`).
- **Reconciliação:** query agendada compara `available_balance` vs soma do ledger. Divergências alertam admin.
