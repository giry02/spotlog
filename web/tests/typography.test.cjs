const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const web = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(web, 'src/styles.css'), 'utf8');
const root = css.match(/:root\s*\{([^}]+)\}/)[1];
const tokens = Object.fromEntries([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), m[2]]);
const value = (name, seen = new Set()) => {
  assert.ok(!seen.has(name), 'Circular font token: ' + name);
  seen.add(name);
  assert.ok(tokens[name], 'Missing font token: ' + name);
  const alias = tokens[name].match(/^var\((--[\w-]+)\)$/);
  return alias ? value(alias[1], seen) : tokens[name];
};

test('existing base type sizes remain stable', () => {
  for (const [name, size] of Object.entries({ 'title-lg':28, title:22, headline:18, body:16, subhead:14, caption:12, micro:11 })) {
    assert.equal(value('--type-' + name), size + 'px');
  }
});

for (const [selector, role, expected] of [
  ['.detail-creator-numbers span', 'stat-label', 12],
  ['.detail-creator-numbers strong', 'stat-value', 18],
  ['.creator-journey-list strong', 'related-title', 16],
  ['.creator-journey-list small', 'related-meta', 11],
  ['.creator-journey-list em', 'related-meta', 11],
]) {
  test(selector + ' uses the named role without a duplicate override', () => {
    const matching = rules.filter(([s]) => s === selector);
    assert.equal(matching.length, 1);
    const sizes = [...matching[0][1].matchAll(/font-size\s*:\s*([^;]+);/g)];
    assert.equal(sizes.length, 1);
    assert.equal(sizes[0][1].trim(), 'var(--type-' + role + ')');
    assert.equal(value('--type-' + role), expected + 'px');
  });
}

test('readable guide and in-app guide retain the same typography rules and rows', () => {
  const catalog = fs.readFileSync(path.join(web, 'src/styleGuideCatalog.ts'), 'utf8');
  const html = fs.readFileSync(path.join(web, 'public/spotlog-design-guide.html'), 'utf8');
  const typography = catalog.split('export const buttonRoles')[0];
  const strings = [...typography.matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(strings.length > 40);
  for (const text of strings) assert.ok(html.includes(text), 'Missing or mismatched guide content: ' + text);
});
