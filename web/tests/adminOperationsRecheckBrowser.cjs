/* Additional period, draft and error tests in a disposable browser context. */
const { chromium, expect } = require(process.env.SPOTLOG_PLAYWRIGHT || 'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.SPOTLOG_ADMIN_URL || 'http://127.0.0.1:5210';
const output = process.env.SPOTLOG_OPS_RECHECK_DIR || path.resolve(__dirname, '../../artifacts/admin-ops-recheck-20261010/extra');
const checks = [], errors = [], key = 'spotlog.admin.review.v1';
const active = page => page.locator('.admin-page-body:not([hidden])');
async function menu(page, name) { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); await expect(page.getByRole('heading', { name, level: 1, exact: true })).toBeVisible(); }
async function tab(page, name) { await active(page).getByRole('tab', { name, exact: true }).click(); }
async function select(page, name, option) { await active(page).getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); }
const record = label => { checks.push(label); console.log('PASS', label); };
async function main() {
  fs.mkdirSync(output, { recursive: true }); const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' }), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin.html'); await expect(page.getByRole('heading', { name: '오늘의 운영 작업' })).toBeVisible();
    const times = await page.evaluate(async storageKey => {
      const { makeAdminSeed } = await import('/src/admin/seed.ts'); const state = makeAdminSeed();
      const record = state.places.find(place => place.placeId === 'jeju-hyeopjae'), content = structuredClone(record.draft);
      content.operation = 'OPEN'; content.rights.display = true; content.rights.store = true; content.location.verified = true;
      for (const media of content.media) { media.rights.display = true; media.rights.store = true; }
      record.published = content; record.state = 'PUBLISHED'; record.revision++;
      const startsAt = new Date(Date.now() - 86400000).toISOString(), endsAt = new Date(Date.now() + 86400000).toISOString();
      state.ops.exposures = [{ exposureId: 'period-review', revision: 1, channel: 'HOME_PLACE', targetId: record.placeId, title: '기간 검수 장소', introduction: '실제 공개 게시 아님', coverMediaId: content.media.find(media => media.type === 'PHOTO').mediaId, startsAt, endsAt, enabled: true, order: 0 }];
      localStorage.setItem(storageKey, JSON.stringify(state)); localStorage.setItem('ops-private-sentinel', 'customer private data stays untouched'); return { startsAt, endsAt };
    }, key);
    await page.reload(); await menu(page, '노출·추천'); await tab(page, '노출 설정'); await select(page, '노출 채널', '홈 인기 장소');
    await active(page).getByRole('button', { name: /기간 검수 장소.*jeju-hyeopjae/ }).click();
    const startInput = active(page).getByLabel('시작일 (선택)', { exact: true }), endInput = active(page).getByLabel('종료일 (선택)', { exact: true });
    assert.ok(await startInput.inputValue(), 'ISO startsAt must remain visible in datetime-local editor');
    assert.ok(await endInput.inputValue(), 'ISO endsAt must remain visible in datetime-local editor');
    assert.ok(new Date(times.startsAt).getTime() - new Date(await startInput.inputValue()).getTime() < 60_000);
    assert.ok(new Date(times.endsAt).getTime() - new Date(await endInput.inputValue()).getTime() < 60_000);
    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      if (width <= 800) await expect.poll(async () => page.locator('.admin-sidebar').evaluate(node => node.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
      await startInput.scrollIntoViewIfNeeded();
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, `period editor page overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `00-period-editor-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await active(page).getByLabel('소개', { exact: true }).fill('저장하지 않은 운영자 초안'); await page.reload(); await menu(page, '노출·추천'); await tab(page, '노출 설정');
    await expect(active(page).getByLabel('소개', { exact: true })).toHaveValue('저장하지 않은 운영자 초안');
    const unchanged = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)).ops.exposures[0], key);
    assert.equal(unchanged.startsAt, times.startsAt); assert.equal(unchanged.endsAt, times.endsAt);
    record('ISO publication periods are visible in the local minute picker, unchanged instants stay intact and unfinished draft survives reload');
    await tab(page, '고객 화면 미리보기'); await select(page, '미리보기 채널', '홈 인기 장소');
    await expect(active(page).locator('.admin-preview h3')).toHaveText('기간 검수 장소');
    const expiresAt = await page.evaluate(async storageKey => {
      const { createLocalAdminAdapter } = await import('/src/admin/repository.ts'), { makeAdminSeed } = await import('/src/admin/seed.ts');
      const adapter = createLocalAdminAdapter(localStorage, makeAdminSeed), state = await adapter.load(), entry = state.ops.exposures[0], { revision, ...payload } = entry;
      payload.endsAt = new Date(Date.now() + 1800).toISOString();
      const result = await adapter.execute({ kind: 'ops.exposure.save', payload, entityRevision: revision, expectedRevision: state.revision, idempotencyKey: crypto.randomUUID() }, { operatorId: 'operator-admin', name: '검수 관리자', role: 'ADMIN' });
      // A disposable second tab will notify the admin through the browser storage event.
      return { at: payload.endsAt, state: result.state, storageKey };
    }, key);
    const sender = await context.newPage(); await sender.goto(base + '/');
    await sender.evaluate(({ state, storageKey }) => { localStorage.setItem(storageKey, JSON.stringify(state)); }, expiresAt); await sender.close();
    await expect(active(page).locator('.admin-preview')).toHaveCount(0, { timeout: 6000 });
    await expect(active(page).getByText('현재 노출 가능한 항목이 없습니다.', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, '01-expired-preview.png') });
    record('admin customer preview removes a period-ended main place without interaction or reload');
    await tab(page, '인기 자료·메인 게시');
    await expect(active(page).locator('tbody tr').filter({ hasText: '협재해수욕장' })).toContainText('기간 종료');
    await page.screenshot({ path: path.join(output, '02-popular-period-state.png') });
    record('popular main status matches the current exposure period');
    await page.evaluate(async storageKey => {
      const { createLocalAdminAdapter } = await import('/src/admin/repository.ts'), { makeAdminSeed } = await import('/src/admin/seed.ts');
      const adapter = createLocalAdminAdapter(localStorage, makeAdminSeed), state = await adapter.load(), entry = state.ops.exposures[0], { revision, ...payload } = entry;
      payload.startsAt = new Date(Date.now() + 3000).toISOString(); payload.endsAt = '';
      await adapter.execute({ kind: 'ops.exposure.save', payload, entityRevision: revision, expectedRevision: state.revision, idempotencyKey: crypto.randomUUID() }, { operatorId: 'operator-admin', name: '검수 관리자', role: 'ADMIN' });
    }, key);
    await page.reload(); await menu(page, '노출·추천'); await tab(page, '인기 자료·메인 게시');
    const rankedPlace = active(page).locator('tbody tr').filter({ hasText: '협재해수욕장' });
    await expect(rankedPlace).toContainText('게시 예약'); await expect(rankedPlace).toContainText('메인 게시 중', { timeout: 6000 });
    record('popular main status changes from scheduled to posted at its start without interaction');
    await menu(page, '회원·문의'); await tab(page, '문의 처리');
    await active(page).getByLabel('답변 기록', { exact: true }).fill('다른 운영자 수정 중에도 보존할 답변');
    await page.evaluate(async storageKey => {
      const { createLocalAdminAdapter } = await import('/src/admin/repository.ts'), { makeAdminSeed } = await import('/src/admin/seed.ts');
      const adapter = createLocalAdminAdapter(localStorage, makeAdminSeed), state = await adapter.load(), inquiry = state.ops.inquiries[0];
      await adapter.execute({ kind: 'ops.inquiry.save', inquiryId: inquiry.inquiryId, status: 'IN_PROGRESS', assigneeId: 'operator-admin', reply: '다른 운영자가 먼저 저장한 답변', entityRevision: inquiry.revision, expectedRevision: state.revision, idempotencyKey: crypto.randomUUID() }, { operatorId: 'operator-admin', name: '검수 관리자', role: 'ADMIN' });
    }, key);
    await page.reload(); await menu(page, '회원·문의'); await tab(page, '문의 처리');
    await expect(active(page).getByLabel('답변 기록', { exact: true })).toHaveValue('다른 운영자 수정 중에도 보존할 답변');
    await expect(active(page).getByText(/저장된 내용의 버전이 변경되었습니다/)).toBeVisible();
    await active(page).getByRole('button', { name: '문의 처리 기록 저장', exact: true }).click();
    await expect(page.getByText(/다른 운영자가 변경한 자료입니다/)).toBeVisible();
    let state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
    assert.equal(state.ops.inquiries[0].replyRecords.length, 1); await page.screenshot({ path: path.join(output, '03-inquiry-conflict-preserves-draft.png') });
    record('inquiry conflict preserves the old reply draft and rejects overwriting newer answer history');
    await menu(page, 'AI·검색 운영'); await tab(page, '실행 정책');
    const originalPolicyId = state.ai.activePolicyId;
    await active(page).getByLabel('정책 이름', { exact: true }).fill('외부 한도 오류 검수');
    await active(page).getByRole('checkbox', { name: '근거가 충분한 소형 모델 실패에 외부 보완 허용', exact: true }).check();
    await active(page).getByLabel('시간 제한 · ms', { exact: true }).fill(''); await active(page).getByLabel('요청 외부 비용 상한 · 원', { exact: true }).fill('');
    await active(page).getByRole('button', { name: '새 정책 초안 저장', exact: true }).click();
    await active(page).getByRole('button', { name: /v2 · 외부 한도 오류 검수/ }).click();
    await active(page).getByRole('button', { name: '규칙 검증', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
    assert.equal(state.ai.activePolicyId, originalPolicyId); assert.equal(state.ai.policies.find(policy => policy.label === '외부 한도 오류 검수').state, 'DRAFT');
    await expect(active(page).getByRole('button', { name: '검수 정책 적용', exact: true })).toHaveCount(0);
    record('external policy without time/cost limits stays a draft and does not replace the active policy');
    await active(page).getByLabel('시간 제한 · ms', { exact: true }).fill('30000'); await active(page).getByLabel('요청 외부 비용 상한 · 원', { exact: true }).fill('100');
    await active(page).getByRole('button', { name: '초안 저장', exact: true }).click(); await active(page).getByRole('button', { name: '규칙 검증', exact: true }).click();
    await active(page).getByRole('button', { name: '검수 정책 적용', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key); assert.notEqual(state.ai.activePolicyId, originalPolicyId);
    await active(page).getByRole('button', { name: /v1 · 소형 LLM 우선/ }).click(); await active(page).getByRole('button', { name: '이전 정책 복구', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key); assert.equal(state.ai.activePolicyId, originalPolicyId);
    record('saved/tested policy activates explicitly and previous policy rollback restores the prior version');
    await page.getByRole('combobox', { name: '역할 전환', exact: true }).click(); await page.getByRole('option', { name: '운영자', exact: true }).click();
    await expect(active(page).getByLabel('정책 이름', { exact: true })).toBeDisabled(); await expect(active(page).getByRole('button', { name: '새 정책 초안 저장', exact: true })).toBeDisabled();
    record('operator role cannot edit or activate AI execution policy');
    await page.getByRole('combobox', { name: '역할 전환', exact: true }).click(); await page.getByRole('option', { name: '최고관리자', exact: true }).click();
    await tab(page, '색인 작업'); await active(page).getByRole('button', { name: '전체 재구성 대기', exact: true }).click();
    await active(page).getByRole('button', { name: '실패 시나리오', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key); const originalIndexId = state.ai.activeIndexId;
    assert.equal(state.ai.jobs[0].state, 'FAILED');
    await active(page).getByRole('button', { name: '현재 자료로 재시도', exact: true }).click(); await active(page).getByRole('button', { name: '실행 시작', exact: true }).click();
    await active(page).getByRole('button', { name: '실행 완료 단계', exact: true }).click(); await active(page).getByRole('button', { name: '자료·사용권 검증', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key); assert.equal(state.ai.activeIndexId, originalIndexId);
    await active(page).getByRole('button', { name: '적용', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key); assert.notEqual(state.ai.activeIndexId, originalIndexId);
    await active(page).getByRole('button', { name: '이전 버전 복구', exact: true }).click();
    state = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key); assert.equal(state.ai.activeIndexId, originalIndexId);
    await page.screenshot({ path: path.join(output, '04-index-failure-retry-rollback.png') });
    record('index failure/retry/validation keeps the active version until explicit apply and rollback restores it');
    assert.equal(await page.evaluate(() => localStorage.getItem('ops-private-sentinel')), 'customer private data stays untouched');
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors, generatedAt: new Date().toISOString() }, null, 2)); await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack, checks, errors }, null, 2)); console.error(error); process.exitCode = 1; });
