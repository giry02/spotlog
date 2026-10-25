import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { resolveSocialTarget } = await import('../lib/social-target.ts');
const { communityTrips } = await import('../lib/community-trips.ts');
const { applySocialAction, createEmptySocialStore, parseSocialStore, selectSocialComments, getSocialReaction, socialCharacterCount, SOCIAL_LIMITS, SOCIAL_AUTHOR, SOCIAL_STORAGE_KEY } = await import('../lib/spotlog-social.ts');
const { readSocialStorage, writeSocialStorage, commitSocialAction } = await import('../lib/spotlog-social-client.ts');

const target = { kind: 'entity', id: 'hyeopjae' };
const course = { kind: 'course', id: 'community-jeju-west-sea' };
const card = { kind: 'course-place', id: course.id, visitIndex: 0 };
const time = '2026-10-24T02:00:00.000Z';
let sequence = 0;
const deps = { now: () => time, id: () => `comment-${++sequence}` };
function apply(store, action, dependencies = deps) {
  const result = applySocialAction(store, action, dependencies);
  assert.equal(result.ok, true, result.error);
  return result.store;
}
function add(store, scope, body = '직접 남긴 방문 메모', parentId) {
  return apply(store, { type: 'add-comment', target: scope, body, ...(parentId ? { parentId } : {}) });
}

test('target resolver separates global places, each course and each visit without key collisions', () => {
  const global = resolveSocialTarget(target), block = resolveSocialTarget(card), whole = resolveSocialTarget(course);
  assert.equal(global.entityId, block.entityId);
  assert.equal(new Set([global.key, block.key, whole.key]).size, 3);
  assert.equal(global.commentLimit, 1000); assert.equal(block.commentLimit, 1000); assert.equal(whole.commentLimit, 180);
  assert.equal(global.reactionMode, 'like'); assert.equal(whole.reactionMode, 'cheer');
  const secondCourse = communityTrips.find(item => item.id !== course.id && item.visits.some(visit => visit.entityId === global.entityId));
  assert.ok(secondCourse);
  const otherBlock = { kind: 'course-place', id: secondCourse.id, visitIndex: secondCourse.visits.findIndex(visit => visit.entityId === global.entityId) };
  assert.equal(resolveSocialTarget(otherBlock).entityId, global.entityId);
  assert.notEqual(resolveSocialTarget(otherBlock).key, block.key);
  let store = add(createEmptySocialStore(), card);
  assert.equal(selectSocialComments(store, target).length, 0);
  assert.equal(selectSocialComments(store, otherBlock).length, 0);
  store = add(store, otherBlock);
  assert.equal(selectSocialComments(store, otherBlock).length, 1);
});

test('unknown identifiers, malformed indices and prototype keys cannot create targets', () => {
  for (const value of [null, [], 'hyeopjae', { kind: 'entity', id: 'unknown' }, { kind: 'entity', id: '__proto__' }, { kind: 'course', id: 'hyeopjae' }, { ...card, visitIndex: -1 }, { ...card, visitIndex: 0.5 }, { ...card, visitIndex: '0' }, { ...card, visitIndex: 9999 }, { ...target, visitIndex: 0 }, JSON.parse('{"kind":"entity","id":"hyeopjae","__proto__":{}}'), Object.create(target), { ...target, [Symbol('extra')]: true }]) assert.equal(resolveSocialTarget(value), null);
});

test('all authored data remains empty until this device acts; no fictitious authors or aggregates', () => {
  const empty = createEmptySocialStore();
  assert.deepEqual(empty, { version: 1, comments: [], reactions: [] });
  assert.equal(getSocialReaction(empty, target), null);
  assert.equal(SOCIAL_AUTHOR, '나 · 이 기기');
  assert.match(SOCIAL_STORAGE_KEY, /v1$/);
  assert.deepEqual(parseSocialStore(null), { ok: true, store: empty });
});

