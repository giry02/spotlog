import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { canOpenHomeMemberTarget, homeCommunityFilters, selectHomeCommunity } from '../src/together/homeCommunityModel.ts';

const at = new Date('2026-11-02T03:00:00+09:00');
const group = (id, extra = {}) => ({ id, name: id, kind: 'HOBBY', region: '부산', introduction: '공개 소개', cover: '/approved-cover.jpg', ownerId: 'host', memberIds: ['host'], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true,
  discovery: { topics: ['CAFE'], district: '수영구', welcome: '커피 이야기를 함께 나눠요.', joinGuide: '가입 승인 후 참석 별도 선택', style: 'NEIGHBORHOOD', recruitment: 'OPEN' }, ...extra });
const activity = (id, groupId, extra = {}) => ({ id, groupId, title: '공개 정모 ' + id, date: '2026-11-03', endDate: '2026-11-03', meetingPoint: '비공개 만남 지점', description: '공개 선정된 정모 소개', status: 'PLANNED', leadId: 'host', editorIds: [], participants: {}, arrivedIds: [], revision: 1, ...extra });
function fixture() {
  const state = createEmptyState('viewer', '나');
  state.members.push({ id: 'host', name: '운영진' }, { id: 'friend', name: '친구' });
  const open = group('coffee', { promotionActivityIds: ['public'] });
  const approved = activity('public', open.id);
  open.promotionActivitySnapshots = [{ id: approved.id, groupId: approved.groupId, title: approved.title, date: approved.date, endDate: approved.endDate, description: approved.description, status: approved.status }];
  state.groups.push(open, group('private-family', { name: '비공개 가족모임', visibility: 'PRIVATE', promotionPublished: false, memberIds: ['viewer', 'friend'] }));
  state.activities.push(approved, activity('internal', 'coffee', { title: '공개하지 않은 장소와 정모 제목' }));
  return state;
}

test('guest home projects approved public cards only, with no internal text, memberships or invented attendance', () => {
  const state = fixture(); state.activities[0].title = '수정 중인 비공개 제목';
  state.messages.push({ id: 'secret', roomId: 'group:private-family', authorId: 'friend', body: '개인 대화 원문', createdAt: '2026-11-01T12:00:00Z' });
  const before = structuredClone(state), result = selectHomeCommunity(state, '', '', '', at);
  assert.deepEqual(result.groups.map(item => item.id), ['coffee']);
  assert.equal(result.meetups[0].activity.title, '공개 정모 public');
  assert.equal(result.continuation, null);
  const text = JSON.stringify(result);
  for (const privateValue of ['비공개 가족모임', '개인 대화 원문', '비공개 만남 지점', '수정 중인 비공개 제목', '공개하지 않은 장소와 정모 제목']) assert.ok(!text.includes(privateValue));
  for (const key of ['memberIds', 'ownerId', 'participants', 'arrivedIds', 'meetingPoint']) assert.equal(result.groups[0][key], undefined);
  assert.deepEqual(state, before);
});

test('manual region and district filters remain exact; an unknown or ambiguous district never widens the result', () => {
  const state = fixture();
  assert.equal(selectHomeCommunity(state, '', '전체 지역', '', at).groupCount, 1);
  assert.deepEqual(homeCommunityFilters(state, '부산 · 수영구').region, '부산');
  assert.equal(homeCommunityFilters(state, '수영구').district, '수영구');
  assert.equal(selectHomeCommunity(state, '', '부산 수영구', '', at).groupCount, 1);
  assert.equal(selectHomeCommunity(state, '', '서울', '', at).groupCount, 0);
  state.groups.push(group('another', { region: '서울' }));
  assert.equal(homeCommunityFilters(state, '수영구').region, '수영구');
  assert.equal(selectHomeCommunity(state, '', '수영구', '', at).groupCount, 0);
});

test('both public sections use the same group-level query, and carry the region/query into discovery', () => {
  const state = fixture();
  const match = selectHomeCommunity(state, '', '부산', '  커피  ', at);
  assert.equal(match.groupCount, 1); assert.equal(match.meetupCount, 1);
  assert.equal(match.filters.region, '부산'); assert.equal(match.filters.query, '커피');
  const noMatch = selectHomeCommunity(state, '', '부산', '비공개 만남 지점', at);
  assert.equal(noMatch.groupCount, 0); assert.equal(noMatch.meetupCount, 0);
});

