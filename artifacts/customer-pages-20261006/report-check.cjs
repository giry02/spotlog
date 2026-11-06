const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.SPOTLOG_REPORT_REVIEW_URL || 'http://127.0.0.1:5216/spotlog/';
const live = base.startsWith('https:'), out = path.join(__dirname, live ? 'report-live' : 'report-review'); fs.mkdirSync(out, { recursive: true });
async function journal(page) { await page.goto(base + '#community'); await page.getByRole('button', { name: '여행기 먼저 보기', exact: true }).first().click(); await expect(page.locator('.journey-detail')).toBeVisible(); }
async function open(page) { await page.locator('.journal-report-footer button').click(); await expect(page.getByRole('heading', { name: '공개 콘텐츠 신고' })).toBeVisible(); }
async function close(page) { await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).first().click(); await expect(page.getByRole('dialog')).toHaveCount(0); }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), errors = [], results = [];
  try {
    const context = await browser.newContext(), page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 390, 460]) {
      await page.setViewportSize({ width, height: 844 }); await journal(page);
      await expect(page.locator('.journal-report-footer .report-context-button')).toHaveCount(1);
      await expect(page.locator('.journal-lead .report-context-button,.guide-place-embed .report-context-button,.journal-gallery .report-context-button,.detail-creator .report-context-button')).toHaveCount(0);
      await page.locator('.journal-report-footer').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `${width}-single-footer.png`) });
      await open(page);
      const targets = page.getByLabel('신고 대상', { exact: true });
      const groups = await targets.locator('optgroup').evaluateAll(nodes => nodes.map(node => node.label));
      assert.ok(groups.includes('여행기·작성자')); assert.ok(groups.includes('장소')); assert.ok(groups.includes('사진'));
      const cover = await targets.getByRole('option', { name: '표지 사진', exact: true }).getAttribute('value');
      await page.getByLabel('신고 이유').selectOption('COPYRIGHT'); await page.getByLabel('상세 사유 (선택)').fill('표지 사진 확인');
      await targets.selectOption(cover);
      await expect(page.getByLabel('신고 이유')).toHaveValue('COPYRIGHT'); await expect(page.getByLabel('상세 사유 (선택)')).toHaveValue('표지 사진 확인');
      await expect(page.getByRole('button', { name: '신고 접수', exact: true })).toBeDisabled();
      const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, field: getComputedStyle(document.querySelector('.phase-sheet select')).fontSize }));
      assert.ok(sizes.scroll <= sizes.width + 1); assert.equal(sizes.field, '16px');
      await page.screenshot({ path: path.join(out, `${width}-report-sheet.png`) });
      await close(page);
      const social = page.locator('.guide-place-embed .card-social').first();
      if (await social.getByRole('button').first().getAttribute('aria-pressed') !== 'true') await social.getByRole('button').first().click();
      await expect(social.getByRole('button', { name: / 좋아요 취소$/ })).toHaveAttribute('aria-pressed', 'true');
      await social.getByRole('button', { name: / 댓글 \d+$/ }).click();
      await expect(page.locator('.card-comment-sheet .report-context-button')).toHaveCount(0); await close(page);
      results.push({ width, oneFooterReport: true, noRepeatedReports: true, groups, selectionsPreserved: true, disconnectedSubmitDisabled: true, socialPreserved: true, ...sizes });
    }
    if (!live) {
      const dev = await context.newPage(); dev.on('pageerror', error => errors.push(error.message)); await dev.goto('http://127.0.0.1:5217/#community'); await dev.getByRole('button', { name: '여행기 먼저 보기', exact: true }).first().click(); await open(dev);
      await dev.getByLabel('신고 대상').selectOption({ label: '표지 사진' }); await dev.getByLabel('신고 이유').selectOption('COPYRIGHT'); await dev.getByRole('button', { name: '로컬 검수 접수', exact: true }).click();
      await expect(dev.getByRole('status').filter({ hasText: '로컬 검수 접수' })).toBeVisible();
      const reports = await dev.evaluate(() => JSON.parse(localStorage.getItem('spotlog.review.service.v1')).reports);
      assert.equal(reports.length, 1); assert.equal(reports[0].targetType, 'PHOTO'); assert.ok(reports[0].targetId.endsWith(':cover')); assert.equal(reports[0].reasonCode, 'COPYRIGHT');
      await dev.screenshot({ path: path.join(out, 'local-photo-receipt.png') }); results.push({ localSelectedPhotoReceipt: true });
    }
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, results, errors }, null, 2)); console.log('PASS single report footer, target/reason preservation, social controls, 3 mobile widths' + (live ? ' on public site' : ', local photo receipt'));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
