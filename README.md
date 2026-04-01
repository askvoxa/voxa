# VOXA

**VOXA** é uma plataforma brasileira de monetização para criadores de conteúdo. Fãs pagam para enviar perguntas diretas ao criador favorito via PIX ou cartão. O criador tem até 36 horas para responder em texto ou áudio — caso não responda, o reembolso é automático.

![Status](https://img.shields.io/badge/Status-Produção_&_Beta_Mobile-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.1-black)
![React Native](https://img.shields.io/badge/React_Native-Expo-blue)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e)

---

## Estrutura do Monorepo

```text
voxa/
├── CLAUDE.md              # Diretrizes para agentes de IA / contribuidores
├── README.md              # Este arquivo
├── docs/                  # Documentação detalhada por domínio
│   ├── architecture.md    # Rotas, componentes, autenticação, emails
│   ├── database.md        # Tabelas, RPCs, triggers, RLS
│   ├── workflows.md       # Fluxos críticos: pagamento, payout, expiração
│   ├── testing_strategy.md# Estratégia de testes (pgTAP, Vitest, Playwright)
│   └── qa_checklist.md    # Checklist manual de QA por jornada
├── frontend/              # App Next.js 14 (App Router)
├── mobile/                # App Expo React Native (WebView wrapper)
└── database/              # SQL source of truth
    └── schemas/           # 00_enums → 06_indexes_and_seed
```

---

## Documentação Detalhada

| Documento | Quando consultar |
|-----------|-----------------|
| [architecture.md](docs/architecture.md) | Criar/alterar interfaces, rotas, componentes, CSS |
| [database.md](docs/database.md) | Alterar tabelas, triggers, RPCs ou políticas RLS |
| [workflows.md](docs/workflows.md) | Tocar no fluxo de pagamento, payout ou expiração |
| [testing_strategy.md](docs/testing_strategy.md) | Implementar ou executar testes |
| [qa_checklist.md](docs/qa_checklist.md) | Sessões de QA manual |

---

## Jornadas de Usuário

### Fã
Cria conta (Google OAuth) → acessa perfil de criador → preenche pergunta + email → paga via Mercado Pago (PIX/cartão) → aguarda resposta → recebe notificação por email quando respondida. Caso expire em 36h, recebe reembolso automático.

### Criador
Solicita acesso via convite ou candidatura → admin aprova → conclui setup do perfil → recebe perguntas pagas no dashboard → responde em texto ou áudio → saldo liberado após carência de 7 dias → solicita saque via PIX.

### Admin
Aprova/rejeita candidaturas de criadores → gerencia usuários → processa verificações de identidade → revisa perguntas reportadas → controla configurações da plataforma (taxa, prazo de resposta, saques).

---

## Mapa de Rotas

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/` | Público | Landing page |
| `/sou-criador` | Público | Página de captação de criadores |
| `/waitlist` | Público | Formulário de pré-cadastro |
| `/login` | Público | Login via Google OAuth |
| `/perfil/[username]` | Público | Perfil do criador + formulário de pergunta |
| `/auth/*` | Sistema | Callback OAuth do Supabase |
| `/invite/[code]` | Autenticado | Ativação de convite de criador |
| `/setup/creator` | Autenticado | Formulário de candidatura / setup do criador |
| `/dashboard` | Autenticado | Dashboard principal (modo fã ou criador) |
| `/dashboard/questions` | Criador | Lista de perguntas pendentes |
| `/dashboard/history` | Autenticado | Histórico de perguntas |
| `/dashboard/payouts` | Criador | Saldo e solicitação de saques PIX |
| `/dashboard/spending` | Fã | Histórico de gastos |
| `/dashboard/profile` | Autenticado | Edição de perfil |
| `/dashboard/settings` | Autenticado | Configurações da conta |
| `/dashboard/referral` | Criador | Link de referral |
| `/dashboard/verification` | Criador | Solicitação de verificação de identidade |
| `/admin` | Admin | Painel administrativo |
| `/admin/approvals` | Admin | Candidaturas de criadores pendentes |
| `/admin/users` | Admin | Gerenciamento de usuários |
| `/admin/influencers/[id]` | Admin | Detalhes e controles de um criador |
| `/admin/payouts` | Admin | Visão geral e controle de saques |
| `/admin/verifications` | Admin | Solicitações de verificação de identidade |
| `/admin/reports` | Admin | Perguntas reportadas como abusivas |
| `/admin/invites` | Admin | Criação e listagem de convites |
| `/admin/settings` | Admin | Taxa da plataforma, prazo de resposta |

---

## Variáveis de Ambiente

Crie `frontend/.env.local` com as seguintes variáveis:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Chave pública (anon)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # Chave publishable (SSR)
SUPABASE_SERVICE_ROLE_KEY=         # Chave service_role (server only — nunca expor)

# Mercado Pago
MP_ACCESS_TOKEN=                   # Token privado do MP (server only)
NEXT_PUBLIC_MP_PUBLIC_KEY=         # Chave pública do MP (checkout)
MP_WEBHOOK_SECRET=                 # Secret HMAC para validar webhooks do MP

# App
NEXT_PUBLIC_APP_URL=               # URL base (ex: https://askvoxa.com)

# Email (Resend)
RESEND_API_KEY=                    # API key do Resend (server only)
```

---

## Setup Local

### 1. Clonar o repositório
```bash
git clone https://github.com/askvoxa/voxa.git
cd voxa
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
cp .env.example .env.local   # preencha as variáveis acima
npm run dev
```

### 3. Banco de dados (Supabase)
Execute os arquivos de `database/schemas/` **em ordem** no SQL Editor do Supabase:
```
00_enums.sql → 01_tables.sql → 02_storage.sql → 03_functions.sql
→ 04_triggers.sql → 05_rls_policies.sql → 06_indexes_and_seed.sql
```
Habilite também o **Sign-in com Google** nas configurações de Autenticação do Supabase.

### 4. Mobile (Expo)
```bash
cd mobile
npm install
npx expo start
```
> O app mobile aponta por padrão para `askvoxa.com`. Para testar localmente, altere a URL do WebView em `mobile/App.tsx`.

---

## Licença
Desenvolvido para uso restrito/interno. Copyright (c) 2026 VOXA. Todos os direitos reservados.
