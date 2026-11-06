const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:5210';
// Isolated browser simulation of the bridge boundary; no OS notification is sent.
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = [], errors = [];
  try {
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      await context.addInitScript(() => {
        window.__nativeMessages = [];
        window.ReactNativeWebView = { postMessage(data) { window.__nativeMessages.push(JSON.parse(data)); } };
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(base + '/#profile');
      await page.locator('.guest-profile-card').waitFor();
      await page.getByRole('button', { name: '로그인', exact: true }).click();
      await page.getByRole('button', { name: '이메일로 로그인', exact: true }).click();
      await page.locator('.member-account-card').waitFor();
      await page.getByText('기기 프로필 · 활동 미리보기', { exact: true }).click();
      const notificationSwitch = page.getByRole('switch', { name: '조회수 목표 알림', exact: true });
      if (await notificationSwitch.getAttribute('aria-checked') !== 'true') await notificationSwitch.click();
      for (const [payload, label, suffix, target] of [
        [{ sent: true }, '테스트 알림을 예약했어요. 잠시 후 기기에서 확인해 주세요.', 'scheduled', 'window'],
        [{ sent: false, reason: 'permission' }, '기기 알림 권한이 꺼져 있어요. 설정에서 허용한 뒤 다시 시도해 주세요.', 'permission', 'document'],
        [{ sent: false, reason: 'unavailable' }, '테스트 알림을 예약하지 못했어요. 잠시 후 다시 시도해 주세요.', 'unavailable', 'window'],
      ]) {
        const countBefore = await page.evaluate(() => window.__nativeMessages.filter(message => message.type === 'PREVIEW_CREATOR_NOTIFICATION').length);
        await page.getByRole('button', { name: '테스트 푸시 받기', exact: true }).click();
        await page.getByText('테스트 알림을 준비하고 있어요.', { exact: true }).waitFor();
        assert.equal(await page.getByText('테스트 알림을 예약했어요. 잠시 후 기기에서 확인해 주세요.', { exact: true }).count(), 0, 'Queued bridge message must not report success');
        assert.equal(await page.evaluate(() => window.__nativeMessages.filter(message => message.type === 'PREVIEW_CREATOR_NOTIFICATION').length), countBefore + 1);
        const sent = await page.evaluate(() => window.__nativeMessages.filter(message => message.type === 'PREVIEW_CREATOR_NOTIFICATION').at(-1));
        assert.deepEqual(sent, { type: 'PREVIEW_CREATOR_NOTIFICATION', payload: { viewMilestone: 100 } });
        await page.evaluate(({ payload, target }) => (target === 'document' ? document : window).dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'PREVIEW_NOTIFICATION_RESULT', payload }) })), { payload, target });
        await page.getByText(label, { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const optionBounds = await page.locator('.notification-options').evaluate(parent => {
          const bounds = parent.getBoundingClientRect();
          return Array.from(parent.querySelectorAll('select,button')).map(element => {
            const item = element.getBoundingClientRect();
            return { tag: element.tagName, left: item.left, right: item.right, parentLeft: bounds.left, parentRight: bounds.right, height: item.height };
          });
        });
        assert.ok(optionBounds.every(item => item.left >= item.parentLeft - 1 && item.right <= item.parentRight + 1), 'Notification controls overflow their own parent: ' + JSON.stringify(optionBounds));
        assert.ok(optionBounds.every(item => item.height >= (item.tag === 'BUTTON' ? 44 : 36)), 'Notification controls touch target: ' + JSON.stringify(optionBounds));
        await page.screenshot({ path: path.join(__dirname, 'notification-feedback-' + width + '-' + suffix + '.png') });
        checks.push({ width, state: suffix, optionBounds, simulatedBridgeOnly: true, osNotificationSent: false });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, 'notification-feedback-results.json'), JSON.stringify({ passed: true, states: checks.length, checks, errors, scope: 'Browser-to-native bridge simulation only; actual OS delivery not tested.' }, null, 2));
    const staleFailure = path.join(__dirname, 'notification-feedback-failure.txt');
    if (fs.existsSync(staleFailure)) fs.unlinkSync(staleFailure);
    console.log('Passed ' + checks.length + ' simulated notification feedback states');
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(__dirname, 'notification-feedback-failure.txt'), String(error.stack)); console.error(error); process.exitCode = 1; });
