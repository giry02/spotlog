const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin = process.env.SPOTLOG_QA_ORIGIN || 'http://127.0.0.1:5173';
const artifactDir = 'C:/Users/Giry/Documents/Spotlog/artifacts';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const log = (name, detail = true) => console.log(name, JSON.stringify(detail));
  const settle = () => page.waitForTimeout(700);
  const feed = page.locator('.photo-landmark-feed');
  const active = () => page.locator('.photo-landmark-reel[data-active="true"]');
  const placeId = () => active().getAttribute('data-place-id');
  const photoIndex = () => active().locator('.photo-reel-track').getAttribute('data-photo-index');
  const nav = () => page.getByRole('navigation', { name: '주요 메뉴' });
  const switchView = async name => { await page.locator('.place-view-toggle').getByRole('button', { name, exact: true }).click(); await settle(); };
  const gesture = async (from, to) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let step = 1; step <= 12; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12 }] });
      await page.waitForTimeout(18);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await settle();
  };
  const inBounds = async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal document overflow');
    for (const locator of [nav(), page.locator('.place-view-toggle'), active().locator('.photo-reel-caption')]) {
      const rect = await locator.boundingBox();
      assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= page.viewportSize().width + 1 && rect.y + rect.height <= page.viewportSize().height + 1, `Element must remain on screen: ${JSON.stringify(rect)}`);
    }
  };

  try {
    await page.goto(`${origin}/#places-photo`, { waitUntil: 'domcontentloaded' });
    await feed.waitFor();
    await active().waitFor();
    await settle();
    const firstId = await placeId();
    const initialRect = await feed.boundingBox();
    assert.ok(initialRect.height >= 760, `Photo feed should fill screen: ${JSON.stringify(initialRect)}`);
    assert.equal(await page.getByRole('textbox', { name: '랜드마크 지역 검색' }).isVisible(), false);
    assert.equal(await page.locator('.place-guide-lead').isVisible(), false);
    assert.ok(await page.locator('.photo-landmark-reel').count() > 1);
    await inBounds();
    await page.screenshot({ path: `${artifactDir}/photo-reels-390.png` });
    log('Immediate full-screen photo feed', { firstId, rect: initialRect });

    await feed.focus();
    await page.keyboard.press('ArrowRight');
    await settle();
    assert.equal(await placeId(), firstId);
    assert.equal(await photoIndex(), '1');
    const secondCaption = await active().locator('.photo-reel-caption').innerText();
    assert.match(await active().locator('.photo-reel-count').innerText(), /2\s*\/\s*2/);
    await page.screenshot({ path: `${artifactDir}/photo-reels-photo2-390.png` });
    log('Keyboard same-place photo navigation', { photoIndex: await photoIndex(), caption: secondCaption });

    await page.mouse.move(160, 320);
    await page.mouse.wheel(0, 550);
    await settle();
    const secondId = await placeId();
    assert.notEqual(secondId, firstId);
    const placeIds = await page.locator('.photo-landmark-reel').evaluateAll(nodes => nodes.map(node => node.dataset.placeId));
    assert.equal(secondId, placeIds[1], 'One vertical step should land at second landmark');
    await feed.focus();
    await page.keyboard.press('ArrowUp');
    await settle();
    assert.equal(await placeId(), firstId);
    assert.equal(await photoIndex(), '1');
    log('Vertical wheel snap and per-place photo restoration', { secondId });

    await feed.focus();
    await page.keyboard.press('ArrowLeft');
    await settle();
    assert.equal(await photoIndex(), '0');
    await gesture({ x: 315, y: 370 }, { x: 70, y: 370 });
    assert.equal(await placeId(), firstId, 'Horizontal gesture must not move to another place');
    assert.equal(await photoIndex(), '1', 'Horizontal gesture should move to next photo');
    await gesture({ x: 155, y: 610 }, { x: 155, y: 220 });
    assert.equal(await placeId(), secondId, 'Vertical gesture should move to next landmark');
    log('Native horizontal and vertical touch gestures');

    const beforeStory = await placeId();
    await active().getByRole('button', { name: /장소 이야기$/ }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    assert.equal(await placeId(), beforeStory, 'Bottom sheet must not navigate the background feed');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await settle();
    log('Optional place story sheet and background keyboard guard');

    await feed.focus();
    await page.keyboard.press('ArrowRight');
    await settle();
    const beforeSaved = { id: await placeId(), photo: await photoIndex() };
    const saveButton = active().getByRole('button', { name: /저장(?: 해제)?$/ }).first();
    if (await saveButton.getAttribute('aria-pressed') !== 'true') await saveButton.click();
    assert.equal(await saveButton.getAttribute('aria-pressed'), 'true');
    await nav().getByRole('button', { name: '저장', exact: true }).click();
    await settle();
    assert.equal(new URL(page.url()).hash, '#saved');
    const savedNames = await page.locator('.library-place-card h3, .library-place-card h2').allTextContents();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await settle();
    await page.goBack();
    await feed.waitFor();
    await settle();
    assert.deepEqual({ id: await placeId(), photo: await photoIndex() }, beforeSaved);
    assert.equal(await active().getByRole('button', { name: /저장 해제$/ }).first().getAttribute('aria-pressed'), 'true');
    log('Shared saved state and back restores landmark/photo', { beforeSaved, savedNames });

    await switchView('지역 안내');
    await page.getByRole('textbox', { name: '랜드마크 지역 검색' }).fill('서울');
    await settle();
    await switchView('사진');
    assert.equal(await page.getByRole('textbox', { name: '랜드마크 지역 검색' }).isVisible(), false);
    assert.deepEqual({ id: await placeId(), photo: await photoIndex() }, beforeSaved);
    assert.equal(await page.locator('.photo-landmark-reel').count(), placeIds.length);
    await switchView('지역 안내');
    assert.equal(await page.getByRole('textbox', { name: '랜드마크 지역 검색' }).inputValue(), '서울');
    await page.getByRole('textbox', { name: '랜드마크 지역 검색' }).fill('오설록');
    await settle();
    assert.equal(await page.locator('.landmark-guide-card').getByRole('button', { name: '저장됨', exact: true }).count(), 1);
    log('Guide filter isolation and shared bookmark');

    await switchView('영상');
    await page.locator('.feed-card').first().waitFor();
    assert.ok(await page.locator('.feed-card video, .feed-card .motion-photo-reel').count() > 0);
    await page.screenshot({ path: `${artifactDir}/photo-reels-video-preserved-390.png` });
    log('Existing video view preserved');

    await switchView('사진');
    await page.setViewportSize({ width: 320, height: 740 });
    await settle();
    await inBounds();
    assert.equal(await placeId(), beforeSaved.id);
    assert.equal(await photoIndex(), beforeSaved.photo);
    await page.screenshot({ path: `${artifactDir}/photo-reels-320.png` });
    log('320px layout and resize restoration');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await feed.focus();
    await page.keyboard.press('ArrowDown');
    await settle();
    assert.notEqual(await placeId(), beforeSaved.id);
    await inBounds();
    log('Motion enabled navigation');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    await feed.focus();
    for (let index = 0; index < placeIds.length; index += 1) await page.keyboard.press('ArrowUp');
    await settle();
    const frameReport = [];
    for (let index = 0; index < placeIds.length; index += 1) {
      assert.equal(await placeId(), placeIds[index]);
      await inBounds();
      const visibleImage = active().locator('figure[aria-hidden="false"] img');
      await visibleImage.waitFor();
      await page.waitForFunction(element => element.complete && element.naturalWidth > 0, await visibleImage.elementHandle());
      frameReport.push({ id: await placeId(), caption: await active().locator('.photo-reel-caption').innerText() });
      await page.screenshot({ path: `${artifactDir}/photo-reels-landmark-${index + 1}-390.png` });
      await feed.focus();
      await page.keyboard.press('ArrowDown');
      await settle();
    }
    log('All six landmark frames loaded and in bounds', frameReport);
    assert.deepEqual(errors, []);
    log('Uncaught page errors', errors);
  } catch (error) {
    await page.screenshot({ path: `${artifactDir}/photo-reels-failure.png` }).catch(() => {});
    console.error('STATE', await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 1700) })).catch(() => null));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
