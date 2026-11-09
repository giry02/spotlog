import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, unpublishActivityFromGroup } from '../src/together/model.ts';
import { createDiscoveryCatalog, hydrateDiscoveryCatalog, DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples.ts';
import { createSeedState, TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed.ts';
import { discoveryProfile, isDiscoverableGroup, publicActivities, upcomingPublicActivities, filterDiscoveryGroups, koreaDay, publicActivityTimeKey } from '../src/together/discovery.ts';
import { createTogetherRepository, togetherStorageKey, isTogetherState } from '../src/together/repository.ts';

const at = new Date('2026-10-28T15:30:00Z'); // October29,00:30KST
const place = { id: 'busan-scene', name: '해운대해수욕장', kind: 'LANDMARK', area: '부산 해운대', image: '/licensed-existing.jpg', address: '', description: '', note: '', duration: '', lat: 35, lng: 129 };
const makeGroup = (id, extras = {}) => ({ id, name: id, kind: 'HOBBY', region: '부산', introduction: '', cover: '', ownerId: 'host', memberIds: ['host'], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true, ...extras });
const makeActivity = (id, groupId, date, endDate = date, extras = {}) => ({ id, groupId, title: id, date, endDate, meetingPoint: 'private exact meeting point', description: 'public introduction', status: 'PLANNED', leadId: 'host', editorIds: [], participants: { privateUser: 'JOINED' }, arrivedIds: ['privateUser'], revision: 1, ...extras });

test('discovery examples cover multiple interests and places without autojoining anyone or exposing private seed data', () => {
  const catalog = createDiscoveryCatalog([place], at);
  assert.equal(catalog.groups.length, 20); assert.equal(catalog.activities.length, 40);
  assert.ok(new Set(catalog.groups.map(group => group.region)).size >= 5);
  assert.equal(new Set(catalog.groups.flatMap(group => group.discovery.topics)).size, 16);
  for (const group of catalog.groups) {
    assert.equal(group.sourceKind, 'EXAMPLE'); assert.equal(group.visibility, 'PUBLIC');
    assert.deepEqual(group.memberIds, [group.ownerId]);
    assert.ok(group.promotionActivityIds.length > 0);
    assert.ok(group.discovery.welcome && group.discovery.joinGuide);
  }
  assert.ok(catalog.activities.every(activity => activity.description.length > 20 && Object.keys(activity.participants).length === 0));
  assert.equal(new Set(catalog.activities.map(activity => activity.description)).size, 40);
  assert.ok(catalog.groups.every(group => group.cover.includes('/media/groups/')));
  assert.ok(catalog.activities.filter(activity => activity.groupId.startsWith('discovery-busan-')).every(activity => activity.kind === 'MEETUP' && activity.startTime && [8, 12].includes(activity.capacity)));
  assert.ok(catalog.activities.every(activity => !activity.description.includes('실제 모임 촬영')));
  const real = createSeedState('real-user', '실제 계정', [place]);
  assert.ok(real.groups.every(group => !group.memberIds.includes('real-user')));
  assert.deepEqual(real.messages, []); assert.deepEqual(real.media, []);
  const review = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', [place]);
  assert.equal(isDiscoverableGroup(review.groups.find(group => group.id === 'family-busan')), false);
  assert.equal(isTogetherState(review), true);
});

test('public activity projection requires explicit same-group selection and excludes private fields and cancellation', () => {
  const state = createEmptyState('viewer', '사용자');
  const group = makeGroup('g', { promotionActivityIds: ['allowed', 'cancelled', 'wrong-group'] });
  state.groups.push(group);
  state.activities.push(makeActivity('allowed', 'g', '2026-10-29'), makeActivity('not-selected', 'g', '2026-10-29'), makeActivity('cancelled', 'g', '2026-10-29', undefined, { status: 'CANCELLED' }), makeActivity('wrong-group', 'other', '2026-10-29'));
  const projected = publicActivities(state, group);
  assert.deepEqual(projected.map(activity => activity.id), ['allowed']);
  for (const field of ['participants', 'arrivedIds', 'meetingPoint', 'journey', 'leadId', 'editorIds']) assert.equal(projected[0][field], undefined);
  group.visibility = 'PRIVATE'; assert.deepEqual(publicActivities(state, group), []);
  group.visibility = 'PUBLIC'; group.archived = true; assert.deepEqual(publicActivities(state, group), []);
  const stale = { ...group, archived: false, promotionPublished: true };
  assert.deepEqual(publicActivities(state, stale), []);
});

test('discovery filters independent topic/style/district and paused recruitment without using synthetic popularity', () => {
  const catalog = createDiscoveryCatalog([place], at); const state = { ...createEmptyState('v', '사용자'), ...catalog };
  const matches = filterDiscoveryGroups(state, { region: '부산', district: '수영구', topic: 'CAFE', style: 'NEIGHBORHOOD' }, at);
  assert.deepEqual(matches.map(group => group.id), ['discovery-gwangan-cafe', 'discovery-busan-craft']);
  assert.equal(filterDiscoveryGroups(state, {}, at).length, 19);
  assert.equal(filterDiscoveryGroups(state, { recruitment: 'ALL' }, at).length, 20);
  assert.ok(!filterDiscoveryGroups(state, { query: '서면 문화' }, at).length);
  assert.equal(filterDiscoveryGroups(state, { query: '서면 문화', recruitment: 'ALL' }, at)[0].id, 'discovery-seomyeon-culture');
  assert.deepEqual(filterDiscoveryGroups(state, {}, at).map(group => group.id), catalog.groups.filter(group => group.discovery.recruitment === 'OPEN').map(group => group.id));
  assert.equal(discoveryProfile(makeGroup('legacy')).topics.length, 0);
  assert.equal(isDiscoverableGroup(makeGroup('family', { kind: 'FAMILY', visibility: 'PRIVATE' })), false);
});

test('date filters use Korean calendar overlap, current weekend and upcoming selected public activity only', () => {
  assert.equal(koreaDay(at), '2026-10-29');
  const state = createEmptyState('v', '사용자');
  for (const [id, from, until] of [['today', '2026-10-28', '2026-10-29'], ['sat', '2026-10-31', '2026-10-31'], ['sun', '2026-11-01', '2026-11-01'], ['later', '2026-11-05', '2026-11-05'], ['unknown', '', '']]) {
    state.groups.push(makeGroup(id, { promotionActivityIds: [id] })); state.activities.push(makeActivity(id, id, from, until));
  }
  assert.deepEqual(filterDiscoveryGroups(state, { dateFilter: 'TODAY' }, at).map(group => group.id), ['today']);
  assert.deepEqual(filterDiscoveryGroups(state, { dateFilter: 'WEEKEND' }, at).map(group => group.id), ['sat', 'sun']);
  assert.deepEqual(filterDiscoveryGroups(state, { dateFilter: 'WEEK' }, at).map(group => group.id), ['today', 'sat', 'sun']);
  assert.deepEqual(filterDiscoveryGroups(state, { dateFilter: 'WEEKEND' }, new Date('2026-11-01T12:00:00+09:00')).map(group => group.id), ['sun']);
  assert.deepEqual(upcomingPublicActivities(state, state.groups.find(group => group.id === 'unknown'), at), []);
  state.groups[0].promotionActivityIds = []; assert.deepEqual(filterDiscoveryGroups(state, { dateFilter: 'TODAY' }, at), []);
});

test('one-time discovery hydration preserves all existing edits, selected visibility and earlier deleted legacy groups', () => {
  const state = createEmptyState('v', '사용자');
  const edited = makeGroup('public-busan-food', { name: '내가 수정한 모임', visibility: 'PRIVATE', promotionActivityIds: [] }); state.groups.push(edited);
  state.messages.push({ id: 'private', roomId: 'group:public-busan-food', authorId: 'v', body: '비공개 대화', createdAt: at.toISOString() });
  const before = structuredClone(state); const next = hydrateDiscoveryCatalog(state, [place], at);
  assert.deepEqual(state, before); assert.deepEqual(next.groups.find(group => group.id === edited.id), edited);
  assert.equal(next.groups.some(group => group.id === 'public-busan-guide'), false); // earlier legacy deletion is respected
  assert.deepEqual(next.messages, before.messages);
  assert.equal(next.discoveryCatalogVersion, DISCOVERY_CATALOG_VERSION);
  const deleted = next.groups.find(group => group.id.startsWith('discovery-')).id;
  next.groups = next.groups.filter(group => group.id !== deleted);
  assert.equal(hydrateDiscoveryCatalog(next, [place], at), next);
  assert.equal(next.groups.some(group => group.id === deleted), false);
});

test('repository saves catalog upgrade once only in its own key and preserves prior state when upgrade write fails', () => {
  const key = togetherStorageKey('v'); const old = createEmptyState('v', '사용자');
  old.groups.push(makeGroup('my-local', { name: '직접 만든 모임', visibility: 'PRIVATE', promotionPublished: false }));
  const values = new Map([[key, JSON.stringify(old)], ['spotlog.web.journeys.v4', 'private-original']]); let writes = 0;
  const disk = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { writes++; values.set(key, value); } };
  const repo = createTogetherRepository('v', '사용자', [place], disk);
  assert.equal(writes, 1); assert.deepEqual(repo.getSnapshot().groups.find(group => group.id === 'my-local'), old.groups[0]);
  assert.equal(values.get('spotlog.web.journeys.v4'), 'private-original');
  createTogetherRepository('v', '사용자', [place], disk); assert.equal(writes, 1);
  const raw = JSON.stringify(old); const failed = createTogetherRepository('v', '사용자', [place], { getItem: () => raw, setItem: () => { throw new Error('quota'); } });
  assert.deepEqual(failed.getSnapshot(), old); assert.ok(failed.getError());
});

test('approved public snapshots stay unchanged after private edits, with current cancellation and removal always enforced', () => {
  const state = createEmptyState('v', '사용자'); const group = makeGroup('g', { promotionActivityIds: ['activity'] }); state.groups.push(group);
  const activity = makeActivity('activity', 'g', '2026-10-29'); state.activities.push(activity);
  group.promotionActivitySnapshots = publicActivities(state, group);
  activity.title = '비공개로 바꾼 새 제목'; activity.description = '개인 연락처를 적은 새 설명'; activity.date = '2026-11-02';
  const approved = publicActivities(state, group)[0];
  assert.equal(approved.title, 'activity'); assert.equal(approved.description, 'public introduction'); assert.equal(approved.date, '2026-10-29');
  assert.equal(approved.meetingPoint, undefined); assert.equal(approved.participants, undefined);
  group.promotionActivitySnapshots = []; assert.deepEqual(publicActivities(state, group), []);
  group.promotionActivitySnapshots = [approved]; activity.status = 'CANCELLED'; assert.deepEqual(publicActivities(state, group), []);
  activity.status = 'PLANNED'; group.promotionActivityIds = []; assert.deepEqual(publicActivities(state, group), []);
  group.promotionActivityIds = ['activity']; state.activities = []; assert.deepEqual(publicActivities(state, group), []);
});

test('snapshot schema rejects internal fields and legacy origin backfill never changes edited visibility or restores deleted examples', () => {
  const state = createEmptyState('v', '사용자'); state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
  state.groups.push(makeGroup('public-busan-food', { ownerId: 'example-walker', name: '내가 바꾼 이름', introduction: '비공개 설명', visibility: 'PRIVATE', promotionPublished: false, promotionActivityIds: [] }));
  const before = structuredClone(state); const next = hydrateDiscoveryCatalog(state, [], at);
  assert.deepEqual(next.groups[0], { ...before.groups[0], sourceKind: 'EXAMPLE' });
  assert.equal(next.groups.length, 1); assert.equal(next.groups.some(group => group.id === 'public-busan-guide'), false);
  assert.deepEqual(state, before);
  assert.equal(hydrateDiscoveryCatalog(next, [], at), next);
  const foreignOwner = { ...before, groups: [{ ...before.groups[0], ownerId: 'actual-user' }] };
  assert.equal(hydrateDiscoveryCatalog(foreignOwner, [], at), foreignOwner);
  next.groups[0].promotionActivitySnapshots = [{ id: 'a', groupId: next.groups[0].id, title: '공개 제목', date: '', endDate: '', description: '공개 설명', status: 'PLANNED' }];
  assert.equal(isTogetherState(next), true);
  next.groups[0].promotionActivitySnapshots[0].meetingPoint = '공개하면 안 되는 위치';
  assert.equal(isTogetherState(next), false);
});

test('catalogue v2 replaces only exact old generated descriptions and never resurrects deleted v1 samples', () => {
  const catalogue = createDiscoveryCatalog([place], at); const state = { ...createEmptyState('v', '사용자'), ...catalogue, discoveryCatalogVersion: 1 };
  const id = 'discovery-gwangan-cafe-next'; const activity = state.activities.find(item => item.id === id);
  const expectedDescription = activity.description;
  const prior = '일정 구성과 참가 흐름을 살펴보는 예시 활동. 표지의 해운대해수욕장 사진은 해당 지역의 참고 장면이며 실제 모임 촬영 사진이 아니에요.';
  activity.description = prior;
  const modified = state.activities.find(item => item.id === 'discovery-gwangan-cafe-past'); modified.description = `${prior} 사용자가 추가한 메모`;
  const group = state.groups.find(item => item.id === activity.groupId); group.introduction = '사용자가 바꾼 모임 소개'; group.visibility = 'PRIVATE';
  group.promotionActivitySnapshots = [{ id, groupId: group.id, title: '기존 승인 제목', date: activity.date, endDate: activity.endDate, description: prior, status: activity.status }];
  state.groups = state.groups.filter(item => item.id !== 'discovery-yeongdo-photo');
  state.messages.push({ id: 'keep', roomId: 'group:private', authorId: 'v', body: '개인 대화 유지', createdAt: at.toISOString() });
  const before = structuredClone(state); const next = hydrateDiscoveryCatalog(state, [place], at);
  assert.equal(next.discoveryCatalogVersion, DISCOVERY_CATALOG_VERSION);
  assert.equal(next.activities.find(item => item.id === id).description, expectedDescription);
  assert.equal(next.activities.find(item => item.id === modified.id).description, modified.description);
  const upgraded = next.groups.find(item => item.id === group.id);
  assert.equal(upgraded.visibility, 'PRIVATE'); assert.equal(upgraded.introduction, '사용자가 바꾼 모임 소개');
  assert.equal(upgraded.promotionActivitySnapshots[0].title, '기존 승인 제목'); assert.notEqual(upgraded.promotionActivitySnapshots[0].description, prior);
  assert.equal(next.groups.some(item => item.id === 'discovery-yeongdo-photo'), false);
  assert.deepEqual(next.messages, state.messages); assert.deepEqual(state, before);
  assert.equal(hydrateDiscoveryCatalog(next, [place], at), next);
});

test('v2 leaves same text on a locally authored non-example group untouched', () => {
  const catalogue = createDiscoveryCatalog([], at); const state = { ...createEmptyState('v', '사용자'), ...catalogue, discoveryCatalogVersion: 1 };
  const group = state.groups.find(item => item.id === 'discovery-jeju-slow'); group.sourceKind = 'LOCAL';
  const activity = state.activities.find(item => item.groupId === group.id); activity.description = '일정 구성과 참가 흐름을 살펴보는 예시 활동. 실제 개최나 예약이 확정된 일정이 아니에요.';
  const next = hydrateDiscoveryCatalog(state, [], at);
  assert.deepEqual(next.activities.find(item => item.id === activity.id), activity);
});

test('catalogue v3 adds only new hobby IDs without recreating deleted tourism entries or overwriting existing private data', () => {
  const catalogue = createDiscoveryCatalog([place], at);
  const state = { ...createEmptyState('v', '사용자'), groups: catalogue.groups.filter(group => !group.id.startsWith('discovery-busan-') && group.id !== 'discovery-yeongdo-photo'), members: catalogue.members, activities: catalogue.activities.filter(activity => !activity.groupId.startsWith('discovery-busan-') && activity.groupId !== 'discovery-yeongdo-photo'), discoveryCatalogVersion: 2 };
  const edited = state.groups.find(group => group.id === 'discovery-jeju-slow'); edited.introduction = '이미 내가 검수한 소개'; edited.promotionPublished = false;
  const existing = { ...catalogue.groups.find(group => group.id === 'discovery-busan-books'), name: '사용자가 먼저 만든 책 모임', visibility: 'PRIVATE' };
  state.groups.push(existing); const before = structuredClone(state);
  const next = hydrateDiscoveryCatalog(state, [place], at);
  assert.equal(next.discoveryCatalogVersion, DISCOVERY_CATALOG_VERSION);
  assert.equal(next.groups.some(group => group.id === 'discovery-yeongdo-photo'), false);
  assert.deepEqual(next.groups.find(group => group.id === existing.id), existing);
  assert.deepEqual(next.groups.find(group => group.id === edited.id), edited);
  assert.equal(next.groups.filter(group => group.id.startsWith('discovery-busan-')).length, 8);
  assert.deepEqual(state, before);
  next.groups = next.groups.filter(group => group.id !== 'discovery-busan-running');
  assert.equal(hydrateDiscoveryCatalog(next, [place], at), next);
  assert.equal(next.groups.some(group => group.id === 'discovery-busan-running'), false);
  assert.equal(filterDiscoveryGroups(next, { topic: 'BOOK' }, at).some(group => group.id === existing.id), false);
  assert.ok(filterDiscoveryGroups(next, { topic: 'SPORTS' }, at).length > 0);
});

test('live completion stops upcoming promotion without revealing private edits and unpublishing removes both approval forms', () => {
  const state = createEmptyState('v', '사용자'); const group = makeGroup('g', { promotionActivityIds: ['a'] }); state.groups.push(group);
  const activity = makeActivity('a', 'g', '2026-10-31'); state.activities.push(activity); group.promotionActivitySnapshots = publicActivities(state, group);
  activity.title = '새 비공개 제목'; activity.description = '아직 승인하지 않은 설명'; activity.status = 'COMPLETED';
  assert.equal(upcomingPublicActivities(state, group, at).length, 0);
  const projected = publicActivities(state, group)[0]; assert.equal(projected.status, 'COMPLETED'); assert.equal(projected.title, 'a'); assert.equal(projected.description, 'public introduction');
  unpublishActivityFromGroup(state, activity.id);
  assert.deepEqual(group.promotionActivityIds, []); assert.deepEqual(group.promotionActivitySnapshots, []); assert.deepEqual(publicActivities(state, group), []);
  assert.equal(state.activities[0], activity);
});

test('soonest sorting compares same-day start times, missing time at day end and undated groups last', () => {
  const state = createEmptyState('v', '사용자');
  for (const [id, date, time] of [['late', '2026-10-29', '19:30'], ['no-time', '2026-10-29', undefined], ['early', '2026-10-29', '08:00'], ['tomorrow', '2026-10-30', '06:00'], ['undated', '', undefined]]) {
    state.groups.push(makeGroup(id, { promotionActivityIds: [id] })); state.activities.push(makeActivity(id, id, date, date, { startTime: time }));
  }
  assert.deepEqual(filterDiscoveryGroups(state, { sort: 'SOONEST' }, at).map(group => group.id), ['early', 'late', 'no-time', 'tomorrow', 'undated']);
  assert.ok(publicActivityTimeKey('', '08:00') > publicActivityTimeKey('2026-10-30', undefined));
  assert.ok(publicActivityTimeKey('2026-10-29', undefined) > publicActivityTimeKey('2026-10-29', '23:59'));
});
