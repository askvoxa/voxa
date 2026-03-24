# Estratégia de Testabilidade Baseada no Banco (DB Testing) - VOXA

Com a fragmentação do schema principal em módulos (e.g., `01_tables.sql`, `03_functions.sql`), torna-se possível rodar testes isolados no Postgres antes de subir alterações para a produção (Supabase). Abaixo delineamos o plano futuro para **Testabilidade**.

## 1. O Problema Atual
No VOXA, **a lógica habita o banco de dados** (via Triggers e RPCs). Se uma trigger de gamificação falha, o backend Node.js não captura confortavelmente este log. Um erro lógico num Hook `BEFORE UPDATE` pode inviabilizar o fluxo de pagamentos.

## 2. Abordagem: _pgTAP_ (Unit Testing in Postgres)

O [pgTAP](https://pgtap.org/) é uma suíte de testes unitários escrita inteiramente em plpgsql. 

**Como funcionará:**
1. Escrevemos scripts de testes (ex: `test_can_accept_question.sql`).
2. Subimos um container Docker local do Supabase (`supabase start`).
3. O script injeta dados simulados na tabela temporária `profiles`.
4. Chamamos `SELECT can_accept_question(...)` e executamos `SELECT results_eq(...)` para checar se a saída esperada ocorreu.
5. Tudo roda num `BEGIN` e um `ROLLBACK` final para não sujar o ambiente.

Exemplo de esboço de teste:
```sql
BEGIN;
SELECT plan(1);

-- Mock de criador com limite 10
INSERT INTO profiles (id, username, daily_limit, questions_answered_today) 
VALUES ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'test_creator', 10, 10);

-- Testa a function
SELECT is(
    can_accept_question('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'),
    FALSE,
    'Não deve aceitar pergunta se chegou no daily_limit'
);

SELECT * FROM finish();
ROLLBACK;
```

## 3. Testes End-to-End (E2E) em Webhooks

Para validar o fluxo integral do Mercado Pago sem onerar produção:
- **Github Actions:** Criar uma pipeline automatizada que sobe um Supabase local efêmero + Next.js (em dev).
- **Mocks:** Um script fará chamadas `POST /api/payment/webhook` passando um JSON idêntico ao payload `payment.created` do Mercado Pago com a assinatura `X-Signature` HMAC forjada pela própria action (usando o Segredo de Teste).
- Se a transação pipocar no banco local em `transactions` com sucesso, o E2E passa e a *Pull Request* é autorizada.
