import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';
import { buildGroupDiscoverySections, groupDiscoveryMoreFilters, resolveGroupDiscoveryList, selectGroupDiscoverySectionPreviews } from '../src/together/groupDiscoverySections.ts';

const at = new Date('2026-11-08T12:00:00+09:00');
const group = (id, changes = {}, profile = {}) => ({ id, name: `${id} 러닝`, kind: 'HOBBY', region: '부산', cover: '', introduction: '공개 소개',
  ownerId: 'private-owner', memberIds: ['private-owner'], managerIds: [], visibility: 'PUBLIC', archived: false, promotionPublished: true,
  discovery: { topics: ['SPORTS'], subtopics: ['SPORTS_RUNNING'], district: '수영구', style: 'NEIGHBORHOOD', recruitment: 'OPEN',
    joinMode: 'DIRECT', welcome: '처음 온 분도 환영해요', joinGuide: '함께 인사해요', ...profile }, ...changes });
function fixture() {
  const state = createEmptyState('me', '나');
  state.groups.push(group('direct'), group('approval', {}, { joinMode: 'APPROVAL' }), group('no-welcome', {}, { welcome: '함께 달려요' }),
    group('joined', { memberIds: ['private-owner', 'me'] }), group('paused', {}, { recruitment: 'PAUSED' }),
    group('other-area', {}, { district: '해운대구' }), group('destination', {}, { style: 'DESTINATION' }),
    group('golf', {}, { subtopics: ['SPORTS_GOLF'] }), group('other-city', { region: '서울' }));
  return state;
}
const project = (state, filters = {}, actor = 'me') => selectGroupDiscovery(state, filters, actor, at);
const ids = rows => rows.map(row => row.id);

test('direct-join and first-welcome sections use only explicit public facts and retain distinct membership policies', () => {
  const state = fixture(), filters = { region: '부산', district: '수영구', topic: 'SPORTS', subtopic: 'SPORTS_RUNNING', style: 'NEIGHBORHOOD' };
  const rows = buildGroupDiscoverySections(project(state, filters), filters);
  assert.deepEqual(ids(rows.find(row => row.id === 'direct').groups), ['direct', 'no-welcome']);
  assert.deepEqual(ids(rows.find(row => row.id === 'welcome').groups), ['direct', 'approval', 'joined']);
  assert.equal(rows.some(row => /베스트|활발|인기/u.test(row.title)), false);
});

test('More preserves the entire selected intersection and opens only the requested direct-join section', () => {
  const state = fixture();
  const filters = { region: '부산', district: '수영구', topic: 'SPORTS', subtopic: 'SPORTS_RUNNING', style: 'NEIGHBORHOOD',
    dateFilter: 'ALL', query: '러닝', sort: 'NEWEST', useMyRegion: false, section: 'DISCOVER' };
  const projection = project(state, filters), direct = buildGroupDiscoverySections(projection, filters).find(row => row.id === 'direct');
  const next = groupDiscoveryMoreFilters(filters, direct);
  for (const name of ['region', 'district', 'topic', 'subtopic', 'style', 'dateFilter', 'query', 'sort', 'useMyRegion']) assert.deepEqual(next[name], filters[name]);
  assert.equal(next.section, 'ALL'); assert.equal(next.collectionId, 'direct');
  assert.deepEqual(ids(resolveGroupDiscoveryList(project(state, next), next).groups), ids(direct.groups));
});

test('topic More keeps the parent/subtopic filter and applies the requested collection without widening unrelated groups', () => {
  const state = fixture(), filters = { region: '부산', topic: 'SPORTS', subtopic: 'SPORTS_RUNNING', style: 'NEIGHBORHOOD', section: 'DISCOVER' };
  const original = buildGroupDiscoverySections(project(state, filters), filters).find(row => row.id === 'sports');
  const next = groupDiscoveryMoreFilters(filters, original);
  assert.equal(next.categoryTopics, undefined); assert.equal(next.topic, 'SPORTS'); assert.equal(next.subtopic, 'SPORTS_RUNNING');
  assert.deepEqual(ids(resolveGroupDiscoveryList(project(state, next), next).groups), ids(original.groups));
  assert.equal(resolveGroupDiscoveryList(project(state, next), next).groups.some(row => row.id === 'golf'), false);
});

