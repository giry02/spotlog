/* Oct12 local customer review. Disposable browser contexts only; no user records or live service writes. */
const { chromium, expect } = require(process.env.SPOTLOG_PLAYWRIGHT || 'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.SPOTLOG_APP_URL || 'http://127.0.0.1:5210';
const output = process.env.SPOTLOG_APP_QA_DIR || path.resolve(__dirname, '../../artifacts/app-improvements-20261012/qa');
const repositoryKey = 'spotlog.local.repository.v2', journeysKey = 'spotlog.web.journeys.v4';
const results = { date: '2026-10-12', checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
function write() { fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
function record(width, name, detail) { results.checks.push({ width, name, detail: detail || 'pass' }); write(); console.log('PASS', width, name); }
async function clean(page) {
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'document overflow');
  assert.ok(await page.getByRole('dialog').count() <= 1, 'stacked dialogs');
  const broken = await page.locator('img').evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect(); return box.width && box.height && box.top < innerHeight && box.bottom > 0 && node.complete && !node.naturalWidth;
  }).map(node => node.currentSrc));
  assert.deepEqual(broken, [], 'unhandled visible failed image');
}
async function shot(page, width, name) { await clean(page); await page.screenshot({ path: path.join(output, `${width}-${name}.png`), animations: 'disabled' }); }
async function snapshot(page) { return page.evaluate(({ repositoryKey, journeysKey }) => JSON.parse(JSON.parse(localStorage.getItem(repositoryKey)).records[journeysKey]), { repositoryKey, journeysKey }); }
async function fixture(page, mode, member = false) {
  await page.goto(base + '/#home');
  const state = await page.evaluate(async ({ mode, member, journeysKey, repositoryKey }) => {
    const { placeCatalog } = await import('/src/data.ts');
    const { normalizePlan, buildPersonalPlan, copyPersonalPlan } = await import('/src/tripPlan.ts');
    const landmark = placeCatalog.find(place => place.id === 'busan-haeundae') || placeCatalog.find(place => place.kind === 'LANDMARK' && place.area.startsWith('부산'));
    const food = placeCatalog.find(place => place.id === 'busan-amso');
    const stay = placeCatalog.find(place => place.id === 'busan-signiel');
    const second = placeCatalog.find(place => place.id === 'busan-gamcheon');
    let trip = buildPersonalPlan([landmark], 3, '앱 사용 흐름 검수', '기기 여행자');
    trip.id = 'trip-app-qa'; trip.planStage = 'READY'; trip.status = 'TRAVELING';
    trip.days = [
      { day: 1, dayId: 'qa-day-1', date: 'DAY 1', title: '첫날', story: '공개되면 안 되는 첫날 메모', places: [
        { ...landmark, visitId: 'qa-v-1', note: '개인 장소 메모', time: '09:00', move: '개인 이동 메모' },
        { ...food, visitId: 'qa-v-2', anchorVisitId: 'qa-v-1', planningSlot: 'lunch', note: '식사 예약 메모', time: '12:00' },
        { ...stay, visitId: 'qa-v-3', bookingFixed: true, stayDayIds: ['qa-day-1'], note: '예약 번호 비공개 메모' }
      ], blocks: [] },
      { day: 2, dayId: 'qa-day-2', date: 'DAY 2', title: '둘째날', story: '공개되면 안 되는 둘째날 메모', places: [
        { ...landmark, visitId: 'qa-v-4', note: '같은 장소의 다른 방문 메모' },
        { ...food, visitId: 'qa-v-5', anchorVisitId: 'qa-v-4', planningSlot: 'dinner', note: '' }
      ], blocks: [] },
      { day: 3, dayId: 'qa-day-3', date: 'DAY 3', title: '마지막날', story: '', places: [{ ...second, visitId: 'qa-v-6', note: '' }], blocks: [] }
    ];
    trip.days.forEach(day => { day.blocks = day.places.map(place => ({ id: 'block-' + place.visitId, type: 'PLACE', placeId: place.id, visitId: place.visitId })); });
    trip.days[0].blocks.push({ id: 'private-block', type: 'TEXT', body: '공개되면 안 되는 예약 메모' });
    const progress = { dayId: 'qa-day-2', visitId: 'qa-v-5', visits: { 'qa-v-1': { status: 'done', recordedAt: '2026-10-12T01:00:00Z' }, 'qa-v-2': { status: 'skipped', recordedAt: '2026-10-12T01:01:00Z' }, 'qa-v-3': { status: 'done', recordedAt: '2026-10-12T01:02:00Z' }, 'qa-v-4': { status: 'skipped', recordedAt: '2026-10-12T01:03:00Z' } } };
    if (mode === 'next-day') { progress.dayId = 'qa-day-1'; delete progress.visitId; delete progress.visits['qa-v-4']; }
    if (mode === 'all') { progress.dayId = 'qa-day-3'; delete progress.visitId; trip.days.flatMap(day => day.places).forEach(place => { progress.visits[place.visitId] = { status: 'done', recordedAt: '2026-10-12T01:00:00Z' }; }); }
    if (mode === 'skipped') { progress.dayId = 'qa-day-3'; delete progress.visitId; trip.days.flatMap(day => day.places).forEach(place => { progress.visits[place.visitId] = { status: 'skipped', recordedAt: '2026-10-12T01:00:00Z' }; }); }
    if (mode === 'late-visited') { progress.dayId = 'qa-day-3'; delete progress.visitId; progress.visits = { 'qa-v-6': { status: 'done', recordedAt: '2026-10-12T01:00:00Z' } }; }
    if (!['no-progress', 'candidate', 'blank'].includes(mode)) trip.travelProgress = progress;
    if (mode === 'blank') trip.days = trip.days.map(day => ({ ...day, places: [], blocks: [] }));
    if (mode === 'candidate') {
      trip.planStage = 'DRAFT';
      const otherFood = placeCatalog.find(place => place.kind === 'FOOD' && place.area.startsWith('부산') && place.id !== food.id);
      trip.businessCandidates = [{ id: 'qa-candidate-food', dayId: 'qa-day-1', anchorVisitId: 'qa-v-1', kind: 'FOOD', slot: 'lunch', options: [
        { place: { ...otherFood, note: '', tags: ['바다 전망', '등록 특징 검수'], description: '등록된 소개를 비교하는 격리 검수 자료' }, fixed: false },
        { place: { ...food, id: 'qa-unverified-food', name: '위치 확인 전 식당 검수', note: '', locationVerified: false, image: '', tags: [], description: '', hook: '' }, fixed: false },
        { place: { ...food, id: 'qa-failed-food', name: '사진 실패 식당 검수', note: '', image: '/qa-failed-photo.png', tags: [] }, fixed: false }
      ] }];
    }
    trip = normalizePlan(trip);
    let journeys = mode === 'empty' ? [] : [trip], alternativeId;
    if (mode.startsWith('recent')) {
      const alternative = copyPersonalPlan(trip, '기기 여행자'); alternative.title = '더 최근에 등록한 다른 여행'; alternativeId = alternative.id;
      if (mode === 'recent-trashed') trip.trash = { deletedAt: '2026-10-12T00:00:00Z', expiresAt: '2027-04-12T00:00:00Z', ownerId: 'local-profile', previousVisibility: 'PRIVATE', previousStatus: 'TRAVELING' };
      journeys = [alternative, trip];
    }
    localStorage.removeItem(repositoryKey);
    localStorage.removeItem('spotlog.local.before-migration.v2');
    localStorage.removeItem('spotlog.web.recent-trip.v1');
    if (mode.startsWith('recent')) localStorage.setItem('spotlog.web.recent-trip.v1', JSON.stringify(trip.id));
    localStorage.setItem(journeysKey, JSON.stringify(journeys));
    localStorage.setItem('spotlog-admin-preservation-sentinel', 'untouched administrator record');
    if (member) sessionStorage.setItem('spotlog.review.account.session.v1', 'signed'); else sessionStorage.removeItem('spotlog.review.account.session.v1');
    return { trip, alternativeId, foodName: food.name, landmarkName: landmark.name, secondName: second.name };
  }, { mode, member, journeysKey, repositoryKey });
  await page.reload(); await page.locator('.app-shell').waitFor(); return state;
}
async function closeSheet(page) { await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).first().click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect.poll(() => page.evaluate(() => !history.state?.spotlogSheet)).toBe(true); }
async function candidateFlows(page, width) {
  await fixture(page, 'candidate');
  await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  await page.getByRole('button', { name: '마지막 확인', exact: true }).click();
  const review = page.locator('.trip-candidate-review');
  await expect(review).toBeVisible();
  await expect(review.locator('.candidate-distance-basis')).toContainText('직선거리');
  await expect(review.locator('.candidate-distance').first()).toContainText('직선');
  await expect(review.getByText('등록된 소개를 비교하는 격리 검수 자료', { exact: true })).toBeVisible();
  await expect(review.getByText('사진 없음', { exact: true }).first()).toBeVisible();
  await expect(review.getByText('사진 미표시', { exact: true })).toBeVisible();
  await expect(review.locator('.candidate-place-copy').filter({ hasText: '위치 확인 전 식당 검수' })).toContainText('위치');
  await shot(page, width, 'candidate-comparison');
  await review.locator('input[value="qa-unverified-food"]').check();
  await closeSheet(page); await page.reload();
  await page.getByRole('button', { name: '마지막 확인', exact: true }).click();
  await expect(review.locator('input[value="qa-unverified-food"]')).toBeChecked();
  await review.getByRole('button', { name: '내 여행 완성', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const final = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  assert.equal(final.planStage, 'READY'); assert.equal(final.businessCandidates?.length || 0, 0);
  assert.equal(final.days[0].places.filter(place => place.kind === 'FOOD').length, 1);
  assert.equal(final.days[0].places.find(place => place.kind === 'FOOD').id, 'qa-unverified-food');
  assert.equal(final.days[0].places.find(place => place.kind === 'STAY').bookingFixed, true);
  assert.equal(final.days[0].places.find(place => place.kind === 'STAY').note, '예약 번호 비공개 메모');
  record(width, 'candidate photo/straight distance/features/fallback, reload selection, one final visit and fixed-stay preservation');
}
async function continuationFlows(page, width) {
  await fixture(page, 'empty');
  await expect(page.locator('.home-resume-trip')).toHaveCount(0); await clean(page);
  record(width, 'empty guest home has no fictitious personal trip');
  const data = await fixture(page, 'cursor');
  const card = page.locator('.home-resume-trip');
  await expect(card).toContainText('이 기기에 저장한 내 여행');
  await expect(card).toContainText(`DAY 2 · 다음 방문: ${data.foodName}`);
  await shot(page, width, 'home-resume');
  const touch = await card.boundingBox(); assert.ok(touch.height >= 44);
  await page.getByRole('button', { name: '내 여행 이어가기', exact: true }).click();
  await expect(page.locator('.day-tabs [data-day="2"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#plan-visit-qa-v-5')).toHaveClass(/plan-stop-selected/);
  await page.reload();
  await expect(page.locator('.day-tabs [data-day="2"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#plan-visit-qa-v-5')).toHaveClass(/plan-stop-selected/);
  await shot(page, width, 'resume-day-2');
  await page.goto(base + '/#home'); await expect(card).toContainText(`DAY 2 · 다음 방문: ${data.foodName}`);
  record(width, 'one-action remembered DAY/visit continuation survives reload and home return');
  await fixture(page, 'next-day');
  await expect(card).toContainText(`DAY 2 · 다음 방문: ${data.landmarkName}`);
  await card.click();
  await expect(page.locator('.day-tabs [data-day="2"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#plan-visit-qa-v-4')).toHaveClass(/plan-stop-selected/);
  const trip = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  assert.equal(trip.travelProgress.dayId, 'qa-day-2'); assert.equal(trip.travelProgress.visitId, 'qa-v-4');
  assert.equal(trip.travelProgress.visits['qa-v-1'].status, 'done'); assert.equal(trip.travelProgress.visits['qa-v-4'], undefined);
  record(width, 'finished previous DAY opens next pending DAY and repeated place uses distinct visit IDs');
  await fixture(page, 'all');
  await expect(page.getByRole('button', { name: '내 여행 보기', exact: true })).toBeVisible();
  await expect(card).not.toContainText('다음 방문');
  await card.click(); await expect(page.locator('.day-tabs [data-day="3"]')).toHaveAttribute('aria-current', 'page');
  record(width, 'all completed trip offers viewing and preserves last DAY');
  await fixture(page, 'blank');
  await expect(card).toContainText('장소를 채워보세요'); await card.click(); await clean(page);
  await expect(page.locator('.personal-trip .empty')).toBeVisible();
  record(width, 'empty itinerary continuation opens existing place-add empty state');
  await fixture(page, 'candidate');
  await expect(card).toContainText('후보 마지막 확인이 남았어요');
  await card.click();
  const draft = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  assert.equal(draft.planStage, 'DRAFT'); assert.equal(draft.businessCandidates.length, 1);
  await expect(page.getByRole('button', { name: '마지막 확인', exact: true })).toBeVisible();
  record(width, 'continuation never approves unresolved candidates');
  const recent = await fixture(page, 'recent');
  await expect(card).toContainText('앱 사용 흐름 검수');
  await page.goto(base + '/#journey-' + recent.alternativeId); await page.locator('.personal-trip').waitFor();
  await page.goto(base + '/#home'); await expect(card).toContainText('더 최근에 등록한 다른 여행');
  await page.reload(); await expect(card).toContainText('더 최근에 등록한 다른 여행');
  await page.goto(base + '/#journey-jeju-west-slow'); await page.locator('.journey-detail').waitFor();
  await page.goto(base + '/#home'); await expect(card).toContainText('더 최근에 등록한 다른 여행');
  const backup = await page.evaluate(async () => { const { createLocalRepository } = await import('/src/localRepository.ts'); return JSON.parse(createLocalRepository(localStorage).exportBackup()); });
  assert.equal(JSON.parse(backup.records['spotlog.web.recent-trip.v1']), recent.alternativeId);
  record(width, 'last opened private trip survives reload/backup and public journal browsing does not replace it');
  await fixture(page, 'recent-trashed'); await expect(card).toContainText('더 최근에 등록한 다른 여행');
  assert.equal(await page.locator('.home-resume-trip').count(), 1);
  record(width, 'trashed recent-trip ID safely falls back to surviving private itinerary');
}
function checkJournal(journal, source, expectedCount) {
  assert.equal(journal.purpose, 'JOURNAL'); assert.equal(journal.visibility, 'PRIVATE'); assert.equal(journal.sourceTripId, source.id);
  assert.notEqual(journal.id, source.id); assert.equal(journal.travelProgress, undefined); assert.equal(journal.businessCandidates, undefined);
  assert.equal(journal.planningPreferences, undefined); assert.equal(journal.days.length, 3); assert.equal(journal.duration, source.duration);
  assert.equal(journal.days.reduce((count, day) => count + day.places.length, 0), expectedCount);
  for (const day of journal.days) {
    assert.equal(day.story, '');
    for (const place of day.places) { assert.equal(place.note, ''); assert.equal(place.bookingFixed, undefined); assert.equal(place.stayDayIds, undefined); assert.equal(place.time, undefined); assert.equal(place.move, undefined); }
    assert.ok(day.blocks.every(block => block.type === 'PLACE' && !block.body));
  }
  const originalIds = new Set(source.days.flatMap(day => day.places).map(place => place.visitId));
  assert.ok(journal.days.flatMap(day => day.places).every(place => !originalIds.has(place.visitId)));
}
async function journalFlows(page, width) {
  await fixture(page, 'cursor');
  await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  const before = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  await page.locator('.plan-journal-link').click();
  await expect(page.locator('.journey-editor')).toBeVisible();
  let records = await snapshot(page), source = records.find(journey => journey.id === 'trip-app-qa'), journal = records.find(journey => journey.purpose === 'JOURNAL' && journey.sourceTripId === source.id);
  checkJournal(journal, source, 2); assert.deepEqual(source, before);
  assert.equal(journal.days[0].places.some(place => place.kind === 'FOOD'), false);
  assert.equal(journal.days[1].places.length, 0); assert.equal(journal.days[2].places.length, 0);
  await shot(page, width, 'journal-visited-only');
  await page.reload(); await expect(page.locator('.journey-editor')).toBeVisible();
  records = await snapshot(page); assert.deepEqual(records.find(journey => journey.id === source.id), before);
  record(width, 'one-action journal includes only visited stops, preserves DAY dates, strips private data and leaves original trip unchanged');
  await fixture(page, 'cursor');
  await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  const inclusiveSource = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  await page.getByRole('button', { name: '여행 메뉴', exact: true }).click();
  await expect(page.getByLabel('예정 장소도 포함', { exact: true })).not.toBeChecked();
  await page.getByLabel('예정 장소도 포함', { exact: true }).check(); await shot(page, width, 'journal-include-planned');
  const checkboxLayout = await page.locator('.plan-journal-option').evaluate(label => {
    const text = label.querySelector('span'), input = label.querySelector('input'), bounds = label.getBoundingClientRect(), t = text.getBoundingClientRect(), i = input.getBoundingClientRect();
    return { font: parseFloat(getComputedStyle(label).fontSize), height: bounds.height, horizontal: i.right <= t.left, aligned: Math.abs(i.top + i.height / 2 - t.top - t.height / 2) < 2 };
  });
  assert.equal(checkboxLayout.font, 14); assert.ok(checkboxLayout.height >= 44); assert.ok(checkboxLayout.horizontal && checkboxLayout.aligned, 'journal checkbox/label must form one aligned row');
  await page.getByRole('dialog').getByRole('button', { name: '예정 장소도 여행기에 담기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.journey-editor')).toBeVisible();
  records = await snapshot(page); journal = records.find(journey => journey.purpose === 'JOURNAL' && journey.sourceTripId === inclusiveSource.id);
  checkJournal(journal, inclusiveSource, 4); assert.deepEqual(records.find(journey => journey.id === inclusiveSource.id), inclusiveSource);
  assert.equal(journal.days[1].places.length, 1); assert.equal(journal.days[2].places.length, 1);
  record(width, 'existing trip menu optionally includes planned visits while excluding skipped visits and preserving original');
  await fixture(page, 'no-progress');
  await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  const plannedSource = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  await page.locator('.plan-journal-link').click(); await expect(page.locator('.journey-editor')).toBeVisible();
  records = await snapshot(page); journal = records.find(journey => journey.purpose === 'JOURNAL' && journey.sourceTripId === plannedSource.id);
  checkJournal(journal, plannedSource, 6); assert.deepEqual(records.find(journey => journey.id === plannedSource.id), plannedSource);
  record(width, 'legacy itinerary without visit marks retains planned non-skipped places as private journal draft');
  await fixture(page, 'skipped');
  await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  const skippedBefore = await snapshot(page); await page.locator('.plan-journal-link').click();
  await expect(page.locator('.journey-editor')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('여행기에 담을 장소가 없어요');
  assert.deepEqual(await snapshot(page), skippedBefore); await clean(page);
  record(width, 'all skipped visits do not generate an empty or falsely visited journal');
  const lateData = await fixture(page, 'late-visited');
  await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  const lateSource = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  await page.locator('.plan-journal-link').click(); await expect(page.locator('.journey-editor')).toBeVisible();
  await expect(page.locator('.journey-editor .day-tabs [data-day="3"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.editor-place-preview').first()).toContainText(lateData.secondName);
  records = await snapshot(page); journal = records.find(journey => journey.purpose === 'JOURNAL' && journey.sourceTripId === lateSource.id);
  checkJournal(journal, lateSource, 1); assert.equal(journal.days[0].places.length, 0); assert.equal(journal.days[1].places.length, 0);
  await page.locator('.journey-editor .day-tabs [data-day="3"]').scrollIntoViewIfNeeded(); await shot(page, width, 'journal-first-content-day-3');
  await page.locator('.journey-editor .day-tabs [data-day="1"]').click();
  await expect(page.locator('.journey-editor .day-tabs [data-day="1"]')).toHaveAttribute('aria-current', 'page');
  await page.reload(); await expect(page.locator('.journey-editor .day-tabs [data-day="1"]')).toHaveAttribute('aria-current', 'page');
  records = await snapshot(page); journal = records.find(journey => journey.purpose === 'JOURNAL' && journey.sourceTripId === lateSource.id);
  assert.equal(journal.editorDraft.selectedDay, 1); assert.deepEqual(records.find(journey => journey.id === lateSource.id), lateSource);
  record(width, 'visited DAY3 opens first content DAY without renumbering; later explicit empty DAY1 selection survives draft reload');
}
async function storageFailureFlows(page, width) {
  await fixture(page, 'all');
  const completedBefore = await snapshot(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'spotlog.local.repository.v2') throw new DOMException('isolated QA storage failure', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.getByRole('button', { name: '내 여행 보기', exact: true }).click();
  await expect(page.locator('.personal-trip')).toBeVisible();
  await expect(page.locator('.day-tabs [data-day="3"]')).toHaveAttribute('aria-current', 'page');
  assert.deepEqual(await snapshot(page), completedBefore);
  record(width, 'completed trip remains readable under full storage without changing visit history or last DAY');
  await fixture(page, 'cursor');
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'spotlog.local.repository.v2') throw new DOMException('isolated QA storage failure', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.getByRole('button', { name: '내 여행 이어가기', exact: true }).click();
  await expect(page.locator('.home-resume-trip')).toBeVisible(); await expect(page.locator('.personal-trip')).toHaveCount(0);
  await expect(page.locator('.local-storage-warning')).toContainText('저장'); assert.deepEqual(await snapshot(page), before);
  record(width, 'failed resume save keeps home and original records without claiming continuation success');
  await fixture(page, 'cursor'); await page.goto(base + '/#journey-trip-app-qa'); await page.locator('.personal-trip').waitFor();
  const source = await snapshot(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'spotlog.local.repository.v2') throw new DOMException('isolated QA storage failure', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.locator('.plan-journal-link').click(); await expect(page.locator('.journey-editor')).toHaveCount(0);
  await expect(page.locator('.personal-trip')).toBeVisible(); assert.deepEqual(await snapshot(page), source);
  record(width, 'failed journal save keeps itinerary and creates no phantom journal');
}
async function accountContinuity(page, width) {
  await fixture(page, 'cursor'); const before = (await snapshot(page)).find(journey => journey.id === 'trip-app-qa');
  await page.goto(base + '/#profile'); await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '이메일로 로그인', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(base + '/#home'); await expect(page.locator('.home-resume-trip')).toContainText('이 기기에 저장한 내 여행');
  assert.deepEqual((await snapshot(page)).find(journey => journey.id === before.id), before);
  await page.goto(base + '/#profile'); await page.getByRole('button', { name: '계정 관리 · 로그아웃', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃', exact: true }).click(); await closeSheet(page);
  await page.goto(base + '/#home'); await expect(page.locator('.home-resume-trip')).toContainText('이 기기에 저장한 내 여행');
  assert.deepEqual((await snapshot(page)).find(journey => journey.id === before.id), before);
  record(width, 'guest/login/logout preserve explicit device-owned trip without falsely claiming account synchronization');
}
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', error => results.errors.push({ width, error: error.message }));
      await page.route('**/qa-failed-photo.png', route => route.fulfill({ status: 404, body: '' }));
      await continuationFlows(page, width);
      await candidateFlows(page, width);
      await journalFlows(page, width);
      await accountContinuity(page, width);
      await storageFailureFlows(page, width);
      assert.equal(await page.evaluate(() => localStorage.getItem('spotlog-admin-preservation-sentinel')), 'untouched administrator record');
      await context.close();
    }
    assert.deepEqual(results.errors, []); results.passed = true; write();
  } finally { await browser.close(); write(); }
}
main().catch(error => { results.failure = String(error.stack); write(); console.error(error); process.exitCode = 1; });
