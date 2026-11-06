const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:5210';
const out = __dirname;
const entry = '/tests/account-methods.html';
const providers = ['KAKAO', 'NAVER', 'GOOGLE', 'APPLE'];
const names = { KAKAO: '카카오', NAVER: '네이버', GOOGLE: 'Google', APPLE: 'Apple' };
const hosts = { KAKAO: 'kauth.kakao.com', NAVER: 'nid.naver.com', GOOGLE: 'accounts.google.com', APPLE: 'appleid.apple.com' };
const results = [];
const errors = [];
const record = (name, details = {}) => { results.push({ name, ...details }); console.log(name); };
const json = (route, value, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(value) });

async function server(context, options = {}) {
  const calls = [];
  let member = options.signed ? { id: 'server-verified-member', displayName: '인증된 검수 회원', email: 'qa@example.invalid', provider: options.signed } : null;
  let pending = null;
  let emailInput = null;
  const authorization = new Map();
  const hasSession = request => /spotlog_qa_member=verified/.test(request.headers().cookie || '');
  const cookie = { 'Set-Cookie': 'spotlog_qa_member=verified; Path=/; HttpOnly; SameSite=Lax' };
  if (member) await context.addCookies([{ name: 'spotlog_qa_member', value: 'verified', url: base, httpOnly: true, sameSite: 'Lax' }]);
  await context.route(base + '/api/qa-account-methods/**', async route => {
    const request = route.request();
    const suffix = new URL(request.url()).pathname.replace('/api/qa-account-methods', '');
    const body = request.postDataJSON();
    calls.push({ suffix, body, method: request.method(), cookie: request.headers().cookie || '' });
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    if (suffix === '/social/session') return json(route, member && hasSession(request) ? { state: 'SIGNED_IN', user: member } : pending ? { state: 'PENDING_SIGNUP', provider: pending } : { state: 'GUEST' });
    if (suffix === '/policies') return json(route, { status: 'PUBLISHED', operator: { name: '격리된 시험 운영자', address: '시험 주소', email: 'qa@example.invalid' }, minimumAge: 14, locationEnabled: false, documents: ['terms','privacy','collection','location','marketing'].map(id => ({ id, title: { terms:'서비스 이용약관', privacy:'개인정보 처리방침', collection:'개인정보 수집·이용', location:'위치 이용 안내', marketing:'이메일 소식 수신' }[id], version: 'qa-20261014', sections: [{ heading: '시험 문서', paragraphs: ['실제 서비스 약관이나 동의 기록이 아닌 격리 시험 응답.'] }] })) });
    const start = suffix.match(/^\/oauth\/(kakao|naver|google|apple)\/start$/);
    if (start) {
      if (options.startFail) return json(route, { message: 'test-unavailable' }, 503);
      const provider = start[1].toUpperCase();
      assert.ok(['login', 'signup'].includes(body.intent), 'explicit start intent');
      const state = 'qa-' + crypto.randomUUID();
      authorization.set(state, { provider, returnTo: body.returnTo, intent: body.intent });
      return json(route, { authorizeUrl: 'https://' + hosts[provider] + '/oauth/authorize?state=' + encodeURIComponent(state) });
    }
    if (suffix === '/social/signup') {
      if (!pending) return json(route, { message: 'no-pending' }, 409);
      assert.equal(body.accepted.age, true);
      assert.equal(body.marketing.accepted, false);
      member = { id: 'server-verified-member', displayName: '인증된 검수 회원', email: pending === 'APPLE' ? null : 'qa@example.invalid', provider: pending };
      pending = null;
      return json(route, member, 200, cookie);
    }
    if (suffix === '/email/signup') {
      assert.equal(body.consent.marketing.accepted, false);
      assert.deepEqual(body.consent.versions, { terms: 'qa-20261014', collection: 'qa-20261014' });
      assert.ok(!JSON.stringify(body.consent).includes('location'));
      if (options.signupFail && !calls.some(c => c.suffix === '/email/signup' && c !== calls.at(-1))) return json(route, { message: 'temporary-failure' }, 503);
      emailInput = body;
      return json(route, { state: 'VERIFICATION_REQUIRED', email: body.email });
    }
    if (suffix === '/email/verify') {
      if (body.code !== '123456') return json(route, { message: 'invalid-code' }, 400);
      member = { id: 'server-verified-member', displayName: emailInput?.displayName || '인증된 검수 회원', email: body.email, provider: 'EMAIL' };
      return json(route, member, 200, cookie);
    }
    if (suffix === '/email/sign-in') {
      if (body.password !== 'correct-password') return json(route, { message: 'invalid-credentials' }, 401);
      member = { id: 'server-verified-member', displayName: '인증된 검수 회원', email: body.email, provider: 'EMAIL' };
      return json(route, member, 200, cookie);
    }
    if (suffix === '/email/verification/resend' || suffix === '/email/password-reset') return route.fulfill({ status: 204 });
    if (suffix === '/sign-out') { member = null; pending = null; return route.fulfill({ status: 204, headers: { 'Set-Cookie': 'spotlog_qa_member=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' } }); }
    return json(route, { message: 'unknown-qa-route' }, 404);
  });
  await context.route(/^https:\/\/(kauth\.kakao\.com|nid\.naver\.com|accounts\.google\.com|appleid\.apple\.com)\//, async route => {
    const state = new URL(route.request().url()).searchParams.get('state');
    const proof = authorization.get(state);
    assert.ok(proof, 'mock server validates one-use OAuth state');
    authorization.delete(state);
    if (options.cancel) { member = null; pending = null; }
    else if (options.existing) { member = { id: 'server-verified-member', displayName: '인증된 검수 회원', email: proof.provider === 'APPLE' ? null : 'qa@example.invalid', provider: proof.provider }; pending = null; }
    else { member = null; pending = proof.provider; }
    const callbackUrl = base + '/qa-account-methods-callback?returnTo=' + encodeURIComponent(proof.returnTo);
    return route.fulfill({ status: 200, contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><title>격리된 OAuth 공급자 응답</title><script>location.replace(' + JSON.stringify(callbackUrl) + ')</script>' });
  });
  await context.route(base + '/qa-account-methods-callback**', route => {
    const target = new URL(route.request().url()).searchParams.get('returnTo');
    return route.fulfill({ status: 302, headers: { Location: base + target, ...(member ? cookie : {}) } });
  });
  return { calls, clear: () => { member = null; pending = null; }, setPending: provider => { member = null; pending = provider; }, setMember: value => { member = value; pending = null; } };
}

async function contextPage(browser, width = 390, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('spotlog.qa.private-sentinel', 'private itinerary must remain');
    localStorage.setItem('spotlog.admin.qa-sentinel', 'administrator data must remain');
    if (!localStorage.getItem('spotlog.local.repository.v2')) {
      const journeys = [{ id:'qa-private-plan', title:'기존 비공개 여행 보호', region:'부산', dateRange:'미정', duration:'1일', cover:'', summary:'', story:'', author:'기기 기록 작성자', status:'PLANNING', visibility:'PRIVATE', isMine:true, saves:0, tags:[], purpose:'PLAN', planStage:'READY', days:[{ day:1, dayId:'qa-private-day', date:'', title:'DAY 1', story:'개인 일정 메모 유지', places:[], blocks:[] }] }];
      localStorage.setItem('spotlog.local.repository.v2', JSON.stringify({ schemaVersion:2, updatedAt:'2026-10-14T00:00:00.000Z', records:{ 'spotlog.web.journeys.v4':JSON.stringify(journeys) } }));
    }
  });
  const api = await server(context, options);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + entry + '#profile');
  await page.locator('.guest-profile-card,.member-account-card').first().waitFor();
  page.qaOriginal = await page.evaluate(() => ({ repository:localStorage.getItem('spotlog.local.repository.v2'), admin:localStorage.getItem('spotlog.admin.review.v1') }));
  return { context, page, api };
}

