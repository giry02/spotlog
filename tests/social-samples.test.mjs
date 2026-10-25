import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { getSocialSample, findSampleThread, SAMPLE_SOCIAL_ID_PREFIX } = await import('../lib/social-samples.ts');
const { communityTrips } = await import('../lib/community-trips.ts');
const { places, restaurants, stays } = await import('../lib/trip-data.ts');
const { resolveSocialTarget } = await import('../lib/social-target.ts');
const { createEmptySocialStore, applySocialAction, parseSocialStore, selectSocialComments, getSocialReaction } = await import('../lib/spotlog-social.ts');
const { commitSocialAction, readSocialStorage } = await import('../lib/spotlog-social-client.ts');

const entity = { kind: 'entity', id: 'hyeopjae' };
const course = { kind: 'course', id: 'community-jeju-west-real-11' };
const card = { kind: 'course-place', id: course.id, visitIndex: 0 };
const time = '2026-10-25T01:00:00.000Z';
let sequence = 0;
const deps = { now: () => time, id: () => `sample-test-own-${++sequence}` };
const run = (store, action, dependencies = deps) => {
  const result = applySocialAction(store, action, dependencies);
  assert.equal(result.ok, true, result.error);
  return result.store;
};

test('all public targets have deterministic, distinct-scope sample roots and one-level replies', () => {
  const targets = [
    ...[...places, ...restaurants, ...stays].map(item => ({ kind: 'entity', id: item.id })),
    ...communityTrips.flatMap(trip => [{ kind: 'course', id: trip.id }, ...trip.visits.map((_, visitIndex) => ({ kind: 'course-place', id: trip.id, visitIndex }))]),
  ];
  const keys = new Set(), ids = new Set();
  for (const target of targets) {
    const resolved = resolveSocialTarget(target);
    assert.ok(resolved);
    if (keys.has(resolved.key)) continue;
    keys.add(resolved.key);
    const sample = getSocialSample(target);
    assert.equal(sample.source, 'SAMPLE');
    assert.equal(getSocialSample({ ...target }), sample);
    assert.equal(sample.threads.length, 4);
    assert.equal(sample.threads.filter(thread => thread.parentId === null).length, 2);
    assert.equal(sample.copies === null, target.kind !== 'course');
    assert.ok(Object.values(sample.reactions).every(value => Number.isSafeInteger(value) && value >= 0));
    if (resolved.reactionMode === 'like') assert.equal(sample.reactions.LOVE + sample.reactions.BEST + sample.reactions.HELPFUL, 0);
    else assert.equal(sample.reactions.LIKE, 0);
    for (const thread of sample.threads) {
      assert.ok(thread.id.startsWith(SAMPLE_SOCIAL_ID_PREFIX));
      assert.ok(thread.id.length <= 96);
      assert.equal(ids.has(thread.id), false, `Cross-scope collision: ${resolved.key}`);
      ids.add(thread.id);
      assert.ok(Array.from(thread.body).length <= resolved.commentLimit);
      assert.ok(thread.author.id.startsWith('sample-person-'));
      assert.ok(thread.author.name && thread.author.initial);
      if (thread.parentId) {
        const parent = findSampleThread(target, thread.parentId);
        assert.ok(parent);
        assert.equal(parent.parentId, null);
        assert.ok(thread.createdAt >= parent.createdAt);
      }
    }
  }
  assert.ok(keys.size > 100);
  assert.equal(getSocialSample({ kind: 'entity', id: 'unknown' }), null);
});

