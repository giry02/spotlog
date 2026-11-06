/* Local isolated browser regression; never uses an existing customer/admin browser profile. */
const { chromium, expect } = require(process.env.SPOTLOG_PLAYWRIGHT || 'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.SPOTLOG_ADMIN_URL || 'http://127.0.0.1:5210';
const output = process.env.SPOTLOG_OPS_QA_DIR || path.resolve(__dirname, '../../artifacts/admin-ops-popularity-20261009');
const storageKey = 'spotlog.admin.review.v1', checks = [], errors = [];
const active = page => page.locator('.admin-page-body:not([hidden])');
const snapshot = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const record = name => { checks.push(name); console.log('PASS', name); };
async function menu(page, name) {
  const open = page.getByRole('button', { name: '관리자 메뉴 열기', exact: true }); if (await open.isVisible()) await open.click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}
async function select(page, label, option) {
  const input = active(page).getByRole('combobox', { name: label, exact: true }); await input.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function main() {
  fs.mkdirSync(output, { recursive: true }); const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin.html'); await expect(page.getByRole('heading', { name: '오늘의 운영 작업' })).toBeVisible();
    await page.evaluate(() => localStorage.setItem('ops-private-sentinel', 'private itinerary remains untouched'));
    await page.evaluate(key => { const state = JSON.parse(localStorage.getItem(key)); for (const id of ['jeju-hyeopjae', 'gangneung-anmok']) { const record = state.places.find(item => item.placeId === id), content = structuredClone(record.draft); content.operation = 'OPEN'; content.rights.display = true; content.rights.store = true; content.location.verified = true; for (const media of content.media) { media.rights.display = true; media.rights.store = true; } record.published = content; record.state = 'PUBLISHED'; record.revision++; } state.revision++; localStorage.setItem(key, JSON.stringify(state)); }, storageKey);
    await page.reload(); await expect(page.getByRole('heading', { name: '오늘의 운영 작업' })).toBeVisible();
    await menu(page, '노출·추천'); await active(page).getByRole('tab', { name: '인기 자료·메인 게시', exact: true }).click();
    await expect(active(page).getByText(/예시 집계/)).toBeVisible();
    const synthetic = active(page).locator('tbody tr').filter({ hasText: '검수용 바다 전망대' });
    await expect(synthetic.getByRole('button', { name: '메인에 게시', exact: true })).toBeDisabled(); await expect(synthetic).toContainText('가상 장소는 고객 홈에 게시할 수 없습니다.');
    const landmark = active(page).locator('tbody tr').filter({ hasText: '협재해수욕장' });
    await expect(landmark).toContainText('384'); await landmark.getByRole('button', { name: '메인에 게시', exact: true }).click();
    await expect(landmark.getByRole('button', { name: '메인 게시 중', exact: true })).toBeDisabled();
    let saved = await snapshot(page); assert.equal(saved.ops.exposures.filter(entry => entry.channel === 'HOME_PLACE' && entry.targetId === 'jeju-hyeopjae').length, 1);
    await page.screenshot({ path: path.join(output, '01-popular-landmark-main.png') });
    record('sample popularity is read-only, synthetic home publication is blocked and a checked catalog place creates one HOME_PLACE exposure');
    if (process.env.SPOTLOG_OPS_CAPTURE_ONLY === '1') { await context.close(); return; }
    const consumer = await context.newPage(); consumer.on('pageerror', error => errors.push(error.message)); await consumer.goto(base + '/#home');
    const homeSection = consumer.getByRole('region', { name: '메인 추천 장소', exact: true }), homeCard = homeSection.locator('[data-place-id="jeju-hyeopjae"]');
    await expect(homeCard).toHaveCount(1); await expect(homeSection.locator('[data-place-id^="review-"]')).toHaveCount(0);
    for (const width of [320, 390, 460]) {
      await consumer.setViewportSize({ width, height: 844 }); await homeSection.scrollIntoViewIfNeeded();
      const dimensions = await consumer.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })); assert.ok(dimensions.scroll <= dimensions.width + 1, `HOME_PLACE overflow at ${width}`);
      await consumer.screenshot({ path: path.join(output, `03-home-place-${width}.png`) });
    }
    record('checked main place appears in the actual customer Home at 320/390/460px without page overflow');
    const setPeriod = phase => consumer.evaluate(async action => {
      const { createLocalAdminAdapter } = await import('/src/admin/repository.ts'), { makeAdminSeed } = await import('/src/admin/seed.ts');
      const adapter = createLocalAdminAdapter(localStorage, makeAdminSeed), state = await adapter.load(), entry = state.ops.exposures.find(item => item.channel === 'HOME_PLACE' && item.targetId === 'jeju-hyeopjae'), { revision, ...payload } = entry;
      payload.startsAt = action === 'start' ? new Date(Date.now() + 400).toISOString() : ''; payload.endsAt = action === 'end' ? new Date(Date.now() + 400).toISOString() : '';
      await adapter.execute({ kind: 'ops.exposure.save', payload, entityRevision: revision, expectedRevision: state.revision, idempotencyKey: crypto.randomUUID() }, { operatorId: 'operator-admin', name: '브라우저 검수 관리자', role: 'ADMIN' });
    }, phase);
    await setPeriod('end');
    await expect(homeCard).toHaveCount(0, { timeout: 5000 });
    await setPeriod('start');
    await expect(homeCard).toHaveCount(1, { timeout: 5000 }); await consumer.close();
    record('Home main-place period expires and starts automatically without a page reload');
    await active(page).getByRole('tab', { name: '인기 여행기', exact: true }).click();
    const topJournal = active(page).locator('tbody tr').first(), topTitle = await topJournal.locator('strong').innerText();
    await expect(active(page).getByText('예시 집계',{exact:true})).toBeVisible(); await topJournal.getByRole('button', { name: '메인에 게시', exact: true }).click();
    await expect(topJournal.getByRole('button', { name: '메인 게시 중', exact: true })).toBeDisabled();
    saved = await snapshot(page); assert.equal(saved.ops.exposures.filter(entry => entry.channel === 'HOME_JOURNAL' && entry.title === topTitle).length, 1);
    record('popular public journal can be posted to main and already-posted state prevents duplicate click');
    const fixtureEntries = [
      { title: 'visible A', targetId: 'jeju-hyeopjae', coverMediaId: saved.places.find(item => item.placeId === 'jeju-hyeopjae').published.media.find(item => item.type === 'PHOTO').mediaId },
      { title: 'hidden middle', targetId: 'gangneung-anmok', coverMediaId: saved.places.find(item => item.placeId === 'gangneung-anmok').published.media.find(item => item.type === 'PHOTO').mediaId },
      { title: 'visible B', targetId: 'gangneung-anmok', coverMediaId: saved.places.find(item => item.placeId === 'gangneung-anmok').published.media.find(item => item.type === 'PHOTO').mediaId },
    ].map((entry, order) => ({ ...entry, exposureId: `order-${order}`, revision: 1, channel: 'HOME_PLACE', introduction: '', startsAt: '', endsAt: '', enabled: true, order }));
    await page.evaluate(({ key, entries }) => { const state = JSON.parse(localStorage.getItem(key)); state.ops.exposures = entries; state.revision++; localStorage.setItem(key, JSON.stringify(state)); }, { key: storageKey, entries: fixtureEntries });
    await page.reload(); await menu(page, '노출·추천'); await active(page).getByRole('tab', { name: '노출 설정', exact: true }).click(); await select(page, '노출 채널', '홈 인기 장소');
    await active(page).getByRole('searchbox', { name: '제목·대상 ID 검색', exact: true }).fill('visible');
    await expect(active(page).getByText(/검색 중에는 노출 순서를 변경/)).toBeVisible();
    for (const button of await active(page).getByRole('button', { name: /visible .* 이동/ }).all()) await expect(button).toBeDisabled();
    await active(page).getByRole('button', { name: '검색 초기화', exact: true }).click(); await active(page).getByRole('button', { name: 'visible A 아래로 이동', exact: true }).click();
    saved = await snapshot(page); assert.equal(saved.ops.exposures.find(entry => entry.title === 'visible A').order, 1);
    record('filtered exposure order cannot move a hidden neighbor; clearing search restores channel reorder');
    await menu(page, '여행기·커뮤니티'); await active(page).getByRole('tab', { name: '신고·이의', exact: true }).click();
    await active(page).getByLabel('신고 처리 사유', { exact: true }).fill('검수한 신고 처리 근거'); await active(page).getByRole('button', { name: '처리 완료 기록', exact: true }).click();
    const history = active(page).getByRole('heading', { name: '관련 조치 이력', exact: true }).locator('..');
    await expect(history).toContainText('ops.report.resolve'); await expect(history).toContainText('검수한 신고 처리 근거');
    record('report detail shows the report resolution actor, reason and action history');
    await menu(page, '회원·문의'); await active(page).getByRole('tab', { name: '회원·삭제 요청', exact: true }).click();
    await active(page).getByRole('button', { name: /검수 회원 B/ }).click(); await active(page).getByRole('combobox', { name: '삭제 요청 처리 상태', exact: true }).click();
    await expect(page.getByRole('option', { name: '삭제 처리 대기', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('option', { name: '확인 중', exact: true }).click(); await active(page).getByLabel('조치 사유', { exact: true }).fill('삭제 요청 확인 시작');
    await active(page).getByRole('button', { name: '요청 상태 기록', exact: true }).click();
    await select(page, '삭제 요청 처리 상태', '삭제 처리 대기'); await active(page).getByLabel('조치 사유', { exact: true }).fill('본인 요청 확인 완료');
    await active(page).getByRole('button', { name: '요청 상태 기록', exact: true }).click();
    saved = await snapshot(page); assert.equal(saved.ops.members[1].deletionRequest.status, 'READY'); assert.equal(saved.ops.members[1].state, 'ACTIVE');
    record('deletion workflow only selects valid next steps and never marks account deletion complete');
    await menu(page, '운영 설정·이력'); await active(page).getByRole('tab', { name: '변경·조치 이력', exact: true }).click();
    await active(page).getByRole('searchbox', { name: '운영자·대상·동작·사유 검색', exact: true }).fill('does-not-exist');
    await expect(active(page).getByText('검색 결과가 없습니다.', { exact: true })).toBeVisible();
    await active(page).getByRole('button', { name: '검색 초기화', exact: true }).click();
    const widths = await active(page).locator('.admin-table-audit th').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().width)));
    assert.equal(widths.length, 4); assert.ok(widths[3] > widths[2]);
    await page.screenshot({ path: path.join(output, '02-audit-balanced-columns.png') });
    record('audit search has an empty state and reason column gets adequate width');
    const apiContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), apiPage = await apiContext.newPage(); apiPage.on('pageerror', error => errors.push(error.message));
    const apiState = structuredClone(saved);
    await apiPage.route('**/api/admin/v1/**', async route => { const pathname = new URL(route.request().url()).pathname; const body = pathname.endsWith('/me') ? { operatorId: 'api-admin', name: 'API 검수 관리자', role: 'ADMIN' } : pathname.endsWith('/snapshot') ? apiState : null; await route.fulfill({ status: body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(body || {}) }); });
    await apiPage.goto(base + '/admin.html?mode=api'); await expect(apiPage.getByRole('heading', { name: '오늘의 운영 작업' })).toBeVisible(); await menu(apiPage, '노출·추천'); await active(apiPage).getByRole('tab', { name: '인기 자료·메인 게시', exact: true }).click();
    await expect(active(apiPage).getByText(/실제 인기 집계 연결 대기/)).toBeVisible(); await expect(active(apiPage).locator('tbody tr')).toHaveCount(0);
    apiState.ops.popularity = { basis: 'SAVES', source: 'SERVER', observedAt: new Date().toISOString(), items: [{ targetType: 'PLACE', targetId: 'jeju-hyeopjae', saveCount: 8 }, { targetType: 'PLACE', targetId: 'gangneung-anmok', saveCount: 21 }] };
    await apiPage.reload(); await menu(apiPage, '노출·추천'); await active(apiPage).getByRole('tab', { name: '인기 자료·메인 게시', exact: true }).click();
    await expect(active(apiPage).locator('tbody tr').first()).toContainText('안목해변'); await expect(active(apiPage).getByText(/서버 저장 수 집계/)).toBeVisible();
    record('API popularity stays empty with sample/no server aggregate and accepts server read-only saves ranking');
    assert.equal(await page.evaluate(() => localStorage.getItem('ops-private-sentinel')), 'private itinerary remains untouched'); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, generatedAt: new Date().toISOString(), checks, widths, errors }, null, 2));
    console.log('ADMIN_OPERATIONS_BROWSER_CHECKS', checks.length); await apiContext.close(); await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack, checks, errors }, null, 2)); console.error(error); process.exitCode = 1; });
