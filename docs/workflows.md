# Documentação de Fluxos de Negócio e Webhooks - VOXA

Este documento explora processos críticos de negócios, como aprovação de pagamentos e expirações forçadas por tempo de limite.

## 1. Fluxo de Pagamentos e Webhook Handshake (Mercado Pago)

O _Frontend_ nunca tem autonomia para aprovar ou liberar o status definitivo de um pagamento.
O processo segue uma abordagem Server-to-Server autoritativa via Webhook:

1. **Criação de Intenção:**
   A rota `/api/payment/create-preference` providencia a reserva e proteção slot de uma nova atividade no table `payment_intents`, efetuando o repasse a plataforma do form Mercado Pago e gerando link para redireção Checkout PRO.
2. **Confirmação HMAC e Transação:**
   Assim que aprovado ou rejeitado no celular, o Mercado Pago faz PING em nossa Edge API Webhook. Nossa API calcula a validade do `X-Signature` HMAC SHA256 com _timestamp_ fornecido. Se devidamente validado (legítimo), nossa rotina insere imediatamente o extrato do sucesso em `transactions` e realiza o repasse (move) do ticket da área provisória pra fila ativa em `questions`.
3. **Prevenção de Overselling:**
   O Webhook também confere em duplicata (lock) os parâmetros de caixa/slots no momento preciso de validar a aprovação. Se já estiver "lotado" em limites diários, o webhook proativo cancela ou emite reembolso (Refund API) pelo provedor bloqueando prejuízo logístico do criador.

## 2. Prazos, Timeout de Resposta e Estornos Automáticos

Todo criador tem até 36 horas ininterruptas para responder perguntas originadas pela audiência na plataforma. Esta não é uma recomendação comercial forte, é um trigger do sistema.

**Rotina Recorrente (Cron Job):**
O arquivo _handler_ em `app/api/cron/expire-questions` desperta esporadicamente acionado via Job serverless agendado (Render Cron):
- O código varre tabelas à procura de items filtrados onde `status = 'pending'` cuja `created_at` seja mais velha que 36h do tempo transcorrido atual.
- Ao achar corrupções ao prazo prometido via Acordo de Termos de Uso com o fã, o status avança para `expired`.
- Executa imediatas chamadas Rest `POST` à API MP "Refund" pra ressarcir e estornar o usuário original daquele capital de forma passiva.

Se for operar sobre essas APIs, certifique-se de realizar mocks precisos utilizando o Sandbox do MP para não ativar reembolsos falsos.

## 3. Fluxo de Payouts (Saque via PIX)

O sistema de saque segue um modelo de ledger contábil para garantir integridade do saldo mesmo sob concorrência.

**Pré-requisito:** O criador deve ter uma chave PIX ativa cadastrada (`creator_pix_keys`) e saldo `available_balance >= min_payout_amount` (padrão: R$ 50,00).

**Pipeline de saque:**

1. **Liberação de Ganhos (Cron `release-earnings`):**
   O cron varre `transactions` com status `approved` + question `answered` fora do período de carência (`payout_release_days`, padrão 7 dias). Para cada transação elegível, insere um `credit` no `creator_ledger`. O trigger `trg_ledger_update_balance` incrementa `profiles.available_balance` atomicamente.

2. **Solicitação de Saque (`/api/payout/request`):**
   Chama a RPC `request_payout(creator_id)` via service_role. A função faz `SELECT FOR UPDATE` no profile (lock anti race condition), valida saldo e ausência de saque pendente, cria o `payout_request` e insere um `debit` no ledger que decrementa o saldo imediatamente.

3. **Processamento (Cron `process-payouts`):**
   O cron busca `payout_requests` com `status = 'pending'`, decripta a chave PIX via `decrypt_pix_key()`, chama a API de transferência do Mercado Pago e atualiza o status para `completed` ou `failed`. Falhas permanentes (≥ 3 tentativas) revertem o debit no ledger para restaurar o saldo.

**Regras críticas:**
- O ledger é a única fonte de verdade do saldo — `available_balance` em `profiles` é apenas um cache materializado pelo trigger.
- Nenhuma escrita direta em `creator_ledger` ou `payout_requests` é permitida via client: RLS bloqueia INSERT/UPDATE/DELETE para roles não-service.
