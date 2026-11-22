import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretCreationPrompt } from '../src/together/creationPlanner.ts';
import { selectCreationAiCandidates } from '../src/together/creationAiCandidates.ts';

const place = (id, kind, area, extras = {}) => ({ id, kind, name: id, area, address: area + ' 테스트로 1', lat: 35.16, lng: 129.16, image: '', description: '', note: '', duration: '', ...extras });
const catalog = [
  place('haeundae-food', 'FOOD', '부산 해운대', { address: '부산 해운대구 중동로 1' }),
  place('haeundae-cafe', 'CAFE', '부산 해운대', { address: '부산 해운대구 달맞이길 1' }),
  place('haeundae-beach', 'LANDMARK', '부산 해운대'),
  place('haeundae-stay', 'STAY', '부산 해운대'),
  place('gamcheon', 'LANDMARK', '부산 사하'),
  place('yonggungsa', 'LANDMARK', '부산 기장'),
  place('gijang-cafe', 'CAFE', '부산 기장'),
  place('gijang-food', 'FOOD', '부산 기장'),
  place('seoul-food', 'FOOD', '서울 강남'),
];
const brief = (prompt, initial = {}) => interpretCreationPrompt(prompt, { purpose: 'MEETUP', region: '부산', ...initial });
const ids = result => result.map(place => place.id).sort();

test('a Haeundae meal-and-cafe appointment excludes unrelated landmarks and districts', () => {
  const request = brief('부산 해운대에서 친구 4명이 식사하고 카페');
  const before = structuredClone(catalog);
  assert.deepEqual(ids(selectCreationAiCandidates(request, catalog)), ['haeundae-cafe', 'haeundae-food']);
  assert.deepEqual(catalog, before);
  assert.deepEqual(ids(selectCreationAiCandidates({ ...request, purpose: 'OUTING' }, catalog)), ['haeundae-cafe', 'haeundae-food']);
});

test('the explicit brief locality intersects prompt constraints rather than widening an empty or conflicting result', () => {
  assert.deepEqual(selectCreationAiCandidates(brief('서울에서 식사', { region: '부산' }), catalog), []);
  assert.deepEqual(selectCreationAiCandidates(brief('기장 카페', { region: '부산 해운대구' }), catalog), []);
  assert.deepEqual(selectCreationAiCandidates(brief('카페', { region: '서울 강남구' }), catalog), []);
  assert.deepEqual(selectCreationAiCandidates(brief('카페', { region: '' }), catalog), []);
  assert.deepEqual(selectCreationAiCandidates(brief('카페', { region: '전국' }), catalog), []);
  assert.deepEqual(selectCreationAiCandidates(brief('해운대와 기장에서 식사'), catalog), []);
});

test('excluded types stay excluded, including notes and constraints after the first place-search phrase', () => {
  assert.deepEqual(ids(selectCreationAiCandidates(brief('해운대 카페 말고 식사'), catalog)), ['haeundae-food']);
  assert.deepEqual(ids(selectCreationAiCandidates({ ...brief('해운대 식사하고 카페'), notes: '카페는 제외해 주세요.' }, catalog)), ['haeundae-food']);
  const late = { ...brief('해운대에서 식사하고 카페'), notes: '일행 소개 '.repeat(60) + '카페는 빼고 식사만 할게요.' };
  assert.deepEqual(ids(selectCreationAiCandidates(late, catalog)), ['haeundae-food']);
  assert.deepEqual(selectCreationAiCandidates(brief('해운대 카페 말고'), catalog).some(place => place.kind === 'CAFE'), false);
});

test('generic requests keep available kinds in the stated locality without inventing a venue-type preference', () => {
  assert.deepEqual(ids(selectCreationAiCandidates(brief('친구 4명과 만나요', { region: '부산 해운대구' }), catalog)),
    ['haeundae-beach', 'haeundae-cafe', 'haeundae-food', 'haeundae-stay']);
  assert.deepEqual(ids(selectCreationAiCandidates(brief('', { region: '부산 해운대구' }), catalog)),
    ['haeundae-beach', 'haeundae-cafe', 'haeundae-food', 'haeundae-stay']);
});

test('private, withdrawn, invalid-coordinate and ambiguous duplicate records never reach model candidates', () => {
  const entries = [...catalog,
    place('private', 'FOOD', '부산 해운대', { personal: true }),
    place('hidden', 'FOOD', '부산 해운대', { visibility: 'PRIVATE' }),
    place('withdrawn', 'CAFE', '부산 해운대', { publicationStatus: 'WITHDRAWN' }),
    place('closed', 'FOOD', '부산 해운대', { operatingStatus: 'CLOSED' }),
    place('invalid', 'FOOD', '부산 해운대', { lat: NaN }),
    place('duplicate', 'FOOD', '부산 해운대'), place('duplicate', 'CAFE', '부산 해운대'),
  ];
  assert.deepEqual(ids(selectCreationAiCandidates(brief('해운대 식사하고 카페'), entries)), ['haeundae-cafe', 'haeundae-food']);
});

test('travel retains the existing public regional itinerary scope and group copy requests use no place candidates', () => {
  const request = { ...brief('해운대 식사하고 카페'), purpose: 'TRIP' };
  assert.deepEqual(ids(selectCreationAiCandidates(request, catalog)), ids(catalog.filter(place => place.area.startsWith('부산'))));
  assert.deepEqual(selectCreationAiCandidates({ ...request, purpose: 'GROUP' }, catalog), []);
});
