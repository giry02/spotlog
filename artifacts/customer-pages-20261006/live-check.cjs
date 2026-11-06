const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.SPOTLOG_REVIEW_URL || 'https://giry02.github.io/spotlog/';
const out = path.join(__dirname, process.env.SPOTLOG_QA_OUT || 'live'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [], errors = [], badRequests = [], workers = [];
  try {
    const context = await browser.newContext(), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('worker', worker => workers.push(worker.url()));
    page.on('response', response => { if (response.status() >= 400 && /\/(assets|fonts)\//.test(response.url())) badRequests.push({ url: response.url(), status: response.status() }); });
    for (const width of [320, 390, 460]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['home', 'community', 'places-photo', 'trips', 'saved']) {
        await page.goto(base + '#' + route);
        await expect(page.locator('.app-shell')).toBeVisible();
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.src && !image.complete).map(image => new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 5000); }))); });
        const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, images: [...document.images].filter(image => image.getClientRects().length > 0).length, broken: [...document.images].filter(image => image.getClientRects().length > 0 && image.complete && !image.naturalWidth).map(image => image.src) }));
        assert.ok(dimensions.scroll <= dimensions.client + 1, route + ' overflow');
        assert.deepEqual(dimensions.broken, [], route + ' broken images');
        assert.equal(await page.locator('.admin-app').count(), 0);
        await page.screenshot({ path: path.join(out, `${width}-${route}.png`) }); results.push({ width, route, ...dimensions });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '#community');
    await page.getByRole('button', { name: '여행기 먼저 보기', exact: true }).first().click();
    const social = page.locator('.guide-place-embed .card-social').first();
    await expect(social).toBeVisible(); await social.scrollIntoViewIfNeeded();
    await expect.poll(() => workers.filter(url => /maplibre-gl-worker-/.test(url)).length).toBeGreaterThan(0);
    const workerUrl = workers.find(url => /maplibre-gl-worker-/.test(url));
    const workerResponse = await context.request.get(workerUrl); assert.equal(workerResponse.status(), 200); assert.ok(/javascript/.test(workerResponse.headers()['content-type']));
    const like = social.getByRole('button', { name: / 좋아요$/, exact: false });
    await like.click(); await expect(social.getByRole('button', { name: / 좋아요 취소$/ })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: path.join(out, 'journal-place-social.png') });
    await social.getByRole('button', { name: / 댓글 \d+$/ }).click();
    const rootText = '공개 배포 검수 댓글 20261006', replyText = '공개 배포 검수 답글 20261006';
    await page.locator('.card-comment-sheet').getByLabel('댓글 작성', { exact: true }).fill(rootText);
    await page.getByRole('button', { name: '댓글 등록', exact: true }).click();
    await expect(page.locator('.card-comment').filter({ hasText: rootText }).first()).toBeVisible();
    await page.locator('.card-comment').filter({ hasText: rootText }).getByRole('button', { name: '답글', exact: true }).click();
    await page.locator('.card-comment-sheet').getByLabel('답글 작성', { exact: true }).fill(replyText);
    await page.getByRole('button', { name: '답글 등록', exact: true }).click();
    await expect(page.locator('.card-reply').filter({ hasText: replyText })).toBeVisible();
    await page.screenshot({ path: path.join(out, 'place-comment-reply.png') });
    const journalUrl = page.url();
    await page.reload(); await expect(page.locator('.app-shell')).toBeVisible();
    if (!await page.locator('.card-social').count()) { await page.goto(base + '#community'); await page.getByRole('button', { name: '여행기 먼저 보기', exact: true }).first().click(); }
    const savedSocial = page.locator('.guide-place-embed .card-social').first();
    await expect(savedSocial.getByRole('button', { name: / 좋아요 취소$/ })).toHaveAttribute('aria-pressed', 'true');
    await savedSocial.getByRole('button', { name: / 댓글 \d+$/ }).click();
    await expect(page.locator('.card-comment').filter({ hasText: rootText }).first()).toBeVisible();
    await expect(page.locator('.card-reply').filter({ hasText: replyText })).toBeVisible();
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records['spotlog.card-social.v1']);
    assert.ok(persisted.includes(rootText) && persisted.includes(replyText));
    assert.deepEqual(errors, []); assert.deepEqual(badRequests, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, journalUrl, routes: results, cardLike: true, cardComment: true, reply: true, reloadPersistence: true, mapWorker: { url: workerUrl, status: workerResponse.status() }, errors, badRequests, note: 'Isolated browser storage; no live service data submitted.' }, null, 2));
    console.log('PASS', results.length, 'production route states; card like/comment/reply/reload; no broken images/overflow/exceptions');
  } catch (error) { fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ base, results, errors, badRequests, error: String(error) }, null, 2)); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
