import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { ownGroupProfileChoices, updateOwnGroupProfile } from '../src/community/ownGroupProfiles.ts';
import { selectMemberProfile } from '../src/together/memberProfile.ts';
import { createTogetherRepository, togetherStorageKey } from '../src/together/repository.ts';
import { DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples.ts';

const group = (id, changes = {}) => ({ id, name: `${id} 모임`, kind: 'HOBBY', region: '서울', cover: '/group.jpg', introduction: '그룹 소개', visibility: 'PRIVATE', promotionPublished: false,
  ownerId: 'me', memberIds: ['me', 'other'], managerIds: [], archived: false, ...changes });
const input = { nickname: '산책 이름표', introduction: '모임에 공유할 소개', avatar: '/my-photo.jpg' };
function fixture() {
  const state = createEmptyState('me', '계정 이름');
  state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION; state.exampleMemberAvatarVersion = 1;
  state.members[0].avatar = '/base-profile.jpg';
  state.members.push({ id: 'other', name: '다른 멤버', avatar: '/other.jpg' });
  state.groups.push(group('family', { kind: 'FAMILY', memberProfiles: { me: { nickname: '가족 이름', introduction: '운영진에게만 보낸 소개', answers: [], availableTimes: [], rulesAccepted: true } } }),
    group('friends', { kind: 'FRIENDS', memberPresentations: { me: { nickname: '친구 이름', introduction: '친구 모임 소개' } } }),
    group('hobby', { memberPresentations: { me: { nickname: '취미 이름', introduction: '공유 소개' } } }),
    group('guide', { kind: 'GUIDE', memberPresentations: { me: { nickname: '가이드 이름', introduction: '' } } }),
    group('blocked', { blockedMemberIds: ['me'] }), group('archived', { archived: true }), group('former', { memberIds: ['other'] }),
    group('appointment', { spaceType: 'ACTIVITY' }));
  state.activities.push({ id: 'a', groupId: 'appointment', title: '개인 약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  return state;
}

test('own profile chooser lists active hobby and guide groups using their room identity', () => {
  const state = fixture(), before = structuredClone(state);
  assert.deepEqual(ownGroupProfileChoices(state, 'me').map(item => [item.id, item.nickname]), [['hobby', '취미 이름'], ['guide', '가이드 이름']]);
  assert.equal(JSON.stringify(ownGroupProfileChoices(state, 'me')).includes('운영진에게만'), false);
  assert.deepEqual(state, before);
  for (const actor of ['', 'missing']) assert.deepEqual(ownGroupProfileChoices(state, actor), []);
  state.members = state.members.filter(member => member.id !== 'me');
  assert.deepEqual(ownGroupProfileChoices(state, 'me'), []);
});

test('the chooser allowlists presentation fields and rejects unsafe cover resources', () => {
  const state = fixture(), hobby = state.groups.find(item => item.id === 'hobby'); hobby.cover = 'javascript:bad';
  hobby.memberPresentations = { me: { nickname: '새 이름표', introduction: '긴 공유 소개' } };
  const choice = ownGroupProfileChoices(state, 'me')[0];
  assert.deepEqual(choice, { id: 'hobby', name: 'hobby 모임', nickname: '새 이름표', cover: '', role: '모임장' });
});

test('save binds the current actor to the captured sheet owner before touching any draft', () => {
  for (const [current, captured] of [['', 'me'], ['other', 'me'], ['me', 'other']]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => updateOwnGroupProfile(state, current, captured, 'hobby', input));
    assert.deepEqual(state, before);
  }
});

test('save rechecks group type, archive, blocked and departed membership instead of trusting a prior chooser item', () => {
  for (const id of ['family', 'friends', 'blocked', 'archived', 'former', 'appointment', 'missing']) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => updateOwnGroupProfile(state, 'me', 'me', id, input)); assert.deepEqual(state, before);
  }
  const state = fixture(); assert.equal(ownGroupProfileChoices(state, 'me')[0].id, 'hobby');
  state.groups.find(item => item.id === 'hobby').memberIds = ['other']; const before = structuredClone(state);
  assert.throws(() => updateOwnGroupProfile(state, 'me', 'me', 'hobby', input)); assert.deepEqual(state, before);
});

test('save changes the chosen group display while family and friends retain the account profile', () => {
  const state = fixture(), before = structuredClone(state);
  updateOwnGroupProfile(state, 'me', 'me', 'hobby', input);
  const chosen = selectMemberProfile(state, 'me', 'hobby', 'me');
  assert.equal(chosen.identity.name, input.nickname);
  assert.equal(chosen.identity.avatar, input.avatar);
  assert.equal(chosen.identity.introduction, input.introduction);
  assert.deepEqual(state.groups.filter(item => item.id !== 'hobby'), before.groups.filter(item => item.id !== 'hobby'));
  assert.deepEqual(state.activities, before.activities);
  assert.deepEqual(state.members, before.members);
  for (const id of ['family', 'friends']) {
    const { identity } = selectMemberProfile(state, 'me', id, 'me');
    assert.equal(identity.name, '계정 이름');
    assert.equal(identity.avatar, '/base-profile.jpg');
  }
});

test('a stale external membership update is loaded without saving the old profile draft and remains guarded on retry', () => {
  const state = fixture(), key = togetherStorageKey('me'), memory = new Map([[key, JSON.stringify(state)], [togetherStorageKey('other'), 'other account bytes']]);
  const storage = { get length() { return memory.size; }, getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key), clear: () => memory.clear(), key: index => [...memory.keys()][index] ?? null };
  const repository = createTogetherRepository('me', '계정 이름', [], storage);
  const revoked = structuredClone(repository.getSnapshot()); revoked.groups.find(item => item.id === 'hobby').archived = true;
  memory.set(key, JSON.stringify(revoked)); const bytes = memory.get(key);
  assert.equal(repository.update(draft => updateOwnGroupProfile(draft, 'me', 'me', 'hobby', input)), false);
  assert.equal(memory.get(key), bytes);
  assert.equal(repository.getSnapshot().groups.find(item => item.id === 'hobby').archived, true);
  assert.equal(repository.update(draft => updateOwnGroupProfile(draft, 'me', 'me', 'hobby', input)), false);
  assert.equal(memory.get(key), bytes);
  assert.equal(memory.get(togetherStorageKey('other')), 'other account bytes');
});
