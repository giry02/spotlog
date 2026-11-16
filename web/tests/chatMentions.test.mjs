import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { findChatMentionQuery, insertChatMention, isChatMemberMentions, prepareChatMentionsForSend, rebaseChatMentions,
  selectChatMentionCandidates, selectReadableChatMentions } from '../src/together/chatMentions.ts';
import { postTogetherMessage } from '../src/together/chatActions.ts';
import { createChatDraftMemory, emptyChatDraft } from '../src/together/chatDrafts.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';

const groupRoom = roomIdForGroup('one'), activityRoom = roomIdForActivity('outing');
function fixture() {
  const state = createEmptyState('alice', '나');
  state.discoveryCatalogVersion = 3;
  state.members.push({ id: 'bob', name: '민지' }, { id: 'bobby', name: '민지' }, { id: 'mom', name: '우리 엄마' },
    { id: 'unicode', name: '지우 🌷' }, { id: 'other', name: '다른 모임 전용 이름' });
  const group = { id: 'one', name: '우리 모임', kind: 'FAMILY', region: '부산', introduction: '', cover: '', ownerId: 'alice',
    memberIds: ['alice', 'bob', 'bobby', 'mom', 'unicode'], managerIds: ['mom'], archived: false, visibility: 'PRIVATE', promotionPublished: false,
    memberPresentations: { bob: { nickname: '별이', introduction: '노출하면 안 되는 소개' } } };
  state.groups.push(group, { ...structuredClone(group), id: 'other', name: '다른 모임', memberIds: ['alice', 'other'], managerIds: [], memberPresentations: {} });
  state.activities.push({ id: 'outing', groupId: 'one', title: '부산 나들이', date: '', endDate: '', meetingPoint: '', description: '',
    status: 'PLANNED', leadId: 'alice', editorIds: [], participants: { mom: 'DECLINED' }, arrivedIds: [], revision: 1 });
  state.messages.push({ id: 'source', roomId: groupRoom, authorId: 'bob', body: '원문은 별도로 보관', createdAt: '2026-11-14T00:00:00Z' });
  return state;
}
function picked(state = fixture(), room = groupRoom, userId = 'bob', before = '@') {
  const query = findChatMentionQuery(before, before.length);
  assert.ok(query);
  return insertChatMention(state, 'alice', room, before, [], query, userId);
}
function unchanged(state, action) { const before = structuredClone(state); assert.throws(action); assert.deepEqual(state, before); }
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('candidate projection uses exact room members and scoped nickname, never contacts or private introductions', () => {
  const state = fixture(), before = structuredClone(state);
  const candidates = selectChatMentionCandidates(state, 'alice', groupRoom);
  assert.deepEqual(candidates.map(item => item.userId), ['bob', 'bobby', 'mom', 'unicode']);
  assert.equal(candidates[0].name, '별이'); assert.equal(candidates[2].role, '매니저');
  assert.equal(JSON.stringify(candidates).includes('소개'), false);
  assert.deepEqual(selectChatMentionCandidates(state, 'alice', activityRoom), candidates, 'RSVP never grants or removes tagging');
  assert.deepEqual(selectChatMentionCandidates(state, 'alice', groupRoom, '우리 엄'), [candidates[2]]);
  assert.deepEqual(selectChatMentionCandidates(state, 'alice', 'group:missing'), []);
  assert.deepEqual(selectChatMentionCandidates(state, 'other', groupRoom), []);
  state.groups[0].blockedMemberIds = ['mom'];
  assert.equal(selectChatMentionCandidates(state, 'alice', groupRoom).some(item => item.userId === 'mom'), false);
  assert.deepEqual({ ...state, groups: before.groups }, before);
});

