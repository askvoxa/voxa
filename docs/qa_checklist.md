# Roteiro de QA — VOXA
**Versão:** 1.0 · **Atualizado:** 2026-03-31

---

## Como usar este documento

Cada item de teste tem o seguinte formato:

```
- [ ] Ação a executar → **Resultado esperado**
      Status: ✅ OK | ❌ Falha | ⚠️ Parcial
      Observação: _______________
```

Ao identificar uma falha, preencha o **Registro de Falhas** no final do documento com:
- ID do item (ex: `J1-03`)
- Descrição do comportamento observado
- Severidade: 🔴 Crítico | 🟠 Alto | 🟡 Médio | 🟢 Baixo
- Print / URL / passo a passo para reproduzir

---

## Pré-requisitos

- Conta de fã criada e ativa
- Conta de criador aprovada e com perfil completo
- Conta de admin disponível
- Mercado Pago em modo sandbox
- App rodando em ambiente de staging/local com banco populado

---

## J1 — Visitante / Páginas Públicas

> Sem nenhuma conta logada.

### Landing Page (`/`)

- [ ] **J1-01** Acessar `/` → Página carrega sem erros, título "VOXA" aparece
      Status: ___ Observação: ___
- [ ] **J1-02** Verificar link de login visível na página → Botão/link "Entrar" ou "Login" está clicável
      Status: ___ Observação: ___
- [ ] **J1-03** Verificar CTA de criador visível → Botão "Sou criador" ou equivalente está presente
      Status: ___ Observação: ___
- [ ] **J1-04** Acessar em mobile (viewport 375px) → Layout responsivo, sem overflow horizontal, botões com altura mínima de 44px
      Status: ___ Observação: ___

### Página Criador (`/sou-criador`)

- [ ] **J1-05** Acessar `/sou-criador` → Página carrega sem erros, conteúdo visível
      Status: ___ Observação: ___
- [ ] **J1-06** Verificar em mobile → Layout correto, sem elementos cortados
      Status: ___ Observação: ___

### Waitlist (`/waitlist`)

- [ ] **J1-07** Acessar `/waitlist` → Formulário de cadastro exibido
      Status: ___ Observação: ___
- [ ] **J1-08** Enviar formulário com dados válidos → Mensagem de confirmação exibida, sem redirecionamento com erro
      Status: ___ Observação: ___
- [ ] **J1-09** Enviar formulário com email inválido → Validação bloqueia envio e exibe erro
      Status: ___ Observação: ___
- [ ] **J1-10** Enviar o mesmo email duas vezes seguidas → Sistema trata duplicata sem crash
      Status: ___ Observação: ___

### Perfil Público (`/perfil/[username]`)

- [ ] **J1-11** Acessar `/perfil/exemplo` → Página carrega com nome, bio e feed de respostas do demo
      Status: ___ Observação: ___
- [ ] **J1-12** Verificar exibição de badges (Verificado, Founder) → Badges aparecem corretamente quando aplicável
      Status: ___ Observação: ___
- [ ] **J1-13** Verificar analytics do perfil (total respondido, streak) → Números exibidos corretamente
      Status: ___ Observação: ___
- [ ] **J1-14** Verificar seção Top Supporters → Lista de apoiadores exibida ou estado vazio adequado
      Status: ___ Observação: ___
- [ ] **J1-15** Acessar `/perfil/username-que-nao-existe` → Página 404 exibida, não crash
      Status: ___ Observação: ___
- [ ] **J1-16** Verificar feed de respostas públicas → Ao menos uma resposta visível no demo, conteúdo legível
      Status: ___ Observação: ___
- [ ] **J1-17** Acessar em mobile → Formulário de pergunta usável, campos com tamanho adequado para toque
      Status: ___ Observação: ___

---

## J2 — Autenticação

### Login

- [ ] **J2-01** Acessar `/login` → Página carrega com botão "Entrar com Google"
      Status: ___ Observação: ___
- [ ] **J2-02** Clicar em "Entrar com Google" → Redireciona para OAuth do Google sem erro
      Status: ___ Observação: ___