test('member continuation includes an ongoing multi-day activity without turning membership into RSVP', () => {
  const state = fixture();
  state.activities.push(activity('ongoing', 'private-family', { date: '2026-11-01', endDate: '2026-11-04' }));
  const before = structuredClone(state);
  const first = selectHomeCommunity(state, 'viewer', '서울', '다른 공개 검색', at);
  assert.equal(first.continuation.activity.id, 'ongoing');
  assert.equal(first.continuation.activity.participation, undefined);
  assert.deepEqual(state, before);
  state.activities.at(-1).participants.viewer = 'JOINED';
  assert.equal(selectHomeCommunity(state, 'viewer', '', '', at).continuation.activity.participation, 'JOINED');
  state.activities.at(-1).participants.viewer = 'DECLINED';
  assert.equal(selectHomeCommunity(state, 'viewer', '', '', at).continuation, null);
});

test('unread continuation is room-scoped and never returns source text or advances cursors', () => {
  const state = fixture();
  state.readCursors['group:private-family'] = '2026-11-01T01:00:00Z';
  const message = (id, extra = {}) => ({ id, roomId: 'group:private-family', authorId: 'friend', body: '목록에 노출하면 안 되는 개인 본문', createdAt: '2026-11-01T02:00:00Z', ...extra });
  state.messages.push(message('valid'), message('mine', { authorId: 'viewer' }), message('deleted', { deleted: true }), message('other', { roomId: 'group:coffee' }), message('future', { createdAt: '2026-11-04T00:00:00Z' }), message('old', { createdAt: '2026-11-01T00:00:00Z' }));
  const before = structuredClone(state), result = selectHomeCommunity(state, 'viewer', '', '', at);
  assert.equal(result.continuation.chat.unreadCount, 1);
  assert.equal(result.continuation.chat.route, 'groupchat-private-family');
  assert.equal(result.continuation.chat.summaryRoute, 'groupsummary-private-family');
  assert.ok(!JSON.stringify(result).includes('목록에 노출하면 안 되는 개인 본문'));
  assert.deepEqual(state, before);
  state.readCursors['group:private-family'] = 'damaged';
  assert.equal(selectHomeCommunity(state, 'viewer', '', '', at).continuation, null);
});

test('latest membership, blocking, archiving and activity reassignment revoke private home targets', () => {
  for (const revoke of [state => { state.groups[1].memberIds = ['friend']; }, state => { state.groups[1].blockedMemberIds = ['viewer']; }, state => { state.groups[1].archived = true; }]) {
    const state = fixture(); state.activities.push(activity('mine', 'private-family'));
    assert.equal(canOpenHomeMemberTarget(state, 'viewer', 'private-family', 'mine'), true);
    revoke(state);
    assert.equal(canOpenHomeMemberTarget(state, 'viewer', 'private-family', 'mine'), false);
    assert.equal(selectHomeCommunity(state, 'viewer', '', '', at).continuation, null);
  }
  const state = fixture(); state.activities.push(activity('mine', 'private-family'));
  state.activities.at(-1).groupId = 'coffee';
  assert.equal(canOpenHomeMemberTarget(state, 'viewer', 'private-family', 'mine'), false);
  assert.equal(canOpenHomeMemberTarget(state, 'another-account', 'private-family'), false);
});

test('public limits and chronological time ordering do not fabricate popularity or select unpublished activities', () => {
  const state = fixture();
  for (let index = 0; index < 5; index++) {
    const id = 'g' + index, aid = 'a' + index;
    state.groups.push(group(id, { promotionActivityIds: [aid] }));
    state.activities.push(activity(aid, id, { date: '2026-11-02', endDate: '2026-11-02', startTime: `${String(10 - index).padStart(2, '0')}:30` }));
  }
  const result = selectHomeCommunity(state, '', '', '', at);
  assert.equal(result.groups.length, 3); assert.equal(result.meetups.length, 2);
  assert.deepEqual(result.meetups.map(item => item.activity.id), ['a4', 'a3']);
  assert.equal(result.groupCount, 6); assert.equal(result.meetupCount, 6);
  state.groups[2].discovery.recruitment = 'PAUSED';
  assert.ok(!selectHomeCommunity(state, '', '', '', at).groups.some(item => item.id === state.groups[2].id));
});
