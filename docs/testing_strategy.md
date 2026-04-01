# Estratégia de Testes — VOXA

## Estado Atual

A infraestrutura de testes foi zerada em março/2026 para reconstrução com estratégia adequada à arquitetura atual. **Não há testes automatizados ativos no repositório.**

Os diretórios abaixo ainda precisam ser criados:
- `database/tests/` — testes pgTAP
- `frontend/src/__tests__/` — testes Vitest
- `frontend/tests/e2e/` — testes Playwright

---

## Estratégia

A lógica crítica do VOXA habita no banco de dados (triggers, RPCs, RLS) e nas rotas de API (pagamentos, cron jobs). A estratégia de testes reflete essa realidade, priorizando onde regressões causam dano real (perda financeira, reembolsos indevidos, brechas de segurança).

---

## Camada 1 — Banco de Dados com pgTAP

Testes unitários de SQL rodando diretamente no PostgreSQL via Supabase local (Docker). Cada teste roda dentro de `BEGIN/ROLLBACK` — não suja o banco.

### Setup do ambiente

```bash
# Instalar Supabase CLI
npm install -g supabase

# Inicializar e subir o banco local (Docker necessário)
supabase start

# Executar schemas em ordem
supabase db reset   # aplica migrations automaticamente se configurado

# Rodar testes pgTAP
supabase test db
```

### Casos prioritários

**RPCs:**
- `can_accept_question()` — valida limite diário, pausa, ban, approval_status e slots pendentes
- `request_payout()` — lock de saldo, validação de mínimo, ausência de saque pendente, PIX ativa, saques globais pausados
- `get_eligible_earnings_for_release()` — carência correta, sem duplicata no ledger

**Triggers:**
- `trg_ledger_update_balance` — incremento e decremento atômico do saldo
- `trg_protect_profile_admin_fields` — impede alteração de `account_type`, `is_admin`, `available_balance` por roles não-service
- `trg_sanitize_anonymous_sender` — substitui sender_name por "Anônimo" quando is_anonymous
- `trg_update_stats_on_answer` — atualiza streak, total_answered e daily_activity corretamente

**RLS:**
- Fã não acessa dados de outro fã (questions, transactions)
- Criador não acessa ledger de outro criador
- Nenhum client pode escrever diretamente em `creator_ledger` ou `payout_requests`
- Admin tem acesso completo via is_admin

**Arquivo de destino:** `database/tests/`

---

## Camada 2 — Rotas de API com Vitest

Testes de integração das rotas críticas com Supabase local. Mais rápidos que Playwright por não usar browser.

### Rotas prioritárias

| Rota | O que testar |
|------|-------------|
| `POST /api/payment/webhook` | Validação HMAC (assinatura válida, inválida, ausente); idempotência com `mp_payment_id` duplicado; overselling quando criador está lotado |
| `POST /api/cron/expire-questions` | Expiração correta após deadline; inserção na refund_queue; não expirar perguntas dentro do prazo |
| `POST /api/cron/process-payouts` | Processamento com sucesso; reversão do debit após 3 falhas |
| `POST /api/payout/request` | Rejeição com saldo insuficiente; rejeição com saque já pendente; rejeição sem chave PIX |
| `POST /api/cron/release-earnings` | Crédito correto no ledger; não duplicar crédito para a mesma transaction |

**Arquivo de destino:** `frontend/src/__tests__/`

---

## Camada 3 — E2E com Playwright (fluxo crítico único)

Um único spec cobrindo o fluxo de pagamento completo — o único caminho que nenhuma camada anterior consegue cobrir integralmente:

```
Usuário acessa /perfil/[criador-real]
  → Preenche formulário com pergunta e email válido
  → Clica em "Pagar"
  → Redireciona para Checkout PRO do Mercado Pago (sandbox)
  → Completa pagamento no sandbox
  → Retorna para a plataforma
  → Pergunta aparece no dashboard do criador com status "Pendente"
  → Criador recebe email de notificação
  → Fã recebe email de confirmação
```

**Arquivo de destino:** `frontend/tests/e2e/payment-flow.spec.ts`

---

## Ordem de Implementação

1. **pgTAP** — maior ROI, cobre a lógica mais crítica e mais difícil de testar manualmente
2. **Vitest** — cobre validações de API sem custo de browser
3. **Playwright** — apenas o fluxo de pagamento end-to-end

---

## Cobertura Mínima Esperada (pós-implementação)

| Área | Cobertura alvo |
|------|---------------|
| RPCs críticas (payout, payment) | 100% dos casos de borda |
| Triggers de integridade | 100% |
| Políticas RLS | Todos os perfis de acesso |
| Webhooks de pagamento | HMAC válido, inválido, idempotência, overselling |
| Fluxo E2E de pagamento | 1 spec completo com sandbox MP |
