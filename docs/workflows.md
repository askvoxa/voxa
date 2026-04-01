# Fluxos de Negócio e Workflows — VOXA

Este documento descreve os processos críticos e irreversíveis da plataforma. Antes de modificar qualquer lógica aqui descrita, leia este documento na íntegra.

---

## 1. Fluxo de Pagamento e Webhook (Mercado Pago)

O frontend **nunca** aprova ou libera o status definitivo de um pagamento. Todo o fluxo é Server-to-Server via Webhook assinado com HMAC.

### Passo a passo

```
Fã preenche formulário no perfil do criador
  ↓
POST /api/payment/create-preference
  - Valida can_accept_question() via service_role
  - Insere PaymentIntent (reserva o slot temporariamente)
  - Gera preferência no Mercado Pago (Checkout PRO)
  - Retorna URL do checkout → fã é redirecionado
  ↓
Fã completa pagamento no Mercado Pago
  ↓
MP faz POST /api/payment/webhook
  - Valida assinatura HMAC SHA256 (header X-Signature + timestamp)
  - Se inválido: retorna 200 silencioso sem processar (não revela motivo)
  ↓
  [Pagamento aprovado]
  - Chama can_accept_question() novamente (exclusão do intent atual para evitar falso-positivo)
  - Se lotado: emite refund imediato via MP API (overselling protection)
  - Se OK: chama insert_question_and_transaction() atomicamente
  - Remove o PaymentIntent da fila
  - Dispara emails fire-and-forget:
      → sendNewQuestionNotification (criador)
      → sendQuestionConfirmation (fã)
  ↓
  [Pagamento rejeitado/cancelado]
  - Remove o PaymentIntent
  - Nenhuma pergunta é criada
```

### Prevenção de Overselling
A função `can_accept_question()` usa `SELECT FOR UPDATE` no profile, garantindo que dois webhooks simultâneos não aprovem mais perguntas do que o `daily_limit` do criador. O parâmetro `p_exclude_intent_id` exclui o intent sendo confirmado da contagem de pendentes.

### Idempotência
O campo `mp_payment_id UNIQUE` na tabela `transactions` impede processamento duplicado. Webhooks retentados pelo MP (pode ocorrer por até 48h) são silenciosamente ignorados.

---

## 2. Expiração de Perguntas e Reembolsos Automáticos

Todo criador tem prazo para responder definido em `platform_settings.response_deadline_hours` (padrão 36h). O prazo pode ser customizado por criador em `profiles.custom_deadline_hours`.

### Cron `expire-questions` (a cada 1h)

```
Varre questions com status = 'pending'
  WHERE created_at < NOW() - INTERVAL [deadline_hours]

Para cada pergunta vencida:
  UPDATE questions SET status = 'expired'  [guard: apenas se ainda pending]
  INSERT INTO refund_queue (question_id, mp_payment_id, amount)
```

### Cron `process-refunds` (parte do cron de expiração)

```
Varre refund_queue com status = 'pending'
  POST MP Refunds API (mp_payment_id)
  → Se sucesso: UPDATE status = 'processed'
              Dispara sendExpirationNotification (fã)
  → Se falha:  retry_count++, registra last_error
              Após N falhas: status = 'exhausted' (requer intervenção manual)
```

### Lembretes de Urgência
O cron `expire-questions` também envia `sendUrgencyReminder` ao criador nos thresholds de **24h, 12h e 6h** antes do vencimento de perguntas pendentes.

---

## 3. Fluxo de Payouts (Saque via PIX)

O sistema usa um **modelo de ledger contábil** para garantir integridade do saldo mesmo sob concorrência.

### Pré-requisito
- Criador com `account_type = 'influencer'`, chave PIX ativa em `creator_pix_keys` e `available_balance >= min_payout_amount` (padrão R$ 50,00).

### Pipeline completo

```
[Cron release-earnings — diário]
  Chama get_eligible_earnings_for_release(payout_release_days)
  Para cada transação elegível (approved + answered fora da carência):
    INSERT INTO creator_ledger (type='credit', reference_type='transaction')
    → Trigger trg_ledger_update_balance incrementa profiles.available_balance
  ↓

[Criador solicita saque]
  POST /api/payout/request
  Chama RPC request_payout(creator_id) via service_role:
    SELECT FOR UPDATE no profile (lock anti race condition)
    Valida: não bloqueado, saques não pausados, saldo >= mínimo, sem saque pendente, PIX ativa
    INSERT INTO payout_requests (status='pending')
    INSERT INTO creator_ledger (type='debit', reference_type='payout')
    → Trigger decrementa available_balance imediatamente
  ↓

[Cron process-payouts — diário]
  Varre payout_requests com status = 'pending'
  Para cada saque:
    Chama get_decrypted_pix_key_for_payout() (decripta no DB, nunca no API layer)
    POST MP Transferência API
    → Se sucesso: UPDATE payout_requests SET status = 'completed'
    → Se falha:   retry_count++, failure_reason registrado
                  Se retry_count >= 3:
                    INSERT INTO creator_ledger (type='credit') para reverter o debit
                    → Saldo restaurado automaticamente
```

