# VOXA — Guia para Desenvolvimento

## O que é o projeto

**VOXA** é uma plataforma de monetização para criadores de conteúdo (influencers) no mercado brasileiro. Fãs pagam para enviar perguntas a criadores com garantia de resposta em até 36 horas. O criador responde via texto ou áudio. A plataforma cobra 10% de taxa sobre cada transação.

**Status atual:** Beta funcional — autenticação, banco e pagamentos integrados. **Deployado em produção no Render.com.** Pronto para onboarding de influencers reais.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14.1 (App Router), React 18, TypeScript 5 |
| Estilo | Tailwind CSS 3.3, gradiente Instagram customizado |
| Ícones | Lucide React |
| Auth | Supabase Auth (Google OAuth apenas — email magic link removido) |
| Banco | PostgreSQL via Supabase |
| ORM | Schema em `database/schema.prisma` (referência) — queries via Supabase JS SDK |
| Pagamentos | Mercado Pago (Checkout Pro — PIX + cartão) |
| Storage | Supabase Storage (bucket `responses` para áudios) |
| Screenshots | html2canvas (geração de Stories) |
| Package manager | npm |

---

## Estrutura de diretórios

```
voxa/
├── CLAUDE.md                          # Este arquivo
├── README.md                          # Guia de setup para desenvolvedores
├── .gitignore
├── plans/                             # Documentos de planejamento (não sobe ao Git)
├── database/
│   ├── schema.prisma                  # Schema completo (fonte de verdade)
│   ├── schema.sql                     # SQL equivalente (referência)
│   └── supabase_setup.sql             # SQL COMPLETO para rodar no Supabase (tabelas + RLS + storage)
└── frontend/
    ├── src/
    │   ├── middleware.ts               # Proteção de rotas (/dashboard, /setup, /admin)
    │   ├── lib/
    │   │   ├── supabase/server.ts      # Client Supabase para Server Components e API Routes
    │   │   ├── supabase/client.ts      # Client Supabase para Client Components
    │   │   ├── constants.ts            # CREATOR_NET_RATE, RESPONSE_DEADLINE_HOURS
    │   │   ├── admin.ts                # getAdminUser() — verifica is_admin no perfil
    │   │   ├── email.ts                # sendResponseNotification() via Resend (pós-beta)
    │   │   └── milestones.ts           # computeMilestones() — lógica de marcos/badges
    │   └── app/
    │       ├── layout.tsx
    │       ├── page.tsx                # Landing page (light theme)
    │       ├── globals.css
    │       ├── auth/callback/route.ts  # Callback OAuth → /setup ou /dashboard
    │       ├── login/page.tsx          # Login Google OAuth
    │       ├── setup/page.tsx          # Onboarding do criador (username, bio, preço, limite)
    │       ├── vender/page.tsx         # Marketing + simulador de ganhos
    │       ├── dashboard/
    │       │   ├── page.tsx            # Client Component — perguntas pendentes + métricas + marcos
    │       │   ├── QuestionList.tsx    # Client Component — resposta texto/áudio, Story modal, iOS fallback
    │       │   ├── MilestoneProgress.tsx  # Client Component — barra de progresso de marcos
    │       │   ├── history/
    │       │   │   ├── page.tsx        # Server Component — histórico paginado + métricas de ganhos
    │       │   │   └── VisibilityToggle.tsx  # Client Component — toggle is_shareable otimista
    │       │   ├── settings/page.tsx   # Client Component — bio, preço, limite, avatar, Fast Ask
    │       │   └── referral/page.tsx   # UI pronta — backend pós-beta
    │       ├── perfil/[username]/
    │       │   ├── page.tsx            # Server Component — perfil + feed público + top supporters + marcos
    │       │   └── QuestionForm.tsx    # Client Component — modo Pergunta e modo Apoio + redirect MP
    │       ├── admin/
    │       │   ├── layout.tsx          # Layout admin (verifica is_admin)
    │       │   ├── page.tsx            # Dashboard admin — visão geral
    │       │   ├── settings/page.tsx   # Configurações da plataforma (taxa, prazo)
    │       │   └── creators/
    │       │       ├── page.tsx        # Lista de criadores
    │       │       └── [id]/
    │       │           ├── page.tsx    # Detalhes do criador
    │       │           ├── BanToggle.tsx       # Ban/unban criador
    │       │           ├── RefundButton.tsx    # Reembolso manual
    │       │           └── CreatorParamsForm.tsx # Taxa e prazo customizados
    │       └── api/
    │           ├── questions/
    │           │   ├── route.ts        # POST (legado — não usado no fluxo de pagamento)
    │           │   ├── [id]/route.ts   # PATCH — responde pergunta (texto ou URL de áudio)
    │           │   └── visibility/route.ts  # PATCH — alterna is_shareable
    │           ├── payment/
    │           │   ├── create-preference/route.ts  # Cria preferência MP + salva payment_intent
    │           │   └── webhook/route.ts            # Confirma MP → salva question (HMAC + reembolso automático)
    │           ├── refunds/
    │           │   └── process/route.ts  # GET protegido — fila de reembolsos (cron externo, desabilitado)
    │           └── admin/
    │               ├── platform-settings/route.ts  # GET/PATCH — taxa e prazo globais
    │               ├── refunds/route.ts             # POST — reembolso manual pelo admin
    │               └── creators/
    │                   ├── [id]/route.ts            # PATCH — ban/unban criador
    │                   └── [id]/params/route.ts     # PATCH — taxa e prazo individuais
    ├── .env.local                      # Credenciais reais (NÃO commitar)
    ├── .env.example                    # Template documentado
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── package.json
```

