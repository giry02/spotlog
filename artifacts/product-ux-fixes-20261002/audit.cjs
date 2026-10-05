const fs = require('fs');
const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const out = __dirname;
const url = 'http://127.0.0.1:5210/';
fs.mkdirSync(out, { recursive: true });
const results = [];
async function snapshot(page, width, name, saveResults = true) {
  const data = await page.evaluate(() => {
    const visible = element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && !!element.getClientRects().length && box.width > 0 && box.height > 0;
    };
    const texts = [], seen = new Set();
    const scope = [...document.querySelectorAll('[role=dialog]')].filter(visible).at(-1) || document.querySelector('.app-shell') || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, element = node.parentElement;
      const text = node.textContent.trim().replace(/\s+/g, ' ');
      if (!text || !element || ['SCRIPT', 'STYLE', 'OPTION'].includes(element.tagName) || !visible(element)) continue;
      if (element.closest('.sr-only,[aria-hidden=true]')) continue;
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      const selector = [element.parentElement?.className, element.tagName.toLowerCase(), element.className].filter(value => typeof value === 'string' && value).join(' > ');
      const key = selector + text;
      if (seen.has(key)) continue;
      seen.add(key);
      texts.push({ text: text.slice(0, 150), selector, size: parseFloat(style.fontSize), weight: style.fontWeight, color: style.color, background: style.backgroundColor, lineHeight: style.lineHeight, inViewport: box.bottom > 0 && box.top < innerHeight, tag: element.tagName });
    }
    const controls = [...document.querySelectorAll('button,a,input,textarea,select,summary')].filter(visible).map(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      const center = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { tag: element.tagName, text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 110), width: box.width, height: box.height, size: parseFloat(style.fontSize), className: element.className, inViewport: box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth, centerObscured: center !== null && !element.contains(center) && center !== element, disabled: element.disabled || false };
    });
    return { url: location.hash, overflow: document.documentElement.scrollWidth > innerWidth, bodyOverflow: document.body.scrollWidth > innerWidth, texts, controls, imageFailures: [...document.querySelectorAll('img')].filter(element => element.complete && !element.naturalWidth).map(element => element.currentSrc), bodyScroll: document.scrollingElement?.scrollTop, tabbar: document.querySelector('.tabbar')?.getBoundingClientRect().toJSON() };
  });
  await page.screenshot({ path: `${out}/${name}-${width}.png` });
  results.push({ name, width, ...data });
  if (saveResults) fs.writeFileSync(out + '/screen-results.json', JSON.stringify(results, null, 2));
  if (saveResults) console.log(JSON.stringify({ name, width, min: Math.min(...data.texts.map(item => item.size)), smallText: data.texts.filter(item => item.size < 12).map(item => ({ text: item.text, size: item.size, selector: item.selector })), overflow: data.overflow, visibleControls: data.controls.filter(item => item.inViewport && !item.centerObscured).length, imageFailures: data.imageFailures.length }));
  return { name, width, ...data };
}
module.exports = { snapshot };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [name, hash] of [['home','home'],['journals','community'],['photos','places-photo'],['videos','places-video'],['places-guide','places-guide'],['saved-empty','saved'],['trips-empty','trips'],['profile','profile'],['journal','journey-jeju-west-slow']]) {
        await page.goto(url + '?audit=' + name + width + '#' + hash, { waitUntil: 'domcontentloaded' });
        await page.locator('.app-shell').waitFor();
        if (name === 'journal') await page.locator('.journal-lead').waitFor();
        await snapshot(page, width, name);
      }
      await page.goto(url + '#profile', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '프로필 · 이용 설정', exact: true }).click();
      await page.locator('.phase-three-settings').waitFor();
      await snapshot(page, width, 'preferences');
      await page.getByRole('button', { name: '닫기', exact: true }).click();
      await page.goto(url + '?audit=ai' + width + '#home', { waitUntil: 'domcontentloaded' });
      await page.locator('button.home-find-guides').filter({ hasText: 'AI 여행 만들기' }).click();
      await page.locator('.ai-planner').waitFor();
      await snapshot(page, width, 'ai-input');
      console.log(JSON.stringify({ width, errors, aiControls: await page.locator('.ai-planner button,.ai-planner input,.ai-planner textarea,.ai-planner select').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, text: node.textContent, value: node.value, className: node.className }))) }));
      fs.writeFileSync(out + '/errors-' + width + '.json', JSON.stringify(errors));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