test('own comment edit, one-level reply and soft deletion preserve replies and restore exact text', () => {
  let store = add(createEmptySocialStore(), card, '  바다 앞을 걸었어요  ');
  const id = store.comments[0].id;
  assert.equal(store.comments[0].body, '바다 앞을 걸었어요');
  store = add(store, card, '답글 메모', id);
  const replyId = store.comments[1].id;
  assert.equal(applySocialAction(store, { type: 'add-comment', target: card, body: '두 단계는 불가', parentId: replyId }, deps).ok, false);
  assert.equal(applySocialAction(store, { type: 'add-comment', target, body: '다른 스레드 답글 불가', parentId: id }, deps).ok, false);
  store = apply(store, { type: 'edit-comment', id, body: '수정한 방문 메모' });
  store = apply(store, { type: 'delete-comment', id });
  assert.equal(store.comments[0].deletedAt, time);
  assert.equal(store.comments[1].body, '답글 메모');
  assert.equal(selectSocialComments(store, card).length, 2);
  assert.equal(applySocialAction(store, { type: 'edit-comment', id, body: '삭제 상태 수정 불가' }, deps).ok, false);
  assert.equal(applySocialAction(store, { type: 'add-comment', target: card, body: '삭제 부모 답글 불가', parentId: id }, deps).ok, false);
  store = apply(store, { type: 'restore-comment', id });
  assert.equal(store.comments[0].deletedAt, null);
  assert.equal(store.comments[0].body, '수정한 방문 메모');
  assert.equal(store.comments[1].parentId, id);
  assert.equal(parseSocialStore(JSON.stringify(store)).ok, true);
});

test('length rules count Unicode characters, reject blank/control text and distinguish course vs card', () => {
  assert.equal(socialCharacterCount('🌊가'), 2);
  assert.equal(add(createEmptySocialStore(), course, '가'.repeat(180)).comments.length, 1);
  assert.equal(add(createEmptySocialStore(), card, '🌊'.repeat(1000)).comments.length, 1);
  for (const [scope, body] of [[course, '가'.repeat(181)], [card, '가'.repeat(1001)], [target, '  \n '], [target, '안녕\u0000']]) {
    const empty = createEmptySocialStore();
    const result = applySocialAction(empty, { type: 'add-comment', target: scope, body }, deps);
    assert.equal(result.ok, false); assert.equal(result.store, empty);
  }
});

test('a device owns one evaluation per target and can change or cancel it', () => {
  let store = apply(createEmptySocialStore(), { type: 'set-reaction', target: course, reaction: 'LOVE' });
  store = apply(store, { type: 'set-reaction', target: course, reaction: 'BEST' });
  store = apply(store, { type: 'set-reaction', target: course, reaction: 'HELPFUL' });
  assert.equal(store.reactions.length, 1); assert.equal(getSocialReaction(store, course), 'HELPFUL');
  assert.equal(applySocialAction(store, { type: 'set-reaction', target: course, reaction: 'LIKE' }, deps).ok, false);
  assert.equal(applySocialAction(store, { type: 'set-reaction', target: card, reaction: 'LOVE' }, deps).ok, false);
  store = apply(store, { type: 'set-reaction', target: course, reaction: null });
  store = apply(store, { type: 'set-reaction', target: card, reaction: 'LIKE' });
  assert.equal(getSocialReaction(store, target), null);
  assert.equal(getSocialReaction(store, card), 'LIKE');
  store = apply(store, { type: 'set-reaction', target: card, reaction: null });
  assert.equal(store.reactions.length, 0);
});

test('persisted malformed/prototype/duplicate/deep-reply data is rejected without rewriting', () => {
  const good = add(createEmptySocialStore(), target);
  const variants = [
    '{', 'null', JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, constructor: {} }),
    JSON.stringify({ ...good, comments: [good.comments[0], good.comments[0]] }),
    JSON.stringify({ ...good, comments: [{ ...good.comments[0], parentId: 'missing' }] }),
    JSON.stringify({ ...good, comments: [{ ...good.comments[0], author: '실제 회원인 척' }] }),
    JSON.stringify({ ...good, comments: [{ ...good.comments[0], target: { kind: 'entity', id: 'made-up' } }] }),
    JSON.stringify({ ...good, comments: [{ ...good.comments[0], deletedAt: '2026-10-24T02:01:00.000Z' }] }),
    JSON.stringify({ ...good, reactions: [{ target, kind: 'LIKE', updatedAt: time }, { target, kind: 'LIKE', updatedAt: time }] }),
    ' '.repeat(SOCIAL_LIMITS.storageCharacters + 1),
  ];
  for (const raw of variants) {
    let written = 0;
    const storage = { getItem: () => raw, setItem: () => written++ };
    assert.equal(readSocialStorage(storage).ok, false);
    assert.equal(writeSocialStorage(storage, createEmptySocialStore()).ok, false);
    assert.equal(written, 0);
  }
  assert.equal(parseSocialStore(JSON.stringify(good)).ok, true);
});