async function inspect(page, width, state) {
  assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1), false, state + ' page horizontal overflow');
  assert.ok(await page.getByRole('dialog').count() <= 1, state + ' one dialog');
  if (await page.getByRole('dialog').count()) {
    const box = await page.getByRole('dialog').boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= width + 1, state + ' dialog width');
    const roles = await page.locator('.account-form input:not([type=checkbox])').evaluateAll(inputs => inputs.map(i => parseFloat(getComputedStyle(i).fontSize)));
    assert.ok(roles.every(value => value >= 16), state + ' input fonts');
  }
  await page.screenshot({ path: path.join(out, width + '-' + state + '.png') });
  record(state, { width });
}

const signup = page => page.locator('.guest-profile-card').getByRole('button', { name: /회원가입/ }).click();
const login = page => page.locator('.guest-profile-card').getByRole('button', { name: '로그인', exact: true }).click();
const emailMethod = (page, action) => page.getByRole('dialog').getByRole('button', { name: new RegExp('이메일.*' + action) }).first().click();
const socialMethod = (page, provider, action) => page.getByRole('dialog').getByRole('button', { name: new RegExp(names[provider] + '.*' + action) }).first().click();
const waitGuest = page => page.locator('.guest-profile-card').waitFor();
const close = async page => { await page.getByRole('button', { name: '닫기', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };
async function enterDetails(page) {
  await page.getByRole('button', { name: '필수 항목만 동의' }).click();
  assert.equal(await page.locator('input[name=marketing]').isChecked(), false);
  await page.getByRole('button', { name: '동의하고 다음' }).click();
  await page.getByLabel('활동 이름', { exact: true }).fill('이메일 검수 여행자');
  await page.getByLabel('이메일', { exact: true }).fill('qa@example.invalid');
  await page.locator('input[type=password]').first().fill('correct-password');
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('correct-password');
}
async function preserved(page) {
  assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.qa.private-sentinel')), 'private itinerary must remain');
  assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.admin.qa-sentinel')), 'administrator data must remain');
  assert.equal(await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records['spotlog.web.journeys.v4'])[0].days[0].story), '개인 일정 메모 유지');
  const current = await page.evaluate(() => ({ repository:localStorage.getItem('spotlog.local.repository.v2'), admin:localStorage.getItem('spotlog.admin.review.v1') }));
  assert.deepEqual(current, page.qaOriginal);
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320,390,460]) {
      const { context, page, api } = await contextPage(browser, width);
      await waitGuest(page);
      await signup(page);
      await page.getByRole('heading', { name: '회원가입', exact: true }).waitFor();
      for (const provider of providers) assert.equal(await page.getByRole('dialog').getByRole('button', { name: new RegExp(names[provider] + '.*회원가입') }).count(), 1);
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: /이메일.*회원가입/ }).count(), 1);
      assert.equal(await page.locator('input[type=password]').count(), 0);
      await inspect(page, width, 'five-signup-methods');
      await emailMethod(page, '회원가입');
      await page.getByRole('button', { name: '필수 항목만 동의' }).waitFor();
      await inspect(page, width, 'email-signup-terms');
      await enterDetails(page);
      await inspect(page, width, 'email-signup-details');
      await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
      await page.getByLabel('이메일 인증번호', { exact: true }).waitFor();
      assert.equal(await page.locator('.member-account-card').count(), 0);
      await page.getByLabel('이메일 인증번호', { exact: true }).fill('000000');
      await page.getByRole('button', { name: '인증하고 가입하기' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('.member-account-card').count(), 0);
      await inspect(page, width, 'wrong-email-code-stays-guest');
      await page.getByRole('button', { name: '인증번호 다시 받기' }).click();
      await page.getByText('이메일로 인증번호를 다시 보냈어요. 최신 번호를 확인하세요.').waitFor();
      assert.equal(await page.getByLabel('이메일 인증번호', { exact: true }).inputValue(), '');
      assert.equal(await page.getByLabel('이메일 인증번호', { exact: true }).evaluate(el => el === document.activeElement), true);
      await page.getByLabel('이메일 인증번호', { exact: true }).fill('123456');
      await page.getByRole('button', { name: '인증하고 가입하기' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.locator('.member-account-card').waitFor();
      await inspect(page, width, 'email-signup-complete');
      await page.reload();
      await page.locator('.member-account-card').waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.ok(api.calls.filter(c => c.suffix === '/social/session').at(-1).cookie.includes('spotlog_qa_member=verified'));
      await inspect(page, width, 'email-server-session-auto');
      await page.getByRole('button', { name: '계정 관리 · 로그아웃' }).click();
      await page.getByRole('button', { name: '로그아웃', exact: true }).click();
      await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
      for (const provider of providers) assert.equal(await page.getByRole('dialog').getByRole('button', { name: new RegExp(names[provider] + '.*로그인') }).count(), 1);
      await inspect(page, width, 'five-login-methods');
      await emailMethod(page, '로그인');
      await page.getByLabel('이메일', { exact: true }).fill('qa@example.invalid');
      await page.getByLabel('비밀번호', { exact: true }).fill('wrong-password');
      await page.getByRole('button', { name: '이메일로 로그인', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('이메일', { exact: true }).inputValue(), 'qa@example.invalid');
      await inspect(page, width, 'email-login-error');
      await page.getByLabel('비밀번호', { exact: true }).fill('correct-password');
      await page.getByRole('button', { name: '이메일로 로그인', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.locator('.member-account-card').waitFor();
      await preserved(page);
      record('email-login-retry-and-storage-preserved', { width });
      await context.close();
    }
    for (const provider of providers) {
      const { context, page, api } = await contextPage(browser);
      await waitGuest(page); await signup(page); await socialMethod(page, provider, '회원가입');
      await page.getByRole('button', { name: '필수 항목만 동의' }).waitFor();
      assert.equal(await page.locator('.signup-provider-summary').innerText().then(t => t.includes(names[provider])), true);
      assert.equal(await page.locator('.member-account-card').count(), 0);
      assert.equal(api.calls.find(c => c.suffix.endsWith('/start')).body.intent, 'signup');
      await inspect(page, 390, provider.toLowerCase() + '-new-social-consent');
      await page.getByRole('button', { name: '필수 항목만 동의' }).click();
      await page.getByRole('button', { name: '동의하고 가입하기' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.locator('.member-account-card').waitFor();
      await page.reload(); await page.locator('.member-account-card').waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(api.calls.filter(c => c.suffix === '/social/signup').length, 1);
      await inspect(page, 390, provider.toLowerCase() + '-new-social-signed-in'); await preserved(page); await context.close();

      const existing = await contextPage(browser, 390, { existing: true });
      await waitGuest(existing.page); await signup(existing.page); await socialMethod(existing.page, provider, '회원가입');
      await existing.page.locator('.member-account-card').waitFor();
      assert.equal(await existing.page.getByRole('dialog').count(), 0);
      assert.equal(existing.api.calls.filter(c => c.suffix === '/social/signup').length, 0);
      await existing.page.reload(); await existing.page.locator('.member-account-card').waitFor();
      record(provider.toLowerCase() + '-existing-account-signup-enters-session'); await existing.context.close();
    }
    for (const provider of providers) {
      const { context, page, api } = await contextPage(browser, 390, { existing: true });
      await waitGuest(page); await login(page); await socialMethod(page, provider, '로그인');
      await page.locator('.member-account-card').waitFor();
      assert.equal(api.calls.find(c => c.suffix.endsWith('/start')).body.intent, 'login');
      assert.equal(await page.getByRole('dialog').count(), 0);
      record(provider.toLowerCase() + '-login-authorized-session'); await context.close();
    }
    const failing = await contextPage(browser, 390, { startFail: true, delay: 120 });
    await waitGuest(failing.page); await signup(failing.page);
    const chosen = failing.page.getByRole('dialog').getByRole('button', { name: /카카오.*회원가입/ });
    await failing.page.locator('.account-method-kakao:not(:disabled)').waitFor();
    await chosen.evaluate(button => { button.click(); button.click(); });
    await failing.page.locator('.account-social-notice').waitFor();
    assert.equal(failing.api.calls.filter(c => c.suffix.endsWith('/start')).length, 1);
    assert.equal(await failing.page.getByRole('heading', { name: '카카오 회원가입', exact: true }).count(), 1);
    assert.equal(await failing.page.locator('.signup-consent-list').count(), 0);
    await inspect(failing.page, 390, 'failed-provider-guard-and-signup-preserved'); await failing.context.close();

    const cancel = await contextPage(browser, 390, { cancel: true });
    await waitGuest(cancel.page); await login(cancel.page); await socialMethod(cancel.page, 'NAVER', '로그인');
    await waitGuest(cancel.page); assert.equal(await cancel.page.locator('.member-account-card').count(), 0);
    record('provider-cancellation-stays-guest'); await cancel.context.close();

    const unconfigured = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const u = await unconfigured.newPage(); u.on('pageerror', e => errors.push(String(e)));
    await u.goto(base + entry + '?unconfigured#profile'); await waitGuest(u); await signup(u);
    await socialMethod(u, 'KAKAO', '회원가입'); await u.locator('.account-social-notice').waitFor();
    assert.equal(await u.getByRole('heading', { name: '카카오 회원가입', exact: true }).count(), 1);
    await inspect(u, 390, 'unconfigured-social-no-fake-success');
    await emailMethod(u, '회원가입'); await enterDetails(u);
    assert.equal(await u.getByRole('button', { name: '인증번호 받기', exact: true }).isDisabled(), true);
    await inspect(u, 390, 'unconfigured-email-signup-no-fake-success'); await unconfigured.close();

    const revisit = await contextPage(browser, 320);
    await waitGuest(revisit.page); await signup(revisit.page); await emailMethod(revisit.page, '회원가입'); await enterDetails(revisit.page);
    await revisit.page.getByRole('button', { name: '약관 다시 확인' }).click();
    assert.equal(await revisit.page.locator('input[name=terms]').isChecked(), true);
    await revisit.page.getByRole('button', { name: '동의하고 다음' }).click();
    assert.equal(await revisit.page.getByLabel('활동 이름', { exact:true }).inputValue(), '이메일 검수 여행자');
    assert.equal(await revisit.page.locator('input[type=password]').first().inputValue(), 'correct-password');
    assert.equal(await revisit.page.getByLabel('비밀번호 확인', { exact:true }).inputValue(), 'correct-password');
    record('revisit-terms-preserves-signup-information');
    await revisit.page.setViewportSize({ width:320, height:420 });
    await revisit.page.getByLabel('이메일', { exact:true }).focus();
    await inspect(revisit.page, 320, 'short-viewport-email-form');
    assert.equal(await revisit.page.locator('input[type=email]').evaluate(el => getComputedStyle(el).fontSize), '16px');
    await revisit.page.setViewportSize({ width:320, height:844 });
    await close(revisit.page); await login(revisit.page); await emailMethod(revisit.page, '로그인');
    await revisit.page.getByLabel('이메일', { exact:true }).fill('qa@example.invalid');
    await revisit.page.getByLabel('비밀번호', { exact:true }).fill('must-not-remain');
    await revisit.page.getByRole('button', { name:'다른 방식 선택', exact:true }).click();
    await emailMethod(revisit.page, '로그인');
    assert.equal(await revisit.page.getByLabel('비밀번호', { exact:true }).inputValue(), '');
    record('changing-login-method-clears-password');
    await revisit.page.getByRole('button', { name:'비밀번호 찾기', exact:true }).click();
    await revisit.page.getByLabel('이메일', { exact:true }).fill('qa@example.invalid');
    await revisit.page.getByRole('button', { name:'재설정 안내 받기', exact:true }).click();
    await revisit.page.getByText('사용 가능한 계정이면 재설정 안내가 발송돼요. 이메일을 확인해 주세요.').waitFor();
    await revisit.page.getByRole('button', { name:'이메일 로그인으로', exact:true }).click();
    assert.equal(await revisit.page.getByRole('heading', { name:'이메일 로그인', exact:true }).count(),1);
    await preserved(revisit.page); record('password-reset-back-and-storage-preserved'); await revisit.context.close();

    const local = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    const d = await local.newPage(); d.on('pageerror', e => errors.push(String(e)));
    await d.goto(base + '/#profile'); await waitGuest(d); await login(d); await emailMethod(d, '로그인');
    assert.equal(await d.getByLabel('이메일', { exact:true }).inputValue(), 'demo@spotlog.test');
    assert.equal(await d.getByLabel('비밀번호', { exact:true }).inputValue(), 'SpotlogDemo123!');
    await inspect(d, 390, 'dev-prefilled-email-login');
    await d.getByRole('button', { name:'이메일로 로그인', exact:true }).click();
    await d.getByRole('dialog').waitFor({ state:'hidden' }); await d.locator('.member-account-card').waitFor();
    await d.reload(); await d.locator('.member-account-card').waitFor();
    assert.equal(await d.getByRole('dialog').count(),0);
    assert.equal(await d.getByRole('button', { name:'로그인', exact:true }).count(),0);
    record('actual-dev-review-login-and-reload');
    await d.getByRole('button', { name:'계정 관리 · 로그아웃' }).click();
    await d.getByRole('dialog').getByRole('heading', { name:'내 계정', exact:true }).waitFor();
    await d.getByRole('button', { name:'로그아웃', exact:true }).click();
    await d.getByRole('heading', { name:'로그인', exact:true }).waitFor();
    await d.getByRole('dialog').getByRole('button', { name:'회원가입', exact:true }).click();
    for (const provider of providers) assert.equal(await d.getByRole('dialog').getByRole('button', { name:new RegExp(names[provider]+'.*회원가입') }).count(),1);
    await inspect(d,390,'actual-dev-five-signup-after-logout'); await local.close();

    const pendingSwitch = await contextPage(browser,390);
    await waitGuest(pendingSwitch.page); await signup(pendingSwitch.page); await socialMethod(pendingSwitch.page,'KAKAO','회원가입');
    await pendingSwitch.page.getByRole('button',{name:'필수 항목만 동의'}).waitFor();
    await pendingSwitch.page.getByRole('button',{name:'필수 항목만 동의'}).click();
    pendingSwitch.api.setPending('NAVER');
    await pendingSwitch.page.evaluate(() => { const now=Date.now(); Date.now=()=>now+61000; window.dispatchEvent(new Event('focus')); });
    await pendingSwitch.page.locator('.signup-provider-summary').getByText('네이버로 가입',{exact:true}).waitFor();
    assert.equal(await pendingSwitch.page.locator('input[name=terms]').isChecked(),false);
    assert.equal(await pendingSwitch.page.getByRole('button',{name:'동의하고 가입하기'}).isDisabled(),true);
    assert.equal(pendingSwitch.api.calls.filter(c=>c.suffix==='/social/signup').length,0);
    await inspect(pendingSwitch.page,390,'pending-provider-change-clears-old-consent');
    await pendingSwitch.page.getByRole('button',{name:'다른 가입 방식 선택'}).click();
    await pendingSwitch.page.getByRole('heading',{name:'회원가입',exact:true}).waitFor();
    assert.equal(await pendingSwitch.page.locator('.signup-consent-list').count(),0);
    record('cancel-pending-signup-returns-five-methods'); await pendingSwitch.context.close();

    const identitySwitch=await contextPage(browser,390,{signed:'EMAIL'});
    await identitySwitch.page.locator('.member-account-card').waitFor();
    await identitySwitch.page.getByRole('button',{name:'계정 관리 · 로그아웃'}).click();
    await identitySwitch.page.getByRole('dialog').getByRole('heading',{name:'내 계정',exact:true}).waitFor();
    await identitySwitch.page.evaluate(() => { const now=Date.now(); Date.now=()=>now+61000; window.dispatchEvent(new Event('focus')); });
    await identitySwitch.page.getByRole('button',{name:'회원 탈퇴',exact:true}).waitFor();
    await identitySwitch.page.getByRole('button',{name:'회원 탈퇴',exact:true}).click();
    await identitySwitch.page.getByRole('checkbox').check();
    identitySwitch.api.setMember({id:'other-verified-member',displayName:'다른 인증 회원',email:'other@example.invalid',provider:'EMAIL'});
    await identitySwitch.page.evaluate(() => { const now=Date.now(); Date.now=()=>now+61000; window.dispatchEvent(new Event('focus')); });
    await identitySwitch.page.getByRole('dialog').getByRole('heading',{name:'내 계정',exact:true}).waitFor();
    await identitySwitch.page.locator('.account-identity').getByText('다른 인증 회원',{exact:true}).waitFor();
    assert.equal(await identitySwitch.page.getByRole('checkbox').count(),0);
    assert.equal(identitySwitch.api.calls.filter(c=>c.suffix==='/delete').length,0);
    await inspect(identitySwitch.page,390,'member-change-clears-old-delete-confirmation');
    await preserved(identitySwitch.page); await identitySwitch.context.close();
    assert.deepEqual(errors, []);
    const summary = { passed: true, checks: results.length, results, errors, disclaimer: 'Isolated DEV fixture exercises real HTTP adapter against a fake server; no real provider credentials, mail delivery or service authentication claimed.' };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(summary, null, 2));
    if (fs.existsSync(path.join(out, 'failure.txt'))) fs.unlinkSync(path.join(out, 'failure.txt'));
    console.log(JSON.stringify({ passed: true, checks: results.length, errors }));
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(out, 'failure.txt'), String(error.stack)); console.error(error); process.exitCode = 1; });