test('topic More intersects a pre-existing OR category filter instead of replacing it with the section topics', () => {
  const state = fixture(); state.groups[0].discovery.topics = ['FOOD', 'SPORTS'];
  state.groups.push(group('food-only', {}, { topics: ['FOOD'], subtopics: ['FOOD_KOREAN'] }));
  const filters = { region: '부산', categoryTopics: ['FOOD', 'CAFE'], section: 'DISCOVER' };
  const sports = buildGroupDiscoverySections(project(state, filters), filters).find(row => row.id === 'sports');
  const next = groupDiscoveryMoreFilters(filters, sports);
  assert.deepEqual(next.categoryTopics, ['FOOD', 'CAFE']);
  assert.deepEqual(ids(resolveGroupDiscoveryList(project(state, next), next).groups), ['direct']);
  assert.deepEqual(ids(sports.groups), ['direct']);
});

test('upcoming More opens approved event rows rather than replacing them with general recommendations', () => {
  const state = fixture();
  state.groups[0].promotionActivityIds = ['next'];
  state.activities.push({ id: 'next', groupId: 'direct', title: '공개 러닝', date: '2026-11-10', endDate: '2026-11-10', status: 'PLANNED',
    description: '공개 일정', meetingPoint: 'private precise address', leadId: 'private-owner', editorIds: [], participants: { me: 'MAYBE' }, arrivedIds: [], revision: 1 });
  const filters = { region: '부산', topic: 'SPORTS', dateFilter: 'WEEK' };
  const upcoming = buildGroupDiscoverySections(project(state, filters), filters).find(row => row.id === 'upcoming');
  const next = groupDiscoveryMoreFilters(filters, upcoming), result = resolveGroupDiscoveryList(project(state, next), next);
  assert.equal(next.section, 'MEETUPS'); assert.equal(next.view, 'MEETUPS'); assert.equal(next.dateFilter, 'WEEK');
  assert.equal(result.kind, 'MEETUPS'); assert.deepEqual(result.events.map(row => row.activity.id), ['next']);
  assert.deepEqual(result.groups, []); assert.equal(JSON.stringify(result).includes('private precise address'), false);
  state.activities[0].status = 'CANCELLED'; assert.deepEqual(resolveGroupDiscoveryList(project(state, next), next).events, []);
});

test('area More retains the exact selected city and district and missing area context never becomes nationwide recommendations', () => {
  const state = fixture(), filters = { region: '부산', district: '수영구' };
  const area = buildGroupDiscoverySections(project(state, filters), filters).find(row => row.id === 'area');
  const next = groupDiscoveryMoreFilters(filters, area);
  assert.equal(next.region, '부산'); assert.equal(next.district, '수영구');
  assert.deepEqual(ids(resolveGroupDiscoveryList(project(state, next), next).groups), ids(area.groups));
  assert.deepEqual(resolveGroupDiscoveryList(project(state), { collectionId: 'area' }).groups, []);
});

test('new and paused collections preserve their exact evidence and never fabricate a current popularity list', () => {
  const state = fixture(); state.groups[0].createdAt = '2026-11-07T00:00:00Z'; state.groups[1].createdAt = '2026-09-01T00:00:00Z';
  const recent = buildGroupDiscoverySections(project(state), {}).find(row => row.id === 'new');
  const next = groupDiscoveryMoreFilters({}, recent);
  assert.equal(next.section, 'NEW'); assert.equal(next.sort, 'NEWEST');
  assert.deepEqual(ids(resolveGroupDiscoveryList(project(state, next), next).groups), ['direct']);
  const pausedState = fixture(); pausedState.groups = pausedState.groups.filter(row => row.id === 'paused');
  const paused = buildGroupDiscoverySections(project(pausedState), {});
  assert.deepEqual(paused.map(row => row.id), ['paused']);
  assert.deepEqual(ids(resolveGroupDiscoveryList(project(pausedState), groupDiscoveryMoreFilters({}, paused[0])).groups), ['paused']);
});

