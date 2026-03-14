# VOXA

**VOXA** é a plataforma definitiva para influenciadores, especialistas e criadores de conteúdo monetizarem sua interação com os fãs de maneira rápida, segura e escalável. 

Cansado de ter sua caixa de entrada lotada com dúvidas ignoradas no Instagram, X ou YouTube? Com o Voxa, você cria seu perfil público e permite que sua audiência pague para ter perguntas respondidas diretamente por você, via texto, áudio ou gravações de vídeo premium.

## 🚀 Principais Funcionalidades

- **Autenticação Simples:** Login "Passwordless" com Magic Link ou integração rápida via Google OAuth.
- **Micro-SaaS para Criadores:** Ferramentas de personalização do perfil (limites diários, configuração de valores personalizados).
- **Três Tipos de Respostas:**
  - 💬 **Texto:** Uma resposta rápida e direta para dúvidas simples.
  - 🎙️ **Áudio:** Para respostas exclusivas e mais detalhadas, diretamente gravadas na plataforma.
  - 🎥 **Vídeo Premium:** Uma monetização maior exigindo mais atenção do influenciador (Em breve).
- **Métricas em Tempo Real:** Dashboard inteligente monitorando ganhos diários no momento em que a pergunta é aprovada.
- **Exportação para as Redes:** Um clique para transformar sua resposta no Voxa em um belíssimo Card nos Stories do Instagram.
- **Pagamento Integrado:** Checkout ultra moderno via MercadoPago (PIX, Cartões e Saldo em conta) gerando aprovações síncronas através de Webhooks.

## 💻 Tech Stack (MVP Beta)

O projeto é mantido sob uma arquitetura serverless state-of-the-art focada em performance e UX:

- **Frontend SSR/SSG:** Next.js 14+ (App Router) e React
- **Estilização:** Tailwind CSS (Personalizado em Gradientes RGB)
- **Backend & Database:** Supabase (PostgreSQL, Auth, Storage)
- **Gateways Externos:** Mercado Pago API / SDK

## ⚙️ Como rodar localmente

Clone o repositório na sua máquina, e execute o seguinte comando na raiz do seu projeto Next:

```bash
cd frontend
npm install
```

Configure suas variáveis de ambiente copiando as enviroments de exemplo e substituindo as secretas do Supabase e do MP:

```bash
cp .env.example .env.local
```

Em seguida, inicialize a infraestrutura do seu projeto Next.js e da sua Base de Dados e comece a testar localmente.

```bash
npm run dev
```

Pronto! Seu servidor estará disponível em `http://localhost:3000`.

## 📦 Deploy (Produção)

A aplicação está oficialmente hospedada no ambiente de nuvem do **Render.com**. 
Durante a homologação para produção, as seguintes arquiteturas foram consolidadas:

- **Autenticação Segura (Google OAuth):** Configuração da variável `NEXT_PUBLIC_APP_URL` para suprimir os redirecionamentos de proxy reverso locais (`localhost:10000`) do Render, garantindo o retorno seguro para a dashboard no domínio oficial.
- **Exportação de Stories HD:** A renderização de cards via `html2canvas` foi refatorada e otimizada (Scale 3x) utilizando Blobs em memória. Superou as limitações nativas de CSS Blur, garantindo download imediato em alta resolução diretamente do navegador do usuário sem onerar o servidor.
- **Integração Mercado Pago:** Webhooks síncronos apontando para a URL de produção para a aprovação automática de pagamentos no banco de dados.

---
> Produto desenvolvido no Brasil por Jeferson Kollenz.