test('cursor-local @ query ignores emails, punctuation, existing picked spans, invalid offsets and trailing unrelated text', () => {
  for (const body of ['hi@example.com', 'hi@민지', '@a.com', '@민지\n다음', '다음@@민지']) assert.equal(findChatMentionQuery(body, body.length), null, body);
  assert.deepEqual(findChatMentionQuery('안녕 @우리 엄', 8), { start: 3, end: 8, query: '우리 엄' });
  assert.deepEqual(findChatMentionQuery('(@민지)', 4), { start: 1, end: 4, query: '민지' });
  assert.equal(findChatMentionQuery('@민지', 0), null);
  assert.equal(findChatMentionQuery('@민지', 10), null);
  assert.equal(findChatMentionQuery('🌷 @민지', 1), null);
  const value = picked();
  assert.equal(findChatMentionQuery(value.body, value.mentions[0].end, value.mentions), null);
  assert.equal(findChatMentionQuery(value.body, value.body.length, value.mentions), null);
});

test('explicit insertion records actual picked ID and UTF-16 ranges, preserving body and immutable inputs', () => {
  const state = fixture(), before = structuredClone(state);
  const value = picked(state, groupRoom, 'unicode', '🌷 안녕 @지우');
  assert.equal(value.body, '🌷 안녕 @지우 🌷 ');
  assert.equal(value.mentions[0].start, 6); assert.equal(value.mentions[0].end, 12); assert.equal(value.caret, 13);
  assert.deepEqual(value.mentions[0], { groupId: 'one', roomId: groupRoom, userId: 'unicode', start: 6, end: 12, text: '@지우 🌷' });
  assert.equal(isChatMemberMentions(value.body, value.mentions), true);
  assert.deepEqual(state, before);
});

test('duplicate displayed names preserve the explicitly selected member ID instead of guessing by text', () => {
  const state = fixture(); delete state.groups[0].memberPresentations;
  const candidates = selectChatMentionCandidates(state, 'alice', groupRoom, '민지');
  assert.deepEqual(candidates.map(item => item.userId), ['bob', 'bobby']);
  const value = picked(state, groupRoom, 'bobby');
  const sent = postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, value.mentions);
  assert.equal(sent.body, '@민지'); assert.equal(sent.mentions[0].userId, 'bobby');
});

test('editing before or after tags rebases unchanged spans while editing a tag removes only that identity', () => {
  const first = picked(), body = `${first.body}다음 @`;
  const second = insertChatMention(fixture(), 'alice', groupRoom, body, first.mentions, findChatMentionQuery(body, body.length, first.mentions), 'mom');
  const before = structuredClone(second.mentions);
  const prefixed = `🌷 ${second.body}`, moved = rebaseChatMentions(second.body, prefixed, second.mentions);
  assert.equal(moved[0].start, second.mentions[0].start + 3); assert.equal(moved[1].start, second.mentions[1].start + 3);
  assert.deepEqual(rebaseChatMentions(second.body, `${second.body}추가`, second.mentions), second.mentions);
  const changed = second.body.replace('별이', '별님'), preserved = rebaseChatMentions(second.body, changed, second.mentions);
  assert.equal(preserved.length, 1); assert.equal(preserved[0].userId, 'mom');
  const removed = rebaseChatMentions(second.body, second.body.slice(second.mentions[0].end + 1), second.mentions);
  assert.equal(removed.length, 1); assert.equal(removed[0].userId, 'mom');
  assert.deepEqual(second.mentions, before);
});

test('pasted or typed @name is ordinary text and never acquires a semantic target', () => {
  const state = fixture(), before = structuredClone(state);
  assert.deepEqual(rebaseChatMentions('hello', '@별이 hello', []), []);
  const message = postTogetherMessage(state, 'alice', groupRoom, '@별이 부탁해요');
  assert.equal(Object.hasOwn(message, 'mentions'), false);
  assert.deepEqual({ ...state, messages: before.messages }, before);
});

