# VOXA 2026 — Strategy Primer

**Autores:** Jeferson
**Status:** Rascunho beta — março/2026

---

## Resumo Executivo

Este documento consolida o que sabemos sobre o mercado, o comportamento dos usuários e as dependências externas da VOXA — uma plataforma de Q&A pago para criadores de conteúdo brasileiros. Fãs pagam por respostas garantidas em até 36 horas; criadores monetizam seu tempo ocioso via texto ou áudio. A plataforma cobra 10% de taxa sobre cada transação.

**O que sabemos:** O mercado brasileiro de criadores é o segundo maior do mundo em número de criadores ativos, com forte adoção de PIX e alta propensão dos fãs a pagar por acesso exclusivo. Plataformas equivalentes em inglês (Cameo, Patreon) têm fricção alta para o público BR. A janela de oportunidade se abriu com a deprecação da API do Instagram pela Meta em dezembro/2024.

**Status atual:** Beta funcional em produção (Render.com). Pagamentos, autenticação, dashboard, respostas texto/áudio — tudo operacional. Pronto para onboarding de criadores reais.

### 5 Grandes Perguntas

1. **Aquisição:** Como onboardar os primeiros 50 criadores sem orçamento de marketing?
2. **Confiança:** Como garantir que criadores respondam dentro de 36h? (reembolso automático ainda está desabilitado)
3. **Diferenciação sustentável:** O que impede o Instagram/TikTok de copiar o modelo?
4. **Escala de receita:** Quando o volume de transações cobre os custos operacionais?
5. **Retenção de criadores:** O que mantém um criador ativo após os primeiros 30 dias?

---

## Visão Geral do Mercado

**Estado do mercado**

O mercado de economia de criadores no Brasil cresce ~30% ao ano. Estimativa: ~570 mil criadores com mais de 10 mil seguidores combinados no Instagram, YouTube e TikTok (2025). O Brasil é o 2º maior mercado mundial de criadores em volume de produtores ativos, atrás apenas dos EUA.

Apesar disso, a oferta de ferramentas de monetização direta em português é escassa. O mercado é dominado por:
- **Patreon** (assinatura mensal, em USD — alta fricção para BR)
- **Hotmart** (infoprodutos, não Q&A)
- **Cameo** (shoutouts em vídeo, EUA-centric, preço alto)
- **Instagram DMs** (gratuito, mas caótico, não remunerado, sem garantias)

Em dezembro/2024, a Meta encerrou a Instagram Basic Display API, impossibilitando autenticação via Instagram nas plataformas parceiras. Isso criou uma janela para plataformas independentes que não dependem do ecossistema Meta.

**Quem usa**

- **Criadores:** influencers de nicho (10K–500K seguidores), podcasters, criadores de conteúdo autoral, especialistas de nicho (fitness, culinária, finanças pessoais)
- **Fãs:** seguidores engajados, dispostos a pagar por acesso direto e resposta garantida. Hipótese: 1–5% da base de fãs de um criador converte em pagamento.

**Receita estimada**

| Escala | Criadores ativos | Perguntas/dia/criador | Ticket médio | Receita plataforma (10%) |
|---|---|---|---|---|
| Beta | 50 | 3 | R$30 | R$1.350/mês |
| Inicial | 500 | 3 | R$30 | R$13.500/mês |
| Escala | 5.000 | 3 | R$30 | R$135.000/mês |

**Driver principal de crescimento**

Loop orgânico: criador adere → compartilha o link no perfil/Stories → fãs pagam → criador lucra → recomenda outros criadores. Acelerador: PIX elimina fricção de conversão vs. plataformas em USD com cartão de crédito.

**Em 5 anos (suposição)**

Se a economia de criadores seguir a trajetória atual, a VOXA pode capturar R$5–20M/ano com 50K–200K criadores ativos. Principal risco: Instagram ou TikTok lançarem Q&A pago nativo — improvável no curto prazo, mas possível.

**Grandes perguntas (mercado)**

1. Qual o TAM real de criadores dispostos a cobrar por Q&A? (não apenas por assinatura ou infoprodutos)
2. Como acelerar a curva de adoção além do boca-a-boca?
3. Em quanto tempo o volume de transações cobre os custos operacionais?

---

## Padrões de Comportamento

**Como criadores consomem a plataforma**

- Respondem em blocos de tempo ocioso: fila de café, entre gravações, transporte
- Preferência por áudio: mais rápido que texto, mais humano que escrito, sem câmera
- Controlam carga de trabalho via `daily_limit` (1–50 perguntas/dia) e preço mínimo (R$10–R$200+)
- Compartilham respostas como Stories via exportação nativa da plataforma (html2canvas 3x) → marketing orgânico

**Como fãs consomem**

- Pagamento único por pergunta, sem assinatura → baixíssima fricção de entrada
- PIX dominante (imediato, sem taxas de cartão, sem cadastro de cartão)
- Opção de pergunta anônima reduz inibição → mais perguntas pessoais e íntimas
- Hipótese: fãs recorrentes representam 20–30% dos pagamentos (mesmos fãs voltam a perguntar ao mesmo criador)

