import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationTimeInput, publicationTimeStored, exposureBoundaryDelay } from '../src/admin/opsTime.ts';

test('ISO publication instants display in the local minute picker, with explicit edits stored as UTC', () => {
  for (const input of ['2026-10-10T03:12:45.123Z', '2026-10-10T12:12:45.000+09:00']) {
    const display = publicationTimeInput(input);
    assert.match(display, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(publicationTimeStored(display), new Date(display).toISOString());
    assert.ok(new Date(input).getTime() - new Date(display).getTime() < 60_000);
  }
  assert.equal(publicationTimeInput(''), ''); assert.equal(publicationTimeStored(''), '');
  assert.equal(publicationTimeInput('invalid'), ''); assert.equal(publicationTimeStored('invalid'), 'invalid');
});

test('exposure clock targets the next enabled start/end and has no timer after the last boundary', () => {
  const now = Date.parse('2026-10-10T00:00:00Z'), at = delta => new Date(now + delta).toISOString();
  const entries = [{ enabled: true, startsAt: at(2000), endsAt: at(4000) }, { enabled: false, startsAt: at(100), endsAt: '' }, { enabled: true, startsAt: 'invalid', endsAt: at(-1) }];
  assert.equal(exposureBoundaryDelay(entries, now), 2010);
  assert.equal(exposureBoundaryDelay(entries, now + 2000), 2010);
  assert.equal(exposureBoundaryDelay(entries, now + 4000), null);
  assert.equal(exposureBoundaryDelay([], now), null);
  assert.equal(exposureBoundaryDelay([{ enabled: true, startsAt: at(3_000_000_000), endsAt: '' }], now), 2_147_483_647);
});