test('trim adjustment keeps selected spans exact without mutating supplied metadata or copying quoted body', () => {
  const state = fixture(), value = picked(state, groupRoom, 'mom', ' \n @우리');
  const snapshot = structuredClone(value), original = structuredClone(state.messages[0]), rest = { ...structuredClone(state), messages: [] };
  const message = postTogetherMessage(state, 'alice', groupRoom, `${value.body} \n`, 'cat-hi', 'source', value.mentions);
  assert.equal(message.body, '@우리 엄마'); assert.equal(message.mentions[0].start, 0); assert.equal(message.mentions[0].end, 6);
  assert.deepEqual(value, snapshot); assert.deepEqual(state.messages[0], original);
  assert.equal(JSON.stringify(message).includes(original.body), false);
  assert.deepEqual({ ...state, messages: [] }, rest);
  assert.equal(isTogetherState(state), true);
});

test('stale picker ranges and missing, cross-group or blocked selected members are rejected without side effects', () => {
  const state = fixture(), query = findChatMentionQuery('@', 1);
  for (const [body, range, userId] of [['abc @', query, 'bob'], ['@', { ...query, query: '틀림' }, 'bob'], ['@', query, 'other'], ['@', query, 'missing'], ['@', query, 'alice']]) {
    unchanged(state, () => insertChatMention(state, 'alice', groupRoom, body, [], range, userId));
  }
  state.groups[0].blockedMemberIds = ['bob'];
  unchanged(state, () => insertChatMention(state, 'alice', groupRoom, '@', [], query, 'bob'));
});

test('canonical send rejects changed name, departed/blocked target, wrong scope, invalid offsets and forged metadata', () => {
  const mutations = [
    (state, mention) => { state.groups[0].memberPresentations.bob.nickname = '새 이름'; },
    state => { state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'bob'); },
    state => { state.groups[0].blockedMemberIds = ['bob']; },
    (state, mention) => { mention.groupId = 'other'; },
    (state, mention) => { mention.roomId = activityRoom; },
    (state, mention) => { mention.userId = 'other'; },
    (state, mention) => { mention.text = '@다른 이름'; },
    (state, mention) => { mention.start += 1; },
    (state, mention) => { mention.end += 1; },
    (state, mention) => { mention.secret = 'private data'; },
  ];
  for (const mutate of mutations) {
    const state = fixture(), value = picked(state); mutate(state, value.mentions[0]);
    unchanged(state, () => postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, value.mentions));
  }
});

test('a tag prepared in one room cannot be replayed into activity or another group, even if actor belongs to both', () => {
  const state = fixture(), value = picked(state);
  for (const room of [activityRoom, roomIdForGroup('other'), 'group:one:extra']) unchanged(state, () => postTogetherMessage(state, 'alice', room, value.body, undefined, undefined, value.mentions));
  const activityValue = picked(state, activityRoom);
  assert.equal(postTogetherMessage(state, 'alice', activityRoom, activityValue.body, undefined, undefined, activityValue.mentions).mentions[0].roomId, activityRoom);
});

test('current actor membership, profile existence, blocking, archived and one-off lifecycle are checked again before send', () => {
  for (const mutate of [
    state => { state.groups[0].memberIds = ['bob']; }, state => { state.groups[0].blockedMemberIds = ['alice']; },
    state => { state.members = state.members.filter(item => item.id !== 'alice'); }, state => { state.groups[0].archived = true; },
    state => { state.groups[0].temporaryRoom = { purpose: 'GATHERING', expiresAt: '2000-01-01T00:00:00Z' }; },
    state => { state.groups[0].temporaryRoom = { purpose: 'GATHERING', disposition: 'TRASH' }; },
  ]) {
    const state = fixture(), value = picked(state); mutate(state);
    unchanged(state, () => postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, value.mentions));
    assert.deepEqual(selectChatMentionCandidates(state, 'alice', groupRoom), []);
  }
});

test('activity-only spaces expose no synthetic group room, while RSVP and completed activities remain independent', () => {
  const state = fixture(); state.groups[0].spaceType = 'ACTIVITY';
  assert.deepEqual(selectChatMentionCandidates(state, 'alice', groupRoom), []);
  unchanged(state, () => postTogetherMessage(state, 'alice', groupRoom, '숨은 모임방'));
  const value = picked(state, activityRoom, 'mom'); state.activities[0].status = 'COMPLETED';
  const participation = structuredClone(state.activities[0].participants);
  assert.equal(postTogetherMessage(state, 'alice', activityRoom, value.body, undefined, undefined, value.mentions).mentions[0].userId, 'mom');
  assert.deepEqual(state.activities[0].participants, participation);
});

