import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaceSearchPresentation, formatPlaceSearchDistance, placeSearchOriginOptions, placeSearchRequestedCount } from '../src/placeSearchPresentation.ts';

const place = (id, name, kind = 'CAFE', details = {}) => ({ id, name, kind, area: '부산 해운대', address: '부산 해운대구', lat: 35.16, lng: 129.16, image: '', description: '', note: '', duration: '', ...details });
function fixture() {
  return [
    place('plain', '가온 카페'),
    place('sea', '바다 카페', 'CAFE', { description: '바다가 보이는 전망 카페', lat: 35.17 }),
    place('night', '노을 카페', 'CAFE', { tags: ['야경', '바다'], lng: 129.18 }),
    place('anchor', '해운대 해변', 'LANDMARK', { lat: 35.16, lng: 129.16 }),
    place('private', '개인 카페', 'CAFE', { personal: true, description: '바다 전망' }),
    place('foreign', '제주 카페', 'CAFE', { area: '제주 안덕' }),
  ];
}
const present = (options = {}, places = fixture()) => buildPlaceSearchPresentation({ input: { prompt: '부산 해운대 카페' }, places,
  resultIds: ['night', 'plain', 'sea'], ...options });

test('recommendation order comes only from distinct current public eligible IDs without changing the catalogue', () => {
  const places = fixture(), before = structuredClone(places);
  const result = present({ resultIds: ['private', 'night', 'night', 'foreign', 'missing', 'sea', 'anchor'] }, places);
  assert.deepEqual(result.rows.map(row => [row.place.id, row.recommendationRank]), [['night', 1], ['sea', 2]]);
  assert.deepEqual(places, before);
  assert.equal(result.sort, 'RECOMMENDED');
  assert.equal(result.origin, null);
  assert.ok(result.rows.every(row => row.distanceKm === null));
});

test('only public description evidence contributes, never a private note, invented score or unrelated substring', () => {
  const places = [place('literal', '바다뷰 카페', 'CAFE', { description: '바다가 보이는 카페' }),
    place('note', '기록 카페', 'CAFE', { note: '바다' }),
    place('substring', '마음 카페', 'CAFE', { description: '회복을 위한 공간' })];
  const result = present({ input: { prompt: '부산 해운대에서 회와 바다 카페' }, resultIds: ['literal', 'note', 'substring'] }, places);
  assert.deepEqual(result.rows[0].matchedConditions, ['카페', '바다']);
  assert.deepEqual(result.rows[1].matchedConditions, ['카페']);
  assert.deepEqual(result.rows[2].matchedConditions, ['카페']);
  assert.equal(result.rows.some(row => Object.hasOwn(row, 'rating') || Object.hasOwn(row, 'popularity')), false);
  const negative = present({ input: { prompt: '부산 바다 카페' }, resultIds: ['negative'] }, [
    place('negative', '골목 카페', 'CAFE', { tags: ['바다'], description: '바다 전망은 없어요.' }),
  ]);
  assert.deepEqual(negative.rows[0].matchedConditions, ['카페']);
});

test('excluded conditions do not reappear as recommendation evidence', () => {
  const result = present({ input: { prompt: '부산 바다 말고 야경 카페' }, resultIds: ['night', 'sea'] });
  assert.deepEqual(result.rows.map(row => row.matchedConditions), [['카페', '야경'], ['카페']]);
});

test('match sorting compares evidence count and keeps recommendation order on ties', () => {
  const result = present({ input: { prompt: '부산 바다와 야경 카페' }, sort: 'MATCH' });
  assert.deepEqual(result.rows.map(row => row.place.id), ['night', 'sea', 'plain']);
  assert.deepEqual(result.rows.map(row => row.recommendationRank), [1, 3, 2]);
  const tied = present({ sort: 'MATCH' });
  assert.deepEqual(tied.rows.map(row => row.place.id), ['night', 'plain', 'sea']);
});

test('distance sorting uses the explicitly chosen landmark even when searching only cafe results', () => {
  const result = present({ sort: 'DISTANCE', originId: 'anchor' });
  assert.equal(result.origin.id, 'anchor');
  assert.equal(result.sort, 'DISTANCE');
  assert.equal(result.originIssue, '');
  assert.deepEqual(result.rows.map(row => row.place.id), ['plain', 'sea', 'night']);
  assert.equal(result.rows[0].distanceKm, 0);
  assert.ok(result.rows[1].distanceKm > 1.1 && result.rows[1].distanceKm < 1.12);
  assert.ok(result.rows[2].distanceKm > result.rows[1].distanceKm);
});

