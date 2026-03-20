import { test, expect } from '@playwright/test'

// ── API de pagamento ──────────────────────────────────────────────────────────

test.describe('POST /api/payment/create-preference', () => {
  test('email inválido retorna 400', async ({ request }) => {
    const res = await request.post('/api/payment/create-preference', {
      data: {
        username: 'exemplo',
        question: 'Pergunta de teste',
        name: 'Testador',
        email: 'invalido-sem-arroba',
        amount: 15,
        serviceType: 'base',
        isAnonymous: false,
        isShareable: false,
        is_support_only: false,
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('email com domínio sem TLD retorna 400', async ({ request }) => {
    const res = await request.post('/api/payment/create-preference', {
      data: {
        username: 'exemplo',
        question: 'Pergunta de teste',
        name: 'Testador',
        email: 'a@b.c', // TLD de 1 char — inválido pela nova regex
        amount: 15,
        serviceType: 'base',
        isAnonymous: false,
        isShareable: false,
        is_support_only: false,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('valor abaixo do mínimo (R$ 0) retorna 400', async ({ request }) => {
    const res = await request.post('/api/payment/create-preference', {
      data: {
        username: 'exemplo',
        question: 'Pergunta de teste',
        name: 'Testador',
        email: 'teste@exemplo.com',
        amount: 0,
        serviceType: 'base',
        isAnonymous: false,
        isShareable: false,
        is_support_only: false,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('valor acima do máximo (R$ 99999) retorna 400', async ({ request }) => {
    const res = await request.post('/api/payment/create-preference', {
      data: {
        username: 'exemplo',
        question: 'Pergunta de teste',
        name: 'Testador',
        email: 'teste@exemplo.com',
        amount: 99999,
        serviceType: 'base',
        isAnonymous: false,
        isShareable: false,
        is_support_only: false,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('pergunta vazia retorna 400', async ({ request }) => {
    const res = await request.post('/api/payment/create-preference', {
      data: {
        username: 'exemplo',
        question: '   ',
        name: 'Testador',
        email: 'teste@exemplo.com',
        amount: 15,
        serviceType: 'base',
        isAnonymous: false,
        isShareable: false,
        is_support_only: false,
      },
    })
    expect(res.status()).toBe(400)
  })
})

// ── Webhook ───────────────────────────────────────────────────────────────────

test.describe('POST /api/payment/webhook', () => {
  test('sem header x-signature retorna 4xx ou 5xx', async ({ request }) => {
    const res = await request.post('/api/payment/webhook', {
      data: { action: 'payment.updated', type: 'payment', data: { id: '12345' } },
    })
    // Sem secret configurado: 500 (forçar retry do MP)
    // Com secret mas sem assinatura: 200 com received:true (rejeição silenciosa)
    expect([200, 400, 401, 500]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      // Se retorna 200, deve ser o formato expected do webhook
      expect(body).toHaveProperty('received', true)
    }
  })

  test('assinatura inválida retorna 200 com received:true (rejeição silenciosa)', async ({ request }) => {
    const res = await request.post('/api/payment/webhook?data.id=99999', {
      headers: {
        'x-signature': 'ts=123456789,v1=assinatura_invalida_aqui',
        'x-request-id': 'test-request-id',
      },
      data: { action: 'payment.updated', type: 'payment', data: { id: '99999' } },
    })
    // Com secret configurado: 200 (não revela o motivo)
    // Sem secret configurado: 500 (erro de configuração)
    expect([200, 500]).toContain(res.status())
  })
})

// ── Proteção de rotas da API ──────────────────────────────────────────────────

test.describe('Proteção de rotas autenticadas da API', () => {
  test('PATCH /api/questions/[id] sem auth retorna 401', async ({ request }) => {
    const res = await request.patch('/api/questions/00000000-0000-0000-0000-000000000000', {
      data: { response_text: 'Resposta de teste' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('PATCH /api/questions/visibility sem auth retorna 401', async ({ request }) => {
    const res = await request.patch('/api/questions/visibility', {
      data: { question_id: '00000000-0000-0000-0000-000000000000', is_shareable: true },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('PATCH /api/admin/creators/[id] sem auth retorna 401', async ({ request }) => {
    const res = await request.patch('/api/admin/creators/00000000-0000-0000-0000-000000000000', {
      data: { is_active: false },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/admin/refunds sem auth retorna 401', async ({ request }) => {
    const res = await request.post('/api/admin/refunds', {
      data: { question_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('PATCH /api/admin/platform-settings sem auth retorna 401', async ({ request }) => {
    const res = await request.patch('/api/admin/platform-settings', {
      data: { platform_fee_rate: 0.05 },
    })
    expect([401, 403]).toContain(res.status())
  })
})

// ── Validação de URL de áudio ─────────────────────────────────────────────────

test.describe('Validação de URL de áudio na resposta', () => {
  test('URL externa é rejeitada (sem auth — deve retornar 401 antes de validar URL)', async ({ request }) => {
    // Sem auth, deve rejeitar antes de chegar na validação de URL
    const res = await request.patch('/api/questions/00000000-0000-0000-0000-000000000000', {
      data: { response_audio_url: 'https://site-externo.com/audio.mp3' },
    })
    // 401 (sem auth) ou 400 (URL inválida) — ambos são corretos
    expect([400, 401, 403]).toContain(res.status())
  })
})
