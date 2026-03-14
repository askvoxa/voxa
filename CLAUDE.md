# VOXA — Guia para Desenvolvimento

## O que é o projeto

**VOXA** é uma plataforma de monetização para criadores de conteúdo (influencers) no mercado brasileiro. Fãs pagam para enviar perguntas a criadores com garantia de resposta em até 36 horas. O criador responde via texto ou áudio. A plataforma cobra 10% de taxa sobre cada transação.

**Status atual:** Beta funcional — autenticação, banco e pagamentos integrados. **Deployado em produção no Render.com.** Pronto para testes com influencers reais.

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
├── .gitignore
├── plans/                             # Documentos de planejamento (não sobe ao Git)
│   ├── beta-launch.md                 # Plano de lançamento beta + histórico de sprints
│   ├── 2026-03-13-local-validation.md # Procedimentos de validação local end-to-end
│   └── 2026-03-13-render-deploy.md    # Guia de deploy no Render.com
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
    │       ├── login/page.tsx          # Login Google OAuth (apenas — sem email magic link)
    │       ├── setup/page.tsx          # Onboarding do criador (username, bio, preço, limite)
    │       ├── vender/page.tsx         # Marketing + simulador de ganhos
    │       ├── dashboard/
    │       │   ├── page.tsx            # Server Component — busca dados reais do Supabase
    │       │   ├── QuestionList.tsx    # Client Component — resposta por texto/áudio, Story modal, fallback iOS
    │       │   ├── history/
    │       │   │   ├── page.tsx        # Server Component — histórico de respostas + métricas de ganhos
    │       │   │   └── VisibilityToggle.tsx  # Client Component — toggle is_shareable com update otimista
    │       │   ├── settings/page.tsx   # Client Component — edição de perfil (bio, preço, limite, avatar)
    │       │   └── referral/page.tsx   # Programa de afiliados (UI pronta, dados mockados)
    │       ├── perfil/[username]/
    │       │   ├── page.tsx            # Server Component — perfil real + respostas públicas + demo para 'exemplo'
    │       │   └── QuestionForm.tsx    # Client Component — formulário + redirect para MP
    │       └── api/
    │           ├── questions/
    │           │   ├── route.ts        # POST (legado/mock — não usado no fluxo de pagamento)
    │           │   ├── [id]/route.ts   # PATCH — responde pergunta (texto ou URL de áudio)
    │           │   └── visibility/route.ts  # PATCH — alterna is_shareable de pergunta respondida
    │           ├── payment/
    │           │   ├── create-preference/route.ts  # Cria preferência MP + salva payment_intent
    │           │   └── webhook/route.ts            # Recebe confirmação MP → salva question no DB (HMAC verificado)
    │           └── refunds/
    │               └── process/route.ts  # GET protegido — processa fila de reembolsos (cron externo)
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
| `refund_queue` | Fila de reembolsos: questões expiradas pendentes de reembolso no MP |

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

# Segurança
MP_WEBHOOK_SECRET=                # Secret do webhook MP (painel MP > Webhooks > Secret)
REFUND_SECRET=                    # Token para proteger /api/refunds/process (qualquer string aleatória)
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

# Desenvolvimento local
cd frontend && npm run dev        # http://localhost:3000

# Para testar webhook do MP localmente: expor porta com ngrok
ngrok http 3000                   # necessário apenas em dev — produção usa URL do Render

# Build e lint
cd frontend && npm run build
cd frontend && npm run lint
```

---

## Configuração Supabase (checklist)

- [x] Rodar `database/supabase_setup.sql` no SQL Editor
- [x] Rodar função `increment_answered_today` no SQL Editor
- [x] Authentication > Providers > Google: ativar com Client ID + Secret do Google Cloud Console
- [x] Authentication > URL Configuration: Site URL + Redirect URLs (`/auth/callback`) — atualizado para domínio do Render
- [x] Storage > bucket `responses`: criar como público

## Configuração Mercado Pago (checklist)

- [x] Criar aplicação em developers.mercadopago.com
- [x] Copiar Access Token e Public Key para variáveis de ambiente
- [x] Configurar webhook: URL `{APP_URL}/api/payment/webhook`, evento `payments` — apontando para Render em produção
- [ ] Confirmar uso de credenciais de produção (`APP_USR-...`) vs teste (`TEST-...`) no ambiente Render

---

## Deploy — Render.com

A aplicação está hospedada no **Render.com** (não Vercel). Arquiteturas consolidadas durante o deploy:

- **Auth callback fix:** `NEXT_PUBLIC_APP_URL` usado no redirect pós-OAuth para evitar loop com o proxy reverso do Render (que expõe `localhost:10000` internamente)
- **Story HD:** `html2canvas` refatorado com `scale: 3` e download via Blob em memória — supera limitações de CSS blur e garante qualidade HD sem onerar o servidor
- **Webhook MP:** URL de produção do Render configurada no painel do Mercado Pago

> Ver `plans/2026-03-13-render-deploy.md` para o guia completo de setup.

---

## O que está pronto para o beta

| Funcionalidade | Status |
|---|---|
| Landing page + marketing (/vender) | ✅ |
| Login Google OAuth (email removido) | ✅ |
| Onboarding do criador (/setup) | ✅ |
| Proteção de rotas (middleware) | ✅ |
| Perfil público com dados reais | ✅ |
| Pagamento via Mercado Pago (PIX + cartão) | ✅ |
| Dashboard com perguntas reais + métricas | ✅ |
| Resposta por texto | ✅ |
| Resposta por áudio (MediaRecorder + Storage) | ✅ |
| Geração de Story HD (html2canvas Scale 3x + Blob) | ✅ |
| Feed de respostas públicas no perfil | ✅ |
| Deploy (Render.com) | ✅ |
| Webhook MP com verificação HMAC | ✅ |
| Edição de perfil (/dashboard/settings) | ✅ |
| Histórico de respostas e ganhos (/dashboard/history) | ✅ |
| Controle de visibilidade das perguntas | ✅ |
| Perfil de exemplo (/perfil/exemplo) | ✅ |
| Fallback iOS Safari para gravação de áudio | ✅ |
| Fila de reembolsos (/api/refunds/process) | 🚩 Desabilitado via FEATURE_REFUNDS_ENABLED=false |
| Reset diário automático (cron) | ⚠️ pg_cron não agendado no Supabase |
| Expiração de perguntas após 36h | ⚠️ Código pronto — desabilitado (requer cron pago) |
| Notificações por email | ⏳ Pós-beta |
| Programa de afiliados (dados reais) | ⏳ Pós-beta |
| Resposta por vídeo | ⏳ Pós-beta |
