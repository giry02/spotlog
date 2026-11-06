import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectDiscoveryHome } from '../src/community/discoveryHomeModel.ts';

const at = new Date('2026-11-03T15:00:00+09:00');
const place = (id, kind, area, extra = {}) => ({ id, kind, area, name: id, address: '', lat: 0, lng: 0, image: '', description: '', note: '', duration: '', ...extra });
const group = (id, extra = {}) => ({ id, name: id, kind: 'HOBBY', region: '부산', introduction: '공개 모임 소개', cover: '', visibility: 'PUBLIC', promotionPublished: true, archived: false, ownerId: 'owner', memberIds: ['owner'], managerIds: [], promotionActivityIds: [], discovery: { topics: ['CAFE'], district: '수영구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '커피와 이야기', joinGuide: '승인 후 참여' }, ...extra });
const activity = (id, groupId, date = '2026-11-04', extra = {}) => ({ id, groupId, title: id, date, endDate: date, status: 'PLANNED', description: '공개 약속 소개', meetingPoint: 'private meeting point', participants: { member: 'JOINED' }, arrivedIds: ['member'], leadId: 'owner', editorIds: [], revision: 1, ...extra });
const projection = (state, places = [], filters = {}, viewer = '') => selectDiscoveryHome(state, places, [], { region: '', query: '', ...filters }, viewer, at);

test('home admits only currently public, published, open recruitment and approved activities', () => {
  const state = createEmptyState('member', '사용자');
  state.groups.push(group('open', { cover: '/approved-public-cover.jpg', promotionActivityIds: ['approved'] }), group('private', { cover: '/private-family-photo.jpg', visibility: 'PRIVATE', promotionActivityIds: ['private-event'] }), group('unpublished', { promotionPublished: false }), group('archived', { archived: true }), group('paused', { discovery: { topics: ['CAFE'], district: '', style: 'NEIGHBORHOOD', recruitment: 'PAUSED', welcome: '', joinGuide: '' } }));
  state.activities.push(activity('approved', 'open'), activity('not-approved', 'open'), activity('private-event', 'private'));
  const result = projection(state);
  assert.deepEqual(result.groups.map(item => item.id), ['open']);
  assert.equal(result.groups[0].cover, '/approved-public-cover.jpg');
  assert.equal(JSON.stringify(result).includes('/private-family-photo.jpg'), false);
  assert.deepEqual(result.meetups.map(item => item.activity.id), ['approved']);
});

test('guest home projections exclude internal member identifiers, messages, meeting points and participation', () => {
  const state = createEmptyState('member', '사용자');
  state.groups.push(group('public', { memberIds: ['owner', 'member'], promotionActivityIds: ['event'] }));
  state.activities.push(activity('event', 'public'));
  state.messages.push({ id: 'secret-message', roomId: 'group:public', authorId: 'member', body: 'private chat body', createdAt: at.toISOString() });
  const before = structuredClone(state), result = projection(state);
  assert.equal(result.groups[0].joined, false);
  for (const key of ['memberIds', 'ownerId', 'managerIds', 'blockedMemberIds']) assert.equal(key in result.groups[0], false, key);
  for (const key of ['participants', 'meetingPoint', 'arrivedIds', 'journey', 'leadId', 'editorIds']) assert.equal(key in result.meetups[0].activity, false, key);
  assert.equal(JSON.stringify(result).includes('private chat body'), false);
  assert.equal(projection(state, [], {}, 'member').groups[0].joined, true);
  assert.deepEqual(state, before);
});

test('approved snapshot content remains authoritative while cancellation and unpublication remove current results', () => {
  const state = createEmptyState('', '');
  state.groups.push(group('public', { promotionActivityIds: ['event'], promotionActivitySnapshots: [{ id: 'event', groupId: 'public', title: '승인된 공개 제목', date: '2026-11-04', endDate: '2026-11-04', description: '공개 설명', status: 'PLANNED' }] }));
  state.activities.push(activity('event', 'public', '2026-11-04', { title: 'private edit not approved' }));
  assert.equal(projection(state).meetups[0].activity.title, '승인된 공개 제목');
  state.activities[0].status = 'CANCELLED';
  assert.deepEqual(projection(state).meetups, []);
  state.activities[0].status = 'PLANNED'; state.groups[0].promotionPublished = false;
  assert.deepEqual(projection(state).meetups, []);
});

test('public upcoming order includes an ongoing multiday event and sorts same-day times without mutating originals', () => {
  const state = createEmptyState('', '');
  state.groups.push(group('g', { promotionActivityIds: ['late', 'ongoing', 'early', 'undated', 'past', 'done'] }));
  state.activities.push(activity('late', 'g', '2026-11-04', { startTime: '19:00' }), activity('ongoing', 'g', '2026-11-02', { endDate: '2026-11-03' }), activity('early', 'g', '2026-11-04', { startTime: '10:00' }), activity('undated', 'g', ''), activity('past', 'g', '2026-11-02'), activity('done', 'g', '2026-11-04', { status: 'COMPLETED' }));
  const before = structuredClone(state);
  assert.deepEqual(projection(state).meetups.map(item => item.activity.id), ['ongoing', 'early', 'late']);
  assert.deepEqual(state, before);
});

test('region, purpose and query intersect for each content type and hand off the same selected metadata', () => {
  const state = createEmptyState('', '');
  state.groups.push(group('부산 커피 친구', { promotionActivityIds: ['busan-coffee'] }), group('제주 커피 친구', { region: '제주', promotionActivityIds: ['jeju-coffee'] }), group('부산 산책 친구', { discovery: { topics: ['WALK'], district: '', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '', joinGuide: '' } }));
  state.activities.push(activity('busan-coffee', '부산 커피 친구', '2026-11-04', { title: '커피 한 잔' }), activity('jeju-coffee', '제주 커피 친구', '2026-11-04', { title: '커피 한 잔' }));
  const places = [place('카페 커피', 'CAFE', '부산 수영'), place('음식 커피', 'FOOD', '부산 수영'), place('제주 커피', 'CAFE', '제주시 한림읍')];
  const result = projection(state, places, { region: '부산', purpose: 'CAFE', query: ' 커피 ' });
  assert.deepEqual(result.groups.map(item => item.id), ['부산 커피 친구']);
  assert.deepEqual(result.meetups.map(item => item.activity.id), ['busan-coffee']);
  assert.deepEqual(result.places.map(item => item.id), ['카페 커피']);
  assert.deepEqual(result.groupFilters, { region: '부산', query: '커피', topic: 'CAFE', dateFilter: 'ALL', sort: 'SOONEST' });
  assert.deepEqual(result.placeFilters, { region: '부산', query: '커피', kind: 'CAFE' });
});

test('event-title searches work independently of group-name matching and retained unknown region never widens results', () => {
  const state = createEmptyState('', '');
  state.groups.push(group('느긋한 사람들', { promotionActivityIds: ['event'] }));
  state.activities.push(activity('event', '느긋한 사람들', '2026-11-04', { title: '토요일 새벽 전망대' }));
  const found = projection(state, [], { query: '전망대' });
  assert.deepEqual(found.groups, []);
  assert.equal(found.meetups[0].activity.id, 'event');
  const empty = projection(state, [], { region: '없는 지역' });
  assert.deepEqual(empty.groups, []); assert.deepEqual(empty.meetups, []); assert.deepEqual(empty.places, []);
  assert.ok(empty.regions.includes('없는 지역'));
  assert.deepEqual(projection(createEmptyState('', '')).regions, []);
});
