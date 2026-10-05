const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'artifacts/photo-source-qa';
const repoKey = 'spotlog.local.repository.v2';
const journeysKey = 'spotlog.web.journeys.v4';
const savedKey = 'spotlog.web.saved.v3';
const raw = (page) => page.evaluate((key) => localStorage.getItem(key), repoKey);
const sheet = (page) => page.getByRole('dialog');
const sourceButton = (scope) => scope.locator('.public-photo-credit button').first();
const delay = (page) => page.waitForTimeout(180);
async function geometry(page) {
  const result = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth,
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    nestedButtons: document.querySelectorAll('button button').length,
    sheetOverflow: [...document.querySelectorAll('.phase-sheet-body')].filter((el) => el.getClientRects().length).some((el) => el.scrollWidth > el.clientWidth + 1),
    outside: [...document.querySelectorAll('.phase-sheet')].some((el) => { const b = el.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1; }),
  }));
  assert.equal(result.horizontal, false); assert.equal(result.nestedButtons, 0);
  assert.equal(result.sheetOverflow, false); assert.equal(result.outside, false);
  assert.ok(result.dialogs <= 1);
  return result;
}
async function capture(page, name, width) {
  await page.screenshot({ path: `${output}/${name}-${width}.png` });
  return geometry(page);
}
async function waitClosed(page) {
  await sheet(page).waitFor({ state: 'detached' }); await delay(page);
  assert.equal(await page.locator('.app-shell').evaluate((el) => el.inert), false);
}
async function openCredit(page, scope) {
  await sourceButton(scope).click(); await page.locator('[role="dialog"]').waitFor(); await delay(page);
  assert.equal(await sheet(page).count(), 1);
  const text = await sheet(page).innerText();
  for (const expected of ['사진 출처', '공공누리 제1유형', '2026-09-10']) assert.ok(text.includes(expected), expected);
  assert.ok(await sheet(page).getByRole('link').count() >= 2);
  await geometry(page);
}
(async () => {
  fs.mkdirSync(output, { recursive: true }); const results = [];
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const run = async (name, width, route, task) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ repoKey, journeysKey, savedKey }) => localStorage.setItem(repoKey, JSON.stringify({ schemaVersion: 2, updatedAt: '2026-09-10T00:00:00Z', records: { [journeysKey]: '[]', [savedKey]: JSON.stringify(['public-busan-dongbaek', 'public-busan-haeundae']) } })), { repoKey, journeysKey, savedKey });
    const page = await context.newPage(); const errors = []; page.setDefaultTimeout(8000); page.on('pageerror', (err) => errors.push(err.message));
    try {
      await page.goto(`http://127.0.0.1:5173/#${route}`); await page.evaluate(() => document.fonts.ready);
      const data = await task(page); assert.deepEqual(errors, []); results.push({ name, width, ok: true, ...data }); console.log('PASS', name, width);
    } catch (err) {
      await page.screenshot({ path: `${output}/${name}-${width}-failure.png` }); results.push({ name, width, ok: false, error: String(err), errors }); console.log('FAIL', name, width, String(err));
    } finally { await context.close(); }
  };
  try {
    for (const width of [320, 390, 460]) {
      await run('public', width, 'journey-public-busan-coast-day', async (page) => {
        await page.locator('.public-source-notes').waitFor(); const initial = await raw(page);
        const button = sourceButton(page); await button.scrollIntoViewIfNeeded();
        await capture(page, 'public-credit', width); await openCredit(page, page);
        await capture(page, 'single-source', width);
        await page.keyboard.press('Escape'); await waitClosed(page);
        assert.equal(await button.evaluate((el) => document.activeElement === el), true);
        const notes = page.locator('.public-source-notes'); await notes.scrollIntoViewIfNeeded(); await capture(page, 'source-row', width);
        const inset = await notes.evaluate((el) => el.querySelector('button').getBoundingClientRect().left - el.getBoundingClientRect().left);
        assert.equal(inset, 20);
        const startScroll = await page.locator('.content').evaluate((el) => el.scrollTop);
        await notes.getByRole('button').click(); await sheet(page).waitFor(); await delay(page);
        assert.equal(await sheet(page).locator('.public-source-item').count(), 2);
        assert.ok((await sheet(page).innerText()).includes('실제 방문 후기'));
        await capture(page, 'all-sources', width);
        await page.keyboard.press('Tab'); assert.equal(await sheet(page).evaluate((el) => el.contains(document.activeElement)), true);
        await page.goBack(); await waitClosed(page);
        assert.ok(Math.abs(await page.locator('.content').evaluate((el) => el.scrollTop) - startScroll) < 2);
        await notes.getByRole('button').click(); await delay(page); await sheet(page).getByRole('button', { name: '닫기', exact: true }).click(); await waitClosed(page);
        await notes.getByRole('button').click(); await delay(page); await page.locator('.phase-sheet-backdrop').click({ position: { x: 5, y: 5 } }); await waitClosed(page);
        assert.equal(await raw(page), initial);
        return { closeEscBackXBackdrop: true, metadata: true, alignment: await geometry(page), storageUnchanged: true };
      });
      await run('add', width, 'saved', async (page) => {
        const initial = await raw(page); await page.getByRole('button', { name: /^동백섬, / }).click();
        let dialog = page.getByRole('dialog', { name: '내 여행에 담기' }); await dialog.waitFor();
        await dialog.getByRole('textbox', { name: '여행 제목', exact: true }).fill('출처를 봐도 남을 여행');
        await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).selectOption('3');
        await dialog.getByRole('textbox', { name: /^출발 날짜/ }).fill('2026-10-31');
        await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        await sourceButton(dialog).scrollIntoViewIfNeeded();
        const scroll = await page.locator('.phase-sheet-body').evaluate((el) => el.scrollTop);
        for (const mode of ['back', 'escape', 'x', 'arrow']) {
          await openCredit(page, dialog); await capture(page, `add-source-${mode}`, width);
          if (mode === 'back') await page.goBack();
          if (mode === 'escape') await page.keyboard.press('Escape');
          if (mode === 'x') await sheet(page).getByRole('button', { name: '사진 출처 닫기', exact: true }).click();
          if (mode === 'arrow') await sheet(page).getByRole('button', { name: '이전 화면으로', exact: true }).click();
          dialog = page.getByRole('dialog', { name: '내 여행에 담기' }); await dialog.waitFor(); await delay(page);
          assert.equal(await dialog.getByRole('textbox', { name: '여행 제목', exact: true }).inputValue(), '출처를 봐도 남을 여행');
          assert.equal(await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).inputValue(), '3');
          assert.equal(await dialog.getByRole('textbox', { name: /^출발 날짜/ }).inputValue(), '2026-10-31');
          assert.equal(await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).getAttribute('aria-pressed'), 'true');
          assert.ok(Math.abs(await page.locator('.phase-sheet-body').evaluate((el) => el.scrollTop) - scroll) < 2);
          assert.equal(await page.locator('.app-shell').evaluate((el) => el.inert), true);
          if (mode === 'back') {
            await page.goForward(); await page.getByRole('dialog', { name: '사진 출처', exact: true }).waitFor();
            await geometry(page); await page.goBack(); await dialog.waitFor(); await delay(page);
            assert.equal(await dialog.getByRole('textbox', { name: '여행 제목', exact: true }).inputValue(), '출처를 봐도 남을 여행');
          }
        }
        await page.goBack(); await waitClosed(page); assert.equal(await raw(page), initial);
        return { parentStatePreserved: true, singleDialog: true, sourceBackRestoresParent: true, scrollRestored: true };
      });
      await run('ai', width, 'home', async (page) => {
        const initial = await raw(page); await page.getByRole('button', { name: /가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/ }).click();
        await sheet(page).getByRole('textbox', { name: /^어떤 여행/ }).fill('부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.');
        await sheet(page).getByRole('button', { name: '초안 만들기', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '여행 초안 미리보기' }); await dialog.waitFor();
        await dialog.getByRole('group', { name: '추천 일정 날짜 선택' }).getByRole('button', { name: /^DAY 2,/ }).click();
        const active = dialog.getByRole('region', { name: 'DAY 2 추천 장소' });
        const exclude = active.getByRole('button', { name: /선택됨, 이번 초안에서 제외$/ }).first(); const label = await exclude.getAttribute('aria-label');
        await exclude.click(); const restore = label.replace('선택됨, 이번 초안에서 제외', '일정에 다시 포함');
        await openCredit(page, active); await capture(page, 'ai-source', width);
        await page.keyboard.press('Escape'); await dialog.waitFor(); await delay(page);
        assert.equal(await dialog.getByRole('group', { name: '추천 일정 날짜 선택' }).getByRole('button', { name: /^DAY 2,/ }).getAttribute('aria-pressed'), 'true');
        assert.equal(await active.getByRole('button', { name: restore, exact: true }).count(), 1);
        await dialog.getByRole('button', { name: '조건 바꾸기', exact: true }).click();
        assert.equal(await sheet(page).getByRole('textbox', { name: /^어떤 여행/ }).inputValue(), '부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.');
        await page.keyboard.press('Escape'); await waitClosed(page); assert.equal(await raw(page), initial);
        return { dayAndExcludedVisitPreserved: true, promptPreserved: true, cancelUnsaved: true };
      });
    }
  } finally { await browser.close(); fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2)); }
  if (results.some((item) => !item.ok)) process.exitCode = 1;
})();
