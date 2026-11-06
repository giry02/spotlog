import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHomePlaces, homePlacePreview, publicPlaceRegion } from '../src/homeDiscovery.ts';

const place = (id, kind, area, extra = {}) => ({
  id, kind, area, name: id, address: '', lat: 0, lng: 0, image: '',
  description: '', note: '', duration: '', ...extra,
});
const references = [
  { category: 'REGION', referenceId: 'busan', name: '부산' },
  { category: 'REGION', referenceId: 'jeju', name: '제주' },
  { category: 'TAG', referenceId: 'not-a-region', name: '부산' },
];

test('registered region identity takes priority, while missing references use the shared regional aliases', () => {
  assert.equal(publicPlaceRegion(place('registered', 'FOOD', '다른 표시 지역', { regionId: 'busan' }), references), '부산');
  for (const area of ['제주시 한림읍', '서귀포시 안덕면', '제주특별자치도 제주시']) {
    assert.equal(publicPlaceRegion(place('jeju', 'STAY', area), references), '제주');
  }
  assert.equal(publicPlaceRegion(place('busan', 'CAFE', '부산광역시 수영구', { regionId: 'unknown' }), references), '부산');
  assert.equal(publicPlaceRegion(place('tag', 'CAFE', '서울 성동', { regionId: 'not-a-region' }), references), '서울');
  assert.equal(publicPlaceRegion(place('address', 'FOOD', '', { address: '부산광역시 해운대구' }), []), '부산');
  assert.equal(publicPlaceRegion(place('unknown', 'LEISURE', ''), []), '지역 미정');
});

test('region, kind and query intersect without widening scope or changing source order', () => {
  const places = [
    place('first', 'CAFE', '부산 수영', { name: '바다 커피', tags: ['노을'], regionId: 'busan' }),
    place('food', 'FOOD', '부산 수영', { name: '바다 커피 식당', regionId: 'busan' }),
    place('other-region', 'CAFE', '제주시 한림읍', { name: '바다 커피' }),
    place('second', 'CAFE', '부산 해운대', { description: '바다 커피를 마시는 공간' }),
    place('similar-region', 'CAFE', '부산진구', { name: '바다 커피' }),
  ];
  const before = structuredClone(places);
  assert.deepEqual(filterHomePlaces(places, { region: '부산', kind: 'CAFE', query: ' 바다 커피 ' }, references).map(item => item.id), ['first', 'second']);
  assert.deepEqual(filterHomePlaces(places, { region: '부산', kind: 'CAFE', query: '노을' }, references).map(item => item.id), ['first']);
  assert.deepEqual(filterHomePlaces(places, { region: '제주', kind: 'STAY', query: '바다' }, references), []);
  assert.deepEqual(filterHomePlaces(places, { region: '부', kind: 'ALL' }, references), [], 'region matching is exact');
  assert.deepEqual(places, before);
});

test('search accepts normalized case and width, remains literal, and covers the guide descriptive fields', () => {
  const places = [place('cafe', 'CAFE', '부산', { name: 'Café [바다]', hook: '창가 자리', description: '풍경 보기', note: '조용한 시간', tags: ['차 한 잔'] })];
  for (const query of ['  ＣＡＦＥ\u0301  ', '[바다]', '창가 자리', '풍경 보기', '조용한 시간', '차 한 잔']) {
    assert.equal(filterHomePlaces(places, { query }, []).length, 1, query);
  }
  assert.deepEqual(filterHomePlaces(places, { query: '.*' }, []), []);
  assert.deepEqual(filterHomePlaces(places, { query: ' \t ' }, []), places);
});

test('preview starts with distinct food, cafe, landmark and stay cards then fills in editorial order', () => {
  const places = [
    place('shop', 'SHOP', '부산'), place('stay', 'STAY', '부산'),
    place('food', 'FOOD', '부산'), place('food-2', 'FOOD', '부산'),
    place('cafe', 'CAFE', '부산'), place('landmark', 'LANDMARK', '부산'),
    place('leisure', 'LEISURE', '부산'),
  ];
  const before = structuredClone(places);
  assert.deepEqual(homePlacePreview(places).map(item => item.id), ['food', 'cafe', 'landmark', 'stay']);
  assert.deepEqual(homePlacePreview(places, 7).map(item => item.id), ['food', 'cafe', 'landmark', 'stay', 'shop', 'food-2', 'leisure']);
  assert.deepEqual(homePlacePreview(places, 2).map(item => item.id), ['food', 'cafe']);
  assert.deepEqual(places, before);
});

test('preview keeps the first record for each id and handles sparse and empty catalogues', () => {
  const first = place('food', 'FOOD', '부산', { name: '원래 카드' });
  const duplicate = { ...first, name: '중복 카드' };
  const shop = place('shop', 'SHOP', '부산'), cafe = place('cafe', 'CAFE', '부산');
  assert.deepEqual(homePlacePreview([shop, first, cafe, duplicate], 9), [first, cafe, shop]);
  const leisure = place('leisure', 'LEISURE', '부산');
  assert.deepEqual(homePlacePreview([shop, leisure, { ...shop, name: '다른 중복 카드' }], 9), [shop, leisure]);
  assert.deepEqual(homePlacePreview([shop], 4), [shop]);
  assert.deepEqual(homePlacePreview([], 4), []);
  assert.deepEqual(homePlacePreview([first], 0), []);
  assert.deepEqual(homePlacePreview([first], -1), []);
  assert.deepEqual(filterHomePlaces([], { region: '부산', kind: 'FOOD', query: '커피' }, references), []);
});