test('sample community is deeply immutable and stays outside the own-record store', () => {
  const sample = getSocialSample(course);
  assert.equal(sample.copies, 236);
  assert.deepEqual(sample.reactions, { LIKE: 0, LOVE: 82, BEST: 63, HELPFUL: 114 });
  assert.equal(Object.isFrozen(sample), true);
  assert.equal(Object.isFrozen(sample.reactions), true);
  assert.equal(Object.isFrozen(sample.threads), true);
  assert.equal(Object.isFrozen(sample.threads[0]), true);
  assert.equal(Object.isFrozen(sample.threads[0].author), true);
  assert.throws(() => sample.reactions.BEST++);
  assert.throws(() => sample.threads.push(sample.threads[0]));
  assert.throws(() => sample.threads[0].body = '샘플 수정 시도');
  assert.throws(() => sample.threads[0].author.name = '샘플 이름 수정 시도');
  assert.deepEqual(createEmptySocialStore(), { version: 1, comments: [], reactions: [] });
  assert.equal(selectSocialComments(createEmptySocialStore(), course).length, 0);
});

test('all 11 Jeju places have curated planning conversations without reusing course-block identities', () => {
  const trip = communityTrips.find(item => item.id === course.id);
  assert.equal(trip.visits.length, 11);
  for (let visitIndex = 0; visitIndex < trip.visits.length; visitIndex++) {
    const visit = trip.visits[visitIndex];
    const globalTarget = { kind: 'entity', id: visit.entityId };
    const blockTarget = { kind: 'course-place', id: course.id, visitIndex };
    const global = getSocialSample(globalTarget), block = getSocialSample(blockTarget);
    assert.notEqual(global.threads[0].id, block.threads[0].id);
    assert.match(block.threads[0].body, new RegExp(`DAY ${visit.day}`));
    assert.ok(block.threads[0].body.includes(resolveSocialTarget(blockTarget).title));
    assert.equal(findSampleThread(globalTarget, block.threads[0].id), null);
  }
});

test('a local reply to a sample root round-trips the unchanged v1 storage schema', () => {
  const sampleParent = getSocialSample(card).threads[0];
  let store = run(createEmptySocialStore(), { type: 'add-comment', target: card, body: '제 여행은 오후에 카페를 더 넣었어요.', parentId: sampleParent.id });
  assert.equal(store.version, 1);
  assert.equal(store.comments.length, 1);
  assert.equal(store.comments[0].parentId, sampleParent.id);
  assert.equal(selectSocialComments(store, card).length, 1);
  const raw = JSON.stringify(store);
  assert.equal(raw.includes(sampleParent.body), false);
  assert.equal(raw.includes(sampleParent.author.name), false);
  assert.deepEqual(parseSocialStore(raw), { ok: true, store });
  const id = store.comments[0].id;
  store = run(store, { type: 'edit-comment', id, body: '제 여행은 쉬는 시간을 더 늘렸어요.' });
  store = run(store, { type: 'delete-comment', id });
  assert.equal(store.comments[0].deletedAt, time);
  store = run(store, { type: 'restore-comment', id });
  assert.equal(store.comments[0].deletedAt, null);
  assert.equal(store.comments[0].parentId, sampleParent.id);
  assert.equal(parseSocialStore(JSON.stringify(store)).ok, true);
});

test('forged sample IDs, cross-target parents, nested replies and time travel are rejected', () => {
  const [root, reply] = getSocialSample(card).threads;
  const empty = createEmptySocialStore();
  const add = (target, parentId, dependencies = deps) => applySocialAction(empty, { type: 'add-comment', target, body: '직접 답글', parentId }, dependencies);
  for (const result of [add(entity, root.id), add(course, root.id), add(card, reply.id), add(card, `${SAMPLE_SOCIAL_ID_PREFIX}invented`), add(card, root.id, { ...deps, now: () => '2026-10-22T01:00:00.000Z' })]) {
    assert.equal(result.ok, false);
    assert.equal(result.store, empty);
  }
  const good = run(empty, { type: 'add-comment', target: card, body: '직접 답글', parentId: root.id });
  for (const comment of [
    { ...good.comments[0], target: entity },
    { ...good.comments[0], parentId: reply.id },
    { ...good.comments[0], createdAt: '2026-10-22T01:00:00.000Z' },
    { ...good.comments[0], id: root.id },
  ]) assert.equal(parseSocialStore(JSON.stringify({ ...good, comments: [comment] })).ok, false);
  for (const type of ['edit-comment', 'delete-comment', 'restore-comment']) {
    const action = { type, id: root.id, ...(type === 'edit-comment' ? { body: '타인의 샘플 수정 시도' } : {}) };
    assert.equal(applySocialAction(empty, action, deps).ok, false);
  }
  assert.equal(applySocialAction(empty, { type: 'add-comment', target: card, body: '식별자 충돌' }, { ...deps, id: () => root.id }).ok, false);
});

