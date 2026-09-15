import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root = new URL('../../', import.meta.url);
const sources = JSON.parse(fs.readFileSync(new URL('assets/spotlog/licensed-places/ATTRIBUTION.json', root), 'utf8'));

test('six discovery places have distinct actual photo files and complete reusable attribution', () => {
  const expectedCounts = { 'jeju-hyeopjae': 2, 'jeju-osulloc': 2, 'jeju-sagye': 2, 'jeju-saebyeol': 2, 'seoul-seoulforest': 1, 'gangneung-anmok': 1 };
  const counts = {};
  const seen = new Set();
  for (const source of sources) {
    counts[source.placeId] = (counts[source.placeId] || 0) + 1;
    for (const key of ['id', 'author', 'originalTitle', 'sourceUrl', 'imageSourceUrl', 'licenseUrl', 'verifiedAt', 'changes']) assert.ok(source[key], `${source.id}: ${key}`);
    assert.ok(['CC BY-SA 3.0', 'CC BY-SA 4.0'].includes(source.license));
    assert.equal(new URL(source.sourceUrl).hostname, 'commons.wikimedia.org');
    assert.equal(new URL(source.licenseUrl).hostname, 'creativecommons.org');
    const bytes = fs.readFileSync(new URL(source.path, root));
    assert.equal(bytes.readUInt16BE(0), 0xffd8, 'download must be JPEG, not an error page');
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash, source.sha256, `${source.id}: downloaded asset changed`);
    assert.ok(!seen.has(hash), 'different gallery items must not duplicate the same file');
    seen.add(hash);
  }
  assert.deepEqual(counts, expectedCounts);
});
