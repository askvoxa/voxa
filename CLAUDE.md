# VOXA — Guia para Desenvolvimento

## O que é o projeto

**VOXA** é uma plataforma de monetização para criadores de conteúdo (influencers) no mercado brasileiro. Fãs pagam para enviar perguntas a criadores com garantia de resposta em até 36 horas. O criador responde via texto ou áudio. A plataforma cobra 10% de taxa sobre cada transação.

**Status atual:** Beta funcional — autenticação, banco e pagamentos integrados. Pronto para deploy e testes com influencers reais.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14.1 (App Router), React 18, TypeScript 5 |
| Estilo | Tailwind CSS 3.3, gradiente Instagram customizado |
| Ícones | Lucide React |
| Auth | Supabase Auth (Google OAuth + Email magic link) |
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
├── .gitignore
├── plans/                             # Documentos de planejamento (não sobe ao Git)
│   └── beta-launch.md                 # Plano de lançamento beta + estado atual
├── database/
│   ├── schema.prisma                  # Schema completo (fonte de verdade)
│   ├── schema.sql                     # SQL equivalente (referência)
│   └── supabase_setup.sql             # SQL COMPLETO para rodar no Supabase (tabelas + RLS + storage)
└── frontend/
    ├── src/
    │   ├── middleware.ts               # Proteção de rotas (/dashboard, /setup)
    │   └── app/
    │       ├── layout.tsx
    │       ├── page.tsx                # Landing page
    │       ├── globals.css
    │       ├── auth/callback/route.ts  # Callback OAuth — redireciona para /setup ou /dashboard
    │       ├── login/page.tsx          # Login Google + Email magic link (REAL)
    │       ├── setup/page.tsx          # Onboarding do criador (username, bio, preço, limite)
    │       ├── vender/page.tsx         # Marketing + simulador de ganhos
    │       ├── dashboard/
    │       │   ├── page.tsx            # Server Component — busca dados reais do Supabase
    │       │   ├── QuestionList.tsx    # Client Component — resposta por texto/áudio, Story modal
    │       │   └── referral/page.tsx   # Programa de afiliados (UI pronta, dados mockados)
    │       ├── perfil/[username]/
    │       │   ├── page.tsx            # Server Component — perfil real + respostas públicas
    │       │   └── QuestionForm.tsx    # Client Component — formulário + redirect para MP
    │       └── api/
    │           ├── questions/
    │           │   ├── route.ts        # POST (legado/mock — não usado no fluxo de pagamento)
    │           │   └── [id]/route.ts   # PATCH — responde pergunta (texto ou URL de áudio)
    │           └── payment/
    │               ├── create-preference/route.ts  # Cria preferência MP + salva payment_intent
    │               └── webhook/route.ts            # Recebe confirmação MP → salva question no DB
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

### Tabelas

| Tabela | Descrição |
|---|---|
| `profiles` | Perfil do criador: username, bio, avatar_url, min_price, daily_limit, questions_answered_today, referred_by_id |
| `questions` | Pergunta: content, sender_name, price_paid, service_type, is_anonymous, is_shareable, status, response_text, response_audio_url, answered_at |
| `transactions` | Pagamento: amount, status, payment_method, mp_payment_id, mp_preference_id |
| `payment_intents` | Temporária: armazena dados da pergunta durante fluxo de pagamento MP (limpa após webhook) |

### Status do campo `questions.status`
- `pending` — pagamento confirmado, aguardando resposta do criador
- `answered` — criador respondeu
- `expired` — expirou sem resposta (reembolso)

### Funções SQL necessárias
```sql
-- Incremento atômico do contador diário (rodar no SQL Editor)
CREATE OR REPLACE FUNCTION increment_answered_today(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET questions_answered_today = questions_answered_today + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Fluxo de pagamento

```
Fã acessa /perfil/[username]
  → preenche formulário → clica "Pagar"
  → POST /api/payment/create-preference
      → salva payment_intent no Supabase (dados da pergunta + external_reference UUID)
      → cria Preference no Mercado Pago com external_reference
      → retorna init_point
  → redirect para checkout Mercado Pago
  → fã paga (PIX / cartão)
  → MP chama POST /api/payment/webhook
      → busca payment por ID no MP
      → se approved: lê external_reference → busca payment_intent → cria question + transaction
      → deleta payment_intent
  → MP redireciona para /perfil/[username]?payment_status=approved
