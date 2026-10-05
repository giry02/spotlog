const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const out = __dirname;
const url = 'http://127.0.0.1:5210';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url + '/#journey-jeju-west-slow', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.locator('.summary[lang=en]').waitFor();
    await page.locator('[data-day="2"]').click();
    await page.waitForFunction(() => document.querySelector('.day-heading small')?.textContent.startsWith('DAY 2'));
    await page.waitForFunction(() => document.querySelector('.content-language-status')?.textContent.includes('Loading') !== true);
    assert.equal(await page.getByRole('button', { name: 'View in English', exact: true }).count(), 0);
    await page.screenshot({ path: out + '/english-day2-correct-390.png' });
    await page.locator('[data-day="1"]').click();
    await page.locator('.card-social button').filter({ has: page.locator('svg.lucide-message-circle') }).first().click();
    await page.locator('.card-comment-sheet').waitFor();
    assert.equal(await page.locator('.card-comment-sheet .guide-language button[aria-pressed=true]').textContent(), 'English');
    assert.equal(await page.locator('.card-comment-sheet .translation-actions').count(), 0);
    await page.screenshot({ path: out + '/english-comments-390.png' });
    assert.deepEqual(errors, []);
    await context.close();

    const fixture = await browser.newPage({ viewport: { width: 320, height: 844 } });
    fixture.setDefaultTimeout(10000);
    const fixtureErrors = [];
    fixture.on('pageerror', error => { fixtureErrors.push(error.message); console.error('Review fixture:', error.message); });
    fixture.on('requestfailed', request => console.error('Review request:', request.url(), request.failure()?.errorText));
    const baseHTML = await (await fixture.request.get(url)).text();
    const entry = /<script\b[^>]*\bsrc="\/src\/main\.tsx(?:\?[^"]*)?"[^>]*><\/script>/;
    assert.ok(entry.test(baseHTML), 'Review fixture needs the existing Vite React preamble');
    const localeModule = await (await fixture.request.get(url + '/src/locale.tsx')).text();
    const mainModule = await (await fixture.request.get(url + '/src/main.tsx')).text();
    const reactPath = localeModule.match(/"([^"]*\/react\.js[^\"]*)"/)[1];
    const clientPath = mainModule.match(/"([^"]*\/react-dom_client\.js[^\"]*)"/)[1];
    const script = `<script type="module">
import React from ${JSON.stringify(reactPath)}; const {useEffect,useState}=React;
import ReactDOM from ${JSON.stringify(clientPath)}; const {createRoot}=ReactDOM;
import{LocaleProvider}from'/src/locale.tsx';
import{ContentTranslationScope,ContentLanguageControls,TranslationText}from'/src/TranslationText.tsx';
import{localTranslationAdapter,sourceVersion,sampleTranslations}from'/src/travelGuide.ts';
import'/src/styles.css';
const known=[...sampleTranslations.keys()][0];window.mode='normal';window.pending=[];let firstFailure=true;
const adapter={async translate(input,signal){
  if(window.mode==='failure'&&input.sourceId==='changed'&&firstFailure){firstFailure=false;throw Error('test failure');}
  if(window.mode==='delay'&&input.sourceId==='slow'){return new Promise(resolve=>window.pending.push(()=>localTranslationAdapter.translate(input).then(resolve)));}
  return localTranslationAdapter.translate(input,signal);
}};
function Demo(){const[source,setSource]=useState({id:'known',text:known});useEffect(()=>{window.updateReviewSource=setSource;},[]);
  return React.createElement(ContentTranslationScope,null,React.createElement(ContentLanguageControls),
    React.createElement(TranslationText,{sourceId:source.id,sourceVersion:sourceVersion(source.text),text:source.text,kind:'journal',adapter}),
    React.createElement(TranslationText,{sourceId:'unknown',sourceVersion:'1',text:'예약 번호 123. 원문 유지.',kind:'comment'}));
}
createRoot(document.getElementById('root')).render(React.createElement(LocaleProvider,null,React.createElement(Demo)));
</script>`;
    await fixture.route('**/tests/content-language-review.html', route => route.fulfill({ contentType: 'text/html', body: baseHTML.replace(entry, script) }));
    await fixture.goto(url + '/tests/content-language-review.html', { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: 'English', exact: true }).click();
    await fixture.locator('[data-content-kind=journal][lang=en]').waitFor();
    assert.equal(await fixture.locator('[data-content-kind=comment]').textContent(), '예약 번호 123. 원문 유지.');
    assert.equal(await fixture.locator('.content-language-status').count(), 1);
    await fixture.evaluate(() => { window.mode = 'failure'; window.updateReviewSource({ id: 'changed', text: '아침 파도와 해변 산책이 하루의 방향을 정해주는 강릉의 대표 장면입니다.' }); });
    await fixture.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    assert.equal(await fixture.locator('[data-content-kind=journal]').getAttribute('lang'), 'ko');
    await fixture.getByRole('button', { name: 'Try again', exact: true }).click();
    await fixture.locator('[data-content-kind=journal][lang=en]').waitFor();
    assert.equal(await fixture.locator('.content-language-status').count(), 1);
    await fixture.evaluate(() => { window.mode = 'delay'; window.updateReviewSource({ id: 'slow', text: '빠르게 지나가기보다 강변에 앉아 주변 마을의 시간을 느껴보는 장소입니다.' }); });
    await fixture.waitForFunction(() => window.pending.length > 0);
    await fixture.getByRole('button', { name: '한국어', exact: true }).click();
    await fixture.evaluate(async () => { await Promise.all(window.pending.map(release => release())); });
    assert.equal(await fixture.locator('[data-content-kind=journal]').getAttribute('lang'), 'ko');
    assert.equal(await fixture.locator('[data-content-kind=journal]').textContent(), '빠르게 지나가기보다 강변에 앉아 주변 마을의 시간을 느껴보는 장소입니다.');
    assert.equal(await fixture.locator('.content-language-status').count(), 0);
    assert.deepEqual(fixtureErrors, []);
    const results = { dayChange: 'pass', commentInheritance: 'pass', automaticTranslation: 'pass', unknownOriginal: 'pass', singleNotice: 'pass', failureRetry: 'pass', lateResponseAfterKorean: 'pass', errors, fixtureErrors };
    fs.writeFileSync(out + '/integration-results.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