test('missing, withdrawn, private, unverified and invalid origins never silently become a city center or GPS', () => {
  const places = [...fixture(), place('unverified', '미확인 장소', 'LANDMARK', { locationVerified: false }),
    place('zero', '빈 좌표', 'LANDMARK', { lat: 0, lng: 0 }), place('invalid', '오류 좌표', 'LANDMARK', { lng: 181 })];
  for (const originId of [undefined, 'missing', 'private', 'unverified', 'zero', 'invalid']) {
    const result = present({ sort: 'DISTANCE', originId }, places);
    assert.equal(result.requestedSort, 'DISTANCE');
    assert.equal(result.sort, 'RECOMMENDED');
    assert.equal(result.origin, null);
    assert.ok(result.originIssue);
    assert.ok(result.rows.every(row => row.distanceKm === null));
  }
});

test('unmapped results remain visible at the end of distance order without a fabricated distance', () => {
  const places = [...fixture(), place('unmapped', '주소만 있는 카페', 'CAFE', { locationVerified: false })];
  const result = present({ sort: 'DISTANCE', originId: 'anchor', resultIds: ['unmapped', 'sea', 'plain'] }, places);
  assert.deepEqual(result.rows.map(row => row.place.id), ['plain', 'sea', 'unmapped']);
  assert.equal(result.rows.at(-1).distanceKm, null);
});

test('origin options are current public mapped positions with landmarks first and never mutate their input', () => {
  const places = fixture(), before = [...places];
  const options = placeSearchOriginOptions([...places, places[0], place('nan', '오류', 'LANDMARK', { lat: NaN })]);
  assert.equal(options[0].id, 'anchor');
  assert.equal(options.some(row => row.personal || row.id === 'nan'), false);
  assert.equal(new Set(options.map(row => row.id)).size, options.length);
  assert.deepEqual(places, before);
});

test('new input or catalogue changes are rechecked instead of displaying stale IDs or old source evidence', () => {
  const places = fixture();
  const changed = places.map(row => row.id === 'night' ? { ...row, personal: true } : row.id === 'sea' ? { ...row, description: '동네 카페' } : row);
  const result = present({ input: { prompt: '부산에서 바다가 보이는 카페' } }, changed);
  assert.deepEqual(result.rows.map(row => row.place.id), ['plain', 'sea']);
  assert.deepEqual(result.rows.find(row => row.place.id === 'sea').matchedConditions, ['카페']);
  assert.deepEqual(present({ input: { prompt: '제주 카페' } }, changed).rows, []);
  const alphabetical = present({ sort: 'NAME' });
  assert.deepEqual(alphabetical.rows.map(row => row.place.id), ['plain', 'night', 'sea']);
});

test('distance labels explicitly mean straight line and retain unknown distances without walking-time estimates', () => {
  assert.equal(formatPlaceSearchDistance(null), '거리 미확인');
  assert.equal(formatPlaceSearchDistance(NaN), '거리 미확인');
  assert.equal(formatPlaceSearchDistance(-1), '거리 미확인');
  assert.equal(formatPlaceSearchDistance(0), '직선 0m');
  assert.equal(formatPlaceSearchDistance(0.15), '직선 150m');
  assert.equal(formatPlaceSearchDistance(1.234), '직선 1.2km');
});


test('an explicit venue count bounds public recommendations without letting private or duplicate ids spend slots', () => {
  const result = present({ input:{prompt:'부산 카페 2곳 추천'},resultIds:['private','plain','plain','missing','sea','night'] });
  assert.equal(result.requestedCount,2);
  assert.deepEqual(result.rows.map(row=>row.place.id),['plain','sea']);
  assert.equal(present({input:{prompt:'부산 카페 6곳 추천'}}).rows.length,3);
});

test('people, prices, month durations and ambiguous venue counts never silently cap recommendations', () => {
  assert.equal(placeSearchRequestedCount('부산 카페 6곳을 추천해줘'),6);
  assert.equal(placeSearchRequestedCount('카페 3곳 제외하고 2곳 추천'),2);
  for (const prompt of ['4명이 갈 카페','3만원 카페','3개월 동안 갈 곳','카페 2곳과 식당 3곳','카페 0곳','100곳 추천']) assert.equal(placeSearchRequestedCount(prompt),undefined,prompt);
});
