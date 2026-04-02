# Remove cron reset-daily: computar answered_today do dado real

**Data:** 2026-04-02  
**Status:** aprovado, aguardando implementação

## Problema

O contador `questions_answered_today` em `profiles` é incrementado via RPC toda vez que um creator responde uma pergunta, e resetado à meia-noite BRT pelo cron `reset-daily`. Se o cron falhar (downtime, Render fora do ar), o contador nunca reseta — o creator fica bloqueado de receber perguntas sem nenhum alerta ou visibilidade.

## Solução

Eliminar o contador e computar o valor diretamente da tabela `questions`:

```sql
SELECT COUNT(*) FROM questions
WHERE creator_id = $1
  AND status = 'answered'
  AND answered_at >= <meia-noite-BRT-hoje>
```

O valor é sempre correto, sem estado para dessincronizar.

## Plano de execução

### Fase 1 — Banco de dados
- Adicionar índice `(creator_id, status, answered_at)` na tabela `questions`
- Migração para dropar coluna `questions_answered_today` de `profiles`
- Dropar função RPC `increment_answered_today`

### Fase 2 — Pages que leem o contador (max 5 arquivos)
Substituir leitura de `questions_answered_today` por query de count em cada página:

| Arquivo | Mudança |
|---|---|
| `frontend/src/app/perfil/[username]/page.tsx` | Adicionar query `answeredTodayCount`; reutilizar `todayStartBRT` já existente |
| `frontend/src/app/dashboard/page.tsx` | Idem |
| `frontend/src/app/admin/page.tsx` | Idem |
| `frontend/src/app/admin/influencers/page.tsx` | Idem |
| `frontend/src/app/admin/influencers/[id]/page.tsx` | Idem |

### Fase 3 — Remover infraestrutura obsoleta
- `frontend/src/app/api/questions/[id]/route.ts`: remover chamada ao RPC `increment_answered_today`
- Deletar `frontend/src/app/api/cron/reset-daily/route.ts`
- Remover o cron job `reset-daily` do Render (instrução manual)

### Fase 4 — Cleanup
- Remover `questions_answered_today` do `reset_test_data.sql`
- Verificar se `increment_answered_today` aparece em outro lugar

## Notas
- `todayStartBRT` já calculado em `perfil/[username]/page.tsx:~220` — extrair para utilitário compartilhado se repetição ficar grande
- A coluna pode ser dropada com segurança depois que todas as leituras forem migradas
- Render: desativar o cron `reset-daily` manualmente no painel após a Fase 3
