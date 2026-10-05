// Mechanical subsection move and numbering update after the summary reorder.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const file = 'web/public/reports/development-summary.js';
const source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('Report.mount(') + 'Report.mount('.length;
const data = JSON.parse(source.slice(start, source.lastIndexOf(');')));
assert.equal(data.slides.length, 19);
const get = title => { const slide = data.slides.find(s => s.title === title); assert.ok(slide, title); return slide; };
const phaseOne = get('1차 추가 범위 · 담기·AI·콘텐츠');
function moveRow(label, targetTitle) {
  const pattern = new RegExp('<tr><th scope="row">' + label + '</th><td>[\\s\\S]*?</td></tr>');
  const row = phaseOne.html.match(pattern)?.[0];
  assert.ok(row, label);
  phaseOne.html = phaseOne.html.replace(row, '');
  const target = get(targetTitle);
  target.html = target.html.replace('</tbody>', row + '</tbody>');
}
moveRow('외부 검색 변경', '후속 개발 · 네이버 연동과 내부 RAG의 경계');
moveRow('3차와 백엔드 이후', '3차 · AI 추천·관광 안내·영어 이용');
for (const [index, slide] of data.slides.entries()) {
  const group = index < 7 ? '공통 방향' : index < 11 ? '1차' : index < 15 ? '2차' : index < 16 ? '3차' : index < 18 ? '후속 개발' : '완료 기준';
  slide.section = `SPOTLOG · ${group} · ${index + 1}`;
}
fs.writeFileSync(file, source.slice(0, start) + JSON.stringify(data, null, 2) + ');\n');
console.log(data.slides.map((s, i) => `${i + 1}: ${s.section} / ${s.title}`).join('\n'));
