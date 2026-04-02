# Arquitetura — VOXA

## Stack Tecnológico

### Web (frontend/)
- **Next.js 14.1** com App Router
- **React 18**, TypeScript, Tailwind CSS
- **Supabase SSR** (`@supabase/ssr`) para autenticação e queries server-side

### Mobile (mobile/)
- **Expo + React Native WebView** — wrapper nativo sobre o frontend web
- **EAS CLI** para build de `.apk` / `.ipa` via nuvem

### Backend e Infraestrutura
- **Supabase** — PostgreSQL Serverless, Auth (Google OAuth), Storage, RLS
- **Render.com** — hospedagem do Next.js e agendamento dos Cron Jobs
- **Mercado Pago** — checkout transparente via PIX e Cartão (Checkout PRO)
- **Resend** — envio transacional de emails

---

## Fluxo de Autenticação

```
Usuário clica "Entrar com Google"
  → Supabase Auth inicia OAuth
  → /auth/callback recebe o code e troca por sessão
  → Middleware verifica session + profile no banco
  → Redirect baseado no estado do perfil:
      - Sem profile           → /setup
      - Criador sem setup     → /setup/creator
      - Profile completo      → /dashboard
```

O middleware em `frontend/src/middleware.ts` executa em **todas as requisições** (exceto assets estáticos) e realiza:
1. Refresh do cookie de sessão do Supabase
2. Proteção de rotas `/dashboard` e `/setup` — exige usuário autenticado
3. Proteção de rotas `/admin` e `/api/admin` — exige `account_type = 'admin'`
4. Redirects do setup flow (criador sem perfil completo)
5. Redirect de `/login` → `/dashboard` se já autenticado

---

## Estrutura de Rotas e Componentes

### Rotas Públicas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `app/page.tsx` | Landing page |
| `/sou-criador` | `app/sou-criador/` | Captação de criadores |
| `/waitlist` | `app/waitlist/` | Pré-cadastro de criadores |
| `/login` | `app/login/` | Login Google OAuth |
| `/perfil/[username]` | `app/perfil/[username]/` | Perfil público do criador + formulário de pergunta |

