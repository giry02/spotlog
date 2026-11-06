const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = 'C:/Users/Giry/Documents/Spotlog';
const fixtureDirectory = path.join(root, 'web/tests/fixtures/busan-media-sources');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/spotlog/busan-business/ATTRIBUTION.json'), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const index = {};
fs.mkdirSync(fixtureDirectory, { recursive: true });

function extractElement(html, expression, label) {
  const match = expression.exec(html);
  assert.ok(match, `Missing original ${label}`);
  const tag = match[0].match(/^<(\w+)\b/)[1];
  const tokens = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}\\s*>`, 'g');
  tokens.lastIndex = match.index;
  let depth = 0, token;
  while ((token = tokens.exec(html))) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return { label, start: match.index, end: tokens.lastIndex, html: html.slice(match.index, tokens.lastIndex) };
  }
  throw new Error(`Unclosed original ${label}`);
}

for (const source of manifest) {
  const recordId = new URL(source.sourceUrl).searchParams.get('dataSid');
  const raw = fs.readFileSync(path.join(root, `artifacts/busan-business-20261012/media-sources/${recordId}.html`));
  const original = raw.toString('utf8');
  const sections = [extractElement(original, /<div class="viewTitleBox">/, 'original-title')];
  if (source.address) {
    const addressIndex = original.indexOf('<div class="lctAticle">주소');
    assert.ok(addressIndex >= 0, `${recordId}: Missing original address`);
    const start = original.lastIndexOf('<div class="lctInfoTxt">', addressIndex);
    assert.ok(start >= 0);
    const section = extractElement(original.slice(start), /<div class="lctInfoTxt">/, 'original-address');
    section.start += start; section.end += start;
    sections.push(section);
  }
  sections.push(extractElement(original, /<ul class="contInfoList">/, 'original-file-metadata'));
  sections.push(extractElement(original, /<div class="ggnrTxt">/, 'individual-photo-license'));
  for (const section of sections) assert.equal(original.slice(section.start, section.end), section.html);
  // Keep the source wording and tags; remove only HTML indentation and empty
  // whitespace lines so copied metadata does not introduce Git whitespace errors.
  const cleanWhitespace = html => html.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n');
  const body = sections.map(section => `<!-- ${section.label} -->\n${cleanWhitespace(section.html)}`).join('\n\n') + '\n';
  assert.ok(!/<script\b|<img\b|\son\w+\s*=|descriptionText|tourresourcesnm/i.test(body));
  const provenance = `<!-- Original source fragments; HTML indentation and blank lines cleaned. Not a rendered page.\nSource: ${source.sourceUrl}\nVerified: ${source.verifiedAt}\nOriginal HTML SHA256: ${sha256(raw)}\n-->\n`;
  const fixture = provenance + body;
  assert.ok(Buffer.byteLength(fixture) < 10_000, `${recordId}: Fixture unexpectedly large`);
  fs.writeFileSync(path.join(fixtureDirectory, `${recordId}.html`), fixture);
  index[recordId] = {
    sourceUrl: source.sourceUrl, verifiedAt: source.verifiedAt,
    originalHtmlSha256: sha256(raw), fixtureSha256: sha256(fixture),
    whitespaceNormalization: 'Trim line indentation/trailing whitespace and omit empty whitespace lines; source words and HTML tags unchanged.',
    excerpts: sections.map(({ label, start, end, html }) => ({ label, start, end, sha256: sha256(html), fixtureExcerptSha256: sha256(cleanWhitespace(html)) })),
  };
}
fs.writeFileSync(path.join(fixtureDirectory, 'sources.json'), JSON.stringify(index, null, 2) + '\n');
console.log({ fixtures: Object.keys(index).length, bytes: fs.readdirSync(fixtureDirectory).reduce((total, file) => total + fs.statSync(path.join(fixtureDirectory, file)).size, 0) });