test('stored mention schema rejects overlap, malformed ranges/scope/unknown properties without invalidating legacy or later departure', () => {
  const state = fixture(), value = picked(state), message = postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, value.mentions);
  const good = structuredClone(state);
  for (const change of [
    row => { row.mentions = null; }, row => { row.mentions = {}; }, row => { row.mentions[0].start = -1; },
    row => { row.mentions[0].end = 1.1; }, row => { row.mentions[0].roomId = activityRoom; },
    row => { row.mentions[0].groupId = 'other'; }, row => { row.mentions.push({ ...row.mentions[0] }); },
    row => { row.mentions[0].text = '별이'; }, row => { row.mentions[0].avatar = 'private'; },
  ]) { const copy = structuredClone(good); change(copy.messages.at(-1)); assert.equal(isTogetherState(copy), false); }
  state.groups[0].memberIds = ['alice']; state.groups[0].memberPresentations.bob.nickname = '새 이름';
  assert.equal(isTogetherState(state), true);
  const legacy = fixture(); assert.equal(isTogetherState(legacy), true);
  assert.equal(isChatMemberMentions('🌷', [{ ...message.mentions[0], start: 0, end: 1, text: '@' }]), false);
});

test('render projection uses canonical message, current exact room membership and stable picked ID after nickname change', () => {
  const state = fixture(), value = picked(state), message = postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, value.mentions);
  assert.deepEqual(selectReadableChatMentions(state, 'alice', groupRoom, message), message.mentions);
  state.groups[0].memberPresentations.bob.nickname = '새 이름';
  assert.equal(selectReadableChatMentions(state, 'alice', groupRoom, message)[0].text, '@별이');
  assert.deepEqual(selectReadableChatMentions(state, 'other', groupRoom, message), []);
  assert.deepEqual(selectReadableChatMentions(state, 'alice', activityRoom, message), []);
  assert.deepEqual(selectReadableChatMentions(state, 'alice', groupRoom, { ...message, body: '가짜 본문' }), []);
  state.groups[0].blockedMemberIds = ['bob']; assert.deepEqual(selectReadableChatMentions(state, 'alice', groupRoom, message), []);
  state.groups[0].blockedMemberIds = []; state.groups[0].memberIds = ['alice']; assert.deepEqual(selectReadableChatMentions(state, 'alice', groupRoom, message), []);
  state.groups[0].memberIds.push('bob'); message.deleted = true; assert.deepEqual(selectReadableChatMentions(state, 'alice', groupRoom, message), []);
});

test('draft roundtrip retains unsent text/reply/sticker and picked IDs, with detached arrays and actor/room separation', () => {
  const state = fixture(), value = picked(state), memory = createChatDraftMemory(); memory.activate('alice');
  const context = { state, userId: 'alice', groupId: 'one', roomId: groupRoom }, draft = { body: value.body, stickerId: 'cat-hi', replyToMessageId: 'source', mentions: value.mentions };
  const expected = structuredClone(draft), before = structuredClone(state);
  assert.equal(memory.write(context, draft), true); draft.mentions[0].userId = 'other';
  const returned = memory.read(context); assert.deepEqual(returned, expected); returned.mentions[0].start = 99;
  assert.deepEqual(memory.read(context), expected);
  assert.deepEqual(memory.read({ ...context, roomId: activityRoom }), emptyChatDraft());
  assert.equal(memory.write({ ...context, roomId: activityRoom }, expected), false);
  assert.equal(memory.write({ ...context, groupId: 'other', roomId: roomIdForGroup('other') }, expected), false);
  assert.deepEqual(memory.read(context), expected);
  memory.activate('mom'); assert.deepEqual(memory.read(context), emptyChatDraft());
  assert.deepEqual(state, before);
});

