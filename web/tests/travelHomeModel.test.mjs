import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicHomeJournal, matchesHomeTravelDuration, selectTravelHomeContent, homeJournalSourceLabel } from '../src/community/travelHomeModel.ts';

const place = (id, kind = 'CAFE', area = '부산 수영구', extra = {}) => ({
  id, kind, area, name: id, address: `${area} 공개 주소`, image: '', description: '공개 장소 소개', note: '공개 카탈로그 팁',
  duration: '1시간', lat: 35.15, lng: 129.12, ...extra,
});
const cafe = place('cafe', 'CAFE', '부산 수영구', { name: '바다 Cafe', tags: ['창가'] });
const food = place('food', 'FOOD', '부산 해운대구', { name: '가족 식당' });
const forest = place('forest', 'LANDMARK', '서울 성동구', { name: '서울숲' });
const approved = [cafe, food, forest];
const journal = (id, extra = {}) => ({
  id, title: '부산의 바다 기록', region: '부산', author: '여행 기록자', summary: '천천히 머문 공개 여행', story: '공개 본문',
  visibility: 'PUBLIC', status: 'PUBLISHED', purpose: 'JOURNAL', isMine: false, cover: '/approved-journal.webp',
  duration: '당일', dateRange: '2026.11.01', saves: 1, tags: ['가족'],
  days: [{ dayId: `${id}-day`, day: 1, date: '2026-11-01', title: '첫날', story: '공개 하루 기록', places: [cafe], blocks: [] }],
  ...extra,
});
const course = (id, extra = {}) => ({
  id, title: '부산 바다 일정', region: '부산', eyebrow: '바다 산책', summary: '가족과 천천히 보는 바다',
  duration: '당일', dayCount: 1, cover: '/approved-course.webp', places: [cafe], ...extra,
});
const select = (courses = [], journals = [], filters = {}, places = approved, references = []) => selectTravelHomeContent(courses, journals, places, references, { region: '', query: '', ...filters });
const ids = items => items.map(item => item.id);
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; };

test('public home admits published journals but never device-owned, private, unfinished, deleted, AI or personal-plan records', () => {
  const visible = journal('visible');
  const rejected = [
    journal('private', { visibility: 'PRIVATE' }), journal('draft', { status: 'PLANNING' }),
    journal('traveling', { status: 'TRAVELING' }), journal('mine', { isMine: true }),
    journal('personal', { purpose: 'PLAN' }), journal('trashed', { trash: { deletedAt: '2026-11-09' } }),
    journal('ai', { recommendationKind: 'AI' }),
  ];
  assert.equal(isPublicHomeJournal(visible), true);
  for (const item of rejected) assert.equal(isPublicHomeJournal(item), false, item.id);
  assert.deepEqual(ids(select([], [visible, ...rejected]).journals), ['visible']);
});

test('home cards are public presentation DTOs and never copy planning, account, chat, booking or visit-note objects', () => {
  const secret = 'PRIVATE_HOME_SENTINEL_174';
  const source = journal('public', {
    story: secret, preferences: { request: secret }, privateMemo: secret, messages: [{ body: secret }],
    booking: { confirmation: secret }, days: [{ dayId: 'day', day: 1, date: '2026-11-01', title: '첫날', story: secret,
      places: [{ ...cafe, note: secret, bookingReference: secret, reservation: { confirmation: secret } }], blocks: [{ id: 'text', type: 'TEXT', body: secret }] }],
  });
  const result = select([course('course', { publicJourney: source, preferences: { request: secret }, privateMemo: secret })], [source]);
  assert.equal(result.courses.length, 1); assert.equal(result.journals.length, 1);
  assert.equal(JSON.stringify(result.courses).includes(secret), false);
  assert.equal(JSON.stringify(result.journals).includes(secret), false);
  for (const card of [...result.courses, ...result.journals]) {
    for (const key of ['days', 'places', 'blocks', 'publicJourney', 'preferences', 'messages', 'booking', 'privateMemo']) assert.equal(Object.hasOwn(card, key), false, key);
  }
  const hiddenQuery = select([course('course', { publicJourney: source })], [source], { query: secret });
  assert.deepEqual(hiddenQuery.courses, []); assert.deepEqual(hiddenQuery.journals, []);
});

