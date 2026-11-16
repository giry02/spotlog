import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, memberName } from '../src/together/model.ts';
import { selectMemberProfile, updateOwnMemberPresentation, isGroupMemberPresentations } from '../src/together/memberProfile.ts';
import { selectMemberRecords } from '../src/together/memberRecords.ts';
import { selectGroupMembers, selectPublicGroupIntroduction } from '../src/together/groupContent.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';
import { createSeedState, TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed.ts';
import { hydrateExampleMemberAvatars, exampleMemberAvatar } from '../src/together/exampleMemberAvatars.ts';

function fixture() {
  const state = createEmptyState('me', '동명이인'); state.discoveryCatalogVersion = 5;
  state.members.push({ id: 'owner', name: '운영자' }, { id: 'author', name: '동명이인', avatar: '/media/author.jpg', email: 'private-email', phone: 'private-phone', birthday: 'private-birthday' }, { id: 'outside', name: '외부' });
  const group = { id: 'g', name: '모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', ownerId: 'owner', memberIds: ['owner', 'me', 'author'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false,
    memberProfiles: { author: { nickname: '가입 이름표', introduction: '가입 소개 비밀', answers: [{ questionId: 'q', answer: '가입 답변 비밀' }], availableTimes: [], rulesAccepted: true } } };
  state.groups.push(group, { ...structuredClone(group), id: 'other', name: '다른 비밀 모임', memberPresentations: { author: { nickname: '다른 이름 비밀', introduction: '다른 소개 비밀' } } });
  state.activities.push({ id: 'a', groupId: 'g', title: '약속A', date: '2999-01-01', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { author: 'JOINED' }, arrivedIds: [], revision: 1 },
    { id: 'b', groupId: 'g', title: '약속B', date: '', endDate: '', meetingPoint: '', description: '', status: 'COMPLETED', leadId: 'owner', editorIds: [], participants: { author: 'MAYBE' }, arrivedIds: [], revision: 1 });
  const post = (id, authorId, activityId, groupId = 'g') => ({ id, authorId, groupId, activityId, title: id, body: id, category: 'FREE', createdAt: '2026-11-10T00:00:00Z', likes: [], comments: [{ id: `${id}-comment`, authorId: 'author', body: '공유 댓글', createdAt: '2026-11-10T00:00:00Z' }], attachments: [{ id: `${id}-photo`, url: `/media/${id}.jpg`, caption: `${id} 사진` }] });
  state.posts.push(post('root', 'author'), post('activity', 'author', 'a'), post('sibling', 'author', 'b'), post('another-author', 'me'), post('foreign', 'author', undefined, 'other'));
  state.media.push({ id: 'media', groupId: 'g', authorId: 'author', kind: 'PHOTO', url: '/media/root.jpg', caption: '앨범 사진', createdAt: '2026-11-10T00:00:00Z' });
  return state;
}
const input = (extra = {}) => ({ nickname: '새 이름표', introduction: '함께 걷는 걸 좋아해요.', avatar: '/media/mine.jpg', ...extra });
function denied(state, actor = 'me', groupId = 'g', activityId, value = input()) {
  const before = structuredClone(state); assert.throws(() => updateOwnMemberPresentation(state, actor, groupId, value, activityId)); assert.deepEqual(state, before);
}

test('shared profile allowlist excludes contact fields, private onboarding and other groups even for an operator', () => {
  const state = fixture(); state.groups[0].memberPresentations = { author: { nickname: '산책 친구', introduction: '직접 공유한 소개' } };
  for (const viewer of ['me', 'owner', 'author']) {
    const before = structuredClone(state), profile = selectMemberProfile(state, viewer, 'g', 'author');
    assert.deepEqual(profile.identity, { id: 'author', name: '산책 친구', avatar: '/media/author.jpg', role: '모임원', introduction: '직접 공유한 소개' });
    for (const secret of ['private-email', 'private-phone', 'private-birthday', '가입 소개 비밀', '가입 답변 비밀', '다른 비밀 모임', '다른 이름 비밀', '다른 소개 비밀']) assert.equal(JSON.stringify(profile).includes(secret), false);
    assert.deepEqual(state, before);
  }
  delete state.groups[0].memberPresentations;
  assert.equal(selectMemberProfile(state, 'owner', 'g', 'author').identity.introduction, '');
  assert.equal(selectMemberRecords(state, 'owner', 'g', 'author').identity.introduction, '가입 소개 비밀');
});

test('group names prefer explicitly saved presentation while keeping prior join nickname fallback and author IDs distinct', () => {
  const state = fixture(); assert.equal(memberName(state, 'author', 'g'), '가입 이름표');
  updateOwnMemberPresentation(state, 'author', 'g', input({ nickname: '새 모임 이름' }));
  assert.equal(memberName(state, 'author', 'g'), '새 모임 이름'); assert.equal(memberName(state, 'me', 'g'), '동명이인');
  assert.equal(memberName(state, 'author', 'other'), '다른 이름 비밀'); assert.equal(memberName(state, 'author'), '동명이인');
  assert.equal(selectGroupMembers(state, 'me', 'g').find(item => item.id === 'author').sharedIntroduction, input().introduction);
});

test('editing writes only own selected group presentation and own global photo, retaining joining answers and all original records', () => {
  const state = fixture(), before = structuredClone(state);
  updateOwnMemberPresentation(state, 'author', 'g', input({ nickname: ' 새 이름 ', introduction: ' 새 소개\n둘째 줄 ' }));
  before.groups[0].memberPresentations = { author: { nickname: '새 이름', introduction: '새 소개\n둘째 줄' } }; before.members.find(item => item.id === 'author').avatar = '/media/mine.jpg';
  assert.deepEqual(state, before); assert.equal(isTogetherState(state), true);
  assert.equal(selectMemberProfile(state, 'me', 'other', 'author').identity.avatar, '/media/mine.jpg');
  updateOwnMemberPresentation(state, 'author', 'g', input({ nickname: '', introduction: '', avatar: '' }));
  assert.equal(state.members.find(item => item.id === 'author').avatar, undefined);
  assert.equal(selectMemberProfile(state, 'me', 'g', 'author').identity.introduction, '');
});

test('albums count exact-author root/activity attachments and retained media, with original post source IDs and no personal library lookup', () => {
  const state = fixture(), root = selectMemberProfile(state, 'me', 'g', 'author'), child = selectMemberProfile(state, 'me', 'g', 'author', 'a');
  assert.deepEqual(root.counts, { journals: 0, media: 2, posts: 1, comments: 2, activities: 1 });
  assert.deepEqual(root.postPhotos.map(photo => [photo.recordId, photo.url]), [['root', '/media/root.jpg']]);
  assert.deepEqual(child.postPhotos.map(photo => [photo.recordId, photo.url]), [['activity', '/media/activity.jpg']]);
  assert.equal(child.counts.media, 1); assert.equal(child.counts.activities, 1);
  state.posts[0].attachments.push({ id: 'unsafe', url: 'javascript:alert(1)', caption: '비정상' });
  assert.equal(selectMemberProfile(state, 'me', 'g', 'author').postPhotos.length, 1);
});

test('current viewer and selected author must both be known, unblocked members of the exact group/activity', () => {
  for (const viewer of ['', 'outside', 'ghost']) assert.equal(selectMemberProfile(fixture(), viewer, 'g', 'author'), null);
  for (const author of ['outside', 'ghost']) assert.equal(selectMemberProfile(fixture(), 'me', 'g', author), null);
  assert.equal(selectMemberProfile(fixture(), 'me', 'other', 'author', 'a'), null);
  assert.equal(selectMemberProfile(fixture(), 'me', 'g', 'author', 'missing'), null);
  for (const change of [s => s.groups[0].blockedMemberIds = ['me'], s => s.groups[0].blockedMemberIds = ['author'], s => s.groups[0].memberIds = ['owner', 'me'], s => s.members = s.members.filter(item => item.id !== 'author')]) {
    const state = fixture(); change(state); assert.equal(selectMemberProfile(state, 'me', 'g', 'author'), null);
  }
});

test('stale profile saves reject guest, revoked, blocked, archived, missing, foreign and standalone fake root scopes unchanged', () => {
  for (const actor of ['', 'outside', 'ghost']) denied(fixture(), actor);
  for (const change of [s => s.groups[0].blockedMemberIds = ['me'], s => s.groups[0].memberIds = ['owner'], s => s.groups[0].archived = true, s => s.members = s.members.filter(item => item.id !== 'me')]) { const state = fixture(); change(state); denied(state); }
  denied(fixture(), 'me', 'other', 'a'); denied(fixture(), 'me', 'g', 'missing');
  const standalone = fixture(); standalone.groups[0].spaceType = 'ACTIVITY'; denied(standalone);
  updateOwnMemberPresentation(standalone, 'me', 'g', input(), 'a');
  const cancelled = fixture(); cancelled.activities[0].status = 'CANCELLED'; denied(cancelled, 'me', 'g', 'a');
});

test('strict additive validation rejects oversized, unknown private fields, prototype keys, invalid images and wrong versions', () => {
  for (const value of [input({ nickname: 'x'.repeat(41) }), input({ introduction: 'x'.repeat(601) }), input({ nickname: 'bad\nname' }), input({ introduction: 'bad\u0000intro' }), input({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }), { ...input(), phone: 'secret' }]) denied(fixture(), 'me', 'g', undefined, value);
  for (const value of [[], { author: { nickname: '이름', introduction: '', email: 'secret' } }, JSON.parse('{"__proto__":{"nickname":"이름","introduction":""}}')]) {
    assert.equal(isGroupMemberPresentations(value), false); const state = fixture(); state.groups[0].memberPresentations = value; assert.equal(isTogetherState(state), false);
  }
  const state = fixture(); state.exampleMemberAvatarVersion = 2; assert.equal(isTogetherState(state), false);
});

test('repository reload persists presentation and invalid or failed writes preserve original storage', () => {
  const initial = fixture(), key = togetherStorageKey('me'), memory = new Map([[key, JSON.stringify(initial)]]);
  let fail = false; const storage = { getItem: k => memory.get(k) ?? null, setItem: (k, value) => { if (fail) throw new Error('full'); memory.set(k, value); } };
  const repo = createTogetherRepository('me', '동명이인', [], storage);
  assert.equal(repo.update(state => updateOwnMemberPresentation(state, 'me', 'g', input())), true);
  assert.equal(createTogetherRepository('me', '동명이인', [], storage).getSnapshot().groups[0].memberPresentations.me.introduction, input().introduction);
  const saved = memory.get(key); fail = true;
  assert.equal(repo.update(state => updateOwnMemberPresentation(state, 'me', 'g', input({ introduction: '실패한 변경' }))), false); assert.equal(memory.get(key), saved);
  fail = false; assert.equal(repo.update(state => state.groups[0].memberPresentations.me.phone = 'secret'), false); assert.equal(memory.get(key), saved);
});

test('fictional example photos use existing local assets and migrate once without replacing custom identities or real accounts', () => {
  const original = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', []); assert.equal(original.exampleMemberAvatarVersion, 1);
  assert.equal(original.members.find(item => item.id === 'example-parent').avatar, exampleMemberAvatar('example-parent'));
  const old = structuredClone(original); delete old.exampleMemberAvatarVersion;
  for (const id of ['example-parent', 'example-sibling', 'example-friend']) delete old.members.find(item => item.id === id).avatar;
  old.members.find(item => item.id === 'example-sibling').avatar = '/custom-avatar.jpg'; old.members.find(item => item.id === 'example-friend').name = '내가 바꾼 이름';
  const before = structuredClone(old), next = hydrateExampleMemberAvatars(old, TOGETHER_REVIEW_MEMBER_ID);
  assert.deepEqual(old, before); assert.notEqual(next, old);
  assert.equal(next.members.find(item => item.id === 'example-sibling').avatar, '/custom-avatar.jpg'); assert.equal(next.members.find(item => item.id === 'example-friend').avatar, undefined);
  assert.ok(next.members.find(item => item.id === 'example-parent').avatar.startsWith('/media/groups/'));
  delete next.members.find(item => item.id === 'example-parent').avatar;
  assert.equal(hydrateExampleMemberAvatars(next, TOGETHER_REVIEW_MEMBER_ID), next); assert.equal(hydrateExampleMemberAvatars(old, 'actual-account'), old);
  assert.equal(isTogetherState(next), true);
});

test('group-shared introduction never becomes a public group introduction or grants outsider access', () => {
  const state = fixture(); state.groups[0].visibility = 'PUBLIC'; state.groups[0].promotionPublished = true;
  state.groups[0].memberPresentations = { author: { nickname: '공유 이름', introduction: '모임원만 보는 소개' } };
  const publicIntro = selectPublicGroupIntroduction(state, 'g'); assert.ok(publicIntro);
  assert.equal(JSON.stringify(publicIntro).includes('모임원만 보는 소개'), false); assert.equal(JSON.stringify(publicIntro).includes('공유 이름'), false);
  assert.equal(selectMemberProfile(state, 'outside', 'g', 'author'), null);
});

test('loading a saved bundled review upgrades only missing default photos and a migration storage failure preserves old bytes', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', []); delete state.exampleMemberAvatarVersion;
  delete state.members.find(item => item.id === 'example-parent').avatar;
  state.members.find(item => item.id === 'example-sibling').avatar = '/my-custom.jpg';
  const key = togetherStorageKey(TOGETHER_REVIEW_MEMBER_ID), raw = JSON.stringify(state), memory = new Map([[key, raw]]);
  const storage = { getItem: k => memory.get(k) ?? null, setItem: (k, value) => memory.set(k, value) };
  const repo = createTogetherRepository(TOGETHER_REVIEW_MEMBER_ID, '검수', [], storage);
  assert.equal(repo.getSnapshot().members.find(item => item.id === 'example-parent').avatar, exampleMemberAvatar('example-parent'));
  assert.equal(repo.getSnapshot().members.find(item => item.id === 'example-sibling').avatar, '/my-custom.jpg');
  assert.equal(JSON.parse(memory.get(key)).exampleMemberAvatarVersion, 1);
  const failing = { getItem: () => raw, setItem: () => { throw new Error('quota'); } };
  const failed = createTogetherRepository(TOGETHER_REVIEW_MEMBER_ID, '검수', [], failing);
  assert.deepEqual(failed.getSnapshot(), JSON.parse(raw)); assert.equal(failing.getItem(key), raw);
});
