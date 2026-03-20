import { test, expect } from '@playwright/test'

// ── Landing & Marketing ──────────────────────────────────────────────────────

test.describe('Landing page', () => {
  test('carrega sem erros', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/VOXA/i)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('link para /login visível', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.getByRole('link', { name: /entrar|login/i }).first()
    await expect(loginLink).toBeVisible()
  })

  test('link para /vender visível', async ({ page }) => {
    await page.goto('/')
    const venderLink = page.getByRole('link', { name: /criador|vender|ganhar/i }).first()
    await expect(venderLink).toBeVisible()
  })
})

test.describe('Página de marketing (/vender)', () => {
  test('carrega sem erros', async ({ page }) => {
    await page.goto('/vender')
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })
})

// ── Auth ─────────────────────────────────────────────────────────────────────

test.describe('Proteção de rotas autenticadas', () => {
  test('/dashboard redireciona para login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/dashboard/settings redireciona para login', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/dashboard/history redireciona para login', async ({ page }) => {
    await page.goto('/dashboard/history')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/admin redireciona para login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ── Perfil público ───────────────────────────────────────────────────────────

test.describe('Perfil público /perfil/exemplo', () => {
  test('carrega sem erros', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  // Nota: /perfil/exemplo é um perfil de demonstração hardcoded com disabled=true
  // O formulário sempre mostra o estado desabilitado (nunca aceita perguntas)
  test('exibe formulário desabilitado (demo sempre tem disabled=true)', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    await expect(page.getByText(/atingiu o limite de perguntas de hoje/i)).toBeVisible()
  })

  // Nota: Os banners de payment_status só aparecem em perfis REAIS (não no demo)
  // Testar em perfil real requer conhecer um username válido no banco de dados

  test('feed de respostas públicas do demo é exibido', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    // O demo tem respostas hardcoded — deve haver pelo menos uma
    await expect(page.getByText(/respondeu:/i).first()).toBeVisible()
  })

  test('aviso de redirect para Mercado Pago visível (quando formulário habilitado)', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    // Pular se formulário desabilitado (sempre no demo, ou limite diário em perfis reais)
    const isDisabled = await page.getByText(/atingiu o limite de perguntas de hoje/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (isDisabled) { test.skip(); return }
    await expect(page.getByText(/mercado pago/i)).toBeVisible()
  })
})

// ── Validação do formulário (requer form habilitado) ──────────────────────────

test.describe('Validação do QuestionForm', () => {
  test('email inválido bloqueia envio', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    const isDisabled = await page.getByText(/atingiu o limite/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (isDisabled) { test.skip(); return }

    await page.locator('textarea').first().fill('Minha pergunta de teste aqui')
    await page.locator('input[type="email"]').fill('email-invalido-sem-arroba')
    await page.getByRole('button', { name: /pagar/i }).click()
    await expect(page).toHaveURL(/\/perfil\/exemplo/)
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('pergunta vazia bloqueia envio no modo pergunta', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    const isDisabled = await page.getByText(/atingiu o limite/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (isDisabled) { test.skip(); return }

    await page.locator('input[type="email"]').fill('teste@exemplo.com')
    await page.getByRole('button', { name: /pagar/i }).click()
    await expect(page).toHaveURL(/\/perfil\/exemplo/)
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('toggle de anonimato funciona', async ({ page }) => {
    await page.goto('/perfil/exemplo')
    const isDisabled = await page.getByText(/atingiu o limite/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (isDisabled) { test.skip(); return }

    const toggle = page.getByRole('button', { name: /enviar com meu nome|enviando como anônimo/i })
    const antes = await toggle.innerText()
    await toggle.click()
    const depois = await toggle.innerText()
    expect(antes).not.toEqual(depois)
  })
})
