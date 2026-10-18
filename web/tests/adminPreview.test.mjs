import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Exercise the real bundled catalog with deterministic image URLs in Node.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.')) for (const suffix of ['.ts', '.tsx']) {
        const url = new URL(specifier + suffix, context.parentURL);
        if (fs.existsSync(url)) return next(url.href, context);
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (/\.(jpg|jpeg|webp|png|svg)$/.test(url)) return { format: 'module', source: 'export default ' + JSON.stringify('/test-assets/' + fileURLToPath(url).split(/[\\/]/).pop()), shortCircuit: true };
    return next(url, context);
  },
});
const { ADMIN_PREVIEW_STORAGE_KEY, createPreviewAdminAdapter } = await import('../src/admin/previewAdapter.ts');
const { ADMIN_STORAGE_KEY, assertAdminState } = await import('../src/admin/repository.ts');
const { REVIEW_SERVICE_KEY } = await import('../src/reviewServiceBridge.ts');
const { activatePreviewDraftStorage, getPreviewDraftStorage } = await import('../src/admin/previewDraftStorage.ts');
hooks.deregister();

const memory = () => {
  const values = new Map(), reads = [], writes = [];
  return { values, reads, writes, getItem(key) { reads.push(key); return values.get(key) ?? null; }, setItem(key, value) { writes.push(key); values.set(key, value); } };
};
const command = (state, input, key = crypto.randomUUID()) => ({ ...input, expectedRevision: state.revision, idempotencyKey: key });
const inactivate = { kind: 'place.inactivate', payload: { placeId: 'review-food', reason: '예시 업체 상태 변경' } };

test('preview seed and session use real DTOs and never read or write operating/customer stores', async () => {
  const store = memory();
  for (const key of [ADMIN_STORAGE_KEY, REVIEW_SERVICE_KEY, 'spotlog-customer-private']) store.values.set(key, 'PRIVATE_' + key);
  const before = new Map(store.values), adapter = createPreviewAdminAdapter(store), actor = await adapter.session(), state = await adapter.load();
  assert.equal(adapter.mode, 'LOCAL'); assertAdminState(state);
  assert.ok(state.ops.operators.some(operator => operator.operatorId === actor.operatorId && operator.active));
  assert.equal(JSON.stringify(state).includes('PRIVATE_'), false);
  assert.deepEqual([...new Set(store.reads)], [ADMIN_PREVIEW_STORAGE_KEY]);
  assert.deepEqual([...new Set(store.writes)], [ADMIN_PREVIEW_STORAGE_KEY]);
  for (const [key, value] of before) assert.equal(store.values.get(key), value);
});

test('preview changes persist across reload only in the dedicated preview key', async () => {
  const store = memory(), first = createPreviewAdminAdapter(store), actor = await first.session(), state = await first.load();
  const result = await first.execute(command(state, inactivate), actor);
  const reloaded = await createPreviewAdminAdapter(store).load();
  assert.equal(reloaded.places.find(place => place.placeId === 'review-food').state, 'INACTIVE');
  assert.equal(reloaded.revision, state.revision + 1); assert.deepEqual(reloaded, result.state);
  result.state.places[0].draft.name = 'caller mutation';
  assert.notEqual((await first.load()).places[0].draft.name, 'caller mutation');
  assert.deepEqual([...new Set([...store.reads, ...store.writes])], [ADMIN_PREVIEW_STORAGE_KEY]);
});

test('preview commands preserve revision conflict, duplicate request and permission rules', async () => {
  const adapter = createPreviewAdminAdapter(null), actor = await adapter.session(), state = await adapter.load();
  const request = command(state, inactivate, 'preview-repeat'), result = await adapter.execute(request, actor);
  const repeated = await adapter.execute(request, actor);
  assert.equal(repeated.replayed, true); assert.equal(repeated.state.audit.length, result.state.audit.length);
  await assert.rejects(adapter.execute({ ...request, idempotencyKey: 'new-stale-request' }, actor), issue => issue.code === 'CONFLICT');
  await assert.rejects(adapter.execute(command(result.state, inactivate), { ...actor, role: 'VISITOR' }));
  await assert.rejects(adapter.execute(command(result.state, inactivate), { ...actor, operatorId: 'real-user-injection' }), issue => issue.code === '403');
  assert.equal((await adapter.load()).revision, result.state.revision);
});