test('a template cannot bypass public journal eligibility by attaching a private or personal source', () => {
  const templates = [course('public', { publicJourney: journal('source') }),
    course('private-source', { publicJourney: journal('hidden', { visibility: 'PRIVATE' }) }),
    course('plan-source', { publicJourney: journal('plan', { purpose: 'PLAN' }) }),
    course('owned-source', { publicJourney: journal('owned', { isMine: true }) }),
    course('deleted-source', { publicJourney: journal('deleted', { trash: { deletedAt: '2026-11-09' } }) })];
  assert.deepEqual(ids(select(templates).courses), ['public']);
});

test('course search and counts use current approved place identities rather than removed or stale template places', () => {
  const stale = { ...cafe, name: '철회한 옛 이름', area: '서울', image: '/withdrawn-photo.webp' };
  const removed = place('removed', 'CAFE', '서울', { name: '삭제한 업체' });
  const templates = [course('mixed', { places: [stale, stale, removed] }), course('empty', { places: [removed] })];
  const all = select(templates);
  assert.deepEqual(ids(all.courses), ['mixed']); assert.equal(all.courses[0].placeCount, 1);
  assert.deepEqual(ids(select(templates, [], { query: '바다 Cafe', region: '부산' }).courses), ['mixed']);
  for (const query of ['철회한 옛 이름', '삭제한 업체']) assert.deepEqual(select(templates, [], { query }).courses, []);
  assert.deepEqual(select(templates, [], { region: '서울' }).courses, []);
});

test('a stale journal snapshot cannot reintroduce withdrawn places or old place names into public discovery', () => {
  const staleCafe = { ...cafe, name: '옛 카페 이름', area: '서울', image: '/withdrawn-journal-place.webp' };
  const removed = place('removed', 'FOOD', '부산', { name: '철회한 식당' });
  const sources = [journal('current', { region: '국내', days: [{ day: 1, places: [staleCafe], blocks: [] }] }),
    journal('withdrawn', { days: [{ day: 1, places: [cafe, removed], blocks: [] }] })];
  const before = structuredClone(sources);
  assert.deepEqual(ids(select([], sources).journals), ['current']);
  assert.deepEqual(ids(select([], sources, { region: '부산', query: '바다 Cafe' }).journals), ['current']);
  for (const query of ['옛 카페 이름', '철회한 식당']) assert.deepEqual(select([], sources, { query }).journals, []);
  assert.deepEqual(sources, before);
});

test('destination, district, purpose and query remain intersecting filters instead of widening to other places', () => {
  const c = [course('coffee'), course('food', { places: [food] }), course('seoul', { region: '서울', places: [forest] })];
  const j = [journal('coffee'), journal('food', { days: [{ day: 1, places: [food], blocks: [] }] }), journal('seoul', { region: '서울', days: [{ day: 1, places: [forest], blocks: [] }] })];
  const f = { region: '부산', district: '수영구', purpose: 'CAFE', query: '바다' };
  const result = select(c, j, f);
  assert.deepEqual(ids(result.courses), ['coffee']); assert.deepEqual(ids(result.journals), ['coffee']); assert.deepEqual(ids(result.places), ['cafe']);
  for (const patch of [{ district: '없는동네' }, { region: '제주' }, { query: '없는 검색어' }, { purpose: 'FOOD' }]) {
    const empty = select(c, j, { ...f, ...patch });
    assert.deepEqual(empty.courses, []); assert.deepEqual(empty.journals, []); assert.deepEqual(empty.places, []);
  }
});

test('registered and normalized place regions allow a multi-region public trip without prefix or unknown-region matches', () => {
  const island = place('island', 'LANDMARK', '서귀포시 안덕면', { name: '제주 해안' });
  const registered = place('registered', 'CAFE', '표시 지역', { regionId: 'busan' });
  const refs = [{ category: 'REGION', referenceId: 'busan', name: '부산' }];
  const templates = [course('island', { region: '국내', places: [island] }), course('registered', { region: '국내', places: [registered] })];
  assert.deepEqual(ids(select(templates, [], { region: '제주' }, [island, registered], refs).courses), ['island']);
  assert.deepEqual(ids(select(templates, [], { region: '부산' }, [island, registered], refs).courses), ['registered']);
  for (const region of ['부', '없는 지역']) assert.deepEqual(select(templates, [], { region }, [island, registered], refs).courses, []);
});