**Mudanças geracionais**

Gen Z e Alpha já estão acostumados a pagar por conteúdo digital: Twitch bits, YouTube Super Thanks, TikTok gifts, Kwai moedas. Preferem interação direta e personalizada vs. conteúdo broadcast genérico. Hipótese: maior propensão a pagar por "acesso exclusivo" do que por produto físico.

**Como o público encontra a plataforma**

- Link direto `/perfil/[username]` no bio do Instagram, Linktree, TikTok
- Stories exportados pela plataforma (o criador divulga sua própria renda/engajamento)
- Programa de referral entre criadores (UI pronta, a ser ativado pós-beta)

**Ticket médio e hábitos de gasto**

- Estimativa inicial: R$20–50/pergunta (depende do nicho e tamanho do criador)
- Criadores de nicho especializado (médicos, advogados, especialistas fitness) tendem a cobrar mais (R$50–200+)
- Criadores de entretenimento geral tendem a cobrar menos (R$10–30)

**Razões para engajar**

- **Fãs:** acesso exclusivo, resposta garantida em 36h, personalização, possibilidade de anonimato
- **Criadores:** nova fonte de renda sem criar novo conteúdo, sem depender de algoritmo de feed, sem câmera obrigatória

**Razões para desengajar**

- **Criadores:** volume baixo de perguntas pagas, resposta que não gera reembolso mas mancha reputação, plataforma complexa
- **Fãs:** resposta decepcionante (curta, genérica), demora além do prometido, preço percebido como alto

**O que os concorrentes oferecem**

| Produto | Modelo | Fricção para BR | Diferença da VOXA |
|---|---|---|---|
| Instagram DMs | Gratuito, sem garantia | Baixa | VOXA é pago e garante resposta |
| Cameo | Vídeo shoutout, preço alto | Alta (USD, EUA) | VOXA é mais rápido, texto/áudio, BR |
| Patreon | Assinatura mensal | Alta (USD, recorrência) | VOXA é transacional, sem fidelização |
| Hotmart | Infoproduto | Média | VOXA é Q&A direto, não produto |

**Grandes perguntas (comportamento)**

1. Qual o ticket médio real após onboarding de criadores reais?
2. Qual % dos fãs que acessam o perfil converte em pagamento?
3. A opção de pergunta anônima aumenta significativamente o volume de perguntas?

---

## Terceiros

**Fornecedores críticos**

| Fornecedor | Função | Risco |
|---|---|---|
| **Mercado Pago** | Checkout Pro (PIX + cartão), webhooks | Outage = plataforma sem pagamentos |
| **Supabase** | Banco PostgreSQL + Auth + Storage (áudios) | Downtime ou mudança de planos gratuitos |
| **Render.com** | Hospedagem Next.js | Cold start em plano gratuito; instância pode dormir |
| **Google OAuth** | Autenticação de criadores | API estável, baixo risco |

**Canais de entrega**

- **Link direto:** `/perfil/[username]` — distribuído pelo próprio criador em suas redes
- **Story export:** criador gera e compartilha Stories com respostas → aquisição orgânica de novos fãs
- **Referral entre criadores:** UI pronta, dados mockados → a ser ativado pós-beta

**Custo de operação (estimativa fase beta)**

| Item | Custo estimado |
|---|---|
| Render.com (web service) | $7–25/mês |
| Supabase (Pro, pós-limite gratuito) | $25/mês |
| Mercado Pago (taxa transação) | 3,49–4,99% por pagamento — pago pelo criador |
| Total estimado | R$200–400/mês |

*Nota: a taxa do Mercado Pago é absorvida na margem do criador (ele recebe 90% - taxa MP). A plataforma retém 10% brutos.*

**Tendências relevantes**

- **PIX:** método dominante no Brasil; elimina fricção de pagamento digital vs. cartão de crédito
- **Creators economy BR:** 2º maior mercado mundial em volume; crescimento acelerado pós-pandemia
- **Fãs BR pagando digital:** Kwai, TikTok gifts, Super Thanks — cultura de micropagamento já estabelecida
- **LGPD:** Lei Geral de Proteção de Dados em vigor; plataforma deve documentar como trata dados de fãs (nome, pergunta, email não obrigatório)
- **Depreciação de APIs sociais:** Meta, Twitter/X e TikTok restringiram APIs de terceiros em 2024–2025 → janela para plataformas independentes

**Histórico de decisões técnicas relevantes**

- **Instagram OAuth descartado** após Meta encerrar Basic Display API (dez/2024) → Google OAuth adotado
- **Email magic link removido** para simplificar onboarding (apenas Google OAuth)
- **Webhook HMAC verificado** após hardening de segurança (março/2026)
- **Reembolso automático (36h) desabilitado** — código pronto, mas requer cron pago no Supabase; risco operacional em aberto
- **Reset diário automático não agendado** — `questions_answered_today` não reseta à meia-noite automaticamente; requer pg_cron pago

---

*Última atualização: março/2026*
