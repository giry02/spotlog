import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { initialMemberRecordTab, ownShareableJournals, resolveMemberRecordDestination, selectMemberRecords, shareMemberJournal } from '../src/together/memberRecords.ts';
import { isTogetherState } from '../src/together/repository.ts';

const group = (id, extra = {}) => ({ id, name: id, kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', promotionPublished: false, ownerId: 'owner', memberIds: ['owner', 'me'], managerIds: [], archived: false, ...extra });
const journal = (id, extra = {}) => ({ id, title: id, region: '부산', dateRange: '', duration: '당일', status: 'PUBLISHED', visibility: 'PRIVATE', cover: '', summary: '공유 소개', story: '공유 이야기', tags: [], saves: 0, author: '나', isMine: true, purpose: 'JOURNAL', days: [{ day: 1, dayId: 'day-1', date: '', title: '기록', story: '', places: [{ id: 'p', kind: 'FOOD', name: '식당', area: '부산', address: '공개 장소 주소', image: '', description: '', duration: '1시간', note: '개인 메모 비밀', booking: { confirmation: '예약번호 비밀' }, visitId: 'v' }], blocks: [{ id: 'b', type: 'TEXT', body: '여행기 본문' }] }], planningPreferences: { prompt: '개인 요청문 비밀' }, editorDraft: { value: { story: '미완성 글 비밀' } }, phone: '연락처 비밀', ...extra });
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'owner', name: '모임장' }, { id: 'other', name: '외부인' });
  state.groups.push(group('g'), group('foreign', { ownerId: 'other', memberIds: ['other'] }));
  state.activities.push(...['a', 'b'].map(id => ({ id, groupId: 'g', title: id, date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], revision: 1 })));
  for (const authorId of ['me', 'owner', 'other']) for (const [groupId, activityId] of [['g', undefined], ['g', 'a'], ['g', 'b'], ['foreign', undefined]]) {
    const id = `${authorId}-${groupId}-${activityId || 'root'}`;
    state.posts.push({ id, groupId, activityId, authorId, title: id, body: '글', category: 'FREE', createdAt: '2026-11-09T00:00:00Z', likes: [], comments: [] });
    state.media.push({ id, groupId, activityId, authorId, kind: 'PHOTO', url: 'https://example.test/photo.jpg', caption: id, createdAt: '2026-11-09T00:00:00Z' });
    state.sharedJournals.push({ id, groupId, activityId, authorId, journey: journal(id, { isMine: false }) });
  }
  return state;
}

test('member records intersect exact author, group and appointment rather than scanning personal libraries', () => {
  const state = fixture(), before = structuredClone(state);
  const root = selectMemberRecords(state, 'me', 'g', 'owner');
  const child = selectMemberRecords(state, 'me', 'g', 'owner', 'a');
  for (const field of ['journals', 'posts', 'media']) {
    assert.deepEqual(root[field].map(item => item.id), ['owner-g-root']);
    assert.deepEqual(child[field].map(item => item.id), ['owner-g-a']);
  }
  assert.deepEqual(state, before);
});

test('guest, other account, blocked viewer/author and departed member cannot retrieve records', () => {
  for (const viewer of ['', 'other', 'ghost']) assert.equal(selectMemberRecords(fixture(), viewer, 'g', 'owner'), null);
  assert.equal(selectMemberRecords(fixture(), 'me', 'g', 'other'), null);
  const blocked = fixture(); blocked.groups[0].blockedMemberIds = ['owner'];
  assert.equal(selectMemberRecords(blocked, 'me', 'g', 'owner'), null);
  blocked.groups[0].blockedMemberIds = ['me'];
  assert.equal(selectMemberRecords(blocked, 'me', 'g', 'owner'), null);
  const departed = fixture(); departed.groups[0].memberIds = ['owner'];
  assert.equal(selectMemberRecords(departed, 'me', 'g', 'owner'), null);
});

test('missing, sibling-group and standalone root scopes cannot manufacture a personal view', () => {
  assert.equal(selectMemberRecords(fixture(), 'me', 'g', 'owner', 'missing'), null);
  const state = fixture(); state.activities[0].groupId = 'foreign';
  assert.equal(selectMemberRecords(state, 'me', 'g', 'owner', 'a'), null);
  state.groups[0].spaceType = 'ACTIVITY';
  assert.equal(selectMemberRecords(state, 'me', 'g', 'owner'), null);
  assert.ok(selectMemberRecords(state, 'me', 'g', 'owner', 'b'));
});

test('only completed own journals enter selection, with private originals allowed before explicit sharing', () => {
  const sources = [journal('private'), journal('public', { visibility: 'PUBLIC' }), journal('other', { isMine: false }), journal('plan', { purpose: 'PLAN' }), journal('unfinished', { status: 'PLANNING' }), journal('trash', { trash: {} })];
  assert.deepEqual(ownShareableJournals(sources).map(item => item.id), ['private', 'public']);
  assert.equal(selectMemberRecords(fixture(), 'me', 'g', 'me').journals.some(item => item.id === 'private'), false);
});

