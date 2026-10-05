// One-time, content-preserving report order migration. No product files are touched.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'web/public/reports/development-summary.js');
const source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('Report.mount(') + 'Report.mount('.length;
const data = JSON.parse(source.slice(start, source.lastIndexOf(');')));
assert.equal(data.slides.length, 18, 'Run only against the original 18-page summary');
const original = structuredClone(data);
const order = [1, 2, 3, 5, 15, 16, 6, 12, 14, 18, 7, 4, 13, 8, 9, 10, 17, 11];
assert.equal(new Set(order).size, original.slides.length);
data.slides = order.map(number => original.slides[number - 1]);
for (const [index, slide] of data.slides.entries()) {
  const group = index < 6 ? '공통 방향' : index < 10 ? '1차' : index < 14 ? '2차' : index < 15 ? '3차' : index < 17 ? '후속 개발' : '완료 기준';
  slide.section = `SPOTLOG · ${group} · ${index + 1}`;
}
// All original content and links must survive the reorder verbatim.
for (const slide of original.slides) {
  const result = data.slides.find(candidate => candidate.title === slide.title);
  for (const key of ['title', 'lead', 'html', 'sources']) assert.deepEqual(result[key], slide[key]);
}
fs.mkdirSync(path.join(root, 'artifacts/tourapi-plan-order-qa'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/tourapi-plan-order-qa/summary-before.json'), JSON.stringify(original, null, 2));
fs.writeFileSync(path.join(root, 'artifacts/tourapi-plan-order-qa/order-map.json'), JSON.stringify(order.map((oldNumber, index) => ({ oldNumber, newNumber: index + 1, title: data.slides[index].title })), null, 2));
fs.writeFileSync(file, source.slice(0, start) + JSON.stringify(data, null, 2) + ');\n');
console.log(order.map((oldNumber, index) => `${oldNumber} -> ${index + 1}: ${data.slides[index].title}`).join('\n'));
