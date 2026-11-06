const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = (process.env.BASE_URL || 'https://giry02.github.io/spotlog/').replace(/\/?$/, '/');
const expectedAdmin = process.env.EXPECTED_ADMIN_ASSET || 'admin-BdFqIH-7.js';
const expectedCustomer = process.env.EXPECTED_CUSTOMER_ASSET;
const label = process.env.QA_LABEL || 'live';
const checkManual = process.env.CHECK_MANUAL !== 'false';
const cacheQuery = process.env.RELEASE_ID ? '?release=' + encodeURIComponent(process.env.RELEASE_ID) : '';
const out = path.join(__dirname, label);
fs.mkdirSync(out, { recursive: true });
const names = ['카카오', '네이버', 'Google', 'Apple', '이메일'];
const results = [], errors = [], apiRequests = [];
const record = (name, width, detail = {}) => { results.push({ name, width, ...detail }); console.log('PASS', width || '', name); };
async function layout(page, width, name, screenshot = true) {
  assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1), false, name + ' horizontal overflow');
  assert.ok(await page.getByRole('dialog').count() <= 1, name + ' stacked dialog');
  assert.equal(await page.locator('.member-account-card').count(), 0, name + ' false authenticated state');
  assert.equal((await page.locator('body').innerText()).includes('검수 계정'), false, name + ' DEV account leaked');
  if (screenshot) await page.screenshot({ path: path.join(out, `${width}-${name}.png`) });
  record(name, width);
}
async function routeImages(page, width, route) {
  await page.goto(base + cacheQuery + '#' + route);
  await page.locator('.app-shell').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => image.src && !image.complete && image.getClientRects().length).map(image => new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 10000);
    })));
  });
  const images = await page.evaluate(() => ({
    visible: [...document.images].filter(image => image.getClientRects().length).length,
    broken: [...document.images].filter(image => image.getClientRects().length && image.complete && !image.naturalWidth).map(image => image.src),
    pending: [...document.images].filter(image => image.getClientRects().length && !image.complete).map(image => image.src),
  }));
  assert.deepEqual(images.broken, [], route + ' broken images');
  assert.deepEqual(images.pending, [], route + ' image load never completed');
  await layout(page, width, 'route-' + route);
  results.at(-1).images = images;
}
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const response = await fetch(base + cacheQuery, { cache: 'no-store' });
    assert.equal(response.status, 200, 'customer HTTP');
    const html = await response.text();
    const customerAsset = html.match(/assets\/(customer-[^"/]+\.js)/)?.[1];
    assert.ok(customerAsset, 'customer entry bundle');
    if (expectedCustomer) assert.equal(customerAsset, expectedCustomer, 'latest expected customer bundle');
    const entryAssets = [...new Set([...html.matchAll(/assets\/([^"/]+\.js)/g)].map(match => match[1]))];
    for (const asset of entryAssets) {
      const source = await (await fetch(base + 'assets/' + asset, { cache: 'no-store' })).text();
      assert.equal(source.includes('demo@spotlog.test'), false, asset + ' DEV email absent');
      assert.equal(source.includes('SpotlogDemo123!'), false, asset + ' DEV password absent');
    }
    record('customer-release-identity', null, { customerAsset, checkedEntryAssets: entryAssets });
    const adminResponse = await fetch(base + 'admin.html' + cacheQuery, { cache: 'no-store' });
    assert.equal(adminResponse.status, 200, 'admin HTTP');
    const adminHtml = await adminResponse.text();
    const adminAsset = adminHtml.match(/assets\/(admin-[^"/]+\.js)/)?.[1];
    assert.equal(adminAsset, expectedAdmin, 'previous administrator bundle retained');
    record('administrator-bundle-unchanged', null, { adminAsset });
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      await context.addInitScript(() => {
        sessionStorage.setItem('spotlog.review.account.session.v1', 'signed');
        localStorage.setItem('spotlog.admin.qa-sentinel', 'administrator data must remain');
        localStorage.setItem('spotlog.auth.qa-sentinel', 'private data must remain');
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push({ width, message: String(error), url: page.url() }));
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
      await page.goto(base + cacheQuery + '#profile');
      await page.locator('.guest-profile-card').waitFor();
      assert.equal(await page.locator('script[src*="' + customerAsset + '"]').count(), 1);
      await layout(page, width, 'guest');
      for (const intent of ['로그인', '회원가입']) {
        await page.locator('.guest-profile-card').getByRole('button', { name: intent, exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        for (const name of names) assert.equal(await dialog.getByRole('button', { name: name + '로 ' + intent, exact: true }).count(), 1, name + ' ' + intent);
        assert.equal(await dialog.locator('.account-method').count(), 5);
        assert.equal(await dialog.locator('input').count(), 0, 'chooser must precede email inputs');
        await layout(page, width, 'five-' + (intent === '로그인' ? 'login' : 'signup'));
        for (const name of names.slice(0, 4)) {
          await dialog.getByRole('button', { name: name + '로 ' + intent, exact: true }).click();
          await dialog.locator('.account-social-notice').waitFor();
          assert.equal(await dialog.getByRole('heading', { name: name + ' ' + intent, exact: true }).count(), 1);
          assert.equal(await dialog.locator('.signup-consent-list').count(), 0);
          await layout(page, width, (intent === '로그인' ? 'login' : 'signup') + '-' + name, false);
          await dialog.getByRole('button', { name: '다른 방식 선택', exact: true }).click();
          assert.equal(await dialog.locator('.account-method').count(), 5);
        }
        await dialog.getByRole('button', { name: '이메일로 ' + intent, exact: true }).click();
        if (intent === '로그인') {
          assert.equal(await dialog.getByLabel('이메일', { exact: true }).inputValue(), '');
          assert.equal(await dialog.getByLabel('비밀번호', { exact: true }).inputValue(), '');
          await dialog.getByLabel('이메일', { exact: true }).fill('qa@example.invalid');
          await dialog.locator('input[type="password"]').first().fill('QaPassword123!');
          assert.equal(await dialog.getByRole('button', { name: '이메일로 로그인', exact: true }).isDisabled(), true);
          await layout(page, width, 'email-login-unconfigured');
        } else {
          await dialog.getByRole('button', { name: '필수 항목만 동의', exact: true }).click();
          await dialog.getByRole('button', { name: '동의하고 다음', exact: true }).click();
          await dialog.getByLabel('활동 이름', { exact: true }).fill('공개 검수');
          await dialog.getByLabel('이메일', { exact: true }).fill('qa@example.invalid');
          await dialog.locator('input[type="password"]').first().fill('QaPassword123!');
          await dialog.getByLabel('비밀번호 확인', { exact: true }).fill('QaPassword123!');
          assert.equal(await dialog.getByRole('button', { name: '인증번호 받기', exact: true }).isDisabled(), true);
          assert.equal(await dialog.getByRole('button', { name: '인증하고 가입하기', exact: true }).isDisabled(), true);
          await layout(page, width, 'email-signup-unconfigured');
        }
        await page.getByRole('button', { name: '닫기', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.admin.qa-sentinel')), 'administrator data must remain');
      assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.auth.qa-sentinel')), 'private data must remain');
      for (const route of ['home', 'community', 'places-photo', 'trips', 'saved']) await routeImages(page, width, route);
      await page.goto(base + cacheQuery + '#error-session');
      await page.getByRole('heading', { name: '로그인이 필요해요', exact: true }).waitFor();
      await page.getByRole('button', { name: '로그인하기', exact: true }).click();
      for (const name of names) assert.equal(await page.getByRole('dialog').getByRole('button', { name: name + '로 로그인', exact: true }).count(), 1);
      await layout(page, width, 'expired-session-five-login');
      await context.close();
    }
    assert.deepEqual(apiRequests, [], 'unconfigured customer must never submit credentials or call fake API');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const adminPage = await adminContext.newPage();
    adminPage.on('pageerror', error => errors.push({ width: 1440, message: String(error), url: adminPage.url() }));
    await adminPage.goto(base + 'admin.html' + cacheQuery);
    await adminPage.getByRole('heading', { name: '관리자 연결 대기', exact: true }).waitFor();
    assert.equal(await adminPage.getByRole('combobox', { name: '역할 전환', exact: true }).count(), 0, 'no local highest-admin bypass in production');
    assert.equal(await adminPage.getByRole('combobox', { name: '작업자', exact: true }).count(), 0);
    assert.equal(await adminPage.locator('.admin-page-body').count(), 0, 'unauthenticated administrator data not rendered');
    await adminPage.screenshot({ path: path.join(out, 'admin-service-gate.png') });
    record('admin-service-access-gate', 1440);
    if (checkManual) {
      const manualResponse = await adminPage.goto(base + 'manual/admin/' + cacheQuery + '#start');
      assert.equal(manualResponse.status(), 200, 'manual HTTP');
      assert.ok((await adminPage.locator('body').innerText()).includes('관리자'), 'manual readable');
      assert.ok((await adminPage.locator('body').innerText()).includes('목차') || (await adminPage.locator('body').innerText()).includes('사용'), 'manual content');
      await adminPage.screenshot({ path: path.join(out, 'administrator-manual.png') });
      record('administrator-manual-retained', 1440);
    }
    await adminContext.close();
    assert.deepEqual(errors, [], 'JavaScript page exceptions');
    const result = { passed: true, base, customerAsset, adminAsset, states: results.length, results, errors, apiRequests, actualAuthenticationConnected: false, devCredentialsExcluded: true };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
    if (fs.existsSync(path.join(out, 'failure.txt'))) fs.unlinkSync(path.join(out, 'failure.txt'));
    console.log(JSON.stringify({ passed: true, base, customerAsset, adminAsset, states: results.length, errors }));
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(out, 'failure.txt'), String(error.stack)); console.error(error); process.exitCode = 1; });