test('all seven menu resources are queryable from examples without API access', async () => {
  const adapter = createPreviewAdminAdapter(null);
  for (const resource of ['places', 'regions', 'ops.exposures', 'ops.journals', 'ops.comments', 'ops.reports', 'ops.members', 'ops.inquiries', 'ai.indices', 'ai.fixtures', 'ai.requests', 'ops.connections', 'audit']) {
    const page = await adapter.query({ resource, page: 1, pageSize: 2 });
    assert.ok(Array.isArray(page.items), resource); assert.ok(page.items.length <= 2, resource); assert.ok(page.total >= page.items.length, resource);
  }
  await assert.rejects(adapter.query({ resource: 'privateTrips' }));
});

test('corrupt or unsafe saved preview is preserved and never replaced by samples', async () => {
  const store = memory(), adapter = createPreviewAdminAdapter(store);
  store.values.set(ADMIN_PREVIEW_STORAGE_KEY, '{broken');
  await assert.rejects(adapter.load(), issue => issue.code === 'STORAGE');
  assert.equal(store.values.get(ADMIN_PREVIEW_STORAGE_KEY), '{broken'); assert.equal(store.writes.length, 0);
  const healthy = await createPreviewAdminAdapter(null).load();
  healthy.ops.journals.find(journal => journal.ownerVisibility !== 'PUBLIC').original = 'private-original';
  const invalid = JSON.stringify(healthy); store.values.set(ADMIN_PREVIEW_STORAGE_KEY, invalid);
  await assert.rejects(adapter.load(), issue => ['PRIVATE_DATA', 'INVALID_RESPONSE'].includes(issue.code));
  assert.equal(store.values.get(ADMIN_PREVIEW_STORAGE_KEY), invalid); assert.equal(store.writes.length, 0);
});

test('blocked browser storage falls back to independent memory without localStorage access', async () => {
  const priorWindow = global.window;
  let sessionAttempts = 0, localAttempts = 0;
  global.window = { get sessionStorage() { sessionAttempts++; throw new Error('blocked'); }, get localStorage() { localAttempts++; throw new Error('must not access'); } };
  try {
    const first = createPreviewAdminAdapter(), actor = await first.session(), state = await first.load();
    await first.execute(command(state, inactivate), actor);
    assert.equal((await first.load()).places.find(place => place.placeId === 'review-food').state, 'INACTIVE');
    assert.equal((await createPreviewAdminAdapter().load()).places.find(place => place.placeId === 'review-food').state, 'PUBLISHED');
    assert.equal(sessionAttempts, 2); assert.equal(localAttempts, 0);
  } finally { global.window = priorWindow; }
});

test('default browser preview touches only its session key and does not inspect local records', async () => {
  const priorWindow = global.window, store = memory();
  let localReads = 0;
  store.values.set(ADMIN_STORAGE_KEY, 'REAL_ADMIN_SENTINEL');
  store.values.set(REVIEW_SERVICE_KEY, 'CUSTOMER_BRIDGE_SENTINEL');
  global.window = { sessionStorage: store, get localStorage() { localReads++; throw new Error('no local records'); } };
  try {
    const adapter = createPreviewAdminAdapter(), actor = await adapter.session(), state = await adapter.load();
    await adapter.execute(command(state, inactivate), actor);
    const reloaded = await createPreviewAdminAdapter().load();
    assert.equal(reloaded.places.find(place => place.placeId === 'review-food').state, 'INACTIVE');
    assert.deepEqual([...new Set([...store.reads, ...store.writes])], [ADMIN_PREVIEW_STORAGE_KEY]);
    assert.equal(store.values.get(ADMIN_STORAGE_KEY), 'REAL_ADMIN_SENTINEL');
    assert.equal(store.values.get(REVIEW_SERVICE_KEY), 'CUSTOMER_BRIDGE_SENTINEL'); assert.equal(localReads, 0);
  } finally { global.window = priorWindow; }
});