### Regras críticas
- O `creator_ledger` é a única fonte de verdade do saldo. `profiles.available_balance` é um **cache materializado** pelo trigger — não confiar diretamente.
- Nenhuma escrita direta em `creator_ledger` ou `payout_requests` é permitida via client (RLS bloqueia).
- Se `payouts_paused = true` em `platform_settings`, nenhum saque pode ser solicitado.

---

## 4. Fluxo de Candidatura de Criador

```
Fã acessa /setup/creator
  ↓
Preenche formulário: bio, nicho, link social, aceite dos termos
  ↓
POST /api/setup/creator
  INSERT/UPDATE profiles com:
    approval_status = 'pending_review'
    account_type permanece 'fan' até aprovação
  ↓
Admin acessa /admin/approvals
  → Vê a candidatura na lista de pendentes

  [Aprovar]
    PATCH /api/admin/approvals/[id]
    UPDATE profiles SET account_type = 'influencer', approval_status = 'approved'
    (Feito via service_role — trigger protege alteração de account_type por role comum)
    → Criador é redirecionado para /setup/creator para completar o perfil
    → Email de aprovação enviado

  [Rejeitar]
    UPDATE profiles SET approval_status = 'rejected', rejection_reason = '...'
    → Fã vê mensagem de rejeição no dashboard com o motivo
```

---

## 5. Fluxo de Convites

Alternativa ao fluxo de candidatura: admin gera um link de convite direto.

```
Admin acessa /admin/invites
  → POST /api/admin/invites
  INSERT INTO invite_links (code, expires_at)
  → Admin compartilha o link /invite/[code] com o criador desejado
  ↓
Criador acessa /invite/[code] logado como fã
  → GET /api/invite/[code] valida: código existe, não usado, não expirado
  → PATCH profiles SET account_type = 'influencer', approval_status = 'approved'
     UPDATE invite_links SET used_by, used_at
  → Redireciona para /setup/creator para completar o perfil
```

---

## 6. Fluxo de Verificação de Identidade

O badge de verificação confirma que o criador é quem diz ser.

```
Criador acessa /dashboard/verification
  → Preenche: link da rede social + upload do documento de identidade
  ↓
POST /api/verification/
  Upload do documento para Supabase Storage
  INSERT INTO verification_requests (social_link, document_url, status='pending')
  ↓
Admin acessa /admin/verifications
  → Lista de solicitações pendentes com link do documento

  [Aprovar]
    PATCH /api/admin/verifications/[id]
    UPDATE verification_requests SET status = 'approved'
    UPDATE profiles SET is_verified = TRUE (via service_role)
    → Badge verificado aparece no perfil público
    → Email de confirmação enviado ao criador

  [Rejeitar]
    UPDATE verification_requests SET status = 'rejected', rejection_reason = '...'
    → Criador vê motivo da rejeição em /dashboard/verification
    → Pode submeter nova solicitação
```

---

## 7. Fluxo de Resposta a Perguntas

```
Criador acessa /dashboard (modo criador)
  → Lista de perguntas pendentes exibida

  [Responder]
    PATCH /api/questions/[id]
    UPDATE questions SET status = 'answered', response_text, response_audio_url, answered_at
    → Trigger trg_update_stats_on_answer atualiza creator_stats e daily_activity
    → sendResponseNotification disparado para o fã (fire-and-forget)

  [Rejeitar]
    UPDATE questions SET status = 'rejected'
    → INSERT INTO refund_queue para reembolso automático
    → sendRejectionNotification disparado para o fã

  [Reportar como abusiva]
    INSERT INTO question_reports (reason, status='pending_review')
    UPDATE questions SET status = 'reported'
    → Pergunta vai para /admin/reports para revisão
```

---

## Ambiente de Testes

Para testar fluxos de pagamento, use sempre o **Sandbox do Mercado Pago**. Não ative webhooks reais em ambiente de desenvolvimento para evitar reembolsos falsos. Configure `MP_ACCESS_TOKEN` com o token de teste do MP.