- [ ] **J2-03** Completar login com conta Google válida → Redireciona para `/dashboard` após autenticação
      Status: ___ Observação: ___
- [ ] **J2-04** Acessar `/dashboard` sem estar logado → Redireciona para `/login`
      Status: ___ Observação: ___
- [ ] **J2-05** Acessar `/dashboard/settings` sem estar logado → Redireciona para `/login`
      Status: ___ Observação: ___
- [ ] **J2-06** Acessar `/admin` sem estar logado → Redireciona para `/login`
      Status: ___ Observação: ___
- [ ] **J2-07** Fazer logout → Sessão encerrada, redirecionamento para `/login` ou `/`
      Status: ___ Observação: ___
- [ ] **J2-08** Acessar `/perfil/[username]` estando logado e clicar em uma pergunta sugerida → Formulário preenchido automaticamente
      Status: ___ Observação: ___

### Convite (`/invite/[code]`)

- [ ] **J2-09** Acessar link de convite válido logado como fã → Fluxo de upgrade para criador iniciado
      Status: ___ Observação: ___
- [ ] **J2-10** Acessar link de convite expirado ou inválido → Mensagem de erro clara, sem crash
      Status: ___ Observação: ___

---

## J3 — Jornada do Fã

> Logado com conta do tipo `fan`.

### Dashboard Modo Fã

- [ ] **J3-01** Acessar `/dashboard` → Cards de métricas exibidos: "Enviadas", "Aguardando resposta", "Total gasto"
      Status: ___ Observação: ___
- [ ] **J3-02** Verificar lista de perguntas enviadas → Lista exibida ou estado vazio com mensagem adequada
      Status: ___ Observação: ___
- [ ] **J3-03** Verificar que o toggle de modo criador NÃO aparece → Fã não tem acesso ao modo criador
      Status: ___ Observação: ___
- [ ] **J3-04** Verificar CTA "Quero ser criador" no dashboard → Botão/card visível levando para `/setup/creator`
      Status: ___ Observação: ___

### Envio de Pergunta (Fluxo de Pagamento)

- [ ] **J3-05** Acessar perfil de criador ativo e preencher pergunta válida com email → Botão "Pagar" ativo
      Status: ___ Observação: ___
- [ ] **J3-06** Tentar enviar pergunta com campo de texto vazio → Validação bloqueia, mensagem de erro exibida
      Status: ___ Observação: ___
- [ ] **J3-07** Tentar enviar com email inválido (sem @) → Validação bloqueia, mensagem de erro exibida
      Status: ___ Observação: ___
- [ ] **J3-08** Tentar enviar com email de domínio inválido (ex: `a@b.c`) → Validação bloqueia
      Status: ___ Observação: ___
- [ ] **J3-09** Clicar em pergunta sugerida (Fast Ask) → Campos de texto e valor preenchidos automaticamente
      Status: ___ Observação: ___
- [ ] **J3-10** Ativar toggle "Anônimo" → Label muda para "Enviando como anônimo"
      Status: ___ Observação: ___
- [ ] **J3-11** Desativar toggle "Anônimo" → Label volta para "Enviar com meu nome"
      Status: ___ Observação: ___
- [ ] **J3-12** Clicar em "Pagar" com dados válidos → Redireciona para Checkout do Mercado Pago sem erro
      Status: ___ Observação: ___
- [ ] **J3-13** Completar pagamento no sandbox do MP → Retorna para a plataforma, pergunta aparece no histórico como "Pendente"
      Status: ___ Observação: ___
- [ ] **J3-14** Verificar email de confirmação recebido após pagamento → Email de confirmação chega com detalhes da pergunta
      Status: ___ Observação: ___

### Histórico e Acompanhamento

- [ ] **J3-15** Acessar `/dashboard/history` → Lista de perguntas enviadas com status correto para cada uma
      Status: ___ Observação: ___
- [ ] **J3-16** Verificar pergunta com status "Respondida" → Resposta em texto visível; player de áudio aparece se houver resposta em áudio
      Status: ___ Observação: ___
- [ ] **J3-17** Verificar pergunta com status "Expirada" → Badge "Expirada (reembolso)" exibido
      Status: ___ Observação: ___