test('storage read/write refusal keeps current workspace usable in memory only', async () => {
  for (const operation of ['getItem', 'setItem']) {
    const store = memory(); store[operation] = () => { throw new Error('storage blocked'); };
    const adapter = createPreviewAdminAdapter(store), actor = await adapter.session(), state = await adapter.load();
    await adapter.execute(command(state, inactivate), actor);
    assert.equal((await adapter.load()).places.find(place => place.placeId === 'review-food').state, 'INACTIVE');
  }
});

test('preview load/query/mutation dispatch no customer bridge events and perform no fetch', async () => {
  const priorWindow = global.window, priorFetch = global.fetch;
  let events = 0, requests = 0;
  global.window = { dispatchEvent() { events++; throw new Error('no bridge'); } };
  global.fetch = async () => { requests++; throw new Error('no API'); };
  try {
    const adapter = createPreviewAdminAdapter(null), actor = await adapter.session(), state = await adapter.load();
    await adapter.query({ resource: 'places' }); await adapter.execute(command(state, inactivate), actor); await adapter.load();
    assert.equal(events, 0); assert.equal(requests, 0);
  } finally { global.window = priorWindow; global.fetch = priorFetch; }
});

test('preview editor draft scope uses page memory and restores the previous boundary', () => {
  const priorWindow = global.window;
  let browserReads = 0;
  global.window = { get localStorage() { browserReads++; throw new Error('no operating drafts'); }, get sessionStorage() { browserReads++; throw new Error('no browser drafts'); } };
  try {
    assert.equal(getPreviewDraftStorage(), null);
    const restore = activatePreviewDraftStorage(), drafts = getPreviewDraftStorage();
    drafts.setItem('spotlog.admin.editor.draft', 'preview-input');
    assert.equal(drafts.getItem('spotlog.admin.editor.draft'), 'preview-input');
    const restoreNested = activatePreviewDraftStorage();
    assert.equal(getPreviewDraftStorage().getItem('spotlog.admin.editor.draft'), null);
    getPreviewDraftStorage().setItem('nested', 'isolated'); restoreNested();
    assert.equal(getPreviewDraftStorage(), drafts); assert.equal(drafts.getItem('nested'), null);
    drafts.removeItem('spotlog.admin.editor.draft');
    assert.equal(drafts.getItem('spotlog.admin.editor.draft'), null);
    restore(); assert.equal(getPreviewDraftStorage(), null); assert.equal(browserReads, 0);
  } finally { global.window = priorWindow; }
});

test('project-path preview rebases all nested example placeholders while preserving real assets and source data', async () => {
  const normal = await createPreviewAdminAdapter(null).load();
  const nested = await createPreviewAdminAdapter(null, '/spotlog/').load();
  assert.equal(normal.places.find(place => place.placeId === 'review-food').draft.media[0].url, '/admin-review.svg');
  assert.equal(nested.places.find(place => place.placeId === 'review-food').draft.media[0].url, '/spotlog/admin-review.svg');
  let placeholders = 0, realImages = 0;
  function compare(before, after, path = '') {
    if (before === '/admin-review.svg') { placeholders++; assert.equal(after, '/spotlog/admin-review.svg', path); }
    else if (before && typeof before === 'object') {
      assert.deepEqual(Object.keys(after), Object.keys(before), path);
      for (const key of Object.keys(before)) compare(before[key], after[key], path + '/' + key);
    } else {
      assert.equal(after, before, path);
      if (typeof before === 'string' && /\.(jpg|webp|png)$/.test(before)) realImages++;
    }
  }
  compare(normal, nested); assert.ok(placeholders > 6); assert.ok(realImages > 0);
  assert.equal(JSON.stringify(nested).includes('"/admin-review.svg"'), false);
  for (const base of ['//evil.example/', '/spotlog/../', '/spotlog/./', '/spotlog/?query=', 'https://example.org/', '/spotlog\\']) {
    assert.throws(() => createPreviewAdminAdapter(null, base), issue => issue.code === 'VALIDATION');
  }
});