```

---

## Fluxo de resposta do criador

```
Criador acessa /dashboard
  → vê perguntas pendentes em tempo real (Server Component)
  → clica "Responder por Texto" ou "Responder por Áudio"
  → modal abre inline no card
  → Texto: digita resposta → PATCH /api/questions/[id]
  → Áudio: grava via MediaRecorder → upload para Supabase Storage (bucket responses)
         → obtém URL pública → PATCH /api/questions/[id] com response_audio_url
  → pergunta some do dashboard (remoção otimista)
  → resposta aparece em /perfil/[username] se is_shareable=true
```

---

## Variáveis de ambiente

Arquivo: `frontend/.env.local` — ver `frontend/.env.example` para referência completa.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Apenas server-side (webhook, create-preference)

# Mercado Pago
MP_ACCESS_TOKEN=                  # TEST-... para sandbox, APP_USR-... para produção
NEXT_PUBLIC_MP_PUBLIC_KEY=        # Não utilizado no fluxo atual (Checkout Pro)

# App
NEXT_PUBLIC_APP_URL=              # http://localhost:3000 ou https://dominio.com
```

---

## Design system

- **Tema:** Dark-first com gradiente Instagram (`#F58529` → `#DD2A7B` → `#8134AF`)
- **Cards escuros:** `rounded-[32px]` com `border border-white/5` e backdrop blur
- **Cards claros (dashboard):** `rounded-2xl` com `border border-gray-100`
- **Botões primários:** `bg-gradient-instagram`
- **Idioma:** Português do Brasil (pt-BR)
- **Tailwind custom:** `bg-gradient-instagram`, `text-gradient-instagram` definidos em `globals.css` e `tailwind.config.ts`

---

## Convenções de código

- **Server vs Client:** Server Components para fetch de dados, `'use client'` apenas para interatividade
- **Supabase:** `lib/supabase/server.ts` em Server Components e API Routes; `lib/supabase/client.ts` em Client Components
- **Admin Supabase:** `createClient(@supabase/supabase-js)` com `SUPABASE_SERVICE_ROLE_KEY` apenas em API Routes server-side (webhook, create-preference)
- **Componentes:** Funcionais com TypeScript, sem CSS modules — Tailwind inline
- **Roteamento:** Next.js App Router exclusivamente

---

## Comandos

```bash
# Instalar dependências
cd frontend && npm install

# Desenvolvimento (com ngrok em paralelo para webhook MP)
cd frontend && npm run dev        # http://localhost:3000
ngrok http 3000                   # expor para webhook do MP

# Build e lint
cd frontend && npm run build
cd frontend && npm run lint
```

---

## Configuração Supabase (checklist)

- [ ] Rodar `database/supabase_setup.sql` no SQL Editor
- [ ] Rodar função `increment_answered_today` no SQL Editor
- [ ] Authentication > Providers > Google: ativar com Client ID + Secret do Google Cloud Console
- [ ] Authentication > URL Configuration: Site URL + Redirect URLs (`/auth/callback`)
- [ ] Storage > bucket `responses`: criar como público

## Configuração Mercado Pago (checklist)

- [ ] Criar aplicação em developers.mercadopago.com
- [ ] Copiar Access Token (TEST) e Public Key (TEST) para `.env.local`
- [ ] Configurar webhook: URL `{APP_URL}/api/payment/webhook`, evento `payments`
- [ ] Para produção: substituir por credenciais de produção e reconfigurar webhook

---

## O que está pronto para o beta

| Funcionalidade | Status |
|---|---|
| Landing page + marketing (/vender) | ✅ |
| Login Google + Email magic link | ✅ |
| Onboarding do criador (/setup) | ✅ |
| Proteção de rotas (middleware) | ✅ |
| Perfil público com dados reais | ✅ |
| Pagamento via Mercado Pago (PIX + cartão) | ✅ |
| Dashboard com perguntas reais + métricas | ✅ |
| Resposta por texto | ✅ |
| Resposta por áudio (MediaRecorder + Storage) | ✅ |
| Geração de Story (html2canvas) | ✅ |
| Feed de respostas públicas no perfil | ✅ |
| Deploy (Vercel) | ⏳ Pendente |
| Programa de afiliados (dados reais) | ⏳ Pós-beta |
| Resposta por vídeo | ⏳ Pós-beta |
| Notificações por email | ⏳ Pós-beta |
| Reset diário automático (cron) | ⏳ Pós-beta |