- [ ] **J3-18** Acessar `/dashboard/spending` → Histórico de gastos exibido com totais corretos
      Status: ___ Observação: ___

### Configurações do Fã

- [ ] **J3-19** Acessar `/dashboard/settings` → Campos de bio, nome e avatar carregados com dados atuais
      Status: ___ Observação: ___
- [ ] **J3-20** Alterar bio e salvar → Sucesso confirmado, dados persistidos ao recarregar
      Status: ___ Observação: ___
- [ ] **J3-21** Fazer upload de avatar → Cropper exibido, imagem salva e avatar atualizado na interface
      Status: ___ Observação: ___

### Aplicação para Criador

- [ ] **J3-22** Acessar `/setup/creator` → Formulário de candidatura exibido (nicho, bio, link social)
      Status: ___ Observação: ___
- [ ] **J3-23** Submeter candidatura com dados válidos e aceite dos termos → Banner "Perfil em análise" aparece no dashboard
      Status: ___ Observação: ___
- [ ] **J3-24** Submeter candidatura sem aceitar os termos → Validação bloqueia, mensagem clara
      Status: ___ Observação: ___

---

## J4 — Jornada do Criador

> Logado com conta do tipo `influencer`, perfil aprovado e completo.

### Dashboard Modo Criador

- [ ] **J4-01** Toggle de modo (Fã ↔ Criador) visível no header → Alternância funciona sem reload
      Status: ___ Observação: ___
- [ ] **J4-02** Ativar modo criador → Cards exibidos: "Pendentes", "A receber", "Vagas hoje"
      Status: ___ Observação: ___
- [ ] **J4-03** Verificar progresso de milestones → Barra de progresso exibida com meta e valor atual corretos
      Status: ___ Observação: ___
- [ ] **J4-04** Verificar lista de perguntas pendentes → Perguntas listadas com nome do remetente, conteúdo, valor e tempo restante
      Status: ___ Observação: ___

### Responder e Rejeitar Perguntas

- [ ] **J4-05** Abrir uma pergunta pendente → Modal/expandir exibe conteúdo completo e ações disponíveis
      Status: ___ Observação: ___
- [ ] **J4-06** Responder pergunta com texto → Resposta salva, status muda para "Respondida", pergunta sai da lista pendente
      Status: ___ Observação: ___
- [ ] **J4-07** Verificar email enviado ao fã após resposta → Fã recebe notificação com a resposta
      Status: ___ Observação: ___
- [ ] **J4-08** Responder com áudio (URL do Supabase Storage) → Player aparece na pergunta respondida no perfil público
      Status: ___ Observação: ___
- [ ] **J4-09** Tentar responder com URL de áudio externa (não Supabase) → Sistema rejeita com mensagem de erro
      Status: ___ Observação: ___
- [ ] **J4-10** Rejeitar uma pergunta → Status muda para "Recusada", fã vê badge correspondente no histórico
      Status: ___ Observação: ___
- [ ] **J4-11** Reportar uma pergunta ofensiva → Status muda para "Em análise", pergunta vai para fila de admin
      Status: ___ Observação: ___
- [ ] **J4-12** Ativar/desativar visibilidade pública de uma resposta → Toggle funciona, pergunta aparece/some do perfil público
      Status: ___ Observação: ___

### Histórico do Criador

- [ ] **J4-13** Acessar `/dashboard/history` → Lista completa de perguntas (pendentes, respondidas, expiradas) com filtros
      Status: ___ Observação: ___

### Configurações do Criador

- [ ] **J4-14** Acessar `/dashboard/settings` → Todos os campos carregados: bio, preço mínimo, limite diário, avatar, Fast Ask
      Status: ___ Observação: ___
- [ ] **J4-15** Alterar preço mínimo para valor válido (≥ R$ 1,00) e salvar → Salvo com sucesso, novo valor refletido no perfil público
      Status: ___ Observação: ___
- [ ] **J4-16** Alterar limite diário e salvar → Salvo com sucesso, card "Vagas hoje" atualizado no dashboard
      Status: ___ Observação: ___
- [ ] **J4-17** Ativar pausa programada → Banner de pausa visível no dashboard, formulário de pergunta desabilitado no perfil público
      Status: ___ Observação: ___