test('private, blocked, archived, unpublished and standalone appointment groups never enter any browse collection', () => {
  const state = fixture();
  state.groups.push(group('private', { visibility: 'PRIVATE' }), group('blocked', { blockedMemberIds: ['me'] }),
    group('archived', { archived: true }), group('unpublished', { promotionPublished: false }), group('one-off', { spaceType: 'ACTIVITY' }));
  const rows = buildGroupDiscoverySections(project(state), {});
  for (const row of rows) for (const invalid of ['private', 'blocked', 'archived', 'unpublished', 'one-off']) assert.equal(row.groups.some(group => group.id === invalid), false, invalid);
  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes('private-owner'), false);
});

test('unknown or obsolete collection links remain empty and selection helpers never mutate state, filters or prior projections', () => {
  const state = fixture(), filters = { region: '부산', categoryTopics: ['SPORTS'], query: '러닝' };
  const projection = project(state, filters), before = JSON.stringify({ state, filters, projection });
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  freeze(state); freeze(filters); freeze(projection);
  const rows = buildGroupDiscoverySections(projection, filters);
  for (const row of rows) groupDiscoveryMoreFilters(filters, row);
  const unknown = resolveGroupDiscoveryList(projection, { ...filters, collectionId: 'not-a-real-section' });
  assert.deepEqual(unknown.groups, []);
  assert.equal(JSON.stringify({ state, filters, projection }), before);
});

test('browse starts with four recommended rows and omits repeated contextual sections without changing their full More lists', () => {
  const groups = Array.from({ length: 9 }, (_, index) => ({ id: `group-${index}` }));
  const sections = [
    { id: 'direct', title: '바로 가입', emoji: '', kind: 'GROUPS', groups: groups.slice(0, 6) },
    { id: 'welcome', title: '첫 참여 안내', emoji: '', kind: 'GROUPS', groups: groups.slice(0, 6) },
    { id: 'recommended', title: '추천', emoji: '', kind: 'GROUPS', groups },
    { id: 'area', title: '동네', emoji: '', kind: 'GROUPS', groups: groups.slice(0, 7) },
  ];
  const before = structuredClone(sections), selected = selectGroupDiscoverySectionPreviews(sections);
  assert.equal(selected.sections[0].id, 'recommended'); assert.equal(selected.sections[0].previewGroups.length, 4);
  assert.deepEqual(selected.sections.map(section => section.id), ['recommended', 'direct']);
  assert.deepEqual(ids(selected.sections[1].previewGroups), ['group-4', 'group-5']);
  assert.equal(selected.sections[1].groups.length, 6);
  assert.deepEqual(sections, before);
});

test('category previews prefer distinct groups but retain overlapping categories and expand from four to all', () => {
  const groups = Array.from({ length: 5 }, (_, index) => ({ id: `group-${index}` }));
  const sections = [
    { id: 'recommended', title: '추천', emoji: '', kind: 'GROUPS', groups },
    ...Array.from({ length: 7 }, (_, index) => ({ id: `category-${index}`, title: `관심사 ${index}`, emoji: '', kind: 'GROUPS', topics: ['SPORTS'], groups: index < 4 ? [groups[index]] : [groups[0], groups[1]] })),
  ];
  const before = structuredClone(sections), collapsed = selectGroupDiscoverySectionPreviews(sections), expanded = selectGroupDiscoverySectionPreviews(sections, true);
  assert.equal(collapsed.categoryCount, 7); assert.equal(collapsed.hiddenCategories, 3);
  assert.equal(collapsed.sections.filter(section => section.topics).length, 4);
  assert.equal(expanded.sections.filter(section => section.topics).length, 7); assert.equal(expanded.hiddenCategories, 0);
  assert.equal(expanded.sections.filter(section => section.topics).every(section => section.previewGroups.length > 0), true);
  for (const section of expanded.sections) assert.deepEqual(section.groups, sections.find(source => source.id === section.id).groups);
  assert.deepEqual(sections, before);
});

test('tiny browse sources do not repeat direct or first-participation sections yet keep category access', () => {
  const state = fixture(); state.groups = state.groups.slice(0, 2);
  const sections = buildGroupDiscoverySections(project(state), {}), selected = selectGroupDiscoverySectionPreviews(sections);
  assert.equal(selected.sections[0].id, 'recommended');
  assert.equal(selected.sections.some(section => section.id === 'direct' || section.id === 'welcome'), false);
  assert.equal(selected.sections.some(section => section.id === 'sports' && section.previewGroups.length > 0), true);
  assert.equal(sections.some(section => section.id === 'direct'), true);
});
