import test from 'node:test';
import assert from 'node:assert/strict';
import { aiTravelVisitKey, selectAiTravelVisits } from '../src/aiTravelSelection.ts';

const place = (id, visitId, name = id) => ({ id, visitId, name, kind: 'LANDMARK', area: '부산', address: '부산', lat: 35.16, lng: 129.16, image: `/${id}.jpg`, description: '안내', note: '메모', duration: '1시간', tags: ['바다'] });
const a = place('a', 'a-day1');
const b = place('b', 'b-day1');
const repeat = place('a', 'a-day2');
const draft = {
  id: 'preview', title: '부산 1박 2일 여행', region: '부산', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: a.image,
  summary: '원하는 내용을 바탕으로 3곳을 고른 로컬 추천 초안입니다.', story: '요청 원문', tags: ['로컬 추천 초안'], saves: 0, author: '여행자', isMine: true, recommendationKind: 'AI',
  days: [
    { day: 1, date: 'DAY 1', title: 'a · b', story: 'DAY 설명', places: [a, b], blocks: [
      { id: 'a-place', type: 'PLACE', placeId: 'a', visitId: a.visitId },
      { id: 'a-photo', type: 'IMAGE', image: a.image, visitId: a.visitId },
      { id: 'a-text', type: 'TEXT', body: '이 방문에 연결된 설명', visitId: a.visitId },
      { id: 'b-place', type: 'PLACE', placeId: 'b', visitId: b.visitId },
      { id: 'independent-text', type: 'TEXT', body: '독립된 글', placeId: 'a' },
      { id: 'independent-image', type: 'IMAGE', image: '/unrelated.jpg', placeId: 'a' },
    ] },
    { day: 2, date: 'DAY 2', title: 'a', story: '다음 날', places: [repeat], blocks: [{ id: 'repeat', type: 'PLACE', placeId: 'a', visitId: repeat.visitId }] },
  ],
};

test('approval filters exact visits and linked blocks, preserves repeated places and standalone content', () => {
  const before = structuredClone(draft);
  const result = selectAiTravelVisits(draft, new Set(['a-day1']));
  assert.deepEqual(result.days[0].places.map((item) => item.id), ['b']);
  assert.deepEqual(result.days[0].blocks.map((item) => item.id), ['b-place', 'independent-text', 'independent-image']);
  assert.deepEqual(result.days[1], draft.days[1]);
  assert.equal(result.days[0].title, 'b');
  assert.equal(result.cover, '/b.jpg');
  assert.ok(result.summary.includes('2곳'));
  assert.equal(result.title, draft.title);
  assert.equal(result.visibility, 'PRIVATE');
  result.days[0].places[0].tags.push('변경');
  assert.deepEqual(draft, before);
});

test('empty selections retain every DAY and can be fully restored from the untouched preview', () => {
  const result = selectAiTravelVisits(draft, new Set(['a-day1', 'b-day1', 'a-day2']));
  assert.equal(result.days.length, 2);
  assert.ok(result.days.every((day) => day.places.length === 0));
  assert.deepEqual(result.days.map((day) => day.date), ['DAY 1', 'DAY 2']);
  assert.equal(result.days[0].title, '선택한 장소 없음');
  assert.equal(result.cover, '');
  assert.ok(result.summary.includes('0곳'));
  assert.deepEqual(selectAiTravelVisits(draft, new Set()), draft);
});

test('unrecognized exclusions do not rewrite titles, cover, summary, or authored headings', () => {
  assert.deepEqual(selectAiTravelVisits(draft, new Set(['not-a-visit'])), draft);
  const custom = structuredClone(draft);
  custom.days[0].title = '내가 정한 첫날 제목';
  assert.equal(selectAiTravelVisits(custom, new Set(['a-day1'])).days[0].title, custom.days[0].title);
});

test('missing visit IDs get stable DAY/index-specific choices, with conservative legacy block filtering', () => {
  const legacy = structuredClone(draft);
  legacy.days[0].places = [place('a', undefined), place('a', undefined), b];
  legacy.days[0].blocks = [{ id: 'legacy-a', type: 'PLACE', placeId: 'a' }, { id: 'legacy-b', type: 'PLACE', placeId: 'b' }];
  const firstKey = aiTravelVisitKey(1, legacy.days[0].places[0], 0);
  const secondKey = aiTravelVisitKey(1, legacy.days[0].places[1], 1);
  assert.notEqual(firstKey, secondKey);
  assert.notEqual(firstKey, aiTravelVisitKey(2, legacy.days[0].places[0], 0));
  assert.equal(selectAiTravelVisits(legacy, new Set([firstKey])).days[0].blocks.length, 2);
  assert.deepEqual(selectAiTravelVisits(legacy, new Set([firstKey, secondKey])).days[0].blocks.map((block) => block.id), ['legacy-b']);
});
