# Estratégia de Testes - VOXA

## Estado Atual

A infraestrutura de testes foi zerada em março/2026 para reconstrução com estratégia adequada à arquitetura atual. Não há testes automatizados ativos no repositório.

## Estratégia Planejada

A lógica crítica do VOXA habita o banco de dados (triggers, RPCs, RLS) e nas rotas de API (pagamentos, cron jobs). A estratégia de testes reflete essa realidade, priorizando onde regressões causam dano real.

### Camada 1 — Banco de Dados com pgTAP

Testes unitários de SQL rodando diretamente no PostgreSQL via `supabase start` (Docker local). Cada teste roda dentro de `BEGIN/ROLLBACK` para não sujar o ambiente.

**Casos prioritários:**
- `can_accept_question()` — valida limite diário, ban, pausa e verificação do criador
- `request_payout()` — lock de saldo, validação de mínimo, chave PIX ativa
- `release_earnings()` — cálculo correto de carência e crédito no ledger
- RLS: fan não acessa dados de outro fan; criador não acessa ledger de outro criador
- Trigger `trg_ledger_update_balance` — incremento/decremento atômico do saldo

**Localização dos arquivos:** `database/tests/` (a criar)

### Camada 2 — Rotas de API com Vitest

Testes de integração das rotas críticas com Supabase local. Mais rápidos que Playwright por não usar browser.

**Rotas prioritárias:**
- `POST /api/payment/webhook` — validação HMAC, idempotência, overselling
- `POST /api/cron/expire-questions` — expiração de prazo e disparo de reembolso
- `POST /api/cron/process-payouts` — processamento e reversão de falhas
- `POST /api/payout/request` — rate limit, validação de saldo

**Localização dos arquivos:** `frontend/src/__tests__/` (a criar)

### Camada 3 — E2E com Playwright (fluxo crítico único)

Um único spec cobrindo o fluxo de pagamento completo — o único caminho que nenhuma camada anterior consegue cobrir integralmente:

> Usuário acessa perfil → preenche formulário → redireciona para MP → retorna com pagamento aprovado → pergunta aparece no dashboard do criador

**Localização:** `frontend/tests/e2e/payment-flow.spec.ts` (a criar)

## Ordem de Implementação

1. pgTAP — maior ROI, cobre a lógica mais crítica e mais difícil de testar manualmente
2. Vitest — cobre validações de API sem custo de browser
3. Playwright — apenas o fluxo de pagamento end-to-end
