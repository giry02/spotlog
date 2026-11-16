import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';
import { buildGroupDiscoverySections, groupDiscoveryMoreFilters, resolveGroupDiscoveryList } from '../src/together/groupDiscoverySections.ts';
import { discoveryCalendarDays, groupDiscoveryScheduleByDate, matchesDiscoveryCalendarDate, validDiscoveryCalendarDate } from '../src/together/groupDiscoveryCalendar.ts';

const at = new Date('2026-11-10T12:00:00+09:00');
const group = (id, changes = {}, profile = {}) => ({ id, name: `${id} 산책`, kind: 'HOBBY', region: '부산', cover: '', introduction: '동네 산책 모임',
  visibility: 'PUBLIC', promotionPublished: true, archived: false, ownerId: 'private-owner', memberIds: ['private-owner'], managerIds: [], promotionActivityIds: [],
  discovery: { topics: ['WALK'], subtopics: ['WALK_NEIGHBORHOOD'], district: '수영구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', joinMode: 'DIRECT', welcome: '처음도 환영해요', joinGuide: '소개 확인', ...profile }, ...changes });
const activity = (id, groupId, date, changes = {}) => ({ id, groupId, title: `${id} 공개 산책`, date, endDate: date, description: '공개 산책 안내', status: 'PLANNED',
  meetingPoint: 'private meeting address', leadId: 'private-owner', editorIds: [], participants: { 'private-person': 'JOINED' }, arrivedIds: [], revision: 1, ...changes });