test('existing v1 own conversations remain readable alongside new sample replies', () => {
  let store = run(createEmptySocialStore(), { type: 'add-comment', target: entity, body: '이전부터 보관하던 기록' });
  const ownParent = store.comments[0].id;
  store = run(store, { type: 'add-comment', target: entity, body: '이전 기록에 답글', parentId: ownParent });
  const existingRaw = JSON.stringify(store);
  assert.equal(parseSocialStore(existingRaw).ok, true);
  store = run(store, { type: 'add-comment', target: entity, body: '다른 사람의 샘플에 답글', parentId: getSocialSample(entity).threads[0].id });
  assert.deepEqual(store.comments.slice(0, 2), JSON.parse(existingRaw).comments);
  assert.equal(parseSocialStore(JSON.stringify(store)).ok, true);
});

test('counts use an immutable baseline and exactly one own reaction which can switch or cancel', () => {
  const baseline = getSocialSample(course);
  const reactionTotal = () => Object.values(baseline.reactions).reduce((total, value) => total + value, 0);
  assert.equal(reactionTotal(), 259);
  let store = createEmptySocialStore();
  store = run(store, { type: 'set-reaction', target: course, reaction: 'LOVE' });
  assert.equal(baseline.reactions.LOVE + Number(getSocialReaction(store, course) === 'LOVE'), 83);
  store = run(store, { type: 'set-reaction', target: course, reaction: 'BEST' });
  assert.equal(baseline.reactions.LOVE + Number(getSocialReaction(store, course) === 'LOVE'), 82);
  assert.equal(baseline.reactions.BEST + Number(getSocialReaction(store, course) === 'BEST'), 64);
  assert.equal(store.reactions.length, 1);
  store = run(store, { type: 'set-reaction', target: course, reaction: null });
  assert.equal(store.reactions.length, 0);
  assert.equal(reactionTotal(), 259);
  store = run(store, { type: 'add-comment', target: course, body: '샘플 스레드에 직접 답글', parentId: baseline.threads[0].id });
  const count = () => baseline.threads.length + selectSocialComments(store, course).filter(comment => !comment.deletedAt).length;
  assert.equal(count(), 5);
  store = run(store, { type: 'delete-comment', id: store.comments[0].id });
  assert.equal(count(), 4);
  store = run(store, { type: 'restore-comment', id: store.comments[0].id });
  assert.equal(count(), 5);
});

test('sample reply commits stay device-local and the next tab reads a valid bounded store', () => {
  const data = new Map([['spotlog-trip-session', 'preserved-trip']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const first = commitSocialAction(storage, { type: 'add-comment', target: card, body: '첫 탭의 답글', parentId: getSocialSample(card).threads[0].id }, deps);
  assert.equal(first.ok, true);
  const second = commitSocialAction(storage, { type: 'add-comment', target: card, body: '다음 탭의 답글', parentId: getSocialSample(card).threads[2].id }, deps);
  assert.equal(second.ok, true);
  assert.equal(readSocialStorage(storage).store.comments.length, 2);
  assert.equal(data.get('spotlog-trip-session'), 'preserved-trip');
  const persisted = [...data.values()].join('');
  assert.equal(persisted.includes('민서의 지도'), false);
  assert.equal(persisted.includes('sample-person-'), false);
});