---

## Banco de dados

**`database/supabase_setup.sql`** é o arquivo definitivo para configurar o Supabase do zero.

### Tabelas principais

| Tabela | Campos relevantes |
|---|---|
| `profiles` | username, bio, avatar_url, min_price, daily_limit, questions_answered_today, is_admin, is_active, custom_creator_rate, custom_deadline_hours, fast_ask_suggestions, referred_by_id |
| `questions` | content, sender_name, sender_email, price_paid, service_type, is_anonymous, is_shareable, **is_support_only**, status, response_text, response_audio_url, answered_at |
| `transactions` | amount, status, payment_method, mp_payment_id, mp_preference_id |
| `payment_intents` | Temporária — dados da pergunta durante fluxo de pagamento (limpa após webhook) |
| `refund_queue` | Fila de reembolsos automáticos |
| `platform_settings` | Singleton — taxa da plataforma e prazo de resposta global |
| `creator_stats` | Estatísticas acumuladas por criador (total ganho, perguntas respondidas, etc.) |
| `daily_activity` | Atividade diária por criador (para gráficos e milestones) |

### Status do campo `questions.status`
- `pending` — pagamento confirmado, aguardando resposta do criador
- `answered` — criador respondeu (ou apoio recebido — criado já neste estado)
- `expired` — expirou sem resposta (reembolso)

### Campo `questions.is_support_only`
- `false` — pergunta normal (sujeita ao prazo de 36h e reembolso automático)
- `true` — apoio do fã (criado já como `answered`, sem exigir resposta, sem reembolso, não aparece no feed público)

### Funções SQL necessárias (rodar no SQL Editor)
```sql
-- Incremento atômico do contador diário
CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET questions_answered_today = questions_answered_today + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration para banco existente
```sql
-- Rodar se o banco foi criado antes de 2026-03-19
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_support_only BOOLEAN DEFAULT FALSE;
```

---

## Fluxo de pagamento

### Modo Pergunta (padrão)
```
Fã acessa /perfil/[username]
  → preenche formulário (modo "Fazer Pergunta") → clica "Pagar"
  → POST /api/payment/create-preference
      → valida daily_limit via can_accept_question()
      → salva payment_intent (question_data + is_support_only=false)
      → cria Preference MP → retorna init_point
  → redirect para checkout Mercado Pago
  → fã paga → MP chama POST /api/payment/webhook
      → HMAC verificado → busca payment_intent
      → re-valida daily_limit (race condition protection)
        → se limite atingido: PaymentRefund imediato + deleta intent
      → cria question (status='pending') + transaction
      → deleta payment_intent
  → MP redireciona para /perfil/[username]?payment_status=approved
```

### Modo Apoio ("Apenas Apoiar")
```
Fã escolhe "Apenas Apoiar" no formulário
  → POST /api/payment/create-preference (is_support_only=true)
  → webhook cria question com:
      status='answered', answered_at=now, response_text='❤️ Apoio recebido!'
      is_support_only=true, is_shareable=false
  → pergunta NUNCA aparece no dashboard do criador nem no feed público
  → fã não tem garantia de resposta (UI avisa: "Sem obrigação de resposta")
```

---

## Fluxo de resposta do criador

```
Criador acessa /dashboard
  → vê perguntas pendentes (status='pending', is_support_only=false)
  → Texto: digita resposta → PATCH /api/questions/[id]
  → Áudio: grava via MediaRecorder → upload Supabase Storage (bucket responses)
          → obtém URL pública → PATCH /api/questions/[id] com response_audio_url
  → pergunta some do dashboard (remoção otimista)
  → resposta aparece em /perfil/[username] se is_shareable=true E is_support_only=false
```

---

## Variáveis de ambiente

Arquivo: `frontend/.env.local` — ver `frontend/.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Server-side apenas (webhook, admin routes)

MP_ACCESS_TOKEN=                  # TEST-... sandbox | APP_USR-... produção
NEXT_PUBLIC_MP_PUBLIC_KEY=        # Não utilizado no fluxo atual (Checkout Pro)

NEXT_PUBLIC_APP_URL=              # http://localhost:3000 | https://dominio.com

MP_WEBHOOK_SECRET=                # Painel MP > Webhooks > Secret
REFUND_SECRET=                    # Token para /api/refunds/process (string aleatória)