test('write failures and invalid IDs preserve last good value and domain state', () => {
  const initial = add(createEmptySocialStore(), target);
  const raw = JSON.stringify(initial);
  const storage = { getItem: () => raw, setItem: () => { throw new Error('QuotaExceededError'); } };
  const candidate = add(initial, target, '저장이 실패할 새 댓글');
  const saved = writeSocialStorage(storage, candidate);
  assert.equal(saved.ok, false); assert.match(saved.error, /기존 기록/);
  assert.equal(storage.getItem(SOCIAL_STORAGE_KEY), raw);
  assert.equal(readSocialStorage(storage).store.comments.length, 1);
  const duplicate = applySocialAction(initial, { type: 'add-comment', target, body: '중복 식별자' }, { ...deps, id: () => initial.comments[0].id });
  assert.equal(duplicate.ok, false); assert.equal(duplicate.store, initial);
  const wrongTime = applySocialAction(initial, { type: 'edit-comment', id: initial.comments[0].id, body: '시계 오류' }, { ...deps, now: () => '2026-10-23T02:00:00.000Z' });
  assert.equal(wrongTime.ok, false); assert.equal(wrongTime.store, initial);
  assert.equal(writeSocialStorage(storage, { ...initial, comments: [{ ...initial.comments[0], body: '' }] }).ok, false);
  assert.equal(readSocialStorage({ getItem: () => { throw new Error('denied'); }, setItem() {} }).ok, false);
});

test('comment count and total size bounds do not evict earlier local records', () => {
  const first = add(createEmptySocialStore(), target).comments[0];
  const full = { version: 1, comments: Array.from({ length: SOCIAL_LIMITS.comments }, (_, index) => ({ ...first, id: `bounded-${index}` })), reactions: [] };
  const result = applySocialAction(full, { type: 'add-comment', target, body: '용량 초과' }, deps);
  assert.equal(result.ok, false); assert.equal(result.store, full);
  assert.equal(result.store.comments[0].id, 'bounded-0');
  assert.equal(result.store.comments.length, SOCIAL_LIMITS.comments);
  assert.equal(parseSocialStore(JSON.stringify({ ...full, comments: [...full.comments, { ...first, id: 'extra-comment' }] })).ok, false);
});

test('storage writes never change a conversation key and a later tab reads the latest version', () => {
  const data = new Map([['spotlog-trip-session', 'unchanged-conversation']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const firstTab = add(readSocialStorage(storage).store, target, '첫 번째 탭');
  assert.equal(writeSocialStorage(storage, firstTab).ok, true);
  const secondTab = add(readSocialStorage(storage).store, target, '두 번째 탭');
  assert.equal(writeSocialStorage(storage, secondTab).ok, true);
  assert.deepEqual(readSocialStorage(storage).store.comments.map(comment => comment.body), ['첫 번째 탭', '두 번째 탭']);
  assert.equal(data.get('spotlog-trip-session'), 'unchanged-conversation');
});

test('provider commit path retains rapid sequential actions and intervening writes from another tab', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  const first = commitSocialAction(storage, { type: 'add-comment', target, body: '첫 입력' }, deps);
  const second = commitSocialAction(storage, { type: 'add-comment', target, body: '렌더 전 두 번째 입력' }, deps);
  assert.equal(first.ok, true); assert.equal(second.ok, true);
  const anotherTab = add(readSocialStorage(storage).store, target, '다른 탭의 입력');
  assert.equal(writeSocialStorage(storage, anotherTab).ok, true);
  const third = commitSocialAction(storage, { type: 'set-reaction', target, reaction: 'LIKE' }, deps);
  assert.equal(third.ok, true);
  assert.deepEqual(third.store.comments.map(comment => comment.body), ['첫 입력', '렌더 전 두 번째 입력', '다른 탭의 입력']);
  assert.equal(getSocialReaction(third.store, target), 'LIKE');
  raw = '{broken-external-value';
  const corrupted = commitSocialAction(storage, { type: 'add-comment', target, body: '덮어쓰지 않기' }, deps);
  assert.equal(corrupted.ok, false); assert.equal(corrupted.readonly, true);
  assert.equal(raw, '{broken-external-value');
});

test('provider commit path distinguishes correctable input errors from storage write failures', () => {
  const initial = add(createEmptySocialStore(), target);
  let raw = JSON.stringify(initial), writes = 0;
  const storage = { getItem: () => raw, setItem: () => { writes++; throw new Error('denied'); } };
  const invalid = commitSocialAction(storage, { type: 'add-comment', target, body: ' ' }, deps);
  assert.equal(invalid.ok, false); assert.equal(invalid.readonly, false); assert.equal(writes, 0);
  const failed = commitSocialAction(storage, { type: 'add-comment', target, body: '저장 불가' }, deps);
  assert.equal(failed.ok, false); assert.equal(failed.readonly, true); assert.equal(writes, 1);
  assert.equal(failed.store.comments.length, 1);
  assert.equal(raw, JSON.stringify(initial));
});