- [ ] **J4-18** Desativar pausa → Perfil volta a aceitar perguntas normalmente
      Status: ___ Observação: ___
- [ ] **J4-19** Editar sugestões de Fast Ask (label, texto, valor) e salvar → Novas sugestões aparecem no perfil público
      Status: ___ Observação: ___

### Verificação de Identidade

- [ ] **J4-20** Acessar `/dashboard/verification` → Formulário de verificação exibido (link social + upload de documento)
      Status: ___ Observação: ___
- [ ] **J4-21** Submeter solicitação de verificação com documento → Solicitação enviada, status "Pendente" exibido
      Status: ___ Observação: ___
- [ ] **J4-22** Tentar submeter segunda solicitação enquanto há uma pendente → Sistema bloqueia ou exibe status atual
      Status: ___ Observação: ___

### Payouts (Saques PIX)

- [ ] **J4-23** Acessar `/dashboard/payouts` → Saldo disponível, pendente de liberação e total sacado exibidos corretamente
      Status: ___ Observação: ___
- [ ] **J4-24** Cadastrar chave PIX (CPF) com formato válido → Chave salva, valor mascarado exibido (ex: `***.123.456-**`)
      Status: ___ Observação: ___
- [ ] **J4-25** Cadastrar chave PIX com CPF inválido (menos de 11 dígitos) → Validação bloqueia, mensagem de erro
      Status: ___ Observação: ___
- [ ] **J4-26** Cadastrar chave PIX (CNPJ) com formato válido → Chave salva, valor mascarado exibido
      Status: ___ Observação: ___
- [ ] **J4-27** Atualizar chave PIX → Chave anterior desativada, nova chave ativa exibida
      Status: ___ Observação: ___
- [ ] **J4-28** Tentar solicitar saque sem chave PIX cadastrada → Mensagem "Cadastre uma chave PIX primeiro"
      Status: ___ Observação: ___
- [ ] **J4-29** Tentar solicitar saque com saldo abaixo do mínimo (R$ 50,00) → Mensagem de saldo insuficiente exibida
      Status: ___ Observação: ___
- [ ] **J4-30** Solicitar saque com saldo suficiente e chave PIX ativa → Saque criado com status "Pendente", saldo decrementado imediatamente
      Status: ___ Observação: ___
- [ ] **J4-31** Tentar solicitar segundo saque com saque pendente em aberto → Sistema bloqueia com mensagem "Já existe saque pendente"
      Status: ___ Observação: ___
- [ ] **J4-32** Verificar histórico de saques → Lista com status, valor e data de cada solicitação
      Status: ___ Observação: ___

### Referral

- [ ] **J4-33** Acessar `/dashboard/referral` → Link de referral exibido para copiar
      Status: ___ Observação: ___

---

## J5 — Jornada do Administrador

> Logado com conta `admin`.

### Painel Principal (`/admin`)

- [ ] **J5-01** Acessar `/admin` → Métricas gerais carregadas: transações aprovadas, reembolsadas, perguntas pendentes/respondidas/expiradas, usuários
      Status: ___ Observação: ___
- [ ] **J5-02** Verificar lista de criadores ativos com contadores → Lista exibida com username, status e perguntas do dia
      Status: ___ Observação: ___
- [ ] **J5-03** Verificar navegação do admin (sidebar/bottom nav) → Todos os links de seção funcionam
      Status: ___ Observação: ___

### Aprovações de Criadores (`/admin/approvals`)

- [ ] **J5-04** Acessar `/admin/approvals` → Lista de candidaturas pendentes carregada
      Status: ___ Observação: ___
- [ ] **J5-05** Aprovar uma candidatura → Status muda para "Aprovado", criador recebe notificação por email, conta promovida para `influencer`
      Status: ___ Observação: ___
- [ ] **J5-06** Rejeitar uma candidatura com motivo → Status muda para "Rejeitado", motivo registrado, criador vê mensagem de rejeição no dashboard
      Status: ___ Observação: ___

### Gerenciamento de Usuários (`/admin/users`)

