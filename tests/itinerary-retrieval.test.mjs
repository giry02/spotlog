import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { itineraryRequest, assessRetrievalCoverage, itineraryEvidenceCandidates } = await import('../lib/itinerary-retrieval.ts');
const { createTripSession, appendTrip } = await import('../lib/trip-engine.ts');
const { placeMapCoordinates } = await import('../lib/trip-map-data.ts');
const { buildModelInput } = await import('../lib/model-input.ts');

const request = (text, session = createTripSession()) => ({ protocolVersion: 1, requestId: 'coverage-test', sessionId: 'coverage-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
const retrieval = (...ids) => ({ dataMode: 'curated-travel-data', indexVersion: 'idx:coverage-test', embeddingModel: 'test-embedding', results: ids.map((placeId, index) => ({ evidenceId: `ev:${index}`, placeId, documentId: `doc:${index}`, chunkId: `chunk:${index}`, sourceVersion: `sv:${index}`, text: '검증한 공식 요약', sourceKind: 'curated-official-summary' })) });

test('itinerary requests extract days and known destination IDs while explanation-only requests stay read-only', () => {
  const needs = itineraryRequest(request('제주 2박 3일, 한라산과 우도를 넣어 일정 만들어줘'));
  assert.equal(needs.requested, true);
  assert.equal(needs.days, 3);
  assert.equal(needs.region, '제주');
  assert.deepEqual(needs.namedPlaceIds.sort(), ['hallasan', 'udo']);
  for (const text of ['제주 일정은 만들지 말고 한라산만 설명해줘', '일정 짜지 마세요. 우도 설명만 해줘', '제주 여행 준비물 알려줘'])
    assert.equal(itineraryRequest(request(text)).requested, false, text);
});

test('coverage requires distinct retrieved places instead of counting multiple chunks of the same destination', () => {
  const input = request('제주 2박 3일 일정 만들어줘');
  assert.deepEqual(assessRetrievalCoverage(input, retrieval('osulloc', 'hyeopjae', 'geumneung', 'songaksan', 'hamdeok', 'bijarim')), { sufficient: true, reason: 'covered' });
  assert.deepEqual(assessRetrievalCoverage(input, retrieval('osulloc', 'osulloc', 'hyeopjae', 'hyeopjae', 'geumneung', 'geumneung')), { sufficient: false, reason: 'too-few-places' });
});

test('full-day Hallasan and Udo each cover a day while one full-day destination cannot fill two days', () => {
  assert.deepEqual(assessRetrievalCoverage(request('제주 당일 여행 일정 만들어줘'), retrieval('udo')), { sufficient: true, reason: 'covered' });
  assert.deepEqual(assessRetrievalCoverage(request('제주 1박 2일 일정 만들어줘'), retrieval('hallasan', 'udo')), { sufficient: true, reason: 'covered' });
  assert.deepEqual(assessRetrievalCoverage(request('제주 1박 2일 일정 만들어줘'), retrieval('hallasan')), { sufficient: false, reason: 'too-few-places' });
  assert.deepEqual(assessRetrievalCoverage(request('제주 2박 3일 일정 만들어줘'), retrieval('hallasan', 'udo', 'jejumuseum', 'aquaplanet')), { sufficient: true, reason: 'covered' });
});

test('explicitly requested named destinations need their own current source even when other coverage is abundant', () => {
  const input = request('제주 2박 3일 우도를 넣어 일정 만들어줘');
  const evidence = retrieval('osulloc', 'hyeopjae', 'geumneung', 'songaksan', 'hamdeok', 'bijarim');
  assert.deepEqual(assessRetrievalCoverage(input, evidence), { sufficient: false, reason: 'missing-requested-place' });
});

test('unknown corpus IDs and general planning documents never gain permission to create itinerary cards', () => {
  const evidence = retrieval('busan-haeundae', 'invented-resort', 'jeju-general');
  assert.deepEqual(itineraryEvidenceCandidates(evidence), []);
  assert.deepEqual(assessRetrievalCoverage(request('제주 2박 3일 일정 만들어줘'), evidence), { sufficient: false, reason: 'too-few-places' });
  assert.deepEqual(assessRetrievalCoverage(request('대전 2박 3일 일정 만들어줘'), evidence), { sufficient: false, reason: 'outside-corpus' });
  assert.equal(itineraryRequest(request('부산 2박 3일 일정 만들어줘')).outsideCorpus, false);
});

test('mixed supported/outside destinations go to the larger model unless the outside destination is clearly excluded', () => {
  for (const text of ['제주 말고 대전 2박 3일 일정 만들어줘', '서울에서 출발해 대전 2박 3일 일정 만들어줘', '제주와 도쿄 여행 코스 만들어줘']) {
    assert.equal(itineraryRequest(request(text)).outsideCorpus, true, text);
    assert.deepEqual(assessRetrievalCoverage(request(text), retrieval('osulloc', 'hyeopjae')), { sufficient: false, reason: 'outside-corpus' });
  }
  for (const text of ['부산 말고 제주 2박 3일 일정 만들어줘', '부산 대신에 제주 여행 일정 만들어줘', '부산을 제외하고 제주 코스 만들어줘', '도쿄는 빼고 서울 일정 만들어줘'])
    assert.equal(itineraryRequest(request(text)).outsideCorpus, false, text);
});

test('nonexistent retrieval and deliberately skipped retrieval remain different coverage states', () => {
  const input = request('제주 여행 준비물 알려줘');
  assert.deepEqual(assessRetrievalCoverage(input, undefined, 'unavailable'), { sufficient: false, reason: 'missing-evidence' });
  assert.deepEqual(assessRetrievalCoverage(input, retrieval()), { sufficient: false, reason: 'missing-evidence' });
  assert.deepEqual(assessRetrievalCoverage(request('안녕하세요'), undefined, 'not-needed'), { sufficient: true, reason: 'not-required' });
  assert.deepEqual(assessRetrievalCoverage(input, retrieval('jeju-general')), { sufficient: true, reason: 'covered' });
});

test('region-specific coverage cannot count a Seoul landmark toward a Jeju itinerary', () => {
  assert.deepEqual(assessRetrievalCoverage(request('제주 1일 일정 만들어줘'), retrieval('hyeopjae', 'seoulforest')), { sufficient: false, reason: 'too-few-places' });
  let session = appendTrip(createTripSession(), { type: 'region', region: '제주' });
  session = appendTrip(session, { type: 'configure', days: 3 });
  const needs = itineraryRequest(request('새 일정 만들어줘', session));
  assert.equal(needs.days, 3);
  assert.equal(needs.region, '제주');
});

test('itinerary candidates preserve actual retrieval reference positions and distinguish full-day planning', () => {
  const evidence = retrieval('jeju-general', 'hallasan', 'invented', 'hallasan', 'jejumuseum');
  const before = structuredClone(evidence);
  const candidates = itineraryEvidenceCandidates(evidence);
  assert.deepEqual(candidates.map((candidate) => candidate.id), ['hallasan', 'jejumuseum']);
  assert.equal(candidates[0].dayScope, 'full-day');
  assert.deepEqual(candidates[0].evidenceIds, ['ref2', 'ref4']);
  assert.deepEqual(candidates[1].evidenceIds, ['ref5']);
  assert.deepEqual(evidence, before);
});

test('planning geography comes from checked public landmarks and compares only this request\'s retrieved candidates', () => {
  const evidence = retrieval('hyeopjae', 'geumneung', 'seongsan', 'seopjikoji', 'invented');
  const before = structuredClone(evidence);
  const candidates = itineraryEvidenceCandidates(evidence);
  const ids = candidates.map(candidate => candidate.id);
  assert.equal(candidates.length, 4);
  for (const candidate of candidates) {
    const point = placeMapCoordinates[candidate.id];
    assert.deepEqual(candidate.representativeLocation, { latitude: point.latitude, longitude: point.longitude });
    assert.equal(candidate.nearbyCandidates.length, 3);
    assert.ok(candidate.nearbyCandidates.every(nearby => ids.includes(nearby.placeId) && nearby.placeId !== candidate.id));
    assert.ok(candidate.nearbyCandidates.every(nearby => Number.isFinite(nearby.straightLineKm) && nearby.straightLineKm >= 0));
    assert.ok(candidate.nearbyCandidates.every((nearby, index, list) => !index || nearby.straightLineKm >= list[index - 1].straightLineKm));
    assert.ok(candidate.nearbyCandidates.every(nearby => !('drivingMinutes' in nearby) && !('roadDistanceKm' in nearby)));
  }
  const west = candidates.find(candidate => candidate.id === 'hyeopjae');
  assert.equal(west.nearbyCandidates[0].placeId, 'geumneung');
  assert.ok(west.nearbyCandidates[0].straightLineKm > 0.1 && west.nearbyCandidates[0].straightLineKm < 1);
  const east = candidates.find(candidate => candidate.id === 'seongsan');
  assert.equal(east.nearbyCandidates[0].placeId, 'seopjikoji');
  assert.ok(east.nearbyCandidates[0].straightLineKm > 3 && east.nearbyCandidates[0].straightLineKm < 6);
  const single = itineraryEvidenceCandidates(retrieval('hyeopjae'));
  assert.deepEqual(single[0].nearbyCandidates, []);
  assert.deepEqual(evidence, before);
});

test('planner receives public proximity hints without rewriting explicit days, visit order or booking state', () => {
  const seed = appendTrip(createTripSession(), { type: 'message', text: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어' });
  const input = request('제주 2박 3일 일정 만들어줘. DAY 1 오전 성산일출봉, 오후 협재해변은 그대로 지켜줘.', seed);
  const before = structuredClone(input);
  const model = buildModelInput(input, { retrieval: retrieval('hyeopjae', 'geumneung', 'seongsan', 'seopjikoji'), retrievalStatus: 'available', retrievalInstruction: '검증한 검색 자료' });
  const serialized = JSON.parse(model.messages[1].content);
  assert.deepEqual(serialized.context.itineraryCandidates, model.question.context.itineraryCandidates);
  assert.ok(serialized.context.itineraryCandidates.every(candidate => candidate.representativeLocation && candidate.nearbyCandidates.length));
  assert.equal(serialized.userMessage, input.action.text);
  assert.deepEqual(input, before);
  assert.match(model.messages[0].content, /사용자가 지정한 DAY·오전\/오후·방문 순서와 예약 고정 조건을 먼저 지킨다/);
  assert.match(model.messages[0].content, /직선거리\(km\).*실제 도로거리·이동시간/);
});

test('an explicit day-trip request overrides a prior three-day state and ignores a rejected duration', () => {
  let session = appendTrip(createTripSession(), { type: 'region', region: '제주' });
  session = appendTrip(session, { type: 'configure', days: 3 });
  for (const text of ['제주 당일 일정 만들어줘', '2박 3일 말고 당일 일정 만들어줘']) {
    const input = request(text, session);
    assert.equal(itineraryRequest(input).days, 1, text);
    assert.deepEqual(assessRetrievalCoverage(input, retrieval('udo')), { sufficient: true, reason: 'covered' });
  }
  assert.equal(itineraryRequest(request('당일 말고 1박 2일 일정 만들어줘', session)).days, 2);
  assert.equal(itineraryRequest(request('DAY 1일차 오후 장소만 설명해줘', session)).days, 3);
});

test('the latest explicit supported destination overrides a rejected destination and the previous region', () => {
  const jeju = appendTrip(createTripSession(), { type: 'region', region: '제주' });
  assert.equal(itineraryRequest(request('제주 말고 서울 당일 일정 만들어줘', jeju)).region, '서울');
  assert.equal(itineraryRequest(request('서울 말고 제주 일정 만들어줘')).region, '제주');
  assert.equal(itineraryRequest(request('제주 일정 만들어줘. 서울에서 출발해요.')).region, '제주');
  assert.equal(itineraryRequest(request('서울에서 출발해 제주로 여행 일정 만들어줘')).region, '제주');
});

test('explicitly excluded named destinations are not mandatory evidence while retained names still are', () => {
  const input = request('제주 당일 일정 만들어줘. 한라산은 말고 우도로 가고 싶어.');
  assert.deepEqual(itineraryRequest(input).namedPlaceIds, ['udo']);
  assert.deepEqual(assessRetrievalCoverage(input, retrieval('udo')), { sufficient: true, reason: 'covered' });
  assert.deepEqual(itineraryRequest(request('제주당일한라산말고우도 일정 만들어줘')).namedPlaceIds, ['udo']);
  assert.deepEqual(itineraryRequest(request('서울숲 말고 한라산 당일 일정 만들어줘')).namedPlaceIds, ['hallasan']);
  assert.equal(itineraryRequest(request('서울숲 말고 한라산 당일 일정 만들어줘')).region, '제주');
  assert.deepEqual(itineraryRequest(request('한라산하고 오설록은 제외하고 우도 당일 일정 만들어줘')).namedPlaceIds, ['udo']);
  assert.ok(itineraryRequest(request('한라산은 빼지 말고 제주 당일 일정 만들어줘')).namedPlaceIds.includes('hallasan'));
});

test('business-category exclusions cannot remove a named destination from an earlier request clause', () => {
  for (const text of [
    '제주 2박 3일 일정 짜줘. 우도는 꼭 포함해줘. 식당 카페 숙소는 빼줘. 오늘 날씨도 알려줘.',
    '제주 2박 3일 우도는 꼭 포함해주고 식당 카페 숙소는 전부 빼줘.',
    '제주 2박 3일 우도는 꼭 포함해줘, 식당 카페 숙소는 빼줘.',
    '제주 우도는 꼭 포함해줘. 식사와 숙박 추천은 제외하고 일정 만들어줘.',
    '제주 우도를 꼭 넣어서 일정 짜줘. 점심은 빼줘.',
  ]) assert.ok(itineraryRequest(request(text)).namedPlaceIds.includes('udo'), text);
  assert.deepEqual(itineraryRequest(request('제주 2박 3일 우도와 식당은 빼줘. 일정 만들어줘.')).namedPlaceIds, []);
  assert.deepEqual(itineraryRequest(request('제주 2박 3일 우도랑 카페는 제외하고 일정 만들어줘.')).namedPlaceIds, []);
  assert.deepEqual(itineraryRequest(request('제주 2박 3일 한라산하고 오설록은 제외하고 우도는 꼭 포함해줘. 식당 카페 숙소는 빼줘.')).namedPlaceIds, ['udo']);
});
