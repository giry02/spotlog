import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForGroup, roomIdForActivity } from '../src/together/model.ts';
import { canReadChatDigest, chatDigestDayKey, chatDigestSelectionKey, createChatDigest, groupChatDigestSources, projectChatDigest, selectChatDigestMessages } from '../src/together/chatDigest.ts';

const cutoff = Date.parse('2026-10-29T03:00:00.000Z'); // 10/29 noon in Korea.
function context() {
  const state = createEmptyState('viewer', '나');
  state.members.push({ id: 'alice', name: '수아' }, { id: 'bob', name: '도윤' });
  state.groups.push({ id: 'g-one', name: '동네 친구', kind: 'HOBBY', region: '부산', introduction: '', cover: '', visibility: 'PUBLIC', ownerId: 'viewer', memberIds: ['viewer', 'alice', 'bob'], managerIds: [], archived: false, promotionPublished: true });
  state.activities.push({ id: 'meetup', groupId: 'g-one', title: '커피 한 잔', date: '', endDate: '', meetingPoint: '', description: '', status: 'CANCELLED', leadId: 'alice', editorIds: [], participants: { viewer: 'DECLINED' }, arrivedIds: [], revision: 1 });
  return { state, userId: 'viewer', groupId: 'g-one', roomId: roomIdForGroup('g-one') };
}
const message = (id, createdAt = '2026-10-29T02:00:00Z', body = '물을 챙겨 주세요.', authorId = 'alice', roomId = roomIdForGroup('g-one')) => ({ id, roomId, authorId, body, createdAt });

test('public discovery, former members and blocked members cannot collect any private room text', () => {
  const ctx = context(); ctx.state.messages.push(message('private'));
  for (const userId of ['', 'outsider']) {
    const other = { ...ctx, userId };
    assert.equal(canReadChatDigest(other), false);
    assert.throws(() => createChatDigest(other, { scope: 'all' }, cutoff), /권한/);
  }
  ctx.state.groups[0].blockedMemberIds = ['viewer'];
  assert.equal(canReadChatDigest(ctx), false);
  assert.throws(() => selectChatDigestMessages(ctx, { scope: 'all' }, cutoff), /권한/);
});

test('activity rooms are bound to their exact group, without imposing a new attendance rule', () => {
  const ctx = context();
  assert.equal(canReadChatDigest({ ...ctx, roomId: roomIdForActivity('meetup') }), true);
  ctx.state.groups[0].archived = true;
  assert.equal(canReadChatDigest({ ...ctx, roomId: roomIdForActivity('meetup') }), true);
  assert.equal(canReadChatDigest({ ...ctx, roomId: roomIdForActivity('missing') }), false);
  ctx.state.activities.push({ ...ctx.state.activities[0], id: 'foreign', groupId: 'g-two' });
  assert.equal(canReadChatDigest({ ...ctx, roomId: roomIdForActivity('foreign') }), false);
  assert.equal(canReadChatDigest({ ...ctx, roomId: roomIdForGroup('g-two') }), false);
});

test('today uses Korea midnight and includes only actual source text through the collection cutoff', () => {
  const ctx = context(); ctx.state.messages.push(
    message('before', '2026-10-28T14:59:59.999Z'), message('midnight', '2026-10-28T15:00:00Z'),
    message('noon', '2026-10-29T03:00:00Z'), message('future', '2026-10-29T03:00:00.001Z'),
    message('invalid-time', 'not-a-time'), message('sticker-only', '2026-10-29T02:00:00Z', '  '),
    message('deleted', '2026-10-29T02:00:00Z'));
  ctx.state.messages.at(-1).deleted = true;
  assert.equal(chatDigestDayKey(cutoff), '2026-10-29');
  assert.deepEqual(selectChatDigestMessages(ctx, { scope: 'today' }, cutoff).map(item => item.id), ['noon', 'midnight']);
});

test('recent seven days means seven Korea calendar dates including today, not eight or a rolling hour window', () => {
  const ctx = context(); ctx.state.messages.push(
    message('before', '2026-10-22T14:59:59.999Z'), message('first-day', '2026-10-22T15:00:00Z'), message('today'));
  assert.deepEqual(selectChatDigestMessages(ctx, { scope: 'recent7' }, cutoff).map(item => item.id), ['today', 'first-day']);
});

test('custom dates include the entire final Korea day and reject impossible calendar dates or reversed ranges', () => {
  const ctx = context(); ctx.state.messages.push(message('start', '2024-02-28T15:00:00Z'), message('end', '2024-02-29T14:59:59.999Z'), message('after', '2024-02-29T15:00:00Z'));
  assert.deepEqual(selectChatDigestMessages(ctx, { scope: 'date', from: '2024-02-29', to: '2024-02-29' }, cutoff).map(item => item.id), ['end', 'start']);
  for (const filters of [{ scope: 'date', from: '2026-02-29', to: '2026-03-01' }, { scope: 'date', from: '2026-10-29', to: '2026-10-28' }, { scope: 'date', from: '', to: '' }]) assert.throws(() => createChatDigest(ctx, filters, cutoff));
});

