const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:5210/';
const out = __dirname, results = [], failures = [];
const read = page => page.evaluate(async () => JSON.parse((await import('/src/localRepository.ts')).createLocalRepository(localStorage).getItem('spotlog.web.journeys.v4')));
async function close(page) {
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForFunction(() => !history.state?.spotlogSheet);
}
async function openAi(page) {
  await page.goto(base + '#home');
  await page.locator('button.home-find-guides').filter({ hasText: 'AI 여행 만들기' }).click();
  return page.getByRole('dialog');
}
async function fixture(page, mode) {
  await page.goto(base);
  await page.evaluate(async mode => {
    const { placeCatalog, initialJourneys } = await import('/src/data.ts');
    const { buildPersonalPlan, normalizePlan, setPlanStay } = await import('/src/tripPlan.ts');
    const { addTripCandidate } = await import('/src/tripCandidates.ts');
    const { createLocalRepository } = await import('/src/localRepository.ts');
    const repo = createLocalRepository(localStorage);
    const anchor = placeCatalog.find(p => p.id === 'public-busan-haeundae');
    let trip = normalizePlan({ ...buildPersonalPlan([anchor], 3, '여행 오류 검수', 'Spotlog 여행자'), planStage: 'DRAFT' });
    const ctx = { dayId: trip.days[0].dayId, anchorVisitId: trip.days[0].places[0].visitId };
    if (mode === 'same-meal') {
      const food = placeCatalog.find(p => p.id === 'catalog-busan-geumsu');
      trip = addTripCandidate(trip, food, { ...ctx, slot: 'dinner' });
      trip = addTripCandidate(trip, food, { ...ctx, slot: 'lunch' });
    }
    if (mode === 'booked') {
      const booked = placeCatalog.find(p => p.id === 'catalog-busan-westin');
      const alternative = placeCatalog.find(p => p.id === 'catalog-busan-shilla-stay');
      if (!booked || !alternative) throw Error('Missing booking fixture');
      trip = setPlanStay(trip, booked, ctx.dayId, 1, true);
      trip = addTripCandidate(trip, alternative, { ...ctx, nights: 2 });
    }
    const journal = { ...structuredClone(initialJourneys[0]), id: 'qa-preserved-journal', purpose: 'JOURNAL', isMine: true, visibility: 'PRIVATE', title: '보존할 별도 여행기' };
    if (!repo.setItem('spotlog.web.journeys.v4', JSON.stringify([trip, journal]))) throw Error('Fixture write failed');
    if (!repo.setItem('spotlog.web.saved.v3', '["public-busan-haeundae","gangneung-anmok"]')) throw Error('Bookmark fixture failed');
    localStorage.setItem('qa.storage-sentinel', 'unrelated-storage-preserved');
  }, mode);
  await page.goto(base + '#trips'); await page.reload();
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function scenario(name, width, operation) {
    if (process.env.SPOTLOG_TRIP_SCENARIOS && !process.env.SPOTLOG_TRIP_SCENARIOS.split(',').includes(name)) return;
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
    try {
      const facts = await operation(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${name}-${width}.png`, animations: 'disabled' });
      results.push({ name, width, passed: true, facts, errors }); console.log('PASS', name, width);
    } catch (error) {
      failures.push({ name, width, error: error.stack, errors }); console.error('FAIL', name, width, error.message);
      await page.screenshot({ path: `${out}/failure-${name}-${width}.png`, animations: 'disabled' });
    } finally { await context.close(); }
  }
  try {
    for (const width of [320, 390, 460]) {
      await scenario('ai-draft-close-reload-save-failure', width, async page => {
        let dialog = await openAi(page);
        assert.match(await dialog.innerText(), /실제 AI 연결 전/);
        const input = dialog.locator('textarea');
        const prompt = '부산 2박 3일, 음식점 숙박 포함하고 카페는 빼고 부모님과 덜 걷고 싶어요.';
        await input.fill(prompt);
        await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
        await page.waitForFunction(() => !history.state?.spotlogSheet);
        dialog = await openAi(page); assert.equal(await dialog.locator('textarea').inputValue(), prompt);
        await close(page); await page.reload();
        dialog = await openAi(page); assert.equal(await dialog.locator('textarea').inputValue(), prompt);
        assert.equal(await dialog.locator('.ai-travel-conditions select').nth(1).inputValue(), '3');
        await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click();
        await dialog.locator('.ai-planner-route').waitFor();
        assert.match(await dialog.locator('.ai-planner-route').innerText(), /음식점/);
        assert.equal(await dialog.locator('.ai-planner-kind[data-kind="CAFE"]').count(), 0);
        const previewId = await page.evaluate(() => JSON.parse(localStorage.getItem('spotlog.ai-planner-draft.v1:local-profile')).draft.preview.data.journey.id);
        await close(page); await page.reload(); dialog = await openAi(page);
        await dialog.locator('.ai-planner-route').waitFor();
        const before = await page.evaluate(() => localStorage.getItem('spotlog.local.repository.v2'));
        await page.evaluate(() => {
          const original = Storage.prototype.setItem;
          window.qaRestoreStorage = () => { Storage.prototype.setItem = original; };
          Storage.prototype.setItem = function(key, value) { if (key === 'spotlog.local.repository.v2') throw new DOMException('test quota', 'QuotaExceededError'); return original.call(this, key, value); };
        });
        await dialog.getByRole('button', { name: /^내 여행에 저장/ }).click();
        await dialog.getByRole('alert').waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.local.repository.v2')), before);
        assert.equal(await dialog.locator('.ai-planner-route').isVisible(), true);
        await page.evaluate(() => window.qaRestoreStorage());
        await dialog.getByRole('button', { name: /^내 여행에 저장/ }).click();
        await page.locator('.personal-trip').waitFor();
        const mine = (await read(page)).filter(j => j.isMine && j.purpose === 'PLAN');
        assert.equal(mine.length, 1); assert.equal(mine[0].id, previewId);
        assert.equal(mine[0].visibility, 'PRIVATE'); assert.equal(mine[0].days.length, 3);
        await page.goto(base + '#home'); dialog = await openAi(page);
        assert.equal(await dialog.locator('.ai-planner-route').count(), 0);
        return { originalPromptRecovered: true, previewRecovered: true, failedSavePreserved: true, explicitPrivateSave: true, noDuplicatePreview: true };
      });
      await scenario('multiple-candidates-and-independent-journal', width, async page => {
        await fixture(page, 'simple');
        await page.getByRole('tab', { name: /내 여행기/ }).click();
        await page.getByText('보존할 별도 여행기', { exact: true }).waitFor();
        assert.equal(await page.getByText('여행 오류 검수', { exact: true }).count(), 0);
        await page.locator('#trip-plans-tab').click(); await page.getByText('여행 오류 검수', { exact: true }).click();
        await page.getByRole('button', { name: '주변 업체', exact: true }).click();
        for (const name of ['금수복국 해운대본점', '거대갈비']) await page.getByRole('button', { name: `${name} · 담기`, exact: true }).click();
        assert.equal(await page.getByRole('dialog').count(), 1);
        await page.getByRole('button', { name: '숙소', exact: true }).click();
        await page.getByRole('button', { name: '웨스틴 조선 부산 · 담기', exact: true }).click();
        await page.getByRole('button', { name: '숙소 후보 담기', exact: true }).click();
        await page.getByRole('button', { name: '신라스테이 해운대 · 담기', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: '숙소 후보 담기', exact: true }).count(), 0);
        await page.getByRole('button', { name: '후보 담기 완료', exact: true }).click();
        assert.equal(await page.locator('.plan-stop').count(), 1);
        await page.getByRole('button', { name: '마지막 확인', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: '내 여행 완성', exact: true }).isDisabled(), true);
        await page.getByRole('radio', { name: /거대갈비/ }).check(); await close(page); await page.reload();
        await page.getByRole('button', { name: '마지막 확인', exact: true }).click();
        assert.equal(await page.getByRole('radio', { name: /거대갈비/ }).isChecked(), true);
        await page.getByRole('radio', { name: /신라스테이 해운대/ }).check();
        await page.getByRole('button', { name: '내 여행 완성', exact: true }).click();
        assert.deepEqual(await page.locator('.plan-stop-copy strong').allTextContents(), ['해운대해수욕장', '거대갈비', '신라스테이 해운대']);
        await page.locator('.plan-journal-link').click();
        const stored = await read(page), trip = stored.find(j => j.title === '여행 오류 검수' && j.purpose === 'PLAN');
        const journal = stored.find(j => j.sourceTripId === trip.id);
        assert.equal(journal.purpose, 'JOURNAL'); assert.equal(journal.businessCandidates, undefined);
        assert.equal(stored.find(j => j.id === 'qa-preserved-journal').title, '보존할 별도 여행기');
        assert.equal(await page.evaluate(() => localStorage.getItem('qa.storage-sentinel')), 'unrelated-storage-preserved');
        return { multipleCandidates: true, onePerGroup: true, savedChoiceRecovered: true, accommodationOneTouch: true, independentJournal: true };
      });
      await scenario('same-restaurant-independent-meals', width, async page => {
        await fixture(page, 'same-meal'); await page.getByText('여행 오류 검수', { exact: true }).click();
        await page.getByRole('button', { name: '마지막 확인', exact: true }).click();
        assert.equal(await page.getByRole('radio', { name: /금수복국/ }).count(), 2);
        await page.getByRole('button', { name: '내 여행 완성', exact: true }).click();
        const trip = (await read(page)).find(j => j.title === '여행 오류 검수'), meals = trip.days[0].places.filter(p => p.kind === 'FOOD');
        assert.deepEqual(meals.map(p => p.planningSlot), ['lunch', 'dinner']); assert.notEqual(meals[0].visitId, meals[1].visitId);
        await page.reload();
        assert.equal(await page.locator('.plan-stop').filter({ hasText: '금수복국 해운대본점' }).count(), 2);
        return { bothMealsPreserved: true, distinctVisits: true, chronologicalMeals: true, survivesReload: true };
      });
      await scenario('booked-night-protected', width, async page => {
        await fixture(page, 'booked'); await page.getByText('여행 오류 검수', { exact: true }).click();
        await page.getByRole('button', { name: '마지막 확인', exact: true }).click();
        const days = page.locator('.candidate-review-day');
        assert.equal(await days.nth(0).getByRole('radio', { name: /신라스테이 해운대/ }).isDisabled(), true);
        assert.equal(await days.nth(0).getByRole('radio', { name: /웨스틴/ }).isChecked(), true);
        await page.getByRole('button', { name: '내 여행 완성', exact: true }).click();
        const trip = (await read(page)).find(j => j.title === '여행 오류 검수');
        assert.equal(trip.days[0].places.at(-1).name, '웨스틴 조선 부산'); assert.equal(trip.days[0].places.at(-1).bookingFixed, true);
        assert.equal(trip.days[1].places.at(-1).name, '신라스테이 해운대');
        return { bookedNightPreserved: true, otherNightIndependent: true };
      });
      await scenario('new-trip-input-close-reload', width, async page => {
        await page.goto(base + '#trips');
        await page.evaluate(async () => (await import('/src/localRepository.ts')).createLocalRepository(localStorage).setItem('spotlog.web.saved.v3', '["public-busan-haeundae"]'));
        await page.reload(); await page.getByRole('button', { name: '새 여행', exact: true }).click();
        const form = page.locator('.plan-form');
        await form.locator('input:not([type=date])').fill('새 여행 입력 보존'); await form.locator('select').selectOption('3');
        await form.locator('input[type=date]').fill('2026-10-20'); await close(page); await page.reload();
        await page.getByRole('button', { name: '새 여행', exact: true }).click();
        assert.equal(await form.locator('input:not([type=date])').inputValue(), '새 여행 입력 보존');
        assert.equal(await form.locator('select').inputValue(), '3'); assert.equal(await form.locator('input[type=date]').inputValue(), '2026-10-20');
        await form.locator(':scope > button').click(); await page.locator('.personal-trip').waitFor();
        const trip = (await read(page)).find(j => j.title === '새 여행 입력 보존');
        assert.equal(trip.planStage, 'READY'); assert.equal(trip.days[0].date, '2026-10-20');
        assert.equal(await page.getByRole('button', { name: '마지막 확인', exact: true }).count(), 0);
        return { inputRecovered: true, createsWithoutRedundantReview: true, datePreserved: true };
      });
      await scenario('saved-manual-days-and-auto-region', width, async page => {
        await fixture(page, 'simple'); await page.goto(base + '#saved');
        await page.getByRole('button', { name: '바로 만들기', exact: true }).click();
        assert.equal(await page.locator('.saved-trip-period-sheet > button.primary').isDisabled(), true);
        await page.locator('.saved-trip-region-options').getByRole('button', { name: /^부산/ }).click();
        assert.equal(await page.locator('.saved-trip-period-sheet > button.primary').isEnabled(), true);
        await close(page);
        await page.getByRole('button', { name: '날짜별로 담기', exact: true }).click();
        await page.locator('.saved-trip-period-options').getByRole('button', { name: '2박 3일', exact: true }).click();
        await page.locator('.saved-trip-period-sheet > button.primary').click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        await page.getByRole('button', { name: '해운대해수욕장, DAY 1에 담기', exact: true }).click();
        await page.locator('.saved-trip-toolbar [data-day="2"]').click();
        await page.getByRole('button', { name: '안목해변, DAY 2에 담기', exact: true }).click();
        await page.reload();
        assert.equal(await page.getByRole('button', { name: '안목해변, 담김 해제', exact: true }).count(), 1);
        await page.getByRole('button', { name: '일정 만들기', exact: true }).click();
        await page.locator('.personal-trip').waitFor();
        const trip = (await read(page)).find(j => j.purpose === 'PLAN' && j.title.includes('부산') && j.title.includes('강원'));
        assert.ok(trip); assert.equal(trip.days.length, 3);
        assert.equal(trip.days[0].places[0].name, '해운대해수욕장'); assert.equal(trip.days[1].places[0].name, '안목해변');
        return { mixedAutoRequiresOneRegion: true, manualCrossRegionDays: true, assignmentReload: true, exactDayPreserved: true };
      });
      await scenario('trip-detail-edit-and-undo', width, async page => {
        await fixture(page, 'simple'); await page.getByText('여행 오류 검수', { exact: true }).click();
        await page.getByRole('button', { name: '해운대해수욕장 · 장소 메뉴', exact: true }).click();
        let dialog = page.getByRole('dialog');
        await dialog.locator('textarea').fill('개인 메모 보존');
        await dialog.locator('input[type=time]').fill('10:30');
        await dialog.locator('input[type=number]').fill('45');
        await dialog.getByRole('button', { name: '변경 저장', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        let trip = (await read(page)).find(j => j.title === '여행 오류 검수'), stop = trip.days[0].places[0];
        assert.equal(stop.note, '개인 메모 보존'); assert.equal(stop.time, '10:30'); assert.equal(stop.duration, '45분');
        await page.reload();
        await page.getByRole('button', { name: '해운대해수욕장 · 장소 메뉴', exact: true }).click();
        dialog = page.getByRole('dialog'); assert.equal(await dialog.locator('textarea').inputValue(), '개인 메모 보존');
        await dialog.locator('input[type=number]').fill('1441');
        await dialog.getByRole('button', { name: '변경 저장', exact: true }).click(); await dialog.getByRole('alert').waitFor();
        assert.equal((await read(page)).find(j => j.id === trip.id).days[0].places[0].duration, '45분');
        await close(page);
        await page.getByRole('button', { name: '해운대해수욕장 · 장소 메뉴', exact: true }).click();
        await page.getByRole('button', { name: '건너뛰기', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        assert.equal((await read(page)).find(j => j.id === trip.id).travelProgress.visits[stop.visitId].status, 'skipped');
        await page.getByRole('button', { name: '마지막 변경 취소', exact: true }).click();
        trip = (await read(page)).find(j => j.id === trip.id);
        assert.notEqual(trip.travelProgress?.visits?.[stop.visitId]?.status, 'skipped');
        assert.equal(trip.days[0].places[0].note, '개인 메모 보존');
        return { editPersisted: true, invalidDurationPreservedRecord: true, skipUndo: true, metadataIndependent: true };
      });
      await scenario('trash-restore-keeps-other-records', width, async page => {
        await fixture(page, 'simple');
        const before = await read(page), trip = before.find(j => j.title === '여행 오류 검수');
        await page.getByRole('button', { name: '여행 오류 검수 휴지통으로 이동', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: '휴지통으로 이동', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        assert.equal(await page.getByText('여행 오류 검수', { exact: true }).count(), 0);
        const trashed = (await read(page)).find(j => j.id === trip.id); assert.equal(trashed.visibility, 'PRIVATE'); assert.ok(trashed.trash);
        assert.equal((await read(page)).find(j => j.id === 'qa-preserved-journal').title, '보존할 별도 여행기');
        await page.getByRole('button', { name: '휴지통', exact: true }).click();
        await page.getByRole('dialog').locator('.trip-trash-list button').click();
        await page.getByRole('button', { name: '복원', exact: true }).click();
        const restored = (await read(page)).find(j => j.id === trip.id);
        assert.equal(restored.visibility, 'PRIVATE'); assert.equal(restored.trash, undefined); assert.deepEqual(restored.days, trip.days);
        assert.equal(await page.evaluate(async () => (await import('/src/localRepository.ts')).createLocalRepository(localStorage).getItem('spotlog.web.saved.v3')), '["public-busan-haeundae","gangneung-anmok"]');
        assert.equal(await page.evaluate(() => localStorage.getItem('qa.storage-sentinel')), 'unrelated-storage-preserved');
        return { trashHidden: true, restoredPrivate: true, exactVisitsPreserved: true, separateJournalAndBookmarksPreserved: true };
      });
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, failures }, null, 2));
  console.log(JSON.stringify({ passed: results.length, failed: failures.length }));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
