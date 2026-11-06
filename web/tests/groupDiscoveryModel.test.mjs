import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';

const at = new Date('2026-11-05T12:00:00+09:00');
const group = (id, extra = {}) => ({ id, name: id, kind: 'HOBBY', region: '부산', introduction: '공개 모임 소개', cover: '', visibility: 'PUBLIC', promotionPublished: true,
  archived: false, ownerId: 'host-secret-id', memberIds: ['host-secret-id'], managerIds: [], promotionActivityIds: [],
  discovery: { topics: ['CAFE'], district: '수영구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '한 줄 소개', joinGuide: '운영진 승인 후 가입해요.' }, ...extra });
const activity = (id, groupId, date, extra = {}) => ({ id, groupId, title: id, date, endDate: date, description: '공개 활동 소개', status: 'PLANNED',
  meetingPoint: 'private precise meeting point', participants: { 'private-member-id': 'JOINED' }, arrivedIds: ['private-member-id'], leadId: 'host-secret-id', editorIds: [], revision: 1, ...extra });
const select = (state, filters = {}, viewerId = '') => selectGroupDiscovery(state, filters, viewerId, at);

test('discovery sections admit only currently public published persistent groups and do not advertise blocked groups', () => {
  const state = createEmptyState('me', '나');
  state.groups.push(group('open'), group('private', { visibility: 'PRIVATE' }), group('unpublished', { promotionPublished: false }), group('archived', { archived: true }), group('appointment', { spaceType: 'ACTIVITY' }), group('blocked', { blockedMemberIds: ['me'] }));
  assert.deepEqual(select(state, {}, 'me').groups.map(item => item.id), ['open']);
  assert.deepEqual(select(state).groups.map(item => item.id), ['open', 'blocked']);
});

test('public cards expose comparison facts without member identifiers, internal messages, RSVP or private route data', () => {
  const state = createEmptyState('me', '나'); state.groups.push(group('public', { promotionActivityIds: ['next'], sourceKind: 'EXAMPLE' }));
  state.activities.push(activity('next', 'public', '2026-11-07'));
  state.messages.push({ id: 'secret-message', roomId: 'group:public', authorId: 'host-secret-id', body: 'never collect this private chat', createdAt: at.toISOString() });
  const before = structuredClone(state), result = select(state);
  assert.equal(result.groups[0].memberCount, 1); assert.equal(result.groups[0].example, true);
  for (const forbidden of ['memberIds', 'ownerId', 'managerIds', 'blockedMemberIds', 'messages', 'participants', 'meetingPoint', 'journey', 'leadId']) assert.equal(forbidden in result.groups[0], false);
  const encoded = JSON.stringify(result);
  for (const secret of ['host-secret-id', 'private-member-id', 'private precise meeting point', 'never collect this private chat']) assert.equal(encoded.includes(secret), false, secret);
  assert.deepEqual(state, before);
});

test('recommendations use selected conditions and public upcoming dates rather than chat activity or synthetic popularity', () => {
  const state = createEmptyState('me', '나');
  state.groups.push(group('later', { promotionActivityIds: ['later-event'] }), group('earlier', { promotionActivityIds: ['earlier-event'] }), group('no-event'));
  state.activities.push(activity('later-event', 'later', '2026-11-09'), activity('earlier-event', 'earlier', '2026-11-06'));
  for (let i = 0; i < 20; i++) state.messages.push({ id: `secret${i}`, roomId: 'group:later', authorId: 'host-secret-id', body: 'secret', createdAt: at.toISOString() });
  const result = select(state);
  assert.equal(result.sections[0].id, 'recommended'); assert.equal(result.sections[0].title, '추천 베스트 모임');
  assert.deepEqual(result.sections[0].groups.map(item => item.id), result.recommended.map(item => item.id));
  assert.deepEqual(result.recommended.map(item => item.id), ['earlier', 'later', 'no-event']);
  assert.deepEqual(result.upcoming.map(item => item.id), ['earlier', 'later']);
  assert.equal(result.sections.some(item => item.id === 'upcoming'), false);
  assert.equal('score' in result.groups[0], false); assert.equal('chatCount' in result.groups[0], false);
  assert.deepEqual(select(state, { sort: 'NAME' }).recommended.map(item => item.id), ['earlier', 'later', 'no-event']);
});

test('best and following activity previews do not repeat the same groups while full activity discovery remains intact', () => {
  const state = createEmptyState('me', '나');
  for (let index = 0; index < 7; index++) {
    const id = `group-${index}`, eventId = `event-${index}`;
    state.groups.push(group(id, { promotionActivityIds: [eventId] }));
    state.activities.push(activity(eventId, id, `2026-11-${String(6 + index).padStart(2, '0')}`));
  }
  const before = structuredClone(state), result = select(state);
  const best = result.sections.find(item => item.id === 'recommended').groups.slice(0, 3).map(item => item.id);
  const following = result.sections.find(item => item.id === 'upcoming').groups.slice(0, 3).map(item => item.id);
  assert.deepEqual(best, ['group-0', 'group-1', 'group-2']);
  assert.deepEqual(following, ['group-3', 'group-4', 'group-5']);
  assert.equal(following.some(id => best.includes(id)), false);
  assert.deepEqual(result.upcoming.map(item => item.id), state.groups.map(item => item.id));
  assert.deepEqual(select(state, { section: 'RECOMMENDED' }).recommended.map(item => item.id), state.groups.map(item => item.id));
  assert.equal(result.events.length, 7); assert.deepEqual(state, before);
});

test('new groups require a known real creation timestamp within the last thirty days and reject unknown or future timestamps', () => {
  const state = createEmptyState('me', '나');
  state.groups.push(group('unknown'), group('old', { createdAt: '2026-09-01T12:00:00+09:00' }), group('newer', { createdAt: '2026-11-04T12:00:00+09:00' }),
    group('older', { createdAt: '2026-10-15T12:00:00+09:00' }), group('future', { createdAt: '2027-01-01T00:00:00Z' }), group('invalid', { createdAt: 'yesterday' }));
  const result = select(state);
  assert.deepEqual(result.recent.map(item => item.id), ['newer', 'older']);
  assert.equal(result.groups.find(item => item.id === 'unknown').createdAt, undefined);
  assert.equal(result.groups.find(item => item.id === 'future').createdAt, undefined);
});

test('topic section lists use OR among selected topics but intersect region district query and individual topic', () => {
  const state = createEmptyState('me', '나');
  state.groups.push(group('cafe'), group('trip', { discovery: { ...group('x').discovery, topics: ['TRAVEL'] } }), group('other-city', { region: '서울' }),
    group('sports', { discovery: { ...group('x').discovery, topics: ['SPORTS'] } }), group('other-district', { discovery: { ...group('x').discovery, district: '해운대구' } }));
  const filters = { region: '부산', district: '수영구', categoryTopics: ['CAFE', 'TRAVEL'] };
  assert.deepEqual(select(state, filters).groups.map(item => item.id), ['cafe', 'trip']);
  assert.deepEqual(select(state, { ...filters, query: 'trip' }).groups.map(item => item.id), ['trip']);
  assert.deepEqual(select(state, { ...filters, topic: 'CAFE' }).groups.map(item => item.id), ['cafe']);
  assert.deepEqual(select(state, { ...filters, region: '자료 없는 지역' }).groups, []);
});

test('join policy and the actor own membership/application state are distinct from recruitment and RSVP', () => {
  const state = createEmptyState('me', '나');
  state.groups.push(group('legacy'), group('direct', { discovery: { ...group('x').discovery, joinMode: 'DIRECT' } }), group('pending'),
    group('member', { memberIds: ['host-secret-id', 'me'] }), group('paused', { discovery: { ...group('x').discovery, recruitment: 'PAUSED' } }));
  state.applications.push({ id: 'application', groupId: 'pending', userId: 'me', status: 'PENDING' }, { id: 'other-user', groupId: 'direct', userId: 'someone', status: 'PENDING' });
  const result = select(state, {}, 'me');
  assert.equal(result.groups.find(item => item.id === 'legacy').joinMode, 'APPROVAL'); assert.equal(result.groups.find(item => item.id === 'direct').joinMode, 'DIRECT');
  assert.equal(result.groups.find(item => item.id === 'pending').pending, true); assert.equal(result.groups.find(item => item.id === 'direct').pending, false);
  assert.equal(result.groups.find(item => item.id === 'member').joined, true); assert.equal(result.groups.find(item => item.id === 'paused').recruitment, 'PAUSED');
  assert.equal(result.recommended.some(item => item.id === 'paused'), false); assert.equal(state.activities.length, 0);
});

test('approved public activity snapshots are authoritative and live cancellation or withdrawal immediately removes a section/event', () => {
  const state = createEmptyState('me', '나');
  const approved = { id: 'next', groupId: 'public', title: '공개 승인 제목', date: '2026-11-06', endDate: '2026-11-06', description: '공개 승인 설명', status: 'PLANNED' };
  state.groups.push(group('public', { promotionActivityIds: ['next'], promotionActivitySnapshots: [approved] }));
  state.activities.push(activity('next', 'public', '2026-11-08', { title: '내부 수정 제목' }));
  assert.equal(select(state).events[0].activity.title, '공개 승인 제목');
  state.activities[0].status = 'CANCELLED'; assert.deepEqual(select(state).events, []); assert.deepEqual(select(state).upcoming, []);
  state.activities[0].status = 'PLANNED'; state.groups[0].promotionPublished = false; assert.deepEqual(select(state).groups, []);
});

test('new category browsing keeps selected dates and ongoing multi-day events, without fabricating unknown region choices', () => {
  const state = createEmptyState('me', '나'); state.groups.push(group('travel', { promotionActivityIds: ['ongoing', 'future'] }));
  state.activities.push(activity('ongoing', 'travel', '2026-11-04', { endDate: '2026-11-06' }), activity('future', 'travel', '2026-11-10'));
  const result = select(state, { dateFilter: 'TODAY' });
  assert.deepEqual(result.events.map(item => item.activity.id), ['ongoing']); assert.equal(result.groups[0].nextActivity.id, 'ongoing');
  const unknown = select(state, { region: '자료 없는 지역', district: '직접 선택한 동네' });
  assert.equal(unknown.regions.includes('자료 없는 지역'), true); assert.equal(unknown.districts.includes('직접 선택한 동네'), true); assert.deepEqual(unknown.events, []);
});
