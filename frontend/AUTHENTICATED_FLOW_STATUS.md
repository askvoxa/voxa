# Status: Testes Autenticados — Fase 2.1

**Data**: 2026-03-31  
**Status**: ✅ Parcialmente Implementado (Bloqueado por Playwright ↔ Supabase Session Sync)

---

## O que Funciona ✅

### 1. Endpoint de Dev Auth (`/api/dev/test-auth`)
- ✅ Criar test users (signup com email/password)
- ✅ Fazer login
- ✅ Retorna sessão válida com tokens
- ✅ Cria perfil no banco de dados automaticamente
- ✅ Apenas disponível em desenvolvimento (bloqueado em production)

**Exemplo de uso**:
```bash
curl -X POST http://localhost:3000/api/dev/test-auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "email": "test@example.com",
    "password": "Test123!",
    "accountType": "fan"
  }'
```

### 2. Test User Creation in Playwright
- ✅ Cria users fan e influencer programaticamente
- ✅ Credentials válidos para login
- ✅ Retorna credenciais para próximas execuções

**Users criados na última execução**:
- Fan: `test_fan_1774987242786@voxa.test`
- Creator: `test_influencer_1774987243605@voxa.test`

### 3. Auth Guard Validation
- ✅ `/dashboard` redireciona para `/login` quando não autenticado
- ✅ Todas as rotas de criador protegidas (`/dashboard/history`, `/dashboard/payouts`, etc.)
- ✅ Auth guard está funcionando corretamente

---

## O que Não Funciona ⚠️

### Sessão não é Restaurada no Playwright

**Problema**: Após fazer login e salvar a sessão no localStorage, o dashboard redireciona para login novamente.

**Causa**: Supabase JS client não está lendo a sessão do localStorage salva pelo Playwright. O cliente precisa:
1. Inicializar COM a sessão (via `setSession()`)
2. Ou ter acesso a cookies HTTP-only (que Playwright não consegue mockar)

**Solução Necessária**: 
- Usar `@supabase/supabase-js` com `setSession()` após login
- OU implementar autenticação com cookies em vez de localStorage
- OU usar Supabase Gotrue Cookie-based Auth

---

## Arquivos Criados

1. **`/api/dev/test-auth`** — Endpoint para criar/logar test users (DEV ONLY)
2. **`test_authenticated_flow.mjs`** — Suite de testes com:
   - Criação de 2 test users (fan + creator)
   - Login de ambos
   - Tentativa de acessar dashboard (falha em session restore)
   - Documentação de status

---

## Próximos Passos

### Curto Prazo (Próximo Sprint)
1. **Usar Supabase Session API**:
   ```ts
   // Após login bem-sucedido:
   const { data, error } = await supabase.auth.setSession(session)
   ```

2. **Ou implementar Auth via Cookies**:
   - Configurar `sameSite: 'lax'` no Supabase client
   - Confiar em HTTP-only cookies que Playwright pode usar

3. **Ou criar endpoint alternativo `/api/dev/auth-bypass`**:
   - Que seta um cookie de autenticação direto

### Resultado Esperado
Após fix: 100% das rotas de dashboard acessíveis com test users, permitindo testes de:
- Dashboard do fã (gastos, histórico)
- Dashboard do criador (respostas, payouts)
- Configurações de perfil
- Responder perguntas

---

## Test Script Execution

```bash
cd frontend
node test_authenticated_flow.mjs
```

**Saída esperada**:
- 7-9 PASS (test user creation, login, auth guard)
- 6 WARN (CSS selector issues, session restore failure)
- 0 FAIL

**Screenshots**:
- `/tmp/voxa_screenshots_auth/01_dashboard_fan_home.png`
- `/tmp/voxa_screenshots_auth/02_dashboard_creator_home.png`

---

## Observações Técnicas

### Por que localStorage não funciona
- Supabase JS client (`createClient()`) não **restaura** sessão do localStorage automaticamente
- O cliente checa `window.location` e inicializa, mas não re-lê localStorage após mudanças via Playwright
- `localStorage.setItem()` feito pelo Playwright não dispara eventos que o Supabase monitora

### Solução Recomendada
Usar `supabase.auth.setSession()` que é a API correta para restaurar uma sessão:
```ts
const { data, error } = await supabase.auth.setSession({
  access_token: token,
  refresh_token: refresh,
})
```

Isso requer que o token/refresh sejam passados para a página via `page.evaluate()` ANTES de navegar para dashboard.
