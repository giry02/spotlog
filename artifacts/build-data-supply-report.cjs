// Generate the independent HTML presentation from the retained data plan.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'docs/DATA_SUPPLY_AND_NAVER_PLAN.md');
const out = path.join(root, 'web/public/reports');
(async () => {
  const { marked } = await import(pathToFileURL('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js'));
  const source = fs.readFileSync(input, 'utf8');
  const tokens = marked.lexer(source);
  const groups = []; let group;
  for (const token of tokens) {
    if (token.type === 'heading') {
      if (token.depth === 1) { group = { title: '문서 범위와 적용 상태', chapter: 'DATA SUPPLY PLAN', blocks: [] }; groups.push(group); }
      else { group = { title: token.text, chapter: token.depth === 2 ? token.text : group.chapter, blocks: [] }; groups.push(group); }
    } else if (token.type !== 'space') group.blocks.push(token);
  }
  const mdLinks = {
    'handoff/DEVELOPMENT_PLAN.md': './spotlog-development-plan.html',
    'handoff/DEVELOPMENT_SUMMARY.md': './spotlog-development-summary.html',
    'handoff/AI_GUIDE_PLAN.md': './spotlog-ai-guide-plan.html',
    'handoff/AI_GUIDE_SUMMARY.md': './spotlog-ai-guide-summary.html',
  };
  function html(raw) {
    return marked.parse(raw.replace(/(?<=\d)~(?=\d)/g, '\\~')).replace(/<table>/g, '<div class="table-wrap compact"><table>').replace(/<\/table>/g, '</table></div>')
      .replace(/<ul>/g, '<ul class="list">').replace(/<th>/g, '<th scope="col">')
      .replace(/<tbody>([\s\S]*?)<\/tbody>/g, (_, rows) => '<tbody>' + rows.replace(/(<tr>\s*)<td>([\s\S]*?)<\/td>/g, '$1<th scope="row">$2</th>') + '</tbody>')
      .replace(/<a href="([^"]+\.md)">([\s\S]*?)<\/a>/g, (_, href, label) => mdLinks[href] ? `<a href="${mdLinks[href]}">${label}</a>` : `<span title="별도 로컬 작업 기록">${label}</span>`);
  }
  // Preserve every paragraph, row and list item. Splitting changes only pagination.
  function units(token) {
    if (token.type === 'table') {
      const lines = token.raw.trim().split('\n'), header = lines.slice(0, 2).join('\n');
      return lines.slice(2).map(row => ({ raw: header + '\n' + row + '\n', tableHeader: header, row, weight: 40 + Math.ceil(row.length / 86) * 25 }));
    }
    if (token.type === 'list') return token.items.map((item, index) => ({ raw: (token.ordered ? `${(token.start || 1) + index}. ` : '- ') + item.text + '\n', weight: 20 + Math.ceil(item.text.length / 110) * 27 }));
    return [{ raw: token.raw, weight: 24 + Math.ceil(token.raw.length / 105) * 27 }];
  }
  const slides = [], pageRaws = [];
  for (const g of groups) {
    let pending = [], weight = 0; const pages = [];
    const flush = () => { if (pending.length) pages.push(pending); pending = []; weight = 0; };
    for (const token of g.blocks) for (const unit of units(token)) {
      const extraHeader = unit.tableHeader && !pending.some(p => p.tableHeader === unit.tableHeader) ? 42 : 0;
      if (pending.length && weight + unit.weight + extraHeader > 480) flush();
      pending.push(unit); weight += unit.weight + extraHeader;
    }
    flush();
    pages.forEach((page, index) => {
      let raw = '', lastHeader = null;
      for (const unit of page) {
        if (unit.tableHeader) {
          if (lastHeader !== unit.tableHeader) raw += '\n\n' + unit.tableHeader + '\n';
          raw += unit.row + '\n'; lastHeader = unit.tableHeader;
        } else { raw += '\n\n' + unit.raw; lastHeader = null; }
      }
      const title = g.title + (pages.length > 1 ? ` · ${index + 1}/${pages.length}` : '');
      slides.push({ title, section: 'SPOTLOG · 데이터 수집 · ' + g.chapter, html: html(raw), sources: [] });
      pageRaws.push(raw);
    });
  }
  const data = { date: '2026.09.13', title: 'Spotlog 데이터 수집 계획서', shortTitle: '데이터 수집 계획', otherTitle: '전체 계획서', otherHref: './spotlog-development-plan.html', slides };
  slides[0] = { ...slides[0], cover: true, title: 'Spotlog<br>데이터 수집 계획서', lead: '장소·사진 수급, 이용 권리, 네이버 검색과 내부 데이터 연결 기준' };
  fs.writeFileSync(path.join(out, 'data-supply-plan.js'), '/* Generated from docs/DATA_SUPPLY_AND_NAVER_PLAN.md. */\nReport.mount(' + JSON.stringify(data, null, 2) + ');\n');
  const md = '# Spotlog 데이터 수집 계획서\n\n2026-09-13 · ' + slides.length + '쪽 · 독립 발표형 문서\n\n[문서 모음](../../web/public/spotlog-documents.html#data) · [발표형 HTML](../../web/public/spotlog-data-supply-plan.html) · [관리 원본](../DATA_SUPPLY_AND_NAVER_PLAN.md)\n\n' + slides.map((s, i) => `<a id="slide-${i + 1}"></a>\n\n## ${String(i + 1).padStart(2, '0')} / ${slides.length} · ${s.title}\n\n${pageRaws[i].trim()}\n\n---\n`).join('\n');
  const mirror = md.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (link, label, href) => {
    if (/^(https?:|\.\.\/|\.\/)/.test(href)) return link;
    const target = path.resolve(path.dirname(input), href);
    return `[${label}](${path.relative(path.join(root, 'docs/handoff'), target).replaceAll('\\', '/')})`;
  }).replace(/(?<=\d)~(?=\d)/g, '\\~');
  fs.writeFileSync(path.join(root, 'docs/handoff/DATA_SUPPLY_PLAN.md'), mirror);
  const normalized = value => value.replace(/\s+/g, ' ').trim();
  const all = normalized(pageRaws.join('\n'));
  for (const token of tokens) if (!['heading', 'space'].includes(token.type)) {
    if (token.type === 'table') for (const line of token.raw.trim().split('\n').slice(2)) assert.ok(all.includes(normalized(line)), 'lost table row');
    else if (token.type === 'list') for (const item of token.items) assert.ok(all.includes(normalized(item.text)), 'lost list item');
    else assert.ok(all.includes(normalized(token.raw)), 'lost paragraph');
  }
  console.log(JSON.stringify({ count: slides.length, titles: slides.map((s, i) => `${i + 1}. ${s.title}`), coverage: 'all paragraphs, table rows and list items preserved' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