FEATURE_REFUNDS_ENABLED=false     # Habilitar quando cron job estiver configurado
```

---

## Design system

- **Tema:** Dark-first com gradiente Instagram (`#F58529` → `#DD2A7B` → `#8134AF`)
- **Perfil e login:** fundo `#0A0A0F`, cards `#12121A`
- **Dashboard:** fundo claro com cards `rounded-2xl border border-gray-100`
- **Landing page:** light theme com acentos do gradiente
- **Botões primários:** `bg-gradient-instagram`
- **Tailwind custom:** `bg-gradient-instagram`, `text-gradient-instagram`, `bg-gradient-story` definidos em `globals.css` e `tailwind.config.ts`
- **Idioma:** Português do Brasil (pt-BR)

---

## Convenções de código

- **Server vs Client:** Server Components para fetch de dados; `'use client'` apenas para interatividade
- **Supabase regular:** `lib/supabase/server.ts` em Server Components; `lib/supabase/client.ts` em Client Components
- **Supabase admin:** `createClient(@supabase/supabase-js)` com `SUPABASE_SERVICE_ROLE_KEY` apenas em API Routes server-side (webhook, admin/*, questions/[id])
- **Componentes:** Funcionais com TypeScript, sem CSS modules — Tailwind inline
- **Roteamento:** Next.js App Router exclusivamente

---

## Comandos

```bash
cd frontend && npm install        # Instalar dependências
cd frontend && npm run dev        # Desenvolvimento (http://localhost:3000)
cd frontend && npm run build      # Build de produção
cd frontend && npm run lint       # Lint

# Testar webhook localmente
ngrok http 3000                   # Expor porta para MP (só em dev)
```

---

## Configuração Supabase (checklist)

- [x] Rodar `database/supabase_setup.sql` no SQL Editor
- [x] Rodar função `increment_answered_today` no SQL Editor
- [x] Rodar migration `is_support_only` se banco já existia (ver seção Banco de dados)
- [x] Authentication > Providers > Google: ativar com Client ID + Secret
- [x] Authentication > URL Configuration: Site URL + Redirect URLs (`/auth/callback`)
- [x] Storage > bucket `responses`: criar como público
- [ ] pg_cron: agendar reset diário de `questions_answered_today` (requer plano pago)

## Configuração Mercado Pago (checklist)

- [x] Criar aplicação em developers.mercadopago.com
- [x] Copiar Access Token e Public Key para variáveis de ambiente
- [x] Configurar webhook: URL `{APP_URL}/api/payment/webhook`, evento `payments`
- [ ] Confirmar uso de credenciais de produção (`APP_USR-...`) vs teste (`TEST-...`)

---

## Deploy — Render.com

A aplicação está hospedada no **Render.com** (não Vercel).

- **Auth callback:** `NEXT_PUBLIC_APP_URL` corrige o redirect pós-OAuth (evita loop com proxy reverso do Render que expõe `localhost:10000` internamente)
- **Story HD:** `html2canvas` com `scale: 3` + download via Blob em memória
- **Webhook MP:** URL de produção do Render configurada no painel do MP
- **Admin panel:** acessível em `/admin` — requer `is_admin=true` no perfil (setar manualmente no Supabase)

> Ver `plans/2026-03-13-render-deploy.md` para o guia completo de setup.

---

## Status das funcionalidades

| Funcionalidade | Status | Observação |
|---|---|---|
| Landing page + marketing (/vender) | ✅ | |
| Login Google OAuth | ✅ | Email removido |
| Onboarding do criador (/setup) | ✅ | |
| Proteção de rotas (middleware) | ✅ | |
| Perfil público com dados reais | ✅ | |
| Pagamento — Pergunta (PIX + cartão) | ✅ | |
| Pagamento — Modo Apoio | ✅ | Sem exigência de resposta |
| Reembolso automático (limite diário) | ✅ | PaymentRefund imediato no webhook |
| Dashboard com perguntas + métricas | ✅ | |
| Resposta por texto | ✅ | |
| Resposta por áudio (MediaRecorder) | ✅ | Fallback iOS Safari ativo |
| Story HD (html2canvas Scale 3x) | ✅ | |
| Feed de respostas públicas | ✅ | Filtra apoios (is_support_only=false) |
| Top supporters no perfil | ✅ | RPC get_top_supporters |
| Marcos e badges de criadores | ✅ | computeMilestones() |
| Edição de perfil + Fast Ask | ✅ | |
| Histórico de respostas + ganhos | ✅ | Paginado, filtros por período |
| Controle de visibilidade | ✅ | Toggle otimista |
| Perfil de exemplo (/perfil/exemplo) | ✅ | |
| Admin panel | ✅ | Ban, taxa custom, reembolso manual |
| Configurações da plataforma (admin) | ✅ | Taxa e prazo globais |
| Deploy (Render.com) | ✅ | |
| Webhook HMAC verificado | ✅ | |
| Reset diário automático (cron) | ⚠️ | pg_cron não configurado — reset manual necessário |
| Expiração de perguntas após 36h | ⚠️ | Código pronto — desabilitado (requer cron) |
| Fila de reembolsos automáticos | 🚩 | FEATURE_REFUNDS_ENABLED=false |
| Notificações por email | ⏳ | Pós-beta (Resend instalado) |
| Programa de afiliados | ⏳ | UI pronta, backend pós-beta |
| Resposta por vídeo | ⏳ | Pós-beta |
