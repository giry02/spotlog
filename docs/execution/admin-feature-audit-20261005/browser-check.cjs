/* Read-only product audit. Only isolated browser context state is mutated. */
const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:5210';
const output = __dirname;
const checks = [], browserErrors = [], requests = [];
const record = (name, evidence) => { checks.push({ name, evidence }); console.log(name, JSON.stringify(evidence)); };
const stored = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const baseline = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const customer = await baseline.newPage();
    customer.on('pageerror', error => browserErrors.push(error.message));
    await customer.goto(base + '/#home');
    await expect(customer.locator('#root')).not.toBeEmpty();
    const screens = [];
    for (const hash of ['home', 'community', 'journey-jeju-west-slow', 'profile']) {
      await customer.goto(base + '/#' + hash);
      await expect(customer.locator('#root')).not.toBeEmpty();
      screens.push({ hash, reportButtons: await customer.getByRole('button', { name: /신고/ }).count(), supportButtons: await customer.getByRole('button', { name: /문의|받은 알림함|챗봇/ }).count() });
    }
    assert.ok(screens.every(screen => screen.reportButtons === 0));
    record('customer baseline has no global report entry on audited screens', screens);
    await customer.goto(base + '/#places-video');
    const follow = customer.getByRole('button', { name: '팔로우', exact: true }).first();
    await expect(follow).toBeVisible();
    const beforeFollow = await stored(customer), textBefore = await follow.innerText();
    await follow.click();
    const textAfter = await follow.innerText(), afterFollow = await stored(customer);
    assert.deepEqual(afterFollow, beforeFollow);
    assert.equal(textAfter, textBefore);
    await customer.screenshot({ path: path.join(output, 'browser-follow.png') });
    record('visible follow click does not update label or local storage', { labelBefore: textBefore, labelAfter: textAfter, storageUnchanged: true });
    await baseline.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const admin = await context.newPage();
    admin.on('pageerror', error => browserErrors.push(error.message));
    await admin.goto(base + '/admin.html');
    await expect(admin.getByRole('heading', { name: '실제 서비스 집계', exact: true })).toBeVisible();
    const connectionNames = await admin.locator('.admin-connection').evaluateAll(nodes => nodes.map(node => node.querySelector('span').firstChild.textContent));
    assert.equal(connectionNames.length, 15);
    await admin.screenshot({ path: path.join(output, 'browser-admin-connections.png') });
    record('administrator overview shows 15 separate connection cards', connectionNames);
    const adminStorageBefore = await admin.evaluate(() => localStorage.getItem('spotlog.admin.review.v1'));
    await admin.getByRole('navigation').getByRole('button', { name: '여행기·커뮤니티', exact: true }).click();
    await expect(admin.getByRole('heading', { name: '신고 목록', exact: true })).toBeVisible();
    const reportList = admin.locator('.admin-panel').filter({ has: admin.getByRole('heading', { name: '신고 목록', exact: true }) }).locator('.admin-list button.admin-card');
    const reportsBefore = await reportList.allTextContents();
    assert.equal(reportsBefore.length, 3);

    const seeded = await context.newPage();
    seeded.on('pageerror', error => browserErrors.push(error.message));
    seeded.on('request', request => { if (/\/api\//.test(request.url())) requests.push({ method: request.method(), url: request.url() }); });
    await seeded.addInitScript(() => {
      const key = JSON.stringify(['jeju-west-slow', 'j1d1-place-1']);
      const synthetic = { likes: [], comments: [{ id: 'audit-other-comment', authorId: 'audit-other-user', author: '별도 검수 작성자', body: '신고 연결을 확인하는 합성 댓글입니다.', createdAt: '2026-10-05T01:00:00.000Z' }, { id: 'audit-own-comment', authorId: 'local-self', author: '내 검수 댓글', body: '본인 댓글에는 수정과 삭제만 있는지 확인합니다.', createdAt: '2026-10-05T00:59:00.000Z' }] };
      if (!localStorage.getItem('spotlog.card-social.v1') && !localStorage.getItem('spotlog.local.repository.v2')) localStorage.setItem('spotlog.card-social.v1', JSON.stringify({ [key]: synthetic }));
    });
    await seeded.goto(base + '/#journey-jeju-west-slow');
    const comments = seeded.getByRole('button', { name: '협재해수욕장 댓글 2', exact: true });
    await expect(comments).toBeVisible();
    await comments.click();
    await expect(seeded.getByText('신고 연결을 확인하는 합성 댓글입니다.', { exact: true })).toBeVisible();
    assert.equal(await seeded.getByRole('button', { name: '신고', exact: true }).count(), 1);
    const ownRow = seeded.locator('.card-comment').filter({ hasText: '본인 댓글에는 수정과 삭제만 있는지 확인합니다.' });
    assert.equal(await ownRow.getByRole('button', { name: '신고', exact: true }).count(), 0);
    await expect(ownRow.getByRole('button', { name: '수정', exact: true })).toBeVisible();
    await expect(ownRow.getByRole('button', { name: '삭제', exact: true })).toBeVisible();
    record('card comment report conditional: other user only, own comment edit/delete', { syntheticThread: ['jeju-west-slow', 'j1d1-place-1'], otherUserReportButtons: 1, ownUserReportButtons: 0 });
    await seeded.getByRole('button', { name: '신고', exact: true }).click();
    await expect(seeded.getByText('신고 선택을 이 기기에 기록해요. 운영자에게 전송되는 기능은 아직 연결되지 않았어요.', { exact: true })).toBeVisible();
    await seeded.locator('.card-comment-sheet select').selectOption('욕설·괴롭힘');
    await seeded.screenshot({ path: path.join(output, 'browser-report-local-warning.png') });
    await seeded.getByRole('button', { name: '신고 표시', exact: true }).click();
    await expect(seeded.getByRole('button', { name: '신고 표시됨', exact: true })).toBeDisabled();
    const customerState = await seeded.evaluate(() => JSON.parse(localStorage.getItem('spotlog.local.repository.v2')));
    const socialState = JSON.parse(customerState.records['spotlog.card-social.v1']);
    assert.equal(socialState[JSON.stringify(['jeju-west-slow', 'j1d1-place-1'])].comments.find(comment => comment.id === 'audit-other-comment').reportReason, '욕설·괴롭힘');
    await seeded.screenshot({ path: path.join(output, 'browser-report-marked.png') });
    await admin.reload();
    await expect(admin.getByRole('heading', { name: '실제 서비스 집계', exact: true })).toBeVisible();
    const adminStorageAfter = await admin.evaluate(() => localStorage.getItem('spotlog.admin.review.v1'));
    assert.equal(adminStorageAfter, adminStorageBefore);
    assert.equal(requests.length, 0);
    await admin.getByRole('navigation').getByRole('button', { name: '여행기·커뮤니티', exact: true }).click();
    await expect(admin.getByRole('heading', { name: '신고 목록', exact: true })).toBeVisible();
    const reportsAfter = await reportList.allTextContents();
    assert.deepEqual(reportsAfter, reportsBefore);
    await admin.screenshot({ path: path.join(output, 'browser-admin-report-independent.png') });
    record('customer report saved locally with no API request and no new administrator report', { reportReason: '욕설·괴롭힘', apiRequests: requests, adminReportCountBefore: reportsBefore.length, adminReportCountAfter: reportsAfter.length, adminReports: reportsAfter, adminStorageUnchanged: true });
    await context.close();
    assert.deepEqual(browserErrors, []);
    record('no browser uncaught errors during audit', browserErrors);
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), base, isolation: 'New browser contexts only; no actual user browser/storage access; product source unchanged.', checks, browserErrors }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ base, checks, browserErrors, failure: String(error), stack: error.stack }, null, 2)); console.error(error); process.exitCode = 1; });
