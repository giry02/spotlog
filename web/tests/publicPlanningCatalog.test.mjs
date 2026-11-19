import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { loadPublicPlanningCatalog, projectPublicPlanningCatalog } from '../server/publicPlanningCatalog.mjs';

const run = promisify(execFile);
const sample = {
  id: 'public-cafe', kind: 'CAFE', name: '공개 카페', area: '부산 해운대',
  address: '주소', description: '  바다   전망 ', tags: ['바다', ' 바다 ', '카페'],
  image: 'private-image', note: 'private-note', creator: 'private-profile',
  lat: 35.1, lng: 129.2, locationVerified: true,
};
const regionForPlace = () => '부산';

test('projects only public catalogue facts and verified coordinate pairs', () => {
  const output = projectPublicPlanningCatalog([
    sample, { ...sample, id: 'private', personal: true }, { ...sample, id: 'booked', bookingFixed: true },
    { ...sample, id: 'unverified', locationVerified: false },
  ], regionForPlace);
  assert.deepEqual(output, [
    { id: 'public-cafe', kind: 'CAFE', name: '공개 카페', area: '부산 해운대', region: '부산', description: '바다 전망', tags: ['바다', '카페'], lat: 35.1, lng: 129.2 },
    { id: 'unverified', kind: 'CAFE', name: '공개 카페', area: '부산 해운대', region: '부산', description: '바다 전망', tags: ['바다', '카페'] },
  ]);
});

test('fails closed on duplicate IDs, unsupported fields and incomplete coordinates', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'spotlog-catalog-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalog = join(directory, 'catalog.json');
  const [row] = projectPublicPlanningCatalog([sample], regionForPlace);
  for (const value of [[row, row], [{ ...row, privateNote: 'private' }], [{ ...row, lng: undefined }], []]) {
    await writeFile(catalog, JSON.stringify(value));
    await assert.rejects(loadPublicPlanningCatalog(catalog), /공개 장소 목록/);
  }
});

test('exports the app build’s real public places without browser or admin storage', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'spotlog-catalog-export-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalog = join(directory, 'catalog.json');
  const exporter = fileURLToPath(new URL('../server/exportPlanningCatalog.mjs', import.meta.url));
  await run(process.execPath, [exporter, catalog]);
  const rows = await loadPublicPlanningCatalog(catalog);
  assert.equal(rows.find(row => row.id === 'catalog-busan-bibibidang')?.region, '부산');
  assert.ok(rows.some(row => row.region === '제주' && row.kind === 'LANDMARK'));
  assert.ok(rows.some(row => row.region === '부산' && row.kind === 'STAY'));
  assert.ok(rows.every(row => !Object.hasOwn(row, 'image') && !Object.hasOwn(row, 'address')));
});