### Rotas Autenticadas (Dashboard)

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/dashboard` | Fã + Criador | Dashboard principal com toggle de modo |
| `/dashboard/questions` | Criador | Lista de perguntas pendentes |
| `/dashboard/history` | Fã + Criador | Histórico completo de perguntas |
| `/dashboard/spending` | Fã | Histórico de gastos |
| `/dashboard/payouts` | Criador | Saldo, saque PIX, histórico financeiro |
| `/dashboard/profile` | Fã + Criador | Edição de perfil público |
| `/dashboard/settings` | Fã + Criador | Configurações da conta |
| `/dashboard/referral` | Criador | Link de referral |
| `/dashboard/verification` | Criador | Solicitação de verificação de identidade |
| `/invite/[code]` | Autenticado | Ativação de convite para virar criador |
| `/setup/creator` | Autenticado | Formulário de candidatura/setup de criador |

### Painel Admin

| Rota | Descrição |
|------|-----------|
| `/admin` | Métricas gerais da plataforma |
| `/admin/approvals` | Candidaturas de criadores pendentes |
| `/admin/users` | Lista e promoção/rebaixamento de usuários |
| `/admin/influencers/[id]` | Detalhes de um criador (ban, verificação, taxa customizada) |
| `/admin/payouts` | Visão de saques, retentativa de falhas, pausar globalmente |
| `/admin/verifications` | Solicitações de verificação de identidade |
| `/admin/reports` | Perguntas reportadas como abusivas |
| `/admin/invites` | Criação e listagem de convites |
| `/admin/settings` | Taxa da plataforma, prazo de resposta padrão |

### Rotas de API

| Prefixo | Descrição |
|---------|-----------|
| `/api/payment/create-preference` | Cria PaymentIntent + preferência Mercado Pago |
| `/api/payment/webhook` | Webhook HMAC do Mercado Pago (confirma pagamentos) |
| `/api/payout/request` | Solicita saque via RPC `request_payout` |
| `/api/payout/balance` | Retorna saldo disponível/pendente via RPC `get_creator_balance` |
| `/api/payout/history` | Histórico de saques do criador |
| `/api/payout/pix-key` | Cadastro/atualização de chave PIX |
| `/api/questions/[id]` | Ações em perguntas (responder, rejeitar, visibilidade) |
| `/api/questions/visibility` | Toggle de visibilidade pública de respostas |
| `/api/refunds/` | Emissão de reembolso manual (admin) |
| `/api/setup/` | Submissão de candidatura de criador |
| `/api/verification/` | Submissão de solicitação de verificação |
| `/api/waitlist/` | Cadastro na lista de espera |
| `/api/invite/` | Validação e uso de convite |
| `/api/admin/*` | Endpoints exclusivos para admin (todos exigem `account_type = 'admin'`) |

### Cron Jobs (agendados via Render.com)

| Endpoint | Frequência | O que faz |
|----------|-----------|-----------|
| `/api/cron/expire-questions` | A cada 1h | Expira perguntas > 36h, enfileira reembolsos |
| `/api/cron/process-payouts` | Diário | Processa saques pendentes via MP, reverte falhas |
| `/api/cron/release-earnings` | Diário | Libera ganhos após carência de 7 dias no ledger |
| `/api/cron/cleanup-intents` | Diário | Remove PaymentIntents com mais de 48h |

---

## Componentes Compartilhados

Localizados em `frontend/src/components/`:

| Componente | Descrição |
|------------|-----------|
| `BottomNav.tsx` | Navegação inferior mobile para usuários autenticados |
| `AdminBottomNav.tsx` | Navegação inferior mobile para o painel admin |
| `Header.tsx` | Cabeçalho da aplicação |
| `DashboardModeToggle.tsx` | Toggle Fã ↔ Criador no dashboard |
| `VerifiedBadge.tsx` | Badge de criador verificado |
| `FounderBadge.tsx` | Badge de criador fundador |
| `SearchBar.tsx` | Barra de busca de criadores |
| `GoogleAnalytics.tsx` | Integração com GA |
| `milestones/` | Componentes de gamificação (barra de progresso, metas) |

---

## Sistema de Emails (Resend)

Implementado em `frontend/src/lib/email.ts`. Todos os envios são **fire-and-forget** — não bloqueiam o fluxo principal.

### Emails para Criadores

| Função | Quando é disparada |
|--------|--------------------|
| `sendNewQuestionNotification` | Webhook confirma pagamento aprovado (pergunta) |
| `sendSupportNotification` | Webhook confirma pagamento aprovado (apoio/tip) |
| `sendUrgencyReminder` | Cron expire-questions nos thresholds de 24h, 12h e 6h |

### Emails para Fãs

| Função | Quando é disparada |
|--------|--------------------|
| `sendQuestionConfirmation` | Webhook confirma pagamento — pergunta criada |
| `sendResponseNotification` | Criador responde a pergunta no dashboard |
| `sendExpirationNotification` | Cron expire-questions marca pergunta como expirada |
| `sendRejectionNotification` | Criador rejeita uma pergunta |
| `sendRefundConfirmation` | Mercado Pago confirma o estorno processado |

---

## Design System

O app usa **dark mode premium** como modo padrão de UI. Regras centrais:

1. **Nunca use hex hardcoded** — use as CSS Vars semânticas definidas em `globals.css` (ex: `bg-gradient-instagram` para botões de conversão).
2. **Nunca duplique lógica de negócio no frontend** — se envolve cálculo de dados (top supporters, métricas), use RPC/View no Supabase. O Next.js apenas consulta e renderiza.
3. **Assets no bucket correto** — avatares → bucket `avatars`; áudios/respostas → bucket `responses`. As políticas RLS dos buckets restringem deleção ao próprio dono.
4. **Mobile-first obrigatório** — todo componente deve funcionar em viewport 375px. Use `<BottomNav />` em vez de sidebar para navegação mobile.

---

## Integração Mobile

O app `mobile/` é um wrapper React Native que carrega o frontend web via `react-native-webview`, sem barra de endereços do navegador. A interface já é projetada para parecer um app nativo em mobile (Bottom Navigation, safe areas do iOS respeitadas com padding inferior).