test('explicit share snapshots the selected journal without private inputs, bookings, notes or source visibility changes', () => {
  const state = fixture(), source = journal('mine'), before = structuredClone(source);
  const id = shareMemberJournal(state, 'me', 'g', source, 'a');
  const result = selectMemberRecords(state, 'me', 'g', 'me', 'a').journals.find(item => item.id === id);
  assert.equal(result.sourceJourneyId, source.id);
  assert.equal(result.journey.story, source.story);
  assert.equal(result.journey.days[0].blocks[0].body, '여행기 본문');
  assert.equal(result.journey.visibility, 'PRIVATE');
  assert.equal(result.journey.days[0].places[0].note, '');
  for (const secret of ['개인 메모 비밀', '예약번호 비밀', '개인 요청문 비밀', '미완성 글 비밀', '연락처 비밀']) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(source, before);
  assert.equal(selectMemberRecords(state, 'me', 'g', 'me').journals.some(item => item.id === id), false);
  assert.ok(isTogetherState(state));
});

test('sharing rechecks current access and rejects archived/cancelled scopes, incomplete or other-author sources', () => {
  for (const actor of ['', 'other', 'ghost']) assert.throws(() => shareMemberJournal(fixture(), actor, 'g', journal('x')));
  for (const change of [state => state.groups[0].archived = true, state => state.groups[0].blockedMemberIds = ['me'], state => state.groups[0].memberIds = ['owner']]) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.throws(() => shareMemberJournal(state, 'me', 'g', journal('x'))); assert.deepEqual(state, before);
  }
  const cancelled = fixture(); cancelled.activities[0].status = 'CANCELLED';
  assert.throws(() => shareMemberJournal(cancelled, 'me', 'g', journal('x'), 'a'));
  for (const source of [journal('x', { isMine: false }), journal('x', { purpose: 'PLAN' }), journal('x', { status: 'PLANNING' }), journal('x', { trash: {} })]) assert.throws(() => shareMemberJournal(fixture(), 'me', 'g', source));
});

test('repeated confirmation reports already shared without replacing the old version; new room receives its own snapshot', () => {
  const state = fixture(), source = journal('mine');
  const first = shareMemberJournal(state, 'me', 'g', source);
  const length = state.sharedJournals.length;
  assert.throws(() => shareMemberJournal(state, 'me', 'g', source), /이미 공유한 여행기/);
  assert.equal(state.sharedJournals.length, length);
  assert.notEqual(shareMemberJournal(state, 'me', 'g', source, 'a'), first);
  assert.equal(state.sharedJournals.length, length + 1);
});

test('archived groups remain readable and stale trash/non-journal snapshots do not appear as member journals', () => {
  const state = fixture(); state.groups[0].archived = true;
  assert.ok(selectMemberRecords(state, 'me', 'g', 'owner'));
  state.sharedJournals.find(item => item.id === 'owner-g-root').journey.trash = {};
  assert.deepEqual(selectMemberRecords(state, 'me', 'g', 'owner').journals, []);
});

test('profile identity uses only this group nickname and retains own/manager introduction access', () => {
  const state = fixture();
  state.groups[0].kind = 'HOBBY';
  state.groups[0].memberProfiles = { owner: { nickname: '이 모임 이름', introduction: '가입 소개', answers: [{ answer: '가입 질문 답변 비밀' }] } };
  state.groups[1].memberProfiles = { owner: { nickname: '다른 모임 이름 비밀', introduction: '다른 모임 소개 비밀' } };
  state.members.find(item => item.id === 'owner').avatar = 'javascript:bad';
  const value = selectMemberRecords(state, 'me', 'g', 'owner').identity;
  assert.deepEqual(value, { id: 'owner', name: '이 모임 이름', avatar: '', role: '모임장', introduction: '' });
  assert.equal(selectMemberRecords(state, 'owner', 'g', 'owner').identity.introduction, '가입 소개');
  state.groups[0].managerIds = ['me'];
  assert.equal(selectMemberRecords(state, 'me', 'g', 'owner').identity.introduction, '가입 소개');
  assert.equal(JSON.stringify(selectMemberRecords(state, 'me', 'g', 'owner').identity).includes('질문 답변'), false);
});

test('comments include the selected member replies on any author post only in the exact chosen scope', () => {
  const state = fixture(), add = (postId, id, authorId = 'owner') => state.posts.find(post => post.id === postId).comments.push({ id, authorId, body: id, createdAt: '2026-11-10T00:00:00Z' });
  add('me-g-root', 'root-comment'); add('me-g-a', 'a-comment'); add('me-g-b', 'b-comment'); add('me-foreign-root', 'foreign-comment'); add('owner-g-root', 'another-member-comment', 'me');
  const before = structuredClone(state);
  assert.deepEqual(selectMemberRecords(state, 'me', 'g', 'owner').comments.map(item => [item.id, item.postId]), [['root-comment', 'me-g-root']]);
  assert.deepEqual(selectMemberRecords(state, 'me', 'g', 'owner', 'a').comments.map(item => item.id), ['a-comment']);
  assert.deepEqual(state, before);
});