test('unread is strictly after the cursor instant; a corrupt cursor never silently widens the range', () => {
  const ctx = context(); ctx.state.messages.push(message('read'), message('unread', '2026-10-29T02:00:00.001Z'));
  assert.deepEqual(selectChatDigestMessages({ ...ctx, unreadAfter: '2026-10-29T11:00:00+09:00' }, { scope: 'unread' }, cutoff).map(item => item.id), ['unread']);
  assert.equal(selectChatDigestMessages(ctx, { scope: 'unread' }, cutoff).length, 2);
  assert.throws(() => createChatDigest({ ...ctx, unreadAfter: 'corrupt' }, { scope: 'unread' }, cutoff), /읽음/);
});

test('unread includes my own literal replies after the cursor as well as other participants', () => {
  const ctx = context(); ctx.state.messages.push(message('own', undefined, '우산을 챙길게요.', 'viewer'), message('other', undefined, '책을 가져가요.'));
  const selected = selectChatDigestMessages({ ...ctx, unreadAfter: '2026-10-29T01:59:59Z' }, { scope: 'unread' }, cutoff);
  assert.deepEqual(new Set(selected.map(item => item.authorId)), new Set(['viewer', 'alice']));
  assert.equal(selected.find(item => item.id === 'own').body, '우산을 챙길게요.');
});

test('a person filter uses author identity and preserves whitespace, source time, exact text and caller state', () => {
  const ctx = context(); ctx.state.messages.push(message('alice', undefined, '  준비: 물\n잊지 말기  '), message('bob', undefined, '동일한 표시 이름과 무관해요.', 'bob'));
  const before = structuredClone(ctx.state), filters = { scope: 'all', authorId: 'alice' };
  const snapshot = createChatDigest(ctx, filters, cutoff);
  assert.equal(snapshot.sources.length, 1); assert.equal(snapshot.sources[0].body, '  준비: 물\n잊지 말기  ');
  assert.deepEqual(ctx.state, before);
  filters.authorId = 'bob'; ctx.state.messages[0].body = '바뀐 원문';
  assert.equal(snapshot.filters.authorId, 'alice'); assert.equal(snapshot.sources[0].body, '  준비: 물\n잊지 말기  ');
});

test('edits, deletions, author/time changes and room moves immediately remove cached source text', () => {
  for (const mutate of [item => { item.deleted = true; }, item => { item.body = '새 원문'; }, item => { item.authorId = 'bob'; }, item => { item.createdAt = '2026-10-29T02:00:01Z'; }, item => { item.roomId = 'group:elsewhere'; }]) {
    const ctx = context(); ctx.state.messages.push(message('one'), message('keep', undefined, '계속 보이는 원문'));
    const snapshot = createChatDigest(ctx, { scope: 'all' }, cutoff);
    mutate(ctx.state.messages[0]);
    const result = projectChatDigest(ctx, snapshot, cutoff);
    assert.deepEqual(result.sources.map(item => item.id), ['keep']); assert.equal(result.removedCount, 1);
  }
});

test('entity cards with text never become human originals, including after a collected message is converted to a card', () => {
  const ctx = context();
  ctx.state.messages.push(message('human', undefined, '만나는 시각을 확인해 주세요.'), message('keep', undefined, '물은 제가 챙길게요.'));
  const snapshot = createChatDigest(ctx, { scope: 'all' }, cutoff);
  assert.equal(snapshot.sources.length, 2);
  ctx.state.messages.push({ ...message('card', undefined, '준비물과 시각을 확인해 주세요.'), entity: { type: 'POLL', id: 'poll-one' } });
  const beforeSelection = structuredClone(ctx.state);
  assert.deepEqual(selectChatDigestMessages(ctx, { scope: 'all' }, cutoff).map(item => item.id), ['human', 'keep']);
  assert.deepEqual(ctx.state, beforeSelection);
  ctx.state.messages.find(item => item.id === 'human').entity = { type: 'NOTICE', id: 'notice-one' };
  const projected = projectChatDigest(ctx, snapshot, cutoff);
  assert.deepEqual(projected.sources.map(item => item.id), ['keep']);
  assert.equal(projected.removedCount, 1); assert.equal(projected.newMessageCount, 0);
  assert.equal(projected.sources.some(item => item.body === snapshot.sources.find(source => source.id === 'human').body), false);
  assert.deepEqual(selectChatDigestMessages(ctx, { scope: 'all' }, cutoff).map(item => item.id), ['keep']);
});

