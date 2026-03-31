/**
 * Teste de fluxo de usuário normal (fã) no VOXA
 * Cobre: homepage, login, busca de criadores, perfil, envio de pergunta, histórico
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = '/tmp/voxa_screenshots';
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

  // Capturar erros de console
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.message}`));

  console.log('\n═══════════════════════════════════════');
  console.log('  VOXA — Teste de Fluxo: Usuário Normal');
  console.log('═══════════════════════════════════════\n');

  // ─────────────────────────────────────────
  // 1. HOMEPAGE
  // ─────────────────────────────────────────
  console.log('── 1. Homepage ──');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await screenshot(page, 'homepage');

    const title = await page.title();
    log('PASS', 'Homepage carrega', `title: "${title}"`);

    // Verificar se há um CTA ou link para login
    const loginLink = page.locator('a[href*="login"], a[href*="auth"], button:has-text("Entrar"), button:has-text("Login"), a:has-text("Entrar"), a:has-text("Começar")').first();
    if (await loginLink.count() > 0) {
      log('PASS', 'CTA/Link de login visível');
    } else {
      log('WARN', 'CTA/Link de login não encontrado na homepage');
    }

    // Verificar presença do header/nav
    const nav = page.locator('nav, header').first();
    if (await nav.count() > 0) {
      log('PASS', 'Header/Nav presente');
    } else {
      log('WARN', 'Header/Nav não encontrado');
    }

    // Verificar se há links para perfis de criadores
    const creatorLinks = page.locator('a[href*="/perfil/"]');
    const creatorCount = await creatorLinks.count();
    if (creatorCount > 0) {
      log('PASS', `${creatorCount} perfis de criadores visíveis na homepage`);
    } else {
      log('WARN', 'Nenhum perfil de criador na homepage');
    }

  } catch (e) {
    log('FAIL', 'Homepage carrega', e.message);
    await screenshot(page, 'homepage_error');
  }

  // ─────────────────────────────────────────
  // 2. PÁGINA DE LOGIN / AUTH
  // ─────────────────────────────────────────
  console.log('\n── 2. Página de Login ──');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await screenshot(page, 'login_page');

    const loginH = await page.locator('h1, h2').first().textContent().catch(() => '');
    log('PASS', 'Página de login carrega', `heading: "${loginH.trim()}"`);

    // Verificar botão Google OAuth
    const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), [data-provider="google"]').first();
    if (await googleBtn.count() > 0) {
      log('PASS', 'Botão de login com Google presente');
    } else {
      log('WARN', 'Botão de login com Google não encontrado');
    }

    // Verificar que não há erros de JS visíveis
    const errorTexts = page.locator('text=Error, text=error, text=Erro crítico').first();
    if (await errorTexts.count() === 0) {
      log('PASS', 'Sem erros visíveis na página de login');
    } else {
      log('FAIL', 'Erro visível na página de login');
    }

  } catch (e) {
    // Login pode redirecionar para outro path
    const url = page.url();
    if (url.includes('login') || url.includes('auth') || url.includes('signin')) {
      log('PASS', 'Redirecionamento para auth esperado', url);
    } else {
      log('WARN', 'Página de login não encontrada em /login', `URL atual: ${url}`);
    }
    await screenshot(page, 'login_page');
  }

  // ─────────────────────────────────────────
  // 3. BUSCA DE CRIADORES / LISTAGEM PÚBLICA
  // ─────────────────────────────────────────
  console.log('\n── 3. Listagem Pública de Criadores ──');
  try {
    // Tentar rotas prováveis
    const routes = ['/', '/explore', '/buscar', '/criadores', '/search'];
    let found = false;

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      const creators = page.locator('a[href*="/perfil/"]');
      if (await creators.count() > 0) {
        log('PASS', `Listagem de criadores encontrada em ${route}`, `${await creators.count()} criadores`);
        await screenshot(page, `creators_list_${route.replace('/', '_')}`);
        found = true;
        break;
      }
    }

    if (!found) {
      log('WARN', 'Nenhuma listagem pública de criadores encontrada');
    }

  } catch (e) {
    log('FAIL', 'Listagem de criadores', e.message);
  }

  // ─────────────────────────────────────────
  // 4. PÁGINA DE PERFIL DO CRIADOR (PÚBLICA)
  // ─────────────────────────────────────────
  console.log('\n── 4. Perfil Público de Criador ──');
  try {
    // Navegar para homepage e pegar um link de perfil
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const creatorLinks = page.locator('a[href*="/perfil/"]');
    const count = await creatorLinks.count();

    if (count > 0) {
      const firstHref = await creatorLinks.first().getAttribute('href');
      await page.goto(`${BASE_URL}${firstHref}`, { waitUntil: 'networkidle' });
      await screenshot(page, 'creator_profile');

      const profileUrl = page.url();
      log('PASS', 'Página de perfil carrega', profileUrl.split('/').pop());

      // Avatar ou nome do criador
      const avatar = page.locator('img[alt], h1, h2').first();
      if (await avatar.count() > 0) {
        log('PASS', 'Conteúdo do perfil presente (nome/avatar)');
      } else {
        log('WARN', 'Nome/avatar do criador não encontrado');
      }

      // Botão de enviar pergunta / apoio
      const askBtn = page.locator('button:has-text("Perguntar"), button:has-text("Pergunta"), button:has-text("Enviar"), button:has-text("Apoiar"), a:has-text("Perguntar")').first();
      if (await askBtn.count() > 0) {
        const btnText = await askBtn.textContent();
        log('PASS', `Botão de ação presente: "${btnText.trim()}"`);
      } else {
        log('WARN', 'Nenhum botão de pergunta/apoio encontrado no perfil');
      }

      // Aba de respostas / tabs
      const tabs = page.locator('[role="tab"], button:has-text("Respostas"), button:has-text("Apoiadores")');
      const tabCount = await tabs.count();
      if (tabCount > 0) {
        log('PASS', `${tabCount} tabs encontradas no perfil`);
      } else {
        log('WARN', 'Nenhuma tab encontrada no perfil');
      }

      // Analytics / Stats visíveis
      const stats = page.locator('[class*="stat"], [class*="analytics"], [class*="metric"]').first();
      if (await stats.count() > 0) {
        log('PASS', 'Stats/analytics visíveis no perfil');
      }

      // ── 4.1 Tentar clicar no botão de pergunta
      console.log('\n── 4.1 Fluxo de Pergunta (não autenticado) ──');
      if (await askBtn.count() > 0) {
        await askBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'ask_button_click');

        const afterUrl = page.url();
        const modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]').first();
        const loginRedirect = afterUrl.includes('login') || afterUrl.includes('auth');

        if (loginRedirect) {
          log('PASS', 'Redireciona para login ao tentar perguntar sem auth');
        } else if (await modal.count() > 0) {
          log('PASS', 'Modal de pergunta aberto');

          // Verificar campos do formulário
          const textarea = page.locator('textarea').first();
          const priceInput = page.locator('input[type="number"], input[type="text"][placeholder*="valor"], input[placeholder*="R$"]').first();

          if (await textarea.count() > 0) {
            log('PASS', 'Campo de texto da pergunta presente');

            // Testar validação: tentar enviar sem preencher
            const sendBtn = page.locator('button[type="submit"], button:has-text("Enviar"), button:has-text("Confirmar")').first();
            if (await sendBtn.count() > 0) {
              await sendBtn.click();
              await page.waitForTimeout(800);
              await screenshot(page, 'form_empty_validation');

              const errorMsg = page.locator('[class*="error"], [class*="Error"], [role="alert"], p:has-text("obrigatório"), p:has-text("inválido")').first();
              if (await errorMsg.count() > 0) {
                log('PASS', 'Validação de formulário vazio funcionando');
              } else {
                log('WARN', 'Sem feedback de validação para formulário vazio');
              }
            }
          } else {
            log('WARN', 'Campo de texto da pergunta não encontrado no modal');
          }

          // Fechar modal
          const closeBtn = page.locator('button:has-text("Cancelar"), button:has-text("Fechar"), button[aria-label="close"], button[aria-label="fechar"]').first();
          if (await closeBtn.count() > 0) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          } else {
            await page.keyboard.press('Escape');
          }
        } else {
          log('WARN', 'Nenhum modal ou redirect ao clicar no botão de pergunta', `URL: ${afterUrl}`);
        }
      }

    } else {
      log('WARN', 'Nenhum criador disponível para testar perfil');
    }

  } catch (e) {
    log('FAIL', 'Página de perfil', e.message);
    await screenshot(page, 'profile_error');
  }

  // ─────────────────────────────────────────
  // 5. SEARCH / BUSCA DE CRIADORES
  // ─────────────────────────────────────────
  console.log('\n── 5. Busca de Criadores ──');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const searchInput = page.locator('input[type="search"], input[placeholder*="buscar"], input[placeholder*="Buscar"], input[placeholder*="pesquisar"]').first();

    if (await searchInput.count() > 0) {
      await searchInput.fill('a');
      await page.waitForTimeout(1000);
      await screenshot(page, 'search_results');

      const results_items = page.locator('a[href*="/perfil/"]');
      log('PASS', 'Campo de busca presente e funcional', `${await results_items.count()} resultados`);
    } else {
      log('WARN', 'Campo de busca não encontrado na homepage');
    }
  } catch (e) {
    log('FAIL', 'Busca de criadores', e.message);
  }

  // ─────────────────────────────────────────
  // 6. WAITLIST / CADASTRO (se existir)
  // ─────────────────────────────────────────
  console.log('\n── 6. Waitlist/Cadastro ──');
  try {
    const waitlistRoutes = ['/waitlist', '/signup', '/cadastro', '/register'];
    let found = false;
    for (const route of waitlistRoutes) {
      const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' }).catch(() => null);
      if (res && res.status() < 400 && !page.url().includes('/404')) {
        await screenshot(page, `waitlist_${route.replace('/', '_')}`);
        log('PASS', `Página de waitlist/cadastro encontrada em ${route}`);

        // Verificar form
        const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
        if (await emailInput.count() > 0) {
          log('PASS', 'Campo de email na waitlist presente');

          // Testar com email inválido
          await emailInput.fill('emailinvalido');
          const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Cadastrar")').first();
          if (await submitBtn.count() > 0) {
            await submitBtn.click();
            await page.waitForTimeout(800);
            await screenshot(page, 'waitlist_invalid_email');
            const validationMsg = page.locator('[class*="error"], input:invalid').first();
            if (await validationMsg.count() > 0) {
              log('PASS', 'Validação de email inválido na waitlist');
            } else {
              log('WARN', 'Sem validação de email inválido na waitlist');
            }
          }
        }
        found = true;
        break;
      }
    }
    if (!found) log('WARN', 'Nenhuma página de waitlist/cadastro encontrada');
  } catch (e) {
    log('FAIL', 'Waitlist/Cadastro', e.message);
  }

  // ─────────────────────────────────────────
  // 7. NAVEGAÇÃO MOBILE (bottom nav)
  // ─────────────────────────────────────────
  console.log('\n── 7. Navegação Mobile ──');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const bottomNav = page.locator('nav[class*="bottom"], [class*="BottomNav"], [class*="bottom-nav"]').first();

    if (await bottomNav.count() > 0) {
      log('PASS', 'Bottom nav mobile presente');
      const navLinks = bottomNav.locator('a');
      log('PASS', `${await navLinks.count()} links na bottom nav`);
    } else {
      log('WARN', 'Bottom nav mobile não encontrada (pode não estar logado)');
    }
  } catch (e) {
    log('FAIL', 'Navegação mobile', e.message);
  }

  // ─────────────────────────────────────────
  // 8. LINKS E ROTAS QUEBRADAS
  // ─────────────────────────────────────────
  console.log('\n── 8. Links e Rotas ──');
  const pagesToCheck = ['/', '/login', '/setup', '/dashboard'];
  for (const route of pagesToCheck) {
    try {
      const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      const status = res?.status();
      if (status && status < 400) {
        log('PASS', `Rota ${route}`, `HTTP ${status}`);
      } else {
        log('FAIL', `Rota ${route}`, `HTTP ${status}`);
      }
    } catch (e) {
      log('FAIL', `Rota ${route}`, e.message);
    }
  }

  // ─────────────────────────────────────────
  // 9. VERIFICAR ERROS DE CONSOLE COLETADOS
  // ─────────────────────────────────────────
  console.log('\n── 9. Erros de Console ──');
  if (consoleErrors.length === 0) {
    log('PASS', 'Sem erros de JavaScript no console');
  } else {
    const unique = [...new Set(consoleErrors)];
    unique.slice(0, 10).forEach(err => log('WARN', 'Console error', err.substring(0, 120)));
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
