import test from 'node:test';
import assert from 'node:assert/strict';
import { placeAssistantPromptLimit, placeAssistantRegions, preparePlaceAssistant } from '../src/placeAssistantModel.ts';
import { PLANNING_AI_CANDIDATE_LIMIT } from '../src/planningAiService.ts';

function place(id, kind, area, details = {}) {
  return { id, kind, area, name: id, address: area, lat: 35, lng: 129, image: '', description: '', note: '', duration: '', ...details };
}

const cafe = place('cafe', 'CAFE', '부산 해운대', { name: '파도 카페', description: '바다가 내려다보이는 카페' });
const otherCafe = place('other-cafe', 'CAFE', '부산 해운대구', { name: '시장 카페', note: '바다 전망은 비공개 메모' });
const food = place('food', 'FOOD', '부산 해운대', { name: '동백 식당' });
const stay = place('stay', 'STAY', '부산 기장');
const landmark = place('landmark', 'LANDMARK', '제주 안덕');
const privatePlace = place('private', 'CAFE', '부산 해운대', { personal: true, description: '바다 전망' });
const sample = [cafe, otherCafe, food, stay, landmark, privatePlace];

test('understands Korean prompt scope, district suffixes, venue kinds and public descriptor evidence', () => {
  const result = preparePlaceAssistant({ prompt: '부산광역시 해운대구에서 바다가 보이는 카페를 찾아줘' }, sample);
  assert.equal(result.issue, '');
  assert.deepEqual([result.region, result.district, ...result.requestedKinds], ['부산', '해운대', 'CAFE']);
  assert.deepEqual(result.localPlaceIds, ['cafe']);
  assert.deepEqual(result.candidateIds, ['cafe', 'other-cafe']);
  assert.equal(result.eligiblePlaces.some(item => item.id === 'private'), false);
  assert.deepEqual(preparePlaceAssistant({ prompt: '제주에서 숙소랑 명소' }, sample).requestedKinds, ['STAY', 'LANDMARK']);
  assert.deepEqual(preparePlaceAssistant({ prompt: '부산 카페 말고 식당' }, sample).localPlaceIds, ['food']);
});

test('maintains the existing district scope, resolves recognized regions without data, and asks about conflicting ones', () => {
  const scoped = preparePlaceAssistant({ prompt: '카페나 호텔', initialRegion: '부산', initialDistrict: '해운대구' }, sample);
  assert.equal(scoped.district, '해운대');
  assert.deepEqual(scoped.localPlaceIds, ['cafe', 'other-cafe']);
  const elsewhere = preparePlaceAssistant({ prompt: '제주도에 갈 명소', initialRegion: '부산', initialDistrict: '해운대' }, sample);
  assert.deepEqual([elsewhere.district, ...elsewhere.localPlaceIds], ['', 'landmark']);
  const unavailable = preparePlaceAssistant({ prompt: '서울에서 카페', initialRegion: '부산' }, sample);
  assert.equal(unavailable.region, '서울');
  assert.deepEqual(unavailable.localPlaceIds, []);
  const conflict = preparePlaceAssistant({ prompt: '부산과 제주 카페', initialRegion: '부산' }, sample);
  assert.match(conflict.issue, /여러 곳/);
  assert.deepEqual(conflict.candidateIds, []);
  assert.match(preparePlaceAssistant({ prompt: '부산 카페', region: '제주' }, sample).issue, /지역이 달라/);
  assert.match(preparePlaceAssistant({ prompt: '카페' }, sample).issue, /검색할 지역/);
});

test('a place name restricts local results and time, parking, distance and costs stay unverified', () => {
  const result = preparePlaceAssistant({ prompt: '부산 파도 카페 주차가 되고 저렴하고 지금 열었는지 알려줘' }, sample);
  assert.deepEqual(result.localPlaceIds, ['cafe']);
  assert.deepEqual(result.unverified, ['주차', '영업 시간', '가격']);
  const noMatch = preparePlaceAssistant({ prompt: '해운대 해변을 볼 수 있는 카페', initialRegion: '부산' }, sample);
  assert.equal(noMatch.missingDescriptions, true);
  assert.deepEqual(noMatch.localPlaceIds, []);
});

test('uses approved region references and sends unique public IDs of bounded size', () => {
  const references = [{ referenceId: 'test-region', name: '도쿄', category: 'REGION' }];
  const registered = place('registered', 'FOOD', '도쿄 우에노', { regionId: 'test-region' });
  const grounds = Array.from({ length: PLANNING_AI_CANDIDATE_LIMIT + 4 }, (_, index) => place(`ground-${index}`, 'LANDMARK', '제주 안덕'));
  const all = [...sample, ...grounds, cafe, registered];
  assert.deepEqual(placeAssistantRegions(all, references), ['도쿄', '부산', '제주']);
  assert.deepEqual(preparePlaceAssistant({ prompt: '도쿄 우에노 식당' }, all, references).localPlaceIds, ['registered']);
  const bounded = preparePlaceAssistant({ prompt: `제주 명소 ${'가'.repeat(placeAssistantPromptLimit)}` }, all, references);
  assert.equal(bounded.candidateIds.length, PLANNING_AI_CANDIDATE_LIMIT);
  assert.equal(new Set(bounded.candidateIds).size, PLANNING_AI_CANDIDATE_LIMIT);
  assert.equal(bounded.prompt.length, placeAssistantPromptLimit);
  assert.equal(bounded.localPlaceIds.length, grounds.length + 1);
});
