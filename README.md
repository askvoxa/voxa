# VOXA

Plataforma de monetização para criadores de conteúdo brasileiros. Fãs pagam para enviar perguntas com garantia de resposta em até 36 horas via texto ou áudio.

**Deploy:** [Render.com](https://render.com) · **Banco:** Supabase · **Pagamentos:** Mercado Pago

---

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Conta no [Mercado Pago Developers](https://developers.mercadopago.com)
- (Opcional) [ngrok](https://ngrok.com) para testar webhooks localmente

---

## Setup local

### 1. Instalar dependências

```bash
cd frontend && npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp frontend/.env.example frontend/.env.local
```

Preencher `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

MP_ACCESS_TOKEN=TEST-...
NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-...

NEXT_PUBLIC_APP_URL=http://localhost:3000

MP_WEBHOOK_SECRET=qualquer-string-secreta
REFUND_SECRET=outra-string-secreta
FEATURE_REFUNDS_ENABLED=false
```

### 3. Configurar banco de dados

No [SQL Editor do Supabase](https://app.supabase.com), executar **em ordem**:

```sql
-- 1. Cole o conteúdo de database/supabase_setup.sql

-- 2. Função obrigatória
CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET questions_answered_today = questions_answered_today + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Se o banco já existia antes de 2026-03-19**, rodar também:
```sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_support_only BOOLEAN DEFAULT FALSE;
```

### 4. Configurar autenticação Google

No painel Supabase > Authentication > Providers > Google:
- Ativar com Client ID e Client Secret do [Google Cloud Console](https://console.cloud.google.com)
- Redirect URL autorizada: `https://{SEU_SUPABASE_URL}/auth/v1/callback`

No painel Supabase > Authentication > URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### 5. Configurar Storage

No painel Supabase > Storage:
- Criar bucket chamado `responses` como **público**

### 6. Rodar

```bash
cd frontend && npm run dev
# http://localhost:3000
```

---

## Testar pagamentos localmente

O webhook do Mercado Pago precisa de URL pública. Use ngrok:

```bash
ngrok http 3000
```

No painel Mercado Pago > Webhooks:
- URL: `https://xxxx.ngrok.io/api/payment/webhook`
- Evento: `payments`
- Copiar o **secret** para `MP_WEBHOOK_SECRET` no `.env.local`

---

## Estrutura do projeto

```
voxa/
├── database/
│   ├── schema.prisma        # Schema fonte de verdade
│   └── supabase_setup.sql   # SQL completo para setup do zero
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx         # Landing page
        │   ├── login/           # Google OAuth
        │   ├── setup/           # Onboarding do criador
        │   ├── vender/          # Marketing + simulador de ganhos
        │   ├── perfil/          # Perfil público + formulário de pagamento
        │   ├── dashboard/       # Painel do criador (perguntas, histórico, settings)
        │   ├── admin/           # Painel administrativo
        │   └── api/
        │       ├── payment/     # create-preference + webhook (HMAC)
        │       ├── questions/   # PATCH resposta + visibilidade
        │       ├── refunds/     # Fila de reembolsos (desabilitado)
        │       └── admin/       # Ban, taxa custom, reembolso manual
        └── lib/
            ├── supabase/        # Clients server e client
            ├── constants.ts     # CREATOR_NET_RATE, RESPONSE_DEADLINE_HOURS
            ├── admin.ts         # getAdminUser()
            └── milestones.ts    # computeMilestones() — marcos e badges
```

---

## Fluxo de pagamento

```
Fã → formulário no perfil → POST /api/payment/create-preference
  → Mercado Pago Checkout (PIX ou cartão)
  → POST /api/payment/webhook (assinatura HMAC verificada)
  → question criada no banco
  → criador vê no dashboard → responde → fã recebe notificação
```

**Modo Apoio:** fã envia valor sem exigir resposta. A question é criada como `answered` imediatamente, não aparece no dashboard do criador nem no feed público.

**Race condition protegida:** Se o `daily_limit` for atingido entre o pagamento e o webhook, o reembolso é iniciado automaticamente via `PaymentRefund` do Mercado Pago.

---

## Deploy no Render.com

1. Criar **Web Service** apontando para este repositório
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Adicionar todas as variáveis de ambiente com `NEXT_PUBLIC_APP_URL` apontando para o domínio Render
6. Atualizar Supabase > Authentication > URL Configuration com o domínio de produção
7. Atualizar webhook do Mercado Pago com a URL de produção

> Guia detalhado: `plans/2026-03-13-render-deploy.md`

---

## Admin panel

Acessível em `/admin`. Para ativar o admin em um usuário:

```sql
UPDATE profiles SET is_admin = true WHERE username = 'seu-username';
```

Funcionalidades: visão geral · ban/unban criadores · taxa e prazo customizados · reembolso manual · configurações globais da plataforma.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Chave anônima |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role (server-side apenas) |
| `MP_ACCESS_TOKEN` | ✅ | Token MP (`TEST-...` sandbox / `APP_USR-...` produção) |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | ✅ | Public key MP |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL base da aplicação |
| `MP_WEBHOOK_SECRET` | ✅ | Secret HMAC do webhook MP |
| `REFUND_SECRET` | ✅ | Token para o cron de reembolsos |
| `FEATURE_REFUNDS_ENABLED` | ❌ | `true` para ativar reembolsos automáticos |

---

> Desenvolvido no Brasil por Jeferson Kollenz.
