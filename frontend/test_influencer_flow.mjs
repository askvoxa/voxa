/**
 * Teste de fluxo de influenciador/criador no VOXA
 * Nota: Testes de dashboard autenticado requerem session mocking avançado.
 * Este teste cobre: página de setup, acesso público a recursos de criador, etc.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = '/tmp/voxa_screenshots_influencer';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let screenshotIndex = 0;
const results = [];

async function screenshot(page, name) {
  const file = `${SCREENSHOTS_DIR}/${String(++screenshotIndex).padStart(2,'0')}_${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}`);
  return file;
}

function log(status, test, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ ';
  const msg = `${icon} ${test}${detail ? ': ' + detail : ''}`;
  console.log(msg);
  results.push({ status, test, detail });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // mobile viewport
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.message}`));

  console.log('\n═══════════════════════════════════════');
  console.log('  VOXA — Teste de Fluxo: Influenciador');
  console.log('═══════════════════════════════════════\n');

  // ─────────────────────────────────────────
  // 1. PÁGINA DE SETUP (criador incompleto)
  // ─────────────────────────────────────────
  console.log('── 1. Página de Setup ──');
  try {
    await page.goto(`${BASE_URL}/setup`, { waitUntil: 'networkidle' });
    await screenshot(page, 'setup_page');

    const title = await page.locator('h1, h2').first().textContent().catch(() => '');
    log('PASS', 'Página de setup carrega', `heading: "${title.trim()}"`);

    // Verificar campos de setup
    const inputFields = page.locator('input, textarea');
    const fieldCount = await inputFields.count();
    if (fieldCount > 0) {
      log('PASS', `Setup tem ${fieldCount} campos de entrada`);
    } else {
      log('WARN', 'Nenhum campo de entrada encontrado no setup');
    }

    // Verificar botão de submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Continuar"), button:has-text("Próximo"), button:has-text("Salvar")').first();
    if (await submitBtn.count() > 0) {
      log('PASS', 'Botão de submit presente no setup');
    } else {
      log('WARN', 'Botão de submit não encontrado');
    }

  } catch (e) {
    log('FAIL', 'Página de setup', e.message);
    await screenshot(page, 'setup_error');
  }

  // ─────────────────────────────────────────
  // 2. DASHBOARD - Proteção de Rota
  // ─────────────────────────────────────────
  console.log('\n── 2. Proteção de Rotas de Dashboard ──');
  try {
    // Tentar acessar dashboard sem autenticação
    const res = await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    const finalUrl = page.url();

    // Dashboard redireciona para /login se não autenticado
    if (finalUrl.includes('/login')) {
      log('PASS', 'Dashboard redireciona para login quando não autenticado');
    } else if (finalUrl.includes('/setup')) {
      log('PASS', 'Dashboard redireciona para setup quando sem perfil completo');
    } else if (finalUrl === `${BASE_URL}/dashboard`) {
      log('WARN', 'Dashboard carregou sem auth (esperado que redirecionasse)', 'Verificar auth guard');
    } else {
      log('WARN', 'Dashboard redirecionou para URL inesperada', finalUrl);
    }
  } catch (e) {
    log('WARN', 'Teste de proteção de dashboard', e.message);
  }

  // ─────────────────────────────────────────
  // 3. ROTAS DE CRIADOR
  // ─────────────────────────────────────────
  console.log('\n── 3. Rotas de Criador (não-autenticado) ──');
  const creatorRoutes = [
    '/dashboard/history',
    '/dashboard/payouts',
    '/dashboard/settings',
    '/dashboard/referral',
  ];

  for (const route of creatorRoutes) {
    try {
      const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      const finalUrl = page.url();

      if (finalUrl.includes('/login') || finalUrl.includes('/setup')) {
        log('PASS', `${route} requer autenticação`);
      } else {
        log('WARN', `${route} acessível sem auth`, finalUrl);
      }
    } catch (e) {
      log('WARN', `Rota ${route}`, e.message);
    }
  }

  // ─────────────────────────────────────────
  // 4. PERFIL PÚBLICO DO CRIADOR
  // ─────────────────────────────────────────
  console.log('\n── 4. Componentes de Perfil Público ──');
  try {
    // Ir para perfil de criador
    await page.goto(`${BASE_URL}/perfil/henrique`, { waitUntil: 'networkidle' });
    await screenshot(page, 'creator_profile_public');

    // Verificar botões/elementos de criador
    const responsesTab = page.locator('button:has-text("Respostas")').first();
    if (await responsesTab.count() > 0) {
      log('PASS', 'Aba de respostas presente no perfil público');

      // Clicar em Respostas para verificar conteúdo
      await responsesTab.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'creator_responses_tab');

      const responseItems = page.locator('[class*="response"], [class*="answer"]').first();
      if (await responseItems.count() > 0) {
        log('PASS', 'Respostas renderizadas');
      } else {
        log('WARN', 'Nenhuma resposta visível (pode estar vazio)');
      }
    } else {
      log('WARN', 'Aba de respostas não encontrada');
    }

  } catch (e) {
    log('FAIL', 'Componentes de perfil público', e.message);
  }

  // ─────────────────────────────────────────
  // 5. RECURSOS DE CRIADOR (página inicial)
  // ─────────────────────────────────────────
  console.log('\n── 5. Links de Recursos de Criador ──');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Procurar por CTA de "Seja criador" ou "Aplicar"
    const creatorCtaLinks = page.locator('a:has-text("criador"), a:has-text("Criador"), a:has-text("aplicar"), a:has-text("Aplicar"), a:has-text("Monetizar")');
    const ctaCount = await creatorCtaLinks.count();

    if (ctaCount > 0) {
      log('PASS', `${ctaCount} CTA(s) de criador/aplicação na homepage`);
      await screenshot(page, 'homepage_creator_cta');
    } else {
      log('WARN', 'Nenhum CTA de criador/aplicação na homepage');
    }

  } catch (e) {
    log('FAIL', 'Links de criador', e.message);
  }

  // ─────────────────────────────────────────
  // 6. VERIFICAÇÃO DE FEATURES DE CRIADOR
  // ─────────────────────────────────────────
  console.log('\n── 6. Features de Criador (Integração) ──');
  try {
    // Verificar se há menção de payouts/saques em qualquer lugar
    const payoutMentions = page.locator('text=saque, text=payout, text=Saque, text=Payout').first();
    if (await payoutMentions.count() > 0) {
      log('PASS', 'Sistema de payout/saque mencionado no site');
    }

    // Verificar se há menção de respostas/perguntas respondidas
    const answerMentions = page.locator('text=responder, text=resposta, text=pergunta, text=Resposta, text=Pergunta').first();
    if (await answerMentions.count() > 0) {
      log('PASS', 'Sistema de perguntas/respostas mencionado');
    }

  } catch (e) {
    log('WARN', 'Verificação de features', e.message);
  }

  // ─────────────────────────────────────────
  // 7. VERIFICAÇÃO DE ERROS DE CONSOLE
  // ─────────────────────────────────────────
  console.log('\n── 7. Erros de Console ──');
  if (consoleErrors.length === 0) {
    log('PASS', 'Sem erros de JavaScript no console');
  } else {
    const unique = [...new Set(consoleErrors)];
    unique.slice(0, 5).forEach(err => log('WARN', 'Console error', err.substring(0, 100)));
  }

  // ─────────────────────────────────────────
  // RELATÓRIO FINAL
  // ─────────────────────────────────────────
  await browser.close();

  console.log('\n═══════════════════════════════════════');
  console.log('  RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════');

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;

  console.log(`✅ PASS: ${pass}  ❌ FAIL: ${fail}  ⚠️  WARN: ${warn}`);

  if (fail > 0) {
    console.log('\n❌ Falhas encontradas:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`   - ${r.test}: ${r.detail}`));
  }
  if (warn > 0) {
    console.log('\n⚠️  Avisos (investigar):');
    results.filter(r => r.status === 'WARN').forEach(r => console.log(`   - ${r.test}: ${r.detail}`));
  }

  console.log(`\n📸 Screenshots em: ${SCREENSHOTS_DIR}`);
}

run().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
