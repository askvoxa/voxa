# VOXA 🎙️

**VOXA** é uma plataforma inovadora de monetização para criadores de conteúdo (influencers) focada no público brasileiro. A plataforma viabiliza a interação Premium, em que fãs pagam para enviar perguntas diretas ou contribuição de apoio ao influenciador favorito, dispondo de uma barreira temporária máxima de 36 horas para as respostas em formato multimídia, com automação estrita de devoluções passivas estourado o tempo limite.

![Status](https://img.shields.io/badge/Status-Produção_&_Beta_Mobile-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.1-black)
![React Native](https://img.shields.io/badge/React_Native-Expo-blue)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e)

## 📦 Estrutura Macro do Projeto

A stack do VOXA repousa sobre a premissa de um Monorepo simplificado contendo o Cliente Next.js, um Container Expo Nativo e os Schemas puros do Supabase.

```text
voxa/
├── CLAUDE.md                   # Resenha essencial de regras (Hub e Pointer Core Pointers AI)
├── README.md                   # Este arquivo (Visão geral e setup)
├── docs/                       # Diretório Progressivo de Documentação (Fluxos, DB, Arch)
├── frontend/                   # Aplicação Next.js Core (Interface e lógicas de servidor)
├── mobile/                     # Aplicativo Expo React Native (Wrapper WebView)
└── database/                   # Definições do banco de dados (SQL Source of Truth)
```

## 📖 Documentação (Progressive Disclosure)

Com o objetivo de manter fluência e facilitar leituras em alto nível (*Progressive Disclosure*), detalhes e restrições arquitetônicas, de banco e de pipelines estão alojados na pasta subordinada `docs/`.

- [**Arquitetura & Design** (`docs/architecture.md`)](docs/architecture.md) => Stack, Mobile vs Web, Dark mode premium constraints e regras centrais de Frontend.
- [**Database Supremo** (`docs/database.md`)](docs/database.md) => Modelagem de perfis, interações centrais (Questions/Payments), regras herméticas RLS e Triggers.
- [**Webhooks & Cron Jobs** (`docs/workflows.md`)](docs/workflows.md) => Entendendo os limites sensíveis e irreversíveis da API MP, estornos passivos assíncronos e proteção contra sobreposição (overselling).

> **Atenção (Importante):** Verifique essas sub-rotas nos documentos sempre que mexer na fundação destas funcionalidades. O arquivo `CLAUDE.md` aglutina regras basilares de convenção para contribuidores autônomos/IAs.

## 🏗️ Pré-requisitos (Desenvolvimento Local)

- Node.js `18.x` mínimo
- Conta no serviço [Supabase](https://supabase.com/) e cli ativada e Mercado Pago em dev-mode.
- A conta do [Expo](https://expo.dev/) acoplada ao EAS CLI (`npm i -g eas-cli`) para disparos de builds unificadas via cloud na estrutura _Mobile_.

## ⚙️ Instalação e Configuração

### 1. Clonar
```bash
git clone https://github.com/seu-usuario/voxa.git
cd voxa
```

### 2. Rodar o App Server Web
```bash
cd frontend
npm install
# Configure variáveis baseadas no supabase/mercado pago no arquivo `frontend/.env.local`.
npm run dev
```

### 3. Subir e Emular Container Mobile
```bash
cd mobile
npm install
npx expo start
```
*(Nota: O front mobile acopla por padrão ao App em deploy `askvoxa.com`. Adapte os URIs locais do React Native Webview dentro de `App.tsx` para testes no _host machine_)*

### 4. Setup Local do Supabase
Lance o conteúdo de `database/supabase_setup.sql` sobre um SQL runner virgem em um novo workspace logado da Supabase e habilite o Sign-in Google de acordo na abas de Autenticações.

---

## 📝 Licença
Desenvolvido para uso restrito/interno. Copyright (c) 2026 VOXA. Todos os direitos reservados.
