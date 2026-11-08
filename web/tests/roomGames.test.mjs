import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createRoomGame, getRoomGameContext, getRoomGames, isTogetherGame, rerunRoomGame, uniformGameIndex } from '../src/together/roomGames.ts';

const at = new Date('2026-11-08T12:00:00+09:00');
const groupScope = { groupId: 'family' }, activityScope = { groupId: 'family', activityId: 'next' };
function fixture() {
  const state = createEmptyState('owner', '모임장');
  state.members.push({ id: 'me', name: '나' }, { id: 'friend', name: '친구' }, { id: 'outside', name: '외부인' });
  state.groups.push({ id: 'family', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner',
    memberIds: ['owner', 'me', 'friend'], managerIds: [], archived: false, promotionPublished: false });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other', memberIds: ['outside'], ownerId: 'outside' });
  state.activities.push({ id: 'next', groupId: 'family', title: '다음 만남', date: '2026-11-09', endDate: '2026-11-09', status: 'PLANNED',
    meetingPoint: '비공개 장소', description: '원래 약속', leadId: 'owner', editorIds: [], participants: { me: 'MAYBE' }, arrivedIds: [], revision: 4 });
  state.tasks.push({ id: 'existing-task', groupId: 'family', activityId: 'next', title: '예약 확인', assigneeId: 'owner', completed: false });
  return state;
}
const wheel = (id = 'wheel', changes = {}) => ({ id, type: 'WHEEL', title: '오늘 메뉴', options: ['국밥', '파스타', '회'], ...changes });
const draw = (id = 'draw', changes = {}) => ({ id, type: 'DRAW', title: '오늘의 주인공', memberIds: ['owner', 'me', 'friend'], ...changes });
const ladder = (id = 'ladder', changes = {}) => ({ id, type: 'LADDER', title: '준비 역할', memberIds: ['owner', 'me', 'friend'], options: ['예약 확인', '준비물 챙기기', '사진 모으기'], ...changes });
const randomSequence = values => { let index = 0; return () => { assert.ok(index < values.length, 'unexpected random call'); return values[index++]; }; };
const rejectUnchanged = (state, action) => { const before = structuredClone(state); assert.throws(action); assert.deepEqual(state, before); };

test('unbiased bounded sampling rejects the uint32 remainder and rejects invalid or stuck random sources', () => {
  assert.equal(uniformGameIndex(3, randomSequence([0xffffffff, 2])), 2);
  assert.equal(uniformGameIndex(2, () => 0xffffffff), 1);
  assert.equal(uniformGameIndex(12, randomSequence([0xffffffff, 11])), 11);
  for (const value of [-1, 0x100000000, .5, NaN, Infinity]) assert.throws(() => uniformGameIndex(3, () => value));
  for (const length of [0, 1, 13, 2.1]) assert.throws(() => uniformGameIndex(length, () => 0));
  assert.throws(() => uniformGameIndex(3, () => 0xffffffff));
});

test('production selection uses crypto uint32 and fails without crypto instead of falling back to Math.random', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const mathRandom = Math.random;
  try {
    Math.random = () => { throw new Error('insecure random fallback'); };
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: values => { values[0] = 1; return values; } } });
    const state = fixture();
    const result = createRoomGame(state, 'me', groupScope, wheel(), at);
    assert.equal(result.result.optionId, 'option-2');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    rejectUnchanged(state, () => createRoomGame(state, 'me', groupScope, wheel('missing-crypto'), at));
  } finally {
    Math.random = mathRandom;
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); else delete globalThis.crypto;
  }
});

test('wheel stores one explicit option result and does not touch schedules, RSVP, tasks, messages or source input', () => {
  const state = fixture(), before = structuredClone(state), input = wheel();
  const result = createRoomGame(state, 'me', groupScope, input, at, () => 1);
  assert.equal(result.type, 'WHEEL'); assert.equal(result.result.optionId, 'option-2'); assert.equal(isTogetherGame(result), true);
  assert.equal(result.createdBy, 'me'); assert.equal(result.createdAt, at.toISOString()); assert.equal(result.round, 1);
  assert.deepEqual(state.activities, before.activities); assert.deepEqual(state.tasks, before.tasks); assert.deepEqual(state.messages, before.messages);
  assert.deepEqual(input, wheel()); assert.deepEqual(result.members, []);
  result.options[0].label = '출력 변조'; assert.equal(state.games[0].options[0].label, '국밥');
  delete state.games; assert.deepEqual(state, before);
});

