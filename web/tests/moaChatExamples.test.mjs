import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState, TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { selectChatDigestMessages, chatDigestDayKey } from '../src/together/chatDigest.ts';
import { getChatSummaryExample, MOA_CHAT_EXAMPLE_MESSAGES } from '../src/together/chatSummaryExample.ts';
import { installMoaChatExamples, MOA_REVIEW_ROOMS } from './moa-chat-examples.ts';

const reference = new Date('2026-11-01T03:00:00Z'); // Noon in Korea, independent of the test runner's time zone.
function fixture() {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '나', []);
  const counts = installMoaChatExamples(state, TOGETHER_REVIEW_MEMBER_ID, reference);
  return { state, counts };
}
const context = (state, roomId = MOA_REVIEW_ROOMS.activity) => ({ state, userId: TOGETHER_REVIEW_MEMBER_ID, groupId: 'family-busan', roomId, unreadAfter: state.readCursors[roomId] });

test('rich fixture has sustained, non-repeated dialogue and valid member/room identities', () => {
  const { state, counts } = fixture();
  assert.ok(counts.activityCount >= 80); assert.ok(counts.groupCount >= 40); assert.ok(counts.isolatedCount > 0);
  assert.equal(isTogetherState(state), true);
  const exampleMessages = state.messages.filter(message => Object.values(MOA_REVIEW_ROOMS).includes(message.roomId));
  assert.equal(new Set(exampleMessages.map(message => message.id)).size, exampleMessages.length);
  for (const roomId of Object.values(MOA_REVIEW_ROOMS)) {
    const messages = exampleMessages.filter(message => message.roomId === roomId);
    assert.equal(new Set(messages.map(message => message.body)).size, messages.length, 'load-test repetition must not replace conversation');
    const group = roomId.startsWith('group:') ? state.groups.find(group => `group:${group.id}` === roomId)
      : state.groups.find(group => state.activities.some(activity => `activity:${activity.id}` === roomId && activity.groupId === group.id));
    assert.ok(group);
    assert.ok(messages.every(message => group.memberIds.includes(message.authorId)));
  }
});

test('installation preserves strict legacy originals and every non-chat domain record; reinstall is idempotent', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '나', []);
  const { messages, readCursors, ...original } = structuredClone(state);
  const legacy = messages.filter(message => /^family-(?:chat|general)-/.test(message.id));
  installMoaChatExamples(state, TOGETHER_REVIEW_MEMBER_ID, reference);
  for (const message of legacy) {
    const actual = state.messages.find(item => item.id === message.id);
    assert.ok(actual); assert.equal(actual.body, message.body); assert.equal(actual.authorId, message.authorId); assert.equal(actual.roomId, message.roomId);
  }
  const { messages: installed, readCursors: cursors, ...rest } = structuredClone(state);
  assert.deepEqual(rest, original);
  installMoaChatExamples(state, TOGETHER_REVIEW_MEMBER_ID, reference);
  assert.deepEqual(state.messages, installed); assert.deepEqual(state.readCursors, cursors);
});

test('all three conversation sessions are chronological and in the past, while the older activity stays older', () => {
  const { state } = fixture();
  for (const roomId of Object.values(MOA_REVIEW_ROOMS)) {
    const messages = state.messages.filter(message => message.roomId === roomId);
    const instants = messages.map(message => Date.parse(message.createdAt));
    assert.ok(instants.every(instant => Number.isFinite(instant) && instant < reference.getTime()));
    assert.deepEqual(instants, [...instants].sort((a, b) => a - b));
    assert.equal(new Set(instants).size, instants.length);
  }
  const current = state.messages.filter(message => message.roomId === MOA_REVIEW_ROOMS.activity);
  assert.equal(new Set(current.map(message => chatDigestDayKey(Date.parse(message.createdAt)))).size, 3);
  assert.ok(state.messages.filter(message => message.roomId === MOA_REVIEW_ROOMS.otherActivity).every(message => Date.parse(message.createdAt) <= reference.getTime() - 7 * 86_400_000));
});

test('real digest selectors isolate the room, author and date even with conflicting times in other conversations', () => {
  const { state, counts } = fixture(), ctx = context(state);
  const all = selectChatDigestMessages(ctx, { scope: 'all' }, reference.getTime());
  assert.equal(all.length, counts.activityCount);
  assert.ok(all.every(message => message.roomId === MOA_REVIEW_ROOMS.activity));
  assert.ok(all.every(message => !message.id.startsWith('moa-past-') && !message.id.startsWith('moa-other-')));
  const today = selectChatDigestMessages(ctx, { scope: 'today' }, reference.getTime());
  assert.ok(today.length > 0 && today.length < all.length);
  assert.ok(today.every(message => chatDigestDayKey(Date.parse(message.createdAt)) === '2026-11-01'));
  const parent = selectChatDigestMessages(ctx, { scope: 'all', authorId: 'example-parent' }, reference.getTime());
  assert.ok(parent.length > 10); assert.ok(parent.every(message => message.authorId === 'example-parent'));
});

test('exact example sources survive default unread scope, and decisions never turn pending reservations into bookings', () => {
  const { state } = fixture();
  for (const source of MOA_CHAT_EXAMPLE_MESSAGES) {
    const actual = state.messages.find(message => message.id === source.id);
    assert.ok(actual); assert.equal(actual.body, source.body); assert.equal(actual.roomId, source.roomId); assert.equal(actual.authorId, source.authorId);
  }
  const activity = getChatSummaryExample(context(state), { scope: 'unread' }, reference.getTime());
  assert.equal(activity.items.length, 10);
  assert.deepEqual(new Set(activity.items.filter(item => item.category === 'DECISION').map(item => item.id)), new Set(['activity-meeting']));
  assert.ok(activity.items.find(item => item.id === 'activity-old-meeting').sourceIds.length === 2);
  assert.equal(activity.items.find(item => item.id === 'activity-reservation').category, 'PENDING');
  assert.equal(activity.items.find(item => item.id === 'activity-stay').category, 'PENDING');
  const parentOnly = getChatSummaryExample(context(state), { scope: 'all', authorId: 'example-parent' }, reference.getTime());
  assert.deepEqual(new Set(parentOnly.items.map(item => item.id)), new Set(['activity-walk', 'activity-medicine']));
  const general = getChatSummaryExample(context(state, MOA_REVIEW_ROOMS.group), { scope: 'unread' }, reference.getTime());
  assert.equal(general.items.length, 6); assert.ok(general.sources.every(source => source.roomId === MOA_REVIEW_ROOMS.group));
});

test('wrong account and invalid reference cannot contaminate the caller state', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '나', []), before = structuredClone(state);
  assert.throws(() => installMoaChatExamples(state, 'real-user', reference), /검수 계정/);
  assert.deepEqual(state, before);
  assert.throws(() => installMoaChatExamples(state, TOGETHER_REVIEW_MEMBER_ID, new Date(NaN)), /기준 시각/);
  assert.deepEqual(state, before);
});