- [ ] **J5-07** Acessar `/admin/users` → Lista de todos os usuários com tipo de conta e status
      Status: ___ Observação: ___
- [ ] **J5-08** Promover fã para influencer → Conta promovida, tipo atualizado na listagem
      Status: ___ Observação: ___
- [ ] **J5-09** Rebaixar influencer para fã → Conta rebaixada, tipo atualizado na listagem
      Status: ___ Observação: ___

### Criadores Individuais (`/admin/influencers/[id]`)

- [ ] **J5-10** Acessar perfil de um criador no admin → Detalhes completos exibidos (stats, status, configurações)
      Status: ___ Observação: ___
- [ ] **J5-11** Banir um criador → `is_active = false`, criador não aparece nas buscas, perfil público inacessível
      Status: ___ Observação: ___
- [ ] **J5-12** Desbanir um criador → Conta restaurada, perfil acessível novamente
      Status: ___ Observação: ___
- [ ] **J5-13** Verificar um criador (badge verificado) → Badge aparece no perfil público
      Status: ___ Observação: ___
- [ ] **J5-14** Remover verificação → Badge removido do perfil público
      Status: ___ Observação: ___
- [ ] **J5-15** Editar parâmetros customizados (taxa, prazo) → Valores salvos e aplicados nas próximas transações
      Status: ___ Observação: ___
- [ ] **J5-16** Bloquear saques de um criador → Criador não consegue solicitar saque (`payouts_blocked = true`)
      Status: ___ Observação: ___
- [ ] **J5-17** Emitir reembolso manual para uma pergunta → Reembolso processado via MP, status da pergunta atualizado
      Status: ___ Observação: ___

### Relatórios de Perguntas (`/admin/reports`)

- [ ] **J5-18** Acessar `/admin/reports` → Lista de perguntas reportadas com status "Pendente"
      Status: ___ Observação: ___
- [ ] **J5-19** Aprovar um relatório (pergunta ofensiva confirmada) → Pergunta marcada como removida/inativa
      Status: ___ Observação: ___
- [ ] **J5-20** Dispensar um relatório → Status muda para "Dispensado", pergunta volta ao estado normal
      Status: ___ Observação: ___

### Verificações de Identidade (`/admin/verifications`)

- [ ] **J5-21** Acessar `/admin/verifications` → Lista de solicitações de verificação pendentes
      Status: ___ Observação: ___
- [ ] **J5-22** Aprovar uma solicitação → Badge verificado ativado no perfil, criador recebe notificação
      Status: ___ Observação: ___
- [ ] **J5-23** Rejeitar uma solicitação com motivo → Badge não concedido, criador vê motivo da rejeição
      Status: ___ Observação: ___

### Payouts Admin (`/admin/payouts`)

- [ ] **J5-24** Acessar `/admin/payouts` → Métricas da semana (total pago, pendente, falhas) e lista de saques
      Status: ___ Observação: ___
- [ ] **J5-25** Retentar um saque com falha → Saque reprocessado, status atualizado
      Status: ___ Observação: ___
- [ ] **J5-26** Pausar todos os saques globalmente → Botão "Pausar Payouts" funciona, criadores não conseguem solicitar saque
      Status: ___ Observação: ___
- [ ] **J5-27** Retomar saques globais → Botão "Retomar" funciona, saques voltam a ser possíveis
      Status: ___ Observação: ___
- [ ] **J5-28** Alterar valor mínimo de saque → Novo valor aplicado imediatamente nas validações
      Status: ___ Observação: ___

### Configurações da Plataforma (`/admin/settings`)

- [ ] **J5-29** Acessar `/admin/settings` → Taxa da plataforma e prazo de resposta exibidos com valores atuais
      Status: ___ Observação: ___
- [ ] **J5-30** Alterar taxa da plataforma → Valor salvo e refletido nos cálculos de novas transações
      Status: ___ Observação: ___
- [ ] **J5-31** Alterar prazo de resposta padrão → Novo prazo aplicado nas próximas perguntas criadas
      Status: ___ Observação: ___

### Invites (`/admin/invites`)

- [ ] **J5-32** Acessar `/admin/invites` → Lista de convites criados com status (usado/disponível)
      Status: ___ Observação: ___