test('draw chooses only current selected members without assuming any attendance and snapshots names', () => {
  const state = fixture();
  const result = createRoomGame(state, 'me', activityScope, draw(), at, () => 2);
  assert.equal(result.result.memberId, 'friend'); assert.deepEqual(result.options, []); assert.equal(result.source, 'MEMBERS');
  assert.equal(state.activities[0].participants.friend, undefined); assert.equal(state.activities[0].participants.me, 'MAYBE');
  state.members.find(member => member.id === 'friend').name = '변경한 이름';
  assert.equal(getRoomGames(state, 'me', activityScope, at)[0].members.find(member => member.id === 'friend').name, '친구');
});

test('member-based wheels retain separate current IDs even when display names are identical', () => {
  const state = fixture(); state.members.find(member => member.id === 'friend').name = '나';
  const result = createRoomGame(state, 'me', groupScope, wheel('members', { memberIds: ['me', 'friend'], options: undefined }), at, () => 1);
  assert.deepEqual(result.options.map(option => option.label), ['나', '나']); assert.equal(result.result.optionId, 'option-2');
  assert.equal(isTogetherGame(result), true);
  const corrupt = structuredClone(result); corrupt.options[1].label = '선택하지 않은 사람'; assert.equal(isTogetherGame(corrupt), false);
});

test('ladder uses each role and member exactly once, and its saved bars reproduce the actual assignment', () => {
  const state = fixture(); const result = createRoomGame(state, 'me', activityScope, ladder(), at, randomSequence([0, 0]));
  assert.equal(isTogetherGame(result), true); assert.equal(result.result.assignments.length, 3);
  assert.equal(new Set(result.result.assignments.map(pair => pair.memberId)).size, 3);
  assert.equal(new Set(result.result.assignments.map(pair => pair.optionId)).size, 3);
  assert.equal(state.tasks[0].assigneeId, 'owner');
  for (const change of [game => { game.result.assignments[0].optionId = game.result.assignments[1].optionId; },
    game => { game.result.assignments.reverse(); game.result.assignments[0].memberId = 'outside'; },
    game => { game.result.bars[0].left = 9; }, game => { game.result.bars[0].level = 7; }, game => { game.result.bars = []; }]) {
    const corrupt = structuredClone(result); change(corrupt); assert.equal(isTogetherGame(corrupt), false);
  }
});

test('the six legal Fisher–Yates random paths produce all six distinct three-person assignments', () => {
  const results = new Set();
  for (let first = 0; first < 3; first++) for (let second = 0; second < 2; second++) {
    const result = createRoomGame(fixture(), 'me', groupScope, ladder(), at, randomSequence([first, second]));
    assert.equal(isTogetherGame(result), true); results.add(result.result.assignments.map(pair => pair.optionId).join(','));
  }
  assert.equal(results.size, 6);
});

test('identity assignments show neutral paired ladder bars without redrawing, and older empty-bar results remain readable unchanged', () => {
  for (const length of [2, 3, 12]) {
    const state = fixture();
    state.members = Array.from({ length }, (_, index) => ({ id: `m${index}`, name: `멤버 ${index}` }));
    state.groups[0].memberIds = state.members.map(member => member.id);
    const input = ladder(`identity-${length}`, { memberIds: state.groups[0].memberIds, options: state.members.map((_, index) => `역할 ${index}`) });
    const result = createRoomGame(state, 'm0', groupScope, input, at, randomSequence(Array.from({ length: length - 1 }, (_, index) => length - 1 - index)));
    assert.deepEqual(result.result.assignments, state.members.map((member, index) => ({ memberId: member.id, optionId: result.options[index].id })));
    assert.equal(result.result.bars.length, (length - 1) * 2);
    for (let index = 0; index < result.result.bars.length; index += 2) {
      assert.equal(result.result.bars[index].left, result.result.bars[index + 1].left);
      assert.equal(result.result.bars[index + 1].level, result.result.bars[index].level + 1);
    }
    assert.equal(isTogetherGame(result), true);
    const legacy = structuredClone(result); legacy.result.bars = []; state.games = [legacy];
    const before = structuredClone(state);
    assert.equal(isTogetherGame(legacy), true);
    assert.deepEqual(getRoomGames(state, 'm0', groupScope, at)[0].result.bars, []);
    assert.deepEqual(state, before);
  }
});

