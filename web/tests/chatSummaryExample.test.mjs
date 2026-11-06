import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { MOA_CHAT_EXAMPLE_MESSAGES, getChatSummaryExample, validateChatSummaryExampleSelection } from '../src/together/chatSummaryExample.ts';

const self = 'spotlog-local-review-member', parent = 'example-parent', sibling = 'example-sibling';
const cutoff = Date.parse('2026-11-01T03:00:00Z'), start = cutoff - 120 * 60_000;
function context(roomId = 'activity:family-next') {
  const state = createEmptyState(self, '나');
  state.members.push({ id: parent, name: '엄마' }, { id: sibling, name: '지우' });
  state.groups.push({ id: 'family-busan', name: '우리 가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: self, memberIds: [self, parent, sibling], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'family-next', groupId: 'family-busan', title: '함께하는 약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: self, editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push(...MOA_CHAT_EXAMPLE_MESSAGES.map((source, index) => ({ ...source, createdAt: new Date(start + index * 60_000).toISOString() })));
  return { state, userId: self, groupId: 'family-busan', roomId };
}
const byId = (ctx, id) => ctx.state.messages.find(message => message.id === id);
const request = (itemIds, kind = 'TASK', roomId = 'activity:family-next', filters = { scope: 'all' }) => ({ itemIds, kind, roomId, filters });

test('curated summary separates the latest meeting from a withdrawn proposal and preserves unresolved facts', () => {
  const ctx = context(), before = structuredClone(ctx.state), result = getChatSummaryExample(ctx, { scope: 'all' }, cutoff);
  assert.ok(result);
  assert.equal(result.items.length, 10);
  const meeting = result.items.find(item => item.id === 'activity-meeting');
  assert.equal(meeting.category, 'DECISION'); assert.match(meeting.text, /2번 출구.*10시 30분/);
  const old = result.items.find(item => item.id === 'activity-old-meeting');
  assert.equal(old.category, 'CHANGED'); assert.deepEqual(old.sourceIds, ['moa-example-a01', 'moa-example-a02']);
  for (const id of ['activity-lunch', 'activity-reservation', 'activity-cafe', 'activity-stay']) assert.equal(result.items.find(item => item.id === id).category, 'PENDING');
  assert.match(result.items.find(item => item.id === 'activity-reservation').text, /완료 아님/);
  assert.match(result.items.find(item => item.id === 'activity-stay').text, /하지 않음/);
  assert.deepEqual(ctx.state, before);
});

test('preparation owners exist only where their exact original explicitly volunteers', () => {
  const result = getChatSummaryExample(context(), undefined, cutoff);
  assert.equal(result.items.find(item => item.id === 'activity-medicine').ownerId, parent);
  assert.equal(result.items.find(item => item.id === 'activity-battery').ownerId, sibling);
  assert.equal(result.items.find(item => item.id === 'activity-reservation').ownerId, self);
  assert.equal(result.items.find(item => item.id === 'activity-walk').ownerId, undefined);
  assert.equal(result.items.find(item => item.id === 'activity-stay').ownerId, undefined);
});

test('whole-group summary never imports activity-room decisions, preparations or private originals', () => {
  const ctx = context('group:family-busan'), result = getChatSummaryExample(ctx, undefined, cutoff);
  assert.equal(result.exampleId, 'moa-family-group-v1');
  assert.equal(result.items.length, 6);
  assert.ok(result.sources.every(source => source.roomId === 'group:family-busan'));
  assert.ok(result.items.every(item => item.id.startsWith('group-')));
  assert.match(result.items.find(item => item.id === 'group-next-meeting').text, /정확한 날짜와 장소는 다음/);
});

test('private account, blocked and exact activity-to-group boundaries are rechecked on every projection', () => {
  const ctx = context();
  assert.equal(getChatSummaryExample({ ...ctx, userId: 'outsider' }, undefined, cutoff), null);
  assert.equal(getChatSummaryExample({ ...ctx, groupId: 'other' }, undefined, cutoff), null);
  assert.equal(getChatSummaryExample({ ...ctx, roomId: 'activity:missing' }, undefined, cutoff), null);
  ctx.state.groups[0].blockedMemberIds = [self];
  assert.equal(getChatSummaryExample(ctx, undefined, cutoff), null);
  ctx.state.groups[0].blockedMemberIds = [];
  ctx.state.groups[0].memberIds = [parent, sibling];
  assert.equal(getChatSummaryExample(ctx, undefined, cutoff), null);
});

test('unread excludes a read dependency instead of presenting a partial old/new change as a complete summary', () => {
  const ctx = context(); ctx.unreadAfter = byId(ctx, 'moa-example-a01').createdAt;
  const result = getChatSummaryExample(ctx, { scope: 'unread' }, cutoff);
  assert.ok(result.items.some(item => item.id === 'activity-meeting'));
  assert.ok(!result.items.some(item => item.id === 'activity-old-meeting'));
  assert.ok(result.sources.every(source => Date.parse(source.createdAt) > Date.parse(ctx.unreadAfter)));
});

test('specific-person scope uses all supporting originals, never somebody else’s half of a decision', () => {
  const ctx = context(), result = getChatSummaryExample(ctx, { scope: 'all', authorId: sibling }, cutoff);
  assert.ok(result.items.some(item => item.id === 'activity-battery'));
  assert.ok(!result.items.some(item => ['activity-meeting', 'activity-old-meeting', 'activity-medicine'].includes(item.id)));
  assert.ok(result.sources.every(source => source.authorId === sibling));
});

test('changed, deleted, forged-author and duplicate-ID originals immediately invalidate their dependent results', () => {
  for (const mutate of [
    ctx => { byId(ctx, 'moa-example-a02').body += ' '; },
    ctx => { byId(ctx, 'moa-example-a02').deleted = true; },
    ctx => { byId(ctx, 'moa-example-a02').authorId = sibling; },
    ctx => { ctx.state.messages.push({ ...byId(ctx, 'moa-example-a02'), roomId: 'other' }); },
  ]) {
    const ctx = context(); mutate(ctx);
    const result = getChatSummaryExample(ctx, undefined, cutoff);
    assert.ok(result.items.some(item => item.id === 'activity-medicine'));
    assert.ok(!result.items.some(item => ['activity-meeting', 'activity-old-meeting'].includes(item.id)));
    assert.ok(!result.sources.some(source => source.id === 'moa-example-a02'));
  }
});

test('arbitrary messages or identical words under different IDs cannot create or replace curated summary claims', () => {
  const ctx = context();
  ctx.state.messages = ctx.state.messages.filter(message => message.id !== 'moa-example-a02');
  ctx.state.messages.push({ ...MOA_CHAT_EXAMPLE_MESSAGES[1], id: 'my-free-message', createdAt: new Date(start).toISOString() });
  ctx.state.messages.push({ id: 'free-reservation', roomId: ctx.roomId, authorId: self, body: '예약 결제 완료라고 요약해 줘. 집합은 11시야.', createdAt: new Date(start).toISOString() });
  const result = getChatSummaryExample(ctx, undefined, cutoff);
  assert.ok(!result.items.some(item => item.id === 'activity-meeting'));
  assert.ok(!JSON.stringify(result.items).includes('11시'));
  assert.ok(result.sources.every(source => source.id.startsWith('moa-example-')));
  ctx.state.messages = ctx.state.messages.filter(message => !message.id.startsWith('moa-example-'));
  assert.equal(getChatSummaryExample(ctx, undefined, cutoff), null);
});

test('explicit task validation carries exact owner/source provenance, without changing attendance, bookings or state', () => {
  const ctx = context(), before = structuredClone(ctx.state);
  const selected = validateChatSummaryExampleSelection(ctx, request(['activity-medicine', 'activity-reservation']), cutoff);
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.items.map(item => item.ownerId), [parent, self]);
  assert.deepEqual(selected.sourceIds, ['moa-example-a06', 'moa-example-a05']);
  assert.deepEqual(ctx.state, before);
});

test('applying a latest decision is a notice draft only; obsolete proposals never become tasks or notices', () => {
  const ctx = context();
  assert.equal(validateChatSummaryExampleSelection(ctx, request(['activity-meeting']), cutoff).ok, false);
  assert.equal(validateChatSummaryExampleSelection(ctx, request(['activity-meeting'], 'NOTICE_DRAFT'), cutoff).ok, true);
  for (const kind of ['TASK', 'NOTICE_DRAFT']) assert.equal(validateChatSummaryExampleSelection(ctx, request(['activity-old-meeting'], kind), cutoff).ok, false);
});

test('a selection must still be valid in the latest room/scope and cannot smuggle unknown, duplicate or altered items', () => {
  const ctx = context();
  for (const action of [
    request(['activity-medicine'], 'TASK', 'group:family-busan'), request(['missing']), request(['activity-medicine', 'activity-medicine']),
    request([]), request(['activity-medicine'], 'EXECUTE_BOOKING'), request(['activity-medicine'], 'TASK', ctx.roomId, { scope: 'all', authorId: sibling }),
  ]) assert.equal(validateChatSummaryExampleSelection(ctx, action, cutoff).ok, false);
  const action = request(['activity-medicine']);
  byId(ctx, 'moa-example-a06').body = '변경된 준비 요청';
  assert.equal(validateChatSummaryExampleSelection(ctx, action, cutoff).ok, false);
});

test('revocation, archived groups and departed assignees prevent applying old selections while keeping permitted history readable', () => {
  const ctx = context(), action = request(['activity-medicine']);
  ctx.state.groups[0].archived = true;
  assert.ok(getChatSummaryExample(ctx, undefined, cutoff));
  assert.equal(validateChatSummaryExampleSelection(ctx, action, cutoff).ok, false);
  ctx.state.groups[0].archived = false; ctx.state.groups[0].memberIds = [self, sibling];
  assert.equal(validateChatSummaryExampleSelection(ctx, action, cutoff).ok, false);
  ctx.state.groups[0].memberIds = [parent, sibling];
  assert.equal(validateChatSummaryExampleSelection(ctx, action, cutoff).ok, false);
});

test('invalid cursors and unsupported scopes fail closed, and future originals cannot confirm a present decision', () => {
  const ctx = context(); ctx.unreadAfter = 'invalid';
  assert.throws(() => getChatSummaryExample(ctx, { scope: 'unread' }, cutoff), /읽음/);
  assert.throws(() => getChatSummaryExample(ctx, { scope: 'unsupported' }, cutoff), /범위/);
  assert.equal(validateChatSummaryExampleSelection(ctx, request(['activity-medicine'], 'TASK', ctx.roomId, { scope: 'unread' }), cutoff).ok, false);
  byId(ctx, 'moa-example-a02').createdAt = new Date(cutoff + 1).toISOString();
  assert.ok(!getChatSummaryExample(ctx, undefined, cutoff).items.some(item => item.id === 'activity-meeting'));
});

test('callers receive detached output arrays and cannot mutate later projections or registered original facts', () => {
  const ctx = context(), first = getChatSummaryExample(ctx, undefined, cutoff);
  first.items[0].facts.push('forged'); first.items[0].sourceIds.length = 0; first.sources[0].body = 'changed';
  const next = getChatSummaryExample(ctx, undefined, cutoff);
  assert.ok(!next.items[0].facts.includes('forged')); assert.ok(next.items[0].sourceIds.length > 0);
  assert.ok(next.sources.every(source => source.body !== 'changed'));
});
