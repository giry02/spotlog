import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalTravelDraft, interpretTravelPrompt, travelRegionOptions } from '../src/aiTravelDraft.ts';

const landmark = { id: 'busan-sea', kind: 'LANDMARK', name: '해변', area: '부산 해운대', address: '부산', lat: 35.16, lng: 129.16, image: '/test.jpg', description: '바다와 해안', note: '', duration: '1시간', time: '12:00', move: '차량 8분', tags: ['바다'] };
const places = [landmark, { ...landmark, id: 'busan-cafe', kind: 'CAFE', name: '등록 카페', lng: 129.17 }, { ...landmark, id: 'busan-food', kind: 'FOOD', name: '등록 식당', lng: 129.18 }, { ...landmark, id: 'busan-culture', name: '등록 박물관', description: '문화 전시', tags: ['역사'], lng: 129.19 }, { ...landmark, id: 'seoul-forest', area: '서울 성동', lat: 37.54, lng: 127.03 }, { ...landmark, id: 'anmok', area: '강원 강릉', lat: 37.77, lng: 128.94 }, { ...landmark, id: 'jeju-sea', area: '제주 한림', lat: 33.39, lng: 126.24 }];

test('period expressions distinguish day trips, nights/days, nights only and maximum', () => {
  for (const [prompt, expected] of [['부산 당일치기', 1], ['부산 하루', 1], ['부산 1박2일', 2], ['부산 2박 3일', 3], ['부산 2박', 3], ['부산 일주일', 7]]) {
    const parsed = interpretTravelPrompt({ prompt }, places); assert.equal(parsed.conditions.dayCount, expected); assert.deepEqual(parsed.errors, []);
  }
  assert.ok(interpretTravelPrompt({ prompt: '부산 8일' }, places).errors.length);
  assert.ok(interpretTravelPrompt({ prompt: '부산 3박 2일' }, places).errors.length);
});
test('exclusions do not reverse positive interests and regional cities stay specific', () => {
  const parsed = interpretTravelPrompt({ prompt: '강릉에서 1박2일 바다 보고 카페는 빼줘, 덜 걷고 싶어' }, places);
  assert.equal(parsed.conditions.region, '강원 강릉'); assert.deepEqual(parsed.conditions.excludedKinds, ['CAFE']); assert.ok(parsed.conditions.interests.includes('바다')); assert.equal(parsed.conditions.pace, 'slow');
  assert.ok(travelRegionOptions(places).includes('강원 강릉'));
  const result = buildLocalTravelDraft({ prompt: '부산 2일 바다 카페 제외' }, places);
  assert.ok(!result.sourcePlaceIds.includes('busan-cafe'));
});
test('empty/unknown/ambiguous regions do not silently fall back to Jeju', () => {
  for (const prompt of ['', '도쿄 2박3일', '바다 보고 싶어', '서울 부산 2일']) {
    const result = buildLocalTravelDraft({ prompt }, places); assert.equal(result.journey, null); assert.ok(result.errors.length);
  }
  assert.equal(buildLocalTravelDraft({ prompt: '바다 보고 싶어', overrides: { region: '부산' } }, places).journey.region, '부산');
});
test('results use existing source IDs, independent visits, no invented schedule, no source mutation', () => {
  const before = structuredClone(places);
  const result = buildLocalTravelDraft({ prompt: '부산 1박2일 바다 천천히' }, places);
  assert.equal(result.journey.visibility, 'PRIVATE'); assert.equal(result.journey.status, 'PLANNING'); assert.equal(result.journey.isMine, true);
  assert.equal(result.journey.recommendationKind, 'AI');
  assert.equal(result.journey.days.length, 2); assert.equal(result.journey.days[1].date, 'DAY 2');
  result.journey.days.forEach((day) => day.places.forEach((place, index) => { assert.ok(places.some((source) => source.id === place.id && source.area.startsWith('부산'))); assert.equal(place.time, undefined); assert.equal(place.move, '경로·이동시간 확인 필요'); assert.equal(day.blocks[index].visitId, place.visitId); }));
  result.journey.days[0].places[0].tags.push('changed');
  assert.deepEqual(places, before);
});
test('missing candidates keep empty days and report limits without fabricated duplicates', () => {
  const result = buildLocalTravelDraft({ prompt: '제주 6박7일' }, places);
  assert.equal(result.journey.days.length, 7); assert.equal(result.sourcePlaceIds.length, 1);
  assert.equal(result.journey.days.filter((day) => !day.places.length).length, 6);
  assert.ok(result.notices.some((notice) => notice.includes('빈 상태')));
});
test('dates are not mistaken for travel length; invalid coordinates stay unassigned', () => {
  const parsed = interpretTravelPrompt({ prompt: '부산 9월 12일 가고 싶어' }, places);
  assert.equal(parsed.conditions.dayCount, 2); assert.ok(parsed.notices.some((notice) => notice.includes('자동 적용하지')));
  const result = buildLocalTravelDraft({ prompt: '부산 당일치기' }, [{ ...landmark, lat: NaN }]);
  assert.equal(result.journey, null); assert.ok(result.errors.length);
});
test('far-apart places are not filled into one walking day', () => {
  const result = buildLocalTravelDraft({ prompt: '강원 당일 도보' }, [{ ...landmark, area: '강원 강릉', lat: 37.77, lng: 128.94 }, { ...landmark, id: 'far', area: '강원 정선', lat: 37.47, lng: 128.72 }]);
  assert.equal(result.sourcePlaceIds.length, 1); assert.ok(result.omittedPlaceIds.includes('far'));
});