test('late arrivals and new messages are counted separately from the fixed snapshot and refresh replaces it explicitly', () => {
  const ctx = context(); ctx.state.messages.push(message('initial'));
  const snapshot = createChatDigest(ctx, { scope: 'today' }, cutoff);
  ctx.state.messages.push(message('new', '2026-10-29T03:00:01Z'), message('backfill', '2026-10-29T01:00:00Z'), message('other-room', '2026-10-29T03:00:01Z', '비공개', 'bob', 'group:elsewhere'));
  const now = cutoff + 2_000, result = projectChatDigest(ctx, snapshot, now);
  assert.deepEqual(result.sources.map(item => item.id), ['initial']); assert.equal(result.newMessageCount, 2);
  const refreshed = createChatDigest(ctx, { scope: 'today' }, now);
  assert.equal(refreshed.sources.length, 3); assert.equal(projectChatDigest(ctx, refreshed, now).newMessageCount, 0);
  assert.equal(snapshot.sources.length, 1);
});

test('revocation, another account or another room cannot project an otherwise valid private snapshot', () => {
  const ctx = context(); ctx.state.messages.push(message('one'));
  const snapshot = createChatDigest(ctx, { scope: 'all' }, cutoff);
  for (const other of [{ ...ctx, userId: 'alice' }, { ...ctx, roomId: roomIdForActivity('meetup') }, { ...ctx, groupId: 'different' }]) {
    const result = projectChatDigest(other, snapshot, cutoff); assert.equal(result.forbidden, true); assert.deepEqual(result.sources, []);
  }
  ctx.state.groups[0].memberIds = ['alice', 'bob'];
  assert.deepEqual(projectChatDigest(ctx, snapshot, cutoff).sources, []);
  assert.equal(snapshot.sources[0].body, '물을 챙겨 주세요.');
});

test('ambiguous duplicate message IDs fail closed, including after a snapshot was collected', () => {
  const ctx = context(); ctx.state.messages.push(message('same'));
  const snapshot = createChatDigest(ctx, { scope: 'all' }, cutoff);
  ctx.state.messages.push(message('same', undefined, '다른 방의 원문', 'bob', 'group:elsewhere'));
  assert.equal(selectChatDigestMessages(ctx, { scope: 'all' }, cutoff).length, 0);
  assert.equal(projectChatDigest(ctx, snapshot, cutoff).sources.length, 0);
});

test('keyword folders retain every literal source, without deciding reservations, assigning owners or merging different messages', () => {
  const ctx = context(); ctx.state.messages.push(
    message('ask', undefined, '토요일 3시가 맞는지 확인해 주세요?'), message('prepare', undefined, '물과 돗자리를 챙겨요.'),
    message('place', undefined, '11시 30분 정문에서 만나요.'), message('reservation', undefined, '예약이 완료됐다는 말을 들었어요.'),
    message('duplicate-body', undefined, '물과 돗자리를 챙겨요.', 'bob'));
  const snapshot = createChatDigest(ctx, { scope: 'all' }, cutoff), before = structuredClone(ctx.state);
  const groups = groupChatDigestSources(snapshot.sources);
  assert.deepEqual(groups.map(group => group.label), ['준비 관련', '시간·장소 관련', '확인·논의 관련', '기타']);
  assert.equal(groups[0].sources.length, 2);
  assert.deepEqual(groups.flatMap(group => group.sources).map(item => item.body).sort(), ctx.state.messages.map(item => item.body).sort());
  assert.deepEqual(ctx.state, before); assert.equal(ctx.state.tasks.length, 0); assert.deepEqual(ctx.state.readCursors, {});
  assert.ok(snapshot.sources.every(item => !('assigneeId' in item) && !('confirmed' in item) && !('summary' in item)));
});

test('keyword groups cover natural preparation endings but do not decide whether discussion is unresolved', () => {
  const ctx = context(); ctx.state.messages.push(message('bring', undefined, '우산을 챙길게요.'), message('confirmed', undefined, '기차 시간을 확인했어요. 이 시간으로 확정해요.'));
  const groups = groupChatDigestSources(createChatDigest(ctx, { scope: 'all' }, cutoff).sources);
  assert.equal(groups.find(group => group.sources.some(item => item.id === 'bring')).label, '준비 관련');
  assert.equal(groups.find(group => group.sources.some(item => item.id === 'confirmed')).label, '확인·논의 관련');
  assert.equal(groups.flatMap(group => group.sources).find(item => item.id === 'confirmed').body, '기차 시간을 확인했어요. 이 시간으로 확정해요.');
});

test('only active filter fields affect the selection key; unread cursor changes stale only unread results', () => {
  assert.equal(chatDigestSelectionKey({ scope: 'all', from: '2026-10-01' }, 'one'), chatDigestSelectionKey({ scope: 'all', from: '2026-10-20' }, 'two'));
  assert.notEqual(chatDigestSelectionKey({ scope: 'unread' }, 'one'), chatDigestSelectionKey({ scope: 'unread' }, 'two'));
  assert.notEqual(chatDigestSelectionKey({ scope: 'all' }), chatDigestSelectionKey({ scope: 'all', authorId: 'alice' }));
});