- [ ] **J5-33** Criar novo convite → Link gerado e listado com data de expiração
      Status: ___ Observação: ___

---

## J6 — Segurança e Limites

> Testes de acesso indevido e comportamento de borda.

### Controle de Acesso

- [ ] **J6-01** Fã tenta acessar `/admin` → Redirecionado, nunca exibe o painel admin
      Status: ___ Observação: ___
- [ ] **J6-02** Criador tenta acessar `/admin` → Redirecionado, nunca exibe o painel admin
      Status: ___ Observação: ___
- [ ] **J6-03** Fã tenta acessar `/dashboard/payouts` → Redireciona ou exibe mensagem de acesso restrito
      Status: ___ Observação: ___
- [ ] **J6-04** Chamada direta `PATCH /api/admin/influencers/[id]` sem autenticação → Retorna 401 ou 403
      Status: ___ Observação: ___
- [ ] **J6-05** Chamada direta `POST /api/admin/refunds` sem autenticação → Retorna 401 ou 403
      Status: ___ Observação: ___
- [ ] **J6-06** Chamada direta `PATCH /api/admin/platform-settings` sem autenticação → Retorna 401 ou 403
      Status: ___ Observação: ___
- [ ] **J6-07** Chamada direta `POST /api/payment/webhook` sem header `x-signature` → Retorna erro (não processa)
      Status: ___ Observação: ___
- [ ] **J6-08** Chamada direta `POST /api/payment/webhook` com assinatura inválida → Retorna 200 silencioso (não revela motivo) sem processar transação
      Status: ___ Observação: ___

### Limites de Negócio

- [ ] **J6-09** Tentar enviar pergunta para criador com limite diário atingido → Formulário desabilitado com mensagem "Atingiu o limite de perguntas de hoje"
      Status: ___ Observação: ___
- [ ] **J6-10** Tentar enviar pergunta para criador pausado → Formulário desabilitado com mensagem de pausa
      Status: ___ Observação: ___
- [ ] **J6-11** Tentar enviar pergunta para criador banido (is_active = false) → Perfil retorna 404 ou inacessível
      Status: ___ Observação: ___
- [ ] **J6-12** Criar pergunta com valor abaixo do mínimo do criador via API → Retorna 400 com mensagem de valor inválido
      Status: ___ Observação: ___
- [ ] **J6-13** Enviar report na mesma pergunta duas vezes rapidamente (rate limit) → Segunda tentativa bloqueada
      Status: ___ Observação: ___

### Mobile

- [ ] **J6-14** Testar toda a jornada do fã em viewport mobile (375px) → Nenhum elemento cortado, formulários usáveis com toque
      Status: ___ Observação: ___
- [ ] **J6-15** Testar dashboard do criador em mobile → Bottom nav funcional, cards legíveis, lista de perguntas usável
      Status: ___ Observação: ___
- [ ] **J6-16** Testar painel admin em mobile → Navegação inferior funcional, tabelas com scroll horizontal quando necessário
      Status: ___ Observação: ___

---

## Registro de Falhas

> Preencher para cada ❌ ou ⚠️ identificado acima.

| # | ID do Teste | Severidade | Comportamento Observado | Passo a Passo para Reproduzir | Responsável | Status da Correção |
|---|-------------|------------|------------------------|-------------------------------|-------------|--------------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

**Severidade:**
- 🔴 Crítico — Bloqueia fluxo principal (pagamento, login, resposta de pergunta)
- 🟠 Alto — Funcionalidade importante quebrada mas há contorno
- 🟡 Médio — Bug visível mas não impede uso
- 🟢 Baixo — Problema estético ou de UX menor

---

## Resumo da Sessão de Testes

```
Data: ___/___/______
Testador: _______________
Ambiente: _______________
Versão/Commit: _______________

Total de testes executados: ___ / 100
✅ Passou:   ___
❌ Falhou:   ___
⚠️ Parcial: ___
⏭️ Pulado:  ___

Falhas críticas (🔴): ___
Falhas altas (🟠):    ___
Falhas médias (🟡):   ___
Falhas baixas (🟢):   ___
```
