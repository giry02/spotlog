const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'tourapi-plan-order-qa');
fs.mkdirSync(out, { recursive: true });
function load(kind) {
  const context = { window: {} }; let result;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'web/public/reports/report.js'), 'utf8'), context);
  context.Report = { ...context.window.Report, mount(data) { result = data; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, `web/public/reports/${kind}.js`), 'utf8'), context);
  return result;
}
const configs = Object.fromEntries(['development-plan', 'development-summary'].map(kind => [kind, load(kind)]));
const renamed = {
  '1차 · 사진 카드로 확인하는 AI·담기 팝업': '사진 카드로 확인하는 AI·담기 팝업',
  '2차 · 여행기 화면 구조와 독자 이용': '여행기 화면 구조 · 작성과 독자 이용',
  '2차 · 스팟 주변 음식점·숙소 추가': '스팟 중심 일정과 주변 장소 추가',
  '후속 개발 · 백엔드와 콘텐츠 확보 순서': '백엔드와 콘텐츠 확보 순서',
  '후속 개발 · 네이버 연동과 내부 RAG의 경계': '네이버 연동과 내부 RAG의 경계',
  '차수별 기록과 완료 정의': '차수별 기록와 완료 정의',
};
// Only these HTML bodies changed. Other Markdown bodies are retained verbatim.
const changed = new Set([
  'TourAPI 장소·좌표와 공공 사진 활용',
  '1차 추가 범위 · 담기·AI·콘텐츠', '3차 · AI 추천·관광 안내·영어 이용',
  '후속 개발 · 네이버 연동과 내부 RAG의 경계',
]);
const detailedChangesFile = path.join(out, 'detailed-changed-titles.json');
if (fs.existsSync(detailedChangesFile)) for (const title of JSON.parse(fs.readFileSync(detailedChangesFile, 'utf8'))) changed.add(title);
function plain(s) { return s.replace(/<br\s*\/?\s*>/g, ' ').replace(/<[^>]*>/g, ''); }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); const errors = [], records = [], linkChecks = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const [kind, config] of Object.entries(configs)) {
      await page.goto(`http://127.0.0.1:5173/spotlog-${kind}.html`);
      await page.waitForSelector('.slide.active'); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.slide').count(), config.slides.length);
      const mdFile = path.join(root, 'docs/handoff', kind.replaceAll('-', '_').toUpperCase() + '.md');
      const originalMd = fs.readFileSync(mdFile, 'utf8').replaceAll('\r\n', '\n');
      const sections = originalMd.split(/(?=<a id="slide-\d+"><\/a>)/);
      const preamble = sections.shift().replace(/ · \d+쪽/, ` · ${config.slides.length}쪽`).replace(/\n(?:---\n)?\s*$/, '\n');
      const lookup = new Map(sections.map(block => [block.match(/^## \d+ \/ \d+ · (.+)$/m)?.[1], block]));
      const generated = await page.locator('.slide').evaluateAll(slides => {
        const inline = node => {
          if (node.nodeType === Node.TEXT_NODE) return node.textContent;
          const content = [...node.childNodes].map(inline).join('');
          if (node.tagName === 'BR') return '<br>';
          if (['STRONG', 'B'].includes(node.tagName)) return '**' + content + '**';
          if (node.tagName === 'A') {
            let href = node.getAttribute('href');
            if (href?.startsWith('./spotlog-')) href = '../../web/public/' + href.slice(2);
            return '[' + content + '](' + href + ')';
          }
          return content;
        };
        const block = node => {
          if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() ? node.textContent : '';
          if (node.tagName === 'TABLE') {
            const rows = [...node.querySelectorAll('tr')].map(row => '| ' + [...row.children].map(cell => inline(cell).replaceAll('|', '\\|').trim()).join(' | ') + ' |');
            const columns = node.querySelector('tr')?.children.length || 1;
            rows.splice(1, 0, '| ' + Array(columns).fill('---').join(' | ') + ' |');
            return rows.join('\n') + '\n\n';
          }
          if (['UL', 'OL'].includes(node.tagName)) return [...node.children].map((li, i) => (node.tagName === 'OL' ? `${i + 1}. ` : '- ') + inline(li)).join('\n') + '\n\n';
          if (/^H[3-6]$/.test(node.tagName)) return '### ' + inline(node) + '\n\n';
          if (node.tagName === 'P' || node.classList.contains('callout')) return inline(node) + '\n\n';
          return [...node.childNodes].map(block).join('');
        };
        return slides.map(s => ({ title: s.dataset.title, body: block(s.querySelector('.slide-content')).trim(), sources: [...s.querySelectorAll('.slide-footer .sources a')].map(a => inline(a)).join(' · ') }));
      });
      let md = preamble.trimEnd() + '\n\n';
      for (let i = 0; i < config.slides.length; i++) {
        const slide = config.slides[i], title = plain(slide.title);
        const oldTitle = renamed[title] || title;
        const existing = lookup.get(oldTitle) || lookup.get(title);
        if (existing && !changed.has(title)) {
          let preserved = existing.replace(/^<a id="slide-\d+"><\/a>/, `<a id="slide-${i + 1}"></a>`)
            .replace(/^## \d+ \/ \d+ · .+$/m, `## ${String(i + 1).padStart(2, '0')} / ${config.slides.length} · ${title}`);
          const lines = preserved.split('\n'), heading = lines.findIndex(l => l.startsWith('## '));
          const sectionLine = lines.findIndex((l, index) => index > heading && l.trim());
          if (sectionLine >= 0) lines[sectionLine] = slide.section || config.shortTitle;
          preserved = lines.join('\n').replaceAll('원본 상세 46쪽', `원본 상세 ${configs['development-plan'].slides.length}쪽`).replace(/\s*(?:---)?\s*$/, '');
          md += preserved + '\n\n---\n\n';
        } else {
          md += `<a id="slide-${i + 1}"></a>\n\n## ${String(i + 1).padStart(2, '0')} / ${config.slides.length} · ${title}\n\n${slide.section || config.shortTitle}\n\n${slide.lead || ''}\n\n${generated[i].body}\n\n${generated[i].sources ? '출처: ' + generated[i].sources + '\n\n' : ''}---\n\n`;
        }
      }
      assert.equal((md.match(/<a id="slide-\d+"><\/a>/g) || []).length, config.slides.length);
      for (const slide of config.slides) assert.ok(md.includes(plain(slide.title)), slide.title);
      assert.ok(!md.includes('기록와'));
      fs.writeFileSync(mdFile, md.trimEnd() + '\n');
      for (const width of [1440, 320, 390, 460]) {
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        for (let number = 1; number <= config.slides.length; number++) {
          await page.evaluate(n => location.hash = `slide-${n}`, number);
          await page.waitForFunction(n => document.querySelector('.slide.active')?.id === `slide-${n}`, number);
          const metrics = await page.locator('.slide.active').evaluate(s => ({ height: s.offsetHeight, horizontal: document.documentElement.scrollWidth > innerWidth, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 }));
          records.push({ kind, number, width, ...metrics });
          const title = plain(config.slides[number - 1].title);
          if ((width === 1440 && kind.endsWith('summary')) || title.includes('TourAPI') || changed.has(title)) {
            await page.screenshot({ path: path.join(out, `${kind}-${number}-${width}.png`) });
          }
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.keyboard.press('Home'); await page.waitForFunction(() => document.querySelector('.slide.active').id === 'slide-1');
      await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => document.querySelector('.slide.active').id === 'slide-2');
      await page.locator('[data-prev]').click(); await page.waitForFunction(() => document.querySelector('.slide.active').id === 'slide-1');
      await page.locator('[data-next]').click(); await page.waitForFunction(() => document.querySelector('.slide.active').id === 'slide-2');
      await page.locator('[data-toc]').click();
      const tocTitles = await page.locator('dialog .contents-list a').allTextContents();
      for (let i = 0; i < tocTitles.length; i++) assert.equal(tocTitles[i].slice(2), plain(config.slides[i].title));
      await page.locator(`dialog a[href="#slide-${config.slides.length}"]`).click();
      await page.waitForFunction(n => document.querySelector('.slide.active').id === `slide-${n}`, config.slides.length);
      const links = await page.locator('a[href*="spotlog-"]').evaluateAll(a => a.map(link => ({ label: link.textContent, href: link.getAttribute('href') })));
      for (const link of links) {
        const match = link.href.match(/spotlog-(development-(?:plan|summary))\.html#slide-(\d+)/);
        if (match) {
          const target = configs[match[1]]?.slides[Number(match[2]) - 1]; assert.ok(target, link.href);
          linkChecks.push({ kind, ...link, target: plain(target.title) });
        }
      }
      await page.emulateMedia({ media: 'print' });
      const print = await page.locator('.slide').evaluateAll(slides => slides.map(s => ({ number: s.id, overflow: s.scrollHeight > s.clientHeight + 1, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 })));
      records.push({ kind, print });
      for (let i = 0; i < config.slides.length; i++) if (plain(config.slides[i].title).includes('TourAPI') || changed.has(plain(config.slides[i].title))) await page.locator(`#slide-${i + 1}`).screenshot({ path: path.join(out, `${kind}-${i + 1}-print.png`) });
      await page.emulateMedia({ media: 'screen' });
      console.log(`${kind}: ${config.slides.length} pages; Markdown, navigation, screen and print checked`);
    }
    const before = JSON.parse(fs.readFileSync(path.join(out, 'summary-before.json'), 'utf8'));
    const summary = configs['development-summary'];
    assert.equal(summary.slides.length, before.slides.length + 1);
    const joined = summary.slides.map(s => s.html).join('\n');
    for (const slide of before.slides) {
      assert.ok(summary.slides.some(s => (renamed[s.title] || s.title) === slide.title), `lost page ${slide.title}`);
      for (const part of slide.html.match(/<tr>[\s\S]*?<\/tr>|<p class="note">[\s\S]*?<\/p>|<div class="callout">[\s\S]*?<\/div>/g) || []) assert.ok(joined.includes(part), `lost content: ${slide.title} / ${part.slice(0, 80)}`);
    }
    const groups = summary.slides.map(s => s.section.split(' · ')[1]);
    const sortedGroups = ['공통 방향', '1차', '2차', '3차', '후속 개발', '완료 기준'];
    for (let i = 1; i < groups.length; i++) assert.ok(sortedGroups.indexOf(groups[i]) >= sortedGroups.indexOf(groups[i - 1]), 'phase order regressed');
  } finally { await browser.close(); }
  const failures = records.filter(r => r.horizontal || r.overlap || (r.width === 1440 && r.height > 770) || r.print?.some(p => p.overflow || p.overlap));
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ counts: Object.fromEntries(Object.entries(configs).map(([k, v]) => [k, v.slides.length])), errors, records, linkChecks, failures }, null, 2));
  console.log(JSON.stringify({ checked: records.filter(r => r.number).length, errors, failures }));
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
})().catch(e => { console.error(e); process.exitCode = 1; });
