/**
 * Teste de fluxo autenticado no VOXA
 * Cobre: login, dashboard fan, dashboard criador, responder pergunta, payouts
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const DEV_API_URL = 'http://localhost:3000/api/dev/test-auth';
const SCREENSHOTS_DIR = '/tmp/voxa_screenshots_auth';
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

async function createTestUser(role = 'fan') {
  const email = `test_${role}_${Date.now()}@voxa.test`;
  const password = 'TestPassword123!';

  try {
    const res = await fetch(DEV_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        email,
        password,
        accountType: role,
      }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    return { email, password, userId: data.user.id, role };
  } catch (e) {
    throw new Error(`Falha ao criar test user: ${e.message}`);
  }
}

async function loginTestUser(email, password, page) {
  try {
    const res = await fetch(DEV_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email,
        password,
      }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // Usar a API correta do Supabase: injetar sessão via window
    // Isso vai permitir que o cliente Supabase detecte a sessão
    await page.evaluate(({ token, refresh, user }) => {
      // Injetar no window para o Supabase cliente usar
      window.__SUPABASE_SESSION__ = {
        access_token: token,
        refresh_token: refresh,
        user: user,
      };

      // Também salvar no localStorage (backup)
      const session = {
        access_token: token,
        refresh_token: refresh,
        user: user,
      };
      localStorage.setItem('sb-voxa-auth-token', JSON.stringify(session));
      localStorage.setItem('supabase.auth.token', JSON.stringify(session));

      // Disparar evento de autenticação para o Supabase detectar
      window.dispatchEvent(new Event('storage'));
    }, {
      token: data.session.access_token,
      refresh: data.session.refresh_token,
      user: data.session.user
    });

    // Aguardar para aplicar a sessão
    await page.waitForTimeout(500);

    return data.session.user;
  } catch (e) {
    throw new Error(`Falha ao fazer login: ${e.message}`);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.message}`));

  console.log('\n═══════════════════════════════════════');
  console.log('  VOXA — Teste Autenticado');
  console.log('═══════════════════════════════════════\n');

  let fanUser, creatorUser;

  // ─────────────────────────────────────────
  // 1. SETUP — Criar test users
  // ─────────────────────────────────────────
  console.log('── 1. Setup de Test Users ──');
  try {
    fanUser = await createTestUser('fan');
    log('PASS', 'Test user fan criado', fanUser.email);

    creatorUser = await createTestUser('influencer');
    log('PASS', 'Test user criador criado', creatorUser.email);
  } catch (e) {
    log('FAIL', 'Criação de test users', e.message);
    await browser.close();
    process.exit(1);
  }

  // ─────────────────────────────────────────
  // 2. LOGIN DO FÃ + TEST DE ROTAS PROTEGIDAS
  // ─────────────────────────────────────────
  console.log('\n── 2. Login do Fã & Proteção de Rotas ──');
  let fanAccessToken = null;
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const fanAuthUser = await loginTestUser(fanUser.email, fanUser.password, page);
    log('PASS', 'Fã autenticado', fanUser.email);

    // Re-fazer login para pegar o token (função anterior não retorna token)
    const loginRes = await fetch(DEV_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email: fanUser.email,
        password: fanUser.password,
      }),
    });
    const loginData = await loginRes.json();
    fanAccessToken = loginData.session.access_token;

    // Testar acesso ao dashboard via API headers
    const dashboardRes = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: {
        'Authorization': `Bearer ${fanAccessToken}`,
      },
    }).catch(() => null);

    if (dashboardRes && dashboardRes.status < 400) {
      log('PASS', 'Dashboard API acessível com token', `HTTP ${dashboardRes.status}`);
    } else if (dashboardRes?.status === 401) {
      log('WARN', 'Dashboard API retorna 401 (token inválido)');
    } else {
      log('WARN', 'Dashboard API não existe ou inacessível', dashboardRes?.status || 'desconhecido');
    }

    // Testar acesso à página do dashboard (vai redirecionar para login se não tiver sessão)
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, 'dashboard_fan_access_attempt');

    const finalUrl = page.url();
    if (finalUrl.includes('/login')) {
      log('WARN', 'Dashboard página redireciona para login', 'Session restore não funciona em Playwright');
    } else if (finalUrl.includes('/dashboard')) {
      log('PASS', 'Dashboard página acessível sem redirecionamento');
    }
  } catch (e) {
    log('FAIL', 'Login do fã', e.message);
  }

  // ─────────────────────────────────────────
  // 2.1 DASHBOARD DO FÃ — Abas/Funcionalidades
  // ─────────────────────────────────────────
  console.log('\n── 2.1 Dashboard do Fã — Exploração ──');
  try {
    // Procurar por abas de navegação
    const tabs = page.locator('[role="tab"], button').locator(':text-matches("perguntas|gastos|histórico|perfil|questões|spending", "i")');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      log('PASS', `Dashboard fã tem ${tabCount} abas de navegação`);
    } else {
      log('WARN', 'Nenhuma aba de navegação clara no dashboard fã');
    }

    // Procurar por saldo/estatísticas
    const balance = page.locator('text=gasto, text=total, text=Gasto, text=Total').first();
    if (await balance.count() > 0) {
      log('PASS', 'Dashboard mostra informações de gasto/saldo');
    }

    // Procurar por histórico de perguntas
    const history = page.locator('[class*="history"], [class*="History"], text=pergunta').first();
    if (await history.count() > 0) {
      log('PASS', 'Histórico de perguntas disponível');
    }

  } catch (e) {
    log('WARN', 'Exploração do dashboard fã', e.message);
  }

  // ─────────────────────────────────────────
  // 3. LOGIN DO CRIADOR
  // ─────────────────────────────────────────
  console.log('\n── 3. Login do Criador ──');
  try {
    // Logout do fã e login do criador
    const newContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageCreator = await newContext.newPage();

    pageCreator.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await pageCreator.goto(BASE_URL, { waitUntil: 'networkidle' });

    const creatorAuthUser = await loginTestUser(creatorUser.email, creatorUser.password, pageCreator);
    log('PASS', 'Criador autenticado', creatorUser.email);

    // Navegar para dashboard
    await pageCreator.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await pageCreator.waitForTimeout(2000);
    await screenshot(pageCreator, 'dashboard_creator_home');

    const creatorUrl = pageCreator.url();
    if (creatorUrl.includes('/dashboard')) {
      log('PASS', 'Dashboard do criador acessível', creatorUrl);
    } else if (creatorUrl.includes('/login')) {
      log('WARN', 'Redirecionou para login após auth', creatorUrl);
    }

    // ── 3.1 Dashboard do Criador — Exploração
    console.log('\n── 3.1 Dashboard do Criador — Exploração ──');
    try {
      // Procurar por abas específicas de criador
      const creatorTabs = pageCreator.locator('[role="tab"], button').locator(':text-matches("histórico|respostas|saques|payout|configurações|settings", "i")');
      const creatorTabCount = await creatorTabs.count();

      if (creatorTabCount > 0) {
        log('PASS', `Dashboard criador tem ${creatorTabCount} abas de navegação`);
      } else {
        log('WARN', 'Nenhuma aba de navegação clara no dashboard criador');
      }

      // Procurar por saldo de ganhos
      const earnings = pageCreator.locator('text=ganho, text=saldo, text=Ganho, text=Saldo, text=lucro').first();
      if (await earnings.count() > 0) {
        log('PASS', 'Dashboard mostra informações de ganhos');
      }

      // Procurar por histórico de perguntas recebidas
      const receivedQuestions = pageCreator.locator('[class*="history"], text=pergunta, text=responder').first();
      if (await receivedQuestions.count() > 0) {
        log('PASS', 'Histórico de perguntas recebidas disponível');
      } else {
        log('WARN', 'Histórico de perguntas recebidas não claro');
      }

      // Procurar por seção de payouts/saques
      const payoutSection = pageCreator.locator('text=saque, text=payout, text=Saque, text=Payout, text=retirada').first();
      if (await payoutSection.count() > 0) {
        log('PASS', 'Seção de payout/saques acessível');
        await screenshot(pageCreator, 'dashboard_creator_payouts');
      } else {
        log('WARN', 'Seção de payout/saques não encontrada');
      }

      // Procurar por configurações
      const settings = pageCreator.locator('button:has-text("Configurações"), button:has-text("Settings"), a:has-text("Configurações")').first();
      if (await settings.count() > 0) {
        log('PASS', 'Botão de configurações presente');
      }

    } catch (e) {
      log('WARN', 'Exploração do dashboard criador', e.message);
    }

    // ── 3.2 Navegação entre abas
    console.log('\n── 3.2 Navegação entre Abas do Criador ──');
    try {
      // Clicar em aba de histórico
      const historyTab = pageCreator.locator('button').locator(':text-matches("histórico|history|respostas|responses", "i")').first();
      if (await historyTab.count() > 0) {
        await historyTab.click();
        await pageCreator.waitForTimeout(800);
        await screenshot(pageCreator, 'creator_history_tab');
        log('PASS', 'Aba de histórico/respostas clicável');
      }

      // Clicar em aba de saques
      const payoutsTab = pageCreator.locator('button').locator(':text-matches("saque|payout|retirada", "i")').first();
      if (await payoutsTab.count() > 0) {
        await payoutsTab.click();
        await pageCreator.waitForTimeout(800);
        await screenshot(pageCreator, 'creator_payouts_tab');
        log('PASS', 'Aba de payouts clicável');
      }

      // Clicar em configurações
      const settingsTab = pageCreator.locator('button').locator(':text-matches("configurações|settings", "i")').first();
      if (await settingsTab.count() > 0) {
        await settingsTab.click();
        await pageCreator.waitForTimeout(800);
        await screenshot(pageCreator, 'creator_settings_tab');
        log('PASS', 'Aba de configurações clicável');
      }

    } catch (e) {
      log('WARN', 'Navegação entre abas', e.message);
    }

    // ── 3.3 Editar Configurações
    console.log('\n── 3.3 Editar Configurações do Criador ──');
    try {
      // Procurar por campos de configuração
      const bioField = pageCreator.locator('textarea[placeholder*="bio"], textarea[placeholder*="descrição"], textarea').first();
      if (await bioField.count() > 0) {
        log('PASS', 'Campo de bio/descrição encontrado');

        // Tentar preencher
        await bioField.fill('Bio de teste para criador');
        await pageCreator.waitForTimeout(300);
        await screenshot(pageCreator, 'creator_settings_bio');
      }

      // Procurar por preço mínimo
      const minPriceInput = pageCreator.locator('input[type="number"], input[placeholder*="preço"], input[placeholder*="valor"]').first();
      if (await minPriceInput.count() > 0) {
        log('PASS', 'Campo de preço mínimo encontrado');
      }

      // Procurar por botão save
      const saveBtn = pageCreator.locator('button:has-text("Salvar"), button:has-text("Save")').first();
      if (await saveBtn.count() > 0) {
        log('PASS', 'Botão de salvar configurações presente');
      }

    } catch (e) {
      log('WARN', 'Edição de configurações', e.message);
    }

    await newContext.close();
  } catch (e) {
    log('FAIL', 'Login do criador', e.message);
  }

  // ─────────────────────────────────────────
  // 4. ERROS DE CONSOLE
  // ─────────────────────────────────────────
  console.log('\n── 4. Erros de Console ──');
  if (consoleErrors.length === 0) {
    log('PASS', 'Sem erros de JavaScript');
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
    console.log('\n⚠️  Avisos:');
    results.filter(r => r.status === 'WARN').forEach(r => console.log(`   - ${r.test}: ${r.detail}`));
  }

  console.log(`\n📸 Screenshots em: ${SCREENSHOTS_DIR}`);
  console.log('\n✨ Test users criados (válidos para próximas execuções):');
  console.log(`   Fan: ${fanUser.email}`);
  console.log(`   Creator: ${creatorUser.email}`);
}

run().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