function fixture() {
  const state = createEmptyState('me', '나');
  state.groups.push(group('main', { promotionActivityIds: ['today', 'span', 'later'] }), group('without-date'));
  state.activities.push(activity('today', 'main', '2026-11-10'), activity('span', 'main', '2026-11-11', { endDate: '2026-11-13' }), activity('later', 'main', '2026-11-21'));
  return state;
}
const select = (state, filters = {}) => selectGroupDiscovery(state, filters, 'me', at);
const eventIds = result => result.events.map(row => row.activity.id);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('seven selectable dates use KST across UTC midnight, year boundaries and leap days', () => {
  const days = discoveryCalendarDays(new Date('2026-12-31T15:01:00Z'));
  assert.equal(days.length, 7); assert.equal(days[0].date, '2027-01-01'); assert.equal(days[0].weekday, '오늘'); assert.equal(days[6].date, '2027-01-07');
  assert.deepEqual(discoveryCalendarDays(new Date('2028-02-27T12:00:00+09:00')).map(day => day.date).slice(0, 4), ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  assert.deepEqual(discoveryCalendarDays(new Date('invalid')), []);
});

test('date validation rejects calendar rollovers, malformed dates and non-string values', () => {
  for (const value of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-11-00', '2026-1-10', '2026-11-10T00:00:00Z', ' tomorrow ', '', undefined, null, 20261110]) assert.equal(validDiscoveryCalendarDate(value), false, String(value));
  assert.equal(validDiscoveryCalendarDate('2028-02-29'), true);
});

test('selected dates intersect inclusive public activity ranges and presets, with invalid end dates limited to the start', () => {
  const span = activity('span', 'g', '2026-11-09', { endDate: '2026-11-12' });
  assert.equal(matchesDiscoveryCalendarDate(span, 'ALL', '2026-11-12', at), true);
  assert.equal(matchesDiscoveryCalendarDate(span, 'ALL', '2026-11-13', at), false);
  assert.equal(matchesDiscoveryCalendarDate(span, 'TODAY', '2026-11-11', at), false);
  assert.equal(matchesDiscoveryCalendarDate(span, 'WEEK', '2026-11-11', at), true);
  for (const endDate of ['2026-02-30', 'not-a-date', '2026-11-08']) assert.equal(matchesDiscoveryCalendarDate({ ...span, endDate }, 'ALL', '2026-11-10', at), false);
  assert.equal(matchesDiscoveryCalendarDate({ ...span, date: '2026-02-30' }, 'ALL', undefined, at), false);
});

test('one exact date filters groups, next-activity previews, full events and their result count together', () => {
  const state = fixture(), filters = { selectedDate: '2026-11-13', section: 'MEETUPS', view: 'MEETUPS' };
  const projection = select(state, filters), result = resolveGroupDiscoveryList(projection, filters);
  assert.deepEqual(projection.groups.map(row => row.id), ['main']);
  assert.equal(projection.groups[0].nextActivity.id, 'span'); assert.deepEqual(eventIds(projection), ['span']);
  assert.equal(result.events.length, 1); assert.deepEqual(eventIds(result), eventIds(projection));
  assert.deepEqual(eventIds(select(state, { selectedDate: '2026-11-14' })), []);
});

test('exact date selection preserves the region, district, topic, category, style and search intersection', () => {
  const state = fixture();
  const variations = [group('other-city', { region: '서울' }), group('other-district', {}, { district: '해운대구' }), group('other-topic', {}, { topics: ['CAFE'] }), group('other-child', {}, { subtopics: ['WALK_PARK'] }), group('other-style', {}, { style: 'DESTINATION' })];
  for (const candidate of variations) { candidate.promotionActivityIds = [`event-${candidate.id}`]; state.groups.push(candidate); state.activities.push(activity(`event-${candidate.id}`, candidate.id, '2026-11-12')); }
  const filters = { region: '부산', district: '수영구', topic: 'WALK', subtopic: 'WALK_NEIGHBORHOOD', categoryTopics: ['WALK', 'TRAVEL'], style: 'NEIGHBORHOOD', query: '산책', selectedDate: '2026-11-12' };
  const before = structuredClone({ state, filters }); freeze(state); freeze(filters);
  const result = select(state, filters);
  assert.deepEqual(result.groups.map(row => row.id), ['main']); assert.deepEqual(eventIds(result), ['span']);
  assert.deepEqual({ state, filters }, before);
});

test('selected dates search only approved public titles and dates, never internal edits or other dates', () => {
  const state = fixture();
  state.groups[0].promotionActivitySnapshots = [{ id: 'span', groupId: 'main', title: '공개 저녁 걷기', description: '', date: '2026-11-12', endDate: '2026-11-12', status: 'PLANNED' }];
  state.activities.find(row => row.id === 'span').title = '비공개 내부 변경';
  state.activities.find(row => row.id === 'span').date = '2026-11-20';
  assert.deepEqual(eventIds(select(state, { selectedDate: '2026-11-12', query: '저녁 걷기' })), ['span']);
  for (const filters of [{ selectedDate: '2026-11-20', query: '저녁 걷기' }, { selectedDate: '2026-11-12', query: '비공개 내부' }, { selectedDate: '2026-11-12', query: 'private meeting' }]) assert.deepEqual(select(state, filters).groups, []);
});

test('invalid selected dates fail closed rather than silently becoming a date-independent search', () => {
  const state = fixture();
  for (const selectedDate of ['2026-02-30', '2026-11-1', 'tomorrow', '2026-11-10T00:00:00Z']) {
    const result = select(state, { selectedDate });
    assert.deepEqual(result.groups, []); assert.deepEqual(result.events, []); assert.equal(result.regions.includes('부산'), true);
  }
});

test('private, blocked, cancelled, completed, unapproved and withdrawn events remain excluded after date selection', () => {
  const state = fixture();
  for (const [id, changes, status] of [['private', { visibility: 'PRIVATE' }, 'PLANNED'], ['blocked', { blockedMemberIds: ['me'] }, 'PLANNED'], ['cancelled', {}, 'CANCELLED'], ['completed', {}, 'COMPLETED'], ['withdrawn', { promotionPublished: false }, 'PLANNED']]) {
    state.groups.push(group(id, { promotionActivityIds: [`event-${id}`], ...changes })); state.activities.push(activity(`event-${id}`, id, '2026-11-12', { status }));
  }
  state.activities.push(activity('unapproved', 'main', '2026-11-12'));
  const result = select(state, { selectedDate: '2026-11-12' });
  assert.deepEqual(eventIds(result), ['span']);
  assert.equal(JSON.stringify(result).includes('private meeting address'), false);
  assert.equal(JSON.stringify(result).includes('private-person'), false);
});

test('More keeps the selected date and all existing discovery conditions without mutating them', () => {
  const state = fixture(), filters = { region: '부산', district: '수영구', categoryTopics: ['WALK'], query: '산책', selectedDate: '2026-11-12', dateFilter: 'ALL' };
  const projection = select(state, filters), upcoming = buildGroupDiscoverySections(projection, filters).find(row => row.id === 'upcoming');
  const before = structuredClone(filters); freeze(filters);
  const next = groupDiscoveryMoreFilters(filters, upcoming), result = resolveGroupDiscoveryList(select(state, next), next);
  assert.equal(next.selectedDate, filters.selectedDate); assert.equal(next.section, 'MEETUPS'); assert.equal(next.view, 'MEETUPS');
  assert.equal(next.region, filters.region); assert.equal(next.district, filters.district); assert.equal(next.query, filters.query); assert.deepEqual(next.categoryTopics, filters.categoryTopics);
  assert.deepEqual(eventIds(result), ['span']); assert.deepEqual(filters, before);
});

test('explicitly clearing an exact date restores only the existing non-date conditions', () => {
  const state = fixture(), filters = { region: '부산', topic: 'WALK', query: '산책', selectedDate: '2026-11-12', dateFilter: 'ALL' };
  const cleared = { ...filters, selectedDate: undefined, dateFilter: 'ALL' };
  assert.deepEqual(eventIds(select(state, filters)), ['span']);
  assert.deepEqual(eventIds(select(state, cleared)), ['today', 'span', 'later']);
  assert.equal(cleared.region, '부산'); assert.equal(cleared.topic, 'WALK'); assert.equal(cleared.query, '산책');
});

test('date-grouped schedules retain every projected event exactly once and use the selected overlap day', () => {
  const state = fixture(); state.activities.push(activity('ongoing', 'main', '2026-11-09', { endDate: '2026-11-11' })); state.groups[0].promotionActivityIds.push('ongoing');
  const projection = select(state), before = structuredClone(projection.events); freeze(projection.events);
  const days = groupDiscoveryScheduleByDate(projection.events, 'ALL', undefined, at);
  assert.deepEqual(days.map(day => day.date), ['2026-11-10', '2026-11-11', '2026-11-21']);
  assert.equal(days.reduce((total, day) => total + day.items.length, 0), projection.events.length);
  assert.equal(new Set(days.flatMap(day => day.items.map(row => row.activity.id))).size, projection.events.length);
  assert.deepEqual(projection.events, before);
  const selected = select(state, { selectedDate: '2026-11-13' });
  assert.deepEqual(groupDiscoveryScheduleByDate(selected.events, 'ALL', '2026-11-13', at).map(day => day.date), ['2026-11-13']);
});