test('input validation bounds choices and member counts before any state mutation or draw', () => {
  const state = fixture(); const noRandom = () => { throw new Error('random must not run'); };
  for (const input of [wheel('', {}), wheel('bad', { title: '' }), wheel('bad', { title: 'a'.repeat(101) }), wheel('bad', { options: ['one'] }),
    wheel('bad', { options: Array.from({ length: 13 }, (_, index) => `option-${index}`) }), wheel('bad', { options: ['A', ' a '] }),
    wheel('bad', { options: ['가', ' '.repeat(2)] }), wheel('bad', { options: ['a'.repeat(81), 'b'] }), draw('bad', { memberIds: ['me'] }),
    draw('bad', { memberIds: ['me', 'me'] }), draw('bad', { memberIds: ['me', 'outside'] }), draw('bad', { options: ['x', 'y'] }),
    wheel('bad', { memberIds: ['me', 'friend'] }), ladder('bad', { options: ['하나', '둘'] }), ladder('bad', { options: ['하나', '둘', '둘'] })]) {
    rejectUnchanged(state, () => createRoomGame(state, 'me', groupScope, input, at, noRandom));
  }
});

test('missing, foreign, archived, blocked and invalid actor scopes fail closed before saving', () => {
  const original = fixture();
  for (const [actor, scope] of [['', groupScope], ['outside', groupScope], ['owner-missing', groupScope], ['me', { groupId: 'missing' }],
    ['me', { groupId: 'other', activityId: 'next' }], ['me', { groupId: 'family', activityId: 'missing' }]]) {
    const state = structuredClone(original); rejectUnchanged(state, () => createRoomGame(state, actor, scope, wheel(), at, () => 0));
    assert.deepEqual(getRoomGames(state, actor, scope, at), []);
  }
  for (const mutate of [state => { state.groups[0].archived = true; }, state => { state.groups[0].blockedMemberIds = ['me']; },
    state => { state.groups[0].memberIds = ['owner', 'friend']; }, state => { state.members = state.members.filter(member => member.id !== 'me'); }]) {
    const state = fixture(); mutate(state); rejectUnchanged(state, () => createRoomGame(state, 'me', groupScope, wheel(), at, () => 0));
  }
});

test('standalone backing groups cannot be used as a whole-group game room', () => {
  const state = fixture(); state.groups[0].spaceType = 'ACTIVITY';
  rejectUnchanged(state, () => createRoomGame(state, 'me', groupScope, wheel(), at, () => 0));
  const result = createRoomGame(state, 'me', activityScope, wheel(), at, () => 0); assert.equal(result.activityId, 'next');
  assert.deepEqual(getRoomGames(state, 'me', groupScope, at), []);
});

test('reopening is read-only, scope-exact, detached, and does not rerun or change any original', () => {
  const state = fixture(); createRoomGame(state, 'me', groupScope, wheel('group-game'), at, () => 0);
  createRoomGame(state, 'me', activityScope, wheel('activity-game'), at, () => 1);
  const before = structuredClone(state);
  for (let count = 0; count < 4; count++) assert.equal(getRoomGames(state, 'me', groupScope, at)[0].id, 'group-game');
  assert.deepEqual(getRoomGames(state, 'me', activityScope, at).map(game => game.id), ['activity-game']);
  assert.deepEqual(state, before);
  const read = getRoomGames(state, 'me', groupScope, at); read[0].title = '외부 변조'; assert.equal(state.games[0].title, '오늘 메뉴');
  state.groups[0].blockedMemberIds = ['me']; assert.deepEqual(getRoomGames(state, 'me', groupScope, at), []);
});

test('cancelled, completed, expired or malformed-dated activity results stay readable but cannot be rerun', () => {
  for (const mutate of [state => { state.activities[0].status = 'CANCELLED'; }, state => { state.activities[0].status = 'COMPLETED'; },
    state => { state.activities[0].date = state.activities[0].endDate = '2026-11-07'; },
    state => { state.activities[0].endDate = '2026-11-40'; }]) {
    const state = fixture(); const saved = createRoomGame(state, 'me', activityScope, wheel(), at, () => 0); mutate(state);
    assert.equal(getRoomGames(state, 'me', activityScope, at).length, 1);
    rejectUnchanged(state, () => rerunRoomGame(state, 'me', saved.id, at, () => 1, 'rerun'));
    assert.equal(getRoomGameContext(state, 'me', activityScope, at).canWrite, false);
  }
});