test('participation shows explicit attending choices in this group, retains cancelled history and scopes appointments exactly', () => {
  const state = fixture();
  state.activities[0].participants.owner = 'JOINED'; state.activities[0].date = '2026-11-10'; state.activities[0].cover = 'javascript:bad';
  state.activities[1].participants.owner = 'MAYBE'; state.activities[1].arrivedIds = ['owner'];
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'cancelled', date: '2026-11-09', status: 'CANCELLED' }, { ...structuredClone(state.activities[0]), id: 'foreign-activity', groupId: 'foreign' });
  assert.deepEqual(selectMemberRecords(state, 'me', 'g', 'owner').activities.map(item => item.id), ['a', 'cancelled']);
  assert.equal(selectMemberRecords(state, 'me', 'g', 'owner').activities[0].cover, '');
  assert.deepEqual(selectMemberRecords(state, 'me', 'g', 'owner', 'a').activities.map(item => item.id), ['a']);
  assert.deepEqual(selectMemberRecords(state, 'me', 'g', 'owner', 'b').activities, []);
  state.activities[1].participants.owner = 'DECLINED';
  assert.equal(selectMemberRecords(state, 'me', 'g', 'owner').activities.some(item => item.id === 'b'), false);
});

test('comment destinations require exact parent, comment author and scope and reject stale membership or records', () => {
  const state = fixture();
  for (const id of ['me-g-root', 'me-g-a']) state.posts.find(item => item.id === id).comments.push({ id: 'same-comment-id', authorId: 'owner', body: '댓글', createdAt: '2026-11-10T00:00:00Z' });
  const target = { kind: 'COMMENT', postId: 'me-g-a', commentId: 'same-comment-id' };
  const resolve = () => resolveMemberRecordDestination(state, 'me', 'g', 'owner', 'a', target);
  assert.deepEqual(resolve(), { kind: 'COMMENT', route: 'activity-a', activityId: 'a', view: 'record', recordView: 'posts', elementId: 'tg-comment-me-g-a-same-comment-id', postElementId: 'tg-post-me-g-a' });
  assert.equal(resolveMemberRecordDestination(state, 'me', 'g', 'owner', undefined, target), null);
  assert.equal(resolveMemberRecordDestination(state, 'me', 'g', 'me', 'a', target), null);
  state.groups[0].blockedMemberIds = ['owner']; assert.equal(resolve(), null);
  state.groups[0].blockedMemberIds = ['me']; assert.equal(resolve(), null);
  state.groups[0].blockedMemberIds = []; state.posts.find(item => item.id === 'me-g-a').comments = []; assert.equal(resolve(), null);
});

test('activity destinations recheck attending state, exact appointment scope and current target membership', () => {
  const state = fixture(); state.activities[0].participants.owner = 'JOINED';
  const target = { kind: 'ACTIVITY', activityId: 'a' }, resolve = () => resolveMemberRecordDestination(state, 'me', 'g', 'owner', undefined, target);
  assert.deepEqual(resolve(), { kind: 'ACTIVITY', route: 'activity-a', activityId: 'a', view: 'schedule' });
  assert.equal(resolveMemberRecordDestination(state, 'me', 'g', 'owner', 'b', target), null);
  state.activities[0].participants.owner = 'DECLINED'; assert.equal(resolve(), null);
  state.activities[0].participants.owner = 'JOINED'; state.groups[0].memberIds = ['me']; assert.equal(resolve(), null);
  state.groups[0].memberIds = ['owner', 'me']; state.activities[0].groupId = 'foreign'; assert.equal(resolve(), null);
});

test('first profile entry selects existing content in this scope with posts first and an honest empty fallback', () => {
  const records = { posts: [], journals: [], media: [], comments: [], activities: [] };
  assert.equal(initialMemberRecordTab(records), 'posts');
  for (const tab of ['activities', 'comments', 'media', 'journals', 'posts']) {
    records[tab].push({}); assert.equal(initialMemberRecordTab(records), tab);
  }
  const state = fixture(); state.posts = state.posts.filter(item => item.activityId !== 'a'); state.sharedJournals = state.sharedJournals.filter(item => item.activityId !== 'a');
  assert.equal(initialMemberRecordTab(selectMemberRecords(state, 'me', 'g', 'owner', 'a')), 'media');
});

test('explicit share returns and scope selections retain the requested tab even when another tab has records', () => {
  const records = { posts: [{}], journals: [], media: [{}], comments: [], activities: [] };
  for (const tab of ['journals', 'media', 'posts', 'comments', 'activities']) assert.equal(initialMemberRecordTab(records, tab), tab);
});