test('target departure preserves visible unsent text for explicit editing but fresh send rejects stale tag, actor departure clears draft', () => {
  const state = fixture(), value = picked(state), memory = createChatDraftMemory(); memory.activate('alice');
  const context = { state, userId: 'alice', groupId: 'one', roomId: groupRoom }, draft = { body: value.body, stickerId: '', replyToMessageId: '', mentions: value.mentions };
  memory.write(context, draft); state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'bob'); memory.reconcile(state, 'alice');
  assert.deepEqual(memory.read(context), draft);
  unchanged(state, () => postTogetherMessage(state, 'alice', groupRoom, draft.body, undefined, undefined, draft.mentions));
  state.groups[0].memberIds = ['mom']; memory.reconcile(state, 'alice'); assert.deepEqual(memory.read(context), emptyChatDraft());
});

test('repository persists only optional allowed mention metadata and failed canonical sends retain the last snapshot', () => {
  const state = fixture(), value = picked(state), key = togetherStorageKey('alice'), disk = memoryStorage({ [key]: JSON.stringify(state), unrelated: 'keep' });
  const repository = createTogetherRepository('alice', '나', [], disk);
  assert.equal(repository.update(draft => { postTogetherMessage(draft, 'alice', groupRoom, value.body, undefined, undefined, value.mentions); }), true);
  const loaded = createTogetherRepository('alice', '나', [], disk).getSnapshot();
  assert.deepEqual(loaded.messages.at(-1).mentions, prepareChatMentionsForSend(state, 'alice', groupRoom, value.body, value.mentions));
  assert.equal(disk.getItem('unrelated'), 'keep');
  const previous = repository.getSnapshot(), bytes = disk.getItem(key);
  assert.equal(repository.update(draft => { postTogetherMessage(draft, 'alice', activityRoom, value.body, undefined, undefined, value.mentions); }), false);
  assert.equal(repository.getSnapshot(), previous); assert.equal(disk.getItem(key), bytes);
});

test('Unicode surrogate boundaries and mention/message bounds fail safely without dropping existing unsent data', () => {
  const state = fixture(), value = picked(state, groupRoom, 'unicode');
  const broken = { ...value.mentions[0], end: value.mentions[0].end - 1, text: value.mentions[0].text.slice(0, -1) };
  assert.equal(isChatMemberMentions(value.body, [broken]), false);
  assert.equal(isChatMemberMentions(value.body, Array.from({ length: 51 }, () => ({ ...value.mentions[0] }))), false);
  const tooLong = `${'a'.repeat(3998)} @`, before = structuredClone(state);
  assert.throws(() => insertChatMention(state, 'alice', groupRoom, tooLong, [], findChatMentionQuery(tooLong, tooLong.length), 'mom'));
  assert.deepEqual(state, before);
  unchanged(state, () => postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, null));
});

test('tag deletion or loss of the boundary removes identity; surrounding untouched tags stay independent', () => {
  const value = picked(), before = structuredClone(value.mentions);
  assert.deepEqual(rebaseChatMentions(value.body, value.body.replace('@', ''), value.mentions), []);
  assert.deepEqual(rebaseChatMentions(value.body, `word${value.body}`, value.mentions), []);
  assert.deepEqual(rebaseChatMentions(value.body, value.body, value.mentions), value.mentions);
  const result = rebaseChatMentions(value.body, value.body, value.mentions); result[0].userId = 'other';
  assert.deepEqual(value.mentions, before);
});

test('ambiguous duplicate original IDs cannot turn another saved member into a clickable profile', () => {
  const state = fixture(), value = picked(state), message = postTogetherMessage(state, 'alice', groupRoom, value.body, undefined, undefined, value.mentions);
  state.messages.push({ ...structuredClone(message), roomId: roomIdForGroup('other') });
  const before = structuredClone(state);
  assert.deepEqual(selectReadableChatMentions(state, 'alice', groupRoom, message), []);
  assert.deepEqual(state, before);
});
