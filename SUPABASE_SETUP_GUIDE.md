# Guia de Setup — Sistema de Payouts no Supabase

**Data**: 2026-03-31  
**Status**: Migration pronta, precisa executar manualmente  
**Tempo estimado**: 5-10 minutos

---

## 📋 Checklist Rápido

- [ ] Abrir Supabase Dashboard
- [ ] Ir para SQL Editor
- [ ] Executar script de validação (`validation_payout_system.sql`)
- [ ] Se algum check falhar, executar migration (`2026-03-26_payout_system.sql`)
- [ ] Verificar variáveis de ambiente
- [ ] Testar criação de test user

---

## 🚀 Passo-a-Passo

### **Passo 1: Verificar Status Atual**

1. Abra [Supabase Dashboard](https://app.supabase.com)
2. Vá para **SQL Editor**
3. Clique em **New Query**
4. Copie TODO o conteúdo de:
   ```
   database/validation_payout_system.sql
   ```
5. Execute (Ctrl+Enter ou botão "Run")

**O que procurar**:
- Todos os checks devem mostrar ✅ ou "OK"
- Resultado final deve ser "7 de 7 checks passaram"

---

### **Passo 2a: Se Todos os Checks Passarem ✅**

Parabéns! A migration já foi executada. Pule para o **Passo 3**.

---

### **Passo 2b: Se Algum Check Falhar ❌**

Você precisa executar a migration:

1. Abra novo SQL Query
2. Copie TODO o conteúdo de:
   ```
   database/migrations/2026-03-26_payout_system.sql
   ```

3. **IMPORTANTE**: Antes de executar, encontre esta linha:
   ```sql
   -- 4. Chaves PIX dos criadores...
   CREATE TABLE IF NOT EXISTS creator_pix_keys (
       ...
       encryption_key = 'SUA_PIX_ENCRYPTION_KEY_AQUI'
   ```

4. Substitua `'SUA_PIX_ENCRYPTION_KEY_AQUI'` pelo valor real:
   - Verifique no seu `.env.local`:
     ```
     ENCRYPTION_KEY=seu_valor_aqui
     ```
   - Ou use um valor temporário para teste:
     ```sql
     encryption_key = 'dev-test-key-12345'
     ```

5. Execute a query completa (pode demorar 30-60 segundos)

6. Se vir mensagens de erro:
   - `duplicate_object` = Normal (tabelas já existem)
   - `syntax error` = Verificar substituição da chave
   - Outro erro = Procurar no final da migration por `ROLLBACK`

---

### **Passo 3: Verificar Novamente**

1. Execute o script de validação novamente (`validation_payout_system.sql`)
2. Deve mostrar "7 de 7 checks passaram"

---

### **Passo 4: Verificar Variáveis de Ambiente**

No seu projeto, verifique se tem:

**`.env.local` ou `.env`**:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ENCRYPTION_KEY=your-encryption-key-here
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx
```

**No Supabase Dashboard** → Settings → Environment Variables:
```
SUPABASE_ENCRYPTION_KEY=your-encryption-key-here
```

---

### **Passo 5: Testar Criação de Test User**

Execute este SQL para verificar que tudo funciona:

```sql
-- Criar um test user
INSERT INTO auth.users (
  id, email, phone, encrypted_password, 
  email_confirmed_at, email_change_confirmed_at,
  created_at, updated_at, last_sign_in_at
) VALUES (
  gen_random_uuid(),
  'test_payouts_' || NOW()::text || '@voxa.test',
  NULL,
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  NOW(),
  NOW()
);

-- Criar perfil associado
INSERT INTO profiles (
  id, username, account_type, is_active
) SELECT
  id, 'test_payout_user_' || RIGHT(id::text, 8), 'influencer', true
FROM auth.users
WHERE email LIKE 'test_payouts_%'
ORDER BY created_at DESC
LIMIT 1;

-- Verificar se funcionou
SELECT 'Verificação' as "Status",
  u.email as "Email",
  p.username as "Username",
  p.account_type as "Tipo",
  COALESCE(p.available_balance, 0) as "Saldo Inicial"
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email LIKE 'test_payouts_%'
ORDER BY u.created_at DESC
LIMIT 1;
```

**Resultado esperado**:
```
✅ Email criado
✅ Perfil criado
✅ Saldo inicial = 0.00
✅ Tipo = influencer
```

---

## 🔧 Se Algo Der Errado

### Erro: "permission denied for schema public"
- **Causa**: Service role sem permissões
- **Solução**: Abrir as RLS policies em "Policies" → escolher public
- **Ou**: Usar Dashboard direto em vez de SQL para criar usuários

### Erro: "duplicate_object"
- **Causa**: Tabelas já existem
- **Solução**: Tudo certo! Pular para Passo 3
- **Verificar**: Se a coluna/função foi realmente criada rodando validação

### Erro: "undefined column"
- **Causa**: Coluna não foi adicionada
- **Solução**: Executar novamente o bloco ALTER TABLE da migration

### Erro ao executar `/api/dev/test-auth`
- **Causa**: `SUPABASE_SERVICE_ROLE_KEY` inválido ou `SUPABASE_ENCRYPTION_KEY` ausente
- **Solução**: 
  1. Verificar `.env.local` está correto
  2. Restart do dev server (`npm run dev`)
  3. Testar criar user via SQL primeiro

---

## ✅ Validação Final

Quando tudo estiver pronto, deve funcionar:

```bash
# Terminal - criar test user via API
curl -X POST http://localhost:3000/api/dev/test-auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "email": "test@voxa.test",
    "password": "Test123!",
    "accountType": "fan"
  }'

# Resposta esperada:
{
  "success": true,
  "user": {
    "id": "uuid-aqui",
    "email": "test@voxa.test"
  },
  "message": "Test user criado com sucesso"
}
```

---

## 📚 Arquivos Relevantes

```
database/
├── migrations/
│   └── 2026-03-26_payout_system.sql      ← Migration principal
├── schemas/
│   └── 03_functions.sql                   ← Funções RPC
└── validation_payout_system.sql           ← Script de validação (este guia)
```

---

## 🎯 Conclusão

Após completar estes passos:

✅ Sistema de payouts estará ativo  
✅ Test users podem ser criados via API  
✅ Dashboard autenticado funcionará  
✅ Pronto para testes de payment flow

**Próximo passo**: Executar `test_authenticated_flow.mjs` para validar auth completa.

---

## 💬 Dúvidas?

Se tiver erro:
1. Rode o script de validação (`validation_payout_system.sql`)
2. Copie os resultados
3. Compare com a seção "Se Algo Der Errado" acima

**Tempo total**: ~10 minutos se tudo estiver ok  
**Sem downtime**: Sim, tudo é feito via SQL direto