test('travel duration uses actual day counts and keeps ordinary place discovery independent of trip duration', () => {
  const courses = [1, 2, 3, 4, 7].map(days => course(`day-${days}`, { dayCount: days, duration: days === 1 ? '당일' : `${days - 1}박 ${days}일` }));
  const journals = [1, 2, 3, 4, 7].map(days => journal(`journal-${days}`, { days: Array.from({ length: days }, (_, index) => ({ day: index + 1, places: [cafe], blocks: [] })) }));
  for (const [duration, expected] of [['DAY', [1]], ['TWO', [2]], ['THREE', [3]], ['LONG', [4, 7]], ['ALL', [1, 2, 3, 4, 7]]]) {
    const result = select(courses, journals, { duration });
    assert.deepEqual(ids(result.courses), expected.map(days => `day-${days}`));
    assert.deepEqual(ids(result.journals), expected.map(days => `journal-${days}`));
    assert.equal(result.places.length, approved.length);
  }
  for (const days of [0, -1, 1.5, NaN, Infinity]) for (const duration of ['DAY', 'TWO', 'THREE', 'LONG']) assert.equal(matchesHomeTravelDuration(days, duration), false);
});

test('public search normalizes width and case, treats punctuation literally, and does not search private metadata', () => {
  const c = [course('course', { title: 'Cafe [바다]', preferences: { prompt: '예약비밀코드' }, places: [{ ...cafe, note: '예약비밀코드' }] })];
  const j = [journal('journal', { title: 'Cafe [바다]', privateMemo: '예약비밀코드', days: [{ day: 1, places: [{ ...cafe, note: '예약비밀코드' }], blocks: [] }] })];
  for (const query of ['  ＣＡＦＥ  ', '[바다]']) {
    const result = select(c, j, { query }); assert.equal(result.courses.length, 1); assert.equal(result.journals.length, 1);
  }
  for (const query of ['.*', '예약비밀코드']) {
    const result = select(c, j, { query }); assert.deepEqual(result.courses, []); assert.deepEqual(result.journals, []);
  }
});

test('home projection preserves editorial order and the first admitted identity without mutating input', () => {
  const courses = [course('b'), course('a'), course('b', { title: '중복 후보' })];
  const journals = [journal('z'), journal('y'), journal('z', { title: '중복 기록' })];
  const data = freeze({ courses, journals, approved: structuredClone(approved) });
  const before = JSON.stringify(data), result = select(data.courses, data.journals, {}, data.approved);
  assert.deepEqual(ids(result.courses), ['b', 'a']); assert.deepEqual(ids(result.journals), ['z', 'y']);
  assert.equal(result.courses[0].title, '부산 바다 일정'); assert.equal(result.journals[0].title, '부산의 바다 기록');
  assert.equal(JSON.stringify(data), before);
});

test('a withdrawn cover supplied by the caller is not resurrected from an embedded source or stale place image', () => {
  const source = journal('source', { cover: '/withdrawn-source.webp' });
  const currentPlace = { ...cafe, image: '' };
  const result = select([course('course', { cover: '', publicJourney: source, places: [{ ...cafe, image: '/withdrawn-place.webp' }] })], [], {}, [currentPlace]);
  assert.equal(result.courses.length, 1); assert.equal(result.courses[0].cover, '');
  assert.equal(JSON.stringify(result).includes('/withdrawn-'), false);
});

test('published examples, editorial recommendations and server-authored journals keep distinguishable source labels', () => {
  const result = select([course('course')], [journal('sample'), journal('editorial', { publicSourceKind: 'EDITORIAL' }), journal('server', { publicSourceKind: 'SERVER' })]);
  assert.equal(result.courses[0].sourceKind, 'EDITORIAL');
  assert.deepEqual(result.journals.map(card => card.sourceKind), ['PUBLIC_SAMPLE', 'EDITORIAL', 'SERVER']);
  assert.equal(homeJournalSourceLabel('SERVER'), '여행자 기록');
  assert.equal(homeJournalSourceLabel('EDITORIAL'), '운영 추천 여행기');
  assert.equal(homeJournalSourceLabel('PUBLIC_SAMPLE'), '공개 여행기 예시');
  assert.deepEqual(select([], [], {}, []), { courses: [], journals: [], places: [] });
});