test('explicit rerun creates a fresh round with a previous reference while every old snapshot remains unchanged', () => {
  const state = fixture(); const first = createRoomGame(state, 'me', groupScope, wheel(), at, () => 0);
  const second = rerunRoomGame(state, 'owner', first.id, new Date(at.getTime() + 1000), () => 2, 'second');
  assert.equal(second.round, 2); assert.equal(second.previousGameId, first.id); assert.equal(second.createdBy, 'owner');
  assert.equal(second.result.optionId, 'option-3'); assert.deepEqual(state.games[0], first);
  assert.deepEqual(second.options, first.options); assert.equal(state.games.length, 2);
  assert.equal(isTogetherGame(second), true);
});

test('member removal blocks rerun without replacing the original participant by a different person', () => {
  const state = fixture(); createRoomGame(state, 'me', groupScope, draw(), at, () => 0);
  state.groups[0].memberIds = ['owner', 'me'];
  rejectUnchanged(state, () => rerunRoomGame(state, 'me', 'draw', at, () => 0, 'second'));
  assert.equal(getRoomGames(state, 'me', groupScope, at)[0].members.length, 3);
});

test('blocking a selected member prevents a new round, while renamed current members create a new name snapshot', () => {
  const state = fixture(); const first = createRoomGame(state, 'me', groupScope, draw(), at, () => 0);
  state.groups[0].blockedMemberIds = ['friend'];
  rejectUnchanged(state, () => rerunRoomGame(state, 'me', first.id, at, () => 0, 'blocked-round'));
  state.groups[0].blockedMemberIds = [];
  state.members.find(member => member.id === 'friend').name = '새 이름';
  const next = rerunRoomGame(state, 'me', first.id, at, () => 2, 'renamed-round');
  assert.equal(next.members.find(member => member.id === 'friend').name, '새 이름');
  assert.equal(state.games[0].members.find(member => member.id === 'friend').name, '친구');
});

test('stable create and rerun request IDs make save retries idempotent without consuming randomness again', () => {
  const state = fixture(); const input = ladder(); const first = createRoomGame(state, 'me', groupScope, input, at, () => 0);
  const noRandom = () => { throw new Error('unexpected rerandomization'); };
  assert.deepEqual(createRoomGame(state, 'me', groupScope, input, at, noRandom), first);
  const second = rerunRoomGame(state, 'me', first.id, at, () => 1, 'stable-rerun');
  assert.deepEqual(rerunRoomGame(state, 'me', first.id, at, noRandom, 'stable-rerun'), second);
  assert.equal(state.games.length, 2);
  rejectUnchanged(state, () => createRoomGame(state, 'me', groupScope, { ...input, title: '다른 제목' }, at, noRandom));
  rejectUnchanged(state, () => createRoomGame(state, 'owner', groupScope, input, at, noRandom));
  rejectUnchanged(state, () => createRoomGame(state, 'me', activityScope, input, at, noRandom));
});

test('validator rejects extra private fields, broken selection, metadata and out-of-scope embedded result IDs', () => {
  const state = fixture(); const original = createRoomGame(state, 'me', groupScope, wheel(), at, () => 0);
  for (const mutate of [game => { game.privateNote = '비공개'; }, game => { game.result.optionId = 'foreign'; }, game => { game.result.secret = 'x'; },
    game => { game.options[0].note = '비공개'; }, game => { game.options[1].id = game.options[0].id; }, game => { game.createdAt = 'bad'; },
    game => { game.round = 2; }, game => { game.previousGameId = game.id; }, game => { game.source = 'MEMBERS'; }, game => { game.options[1].label = game.options[0].label; }]) {
    const corrupt = structuredClone(original); mutate(corrupt); assert.equal(isTogetherGame(corrupt), false);
  }
  for (const value of [null, [], {}, { ...original, version: 2 }]) assert.equal(isTogetherGame(value), false);
});

test('two and twelve-person ladders stay valid and do not mutate existing frozen results', () => {
  for (const length of [2, 12]) {
    const state = fixture(); state.members = Array.from({ length }, (_, index) => ({ id: `m${index}`, name: `멤버 ${index}` }));
    state.groups[0].ownerId = 'm0'; state.groups[0].memberIds = state.members.map(member => member.id);
    const result = createRoomGame(state, 'm0', groupScope, ladder(`ladder-${length}`, { memberIds: state.groups[0].memberIds, options: state.members.map((_, index) => `역할 ${index}`) }), at, () => 0);
    assert.equal(isTogetherGame(result), true); assert.ok(result.result.bars.length <= 66);
    const before = JSON.stringify(state.games[0]);
    const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
    freeze(state.games[0]); rerunRoomGame(state, 'm0', result.id, at, () => 1, `rerun-${length}`);
    assert.equal(JSON.stringify(state.games[0]), before);
  }
});
