import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAiSeed } from '../src/admin/aiSeed.ts';
import { applyAiCommand, approvedDocuments, documentRef, effectiveIndexDocuments, externalFallbackDecision, indexActivationErrors, onPublishedPlaceChange, policyFingerprint, simulateAiFixture, validateAiPolicy } from '../src/admin/aiDomain.ts';

const now = '2026-10-05T05:00:00.000Z';
const context = { actor: { operatorId: 'admin', name: '시험 관리자', role: 'ADMIN' }, now };
const operator = { ...context, actor: { ...context.actor, role: 'OPERATOR' } };
const content = (name, kind = 'LANDMARK', extra = {}) => ({ kind, name, companyId: '', area: '서울 성동', address: '서울 성동구 검수 주소', description: '운영자 합성 공개 장소', tags: [], operation: 'OPEN', provider: '합성', sourceUrl: 'https://example.com/place', checkedAt: '2026-10-05', rights: { display: true, store: true, modify: true, ai: true }, location: { lat: 37.54, lng: 127.04, verified: true, reference: '합성 위치', sourceUrl: 'https://example.com/location', checkedAt: '2026-10-05' }, media: [], guide: { hours: '', bestTime: '', facilities: '', menu: '', lodging: '', access: '', english: '', englishStatus: 'MISSING', sourceUrl: '', checkedAt: '', sourceRevision: 1 }, ai: { text: '합성 자료의 산책·방문 안내', tags: ['산책'], sourceUrl: 'https://example.com/ai', provider: '합성 시험', checkedAt: '2026-10-05', allowed: true, version: 1 }, ...extra });
const place = (placeId, kind = 'LANDMARK', extra = {}) => { const value = content(placeId, kind, extra); return { placeId, revision: 1, state: 'PUBLISHED', published: value, draft: structuredClone(value), revoked: false, updatedAt: now }; };
const makeState = () => ({ schemaVersion: 1, revision: 1, places: [place('a'), place('b'), place('food', 'FOOD'), place('stay', 'STAY')], nearbyOverrides: [], ai: makeAiSeed(), ops: {}, audit: [], processedCommands: [] });
function indexedState() { const state = makeState(); state.ai.indices[0].documents = state.places.map(documentRef); return state; }
function queueAndVerify(state) {
  applyAiCommand(state, { kind: 'ai.index.queue', mode: 'FULL' }, context);
  const job = state.ai.jobs[0];
  applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, context);
  applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, context);
  applyAiCommand(state, { kind: 'ai.index.verify', indexId: job.indexId }, context);
  return job;
}
function policyInput(policy) { const { policyId, version, state, createdAt, testedAt, testedFingerprint, validationErrors, ...input } = policy; return input; }

test('approved RAG descriptions use published source only and exclude drafts, closed, revoked, unchecked and unlicensed places', () => {
  const state = indexedState();
  state.places[0].draft.ai.text = '미공개 수정';
  assert.equal(approvedDocuments(state)[0].content.ai.text, '합성 자료의 산책·방문 안내');
  for (const patch of [{ state: 'DRAFT' }, { revoked: true }, { state: 'INACTIVE' }]) { const source = place('invalid'); Object.assign(source, patch); assert.equal(documentRef(source), null); }
  for (const patch of [{ operation: 'CLOSED' }, { operation: 'TEMP_CLOSED' }, { operation: 'CHECK' }, { rights: { display: true, store: true, modify: true, ai: false } }, { location: { lat: 37, lng: 127, verified: false } }, { ai: { text: 'a', allowed: true, sourceUrl: '', checkedAt: now, version: 1 } }]) assert.equal(documentRef(place('invalid', 'LANDMARK', patch)), null);
});

test('coordinate and address corrections use current DB metadata without re-embedding approved text', () => {
  const state = indexedState(), record = state.places[0], before = structuredClone(record.published), oldRef = documentRef(record);
  record.published.location.lng = 127.041; record.published.address = '좌표 보정 주소'; record.revision++;
  onPublishedPlaceChange(state, record.placeId, before, now);
  assert.deepEqual(documentRef(record), oldRef); assert.equal(state.ai.jobs.length, 0);
  assert.equal(effectiveIndexDocuments(state).length, 4);
});

test('published approved text change queues document work while unsaved draft change does not', () => {
  const state = indexedState(), record = state.places[0], before = structuredClone(record.published);
  record.draft.ai.text = '초안'; assert.equal(documentRef(record).fingerprint, documentRef({ ...record, draft: before }).fingerprint);
  record.published.ai.text = '새 공개 설명'; record.published.ai.version++;
  onPublishedPlaceChange(state, record.placeId, before, now);
  assert.equal(state.ai.jobs[0].mode, 'DOCUMENT'); assert.equal(state.ai.jobs[0].state, 'QUEUED');
  assert.equal(effectiveIndexDocuments(state).some(ref => ref.placeId === record.placeId), false);
  onPublishedPlaceChange(state, record.placeId, before, now); assert.equal(state.ai.jobs.length, 1);
});

test('English document content changes only enter embeddings after review, and stale English is removed', () => {
  const state = indexedState(), record = state.places[0], oldRef = documentRef(record);
  record.published.guide.english = 'Unreviewed text'; assert.equal(documentRef(record).fingerprint, oldRef.fingerprint);
  record.published.guide.englishStatus = 'REVIEWED'; assert.notEqual(documentRef(record).fingerprint, oldRef.fingerprint);
  record.published.guide.englishStatus = 'STALE'; assert.equal(documentRef(record).fingerprint, oldRef.fingerprint);
});

test('index failures and pending verification never replace the active version; retry uses current source', () => {
  const state = indexedState(), original = state.ai.activeIndexId;
  applyAiCommand(state, { kind: 'ai.index.queue', mode: 'FULL' }, context); const job = state.ai.jobs[0];
  applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId, simulateFailure: true }, context);
  assert.equal(job.state, 'FAILED'); assert.equal(state.ai.activeIndexId, original);
  applyAiCommand(state, { kind: 'ai.index.retry', jobId: job.jobId }, context);
  applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, context);
  assert.equal(job.state, 'RUNNING');
  applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, context);
  assert.equal(job.state, 'VALIDATION_PENDING'); assert.equal(state.ai.activeIndexId, original);
  applyAiCommand(state, { kind: 'ai.index.verify', indexId: job.indexId }, context);
  assert.equal(state.ai.indices.find(index => index.indexId === job.indexId).state, 'VERIFIED');
  assert.throws(() => applyAiCommand(state, { kind: 'ai.index.activate', indexId: job.indexId }, operator), /최고관리자/);
  applyAiCommand(state, { kind: 'ai.index.activate', indexId: job.indexId }, context); assert.equal(job.state, 'APPLIED');
});

test('withdrawal, closure and source updates after index verification reject activation and keep active index', () => {
  for (const mutate of [place => { place.revoked = true; }, place => { place.published.operation = 'CLOSED'; }, place => { place.published.ai.text = '변경'; }]) {
    const state = indexedState(), active = state.ai.activeIndexId, job = queueAndVerify(state);
    mutate(state.places[0]);
    assert.throws(() => applyAiCommand(state, { kind: 'ai.index.activate', indexId: job.indexId }, context), /검증 뒤 자료/);
    assert.equal(state.ai.activeIndexId, active);
  }
});

test('parallel document candidates cannot discard a document applied after their snapshot; rebuilding requires fresh execution and verification', () => {
  const state = indexedState();
  state.places[0].published.ai.text = 'a 변경 설명';
  state.places[1].published.ai.text = 'b 변경 설명';
  const prepared = [];
  for (const placeId of ['a', 'b']) {
    applyAiCommand(state, { kind: 'ai.index.queue', mode: 'DOCUMENT', placeId }, operator);
    const job = state.ai.jobs[0];
    applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, operator);
    applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, operator);
    applyAiCommand(state, { kind: 'ai.index.verify', indexId: job.indexId }, operator);
    prepared.push(job);
  }
  const [first, second] = prepared;
  applyAiCommand(state, { kind: 'ai.index.activate', indexId: first.indexId }, context);
  assert.match(indexActivationErrors(state, second.indexId).join(' '), /a: 현재 색인에 반영된 자료 누락/);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.index.activate', indexId: second.indexId }, context), /현재 색인이 변경/);
  assert.equal(state.ai.activeIndexId, first.indexId);
  applyAiCommand(state, { kind: 'ai.index.retry', jobId: second.jobId }, operator);
  const rebuilt = state.ai.indices.find(index => index.indexId === second.indexId);
  assert.equal(second.state, 'QUEUED');
  assert.equal(rebuilt.state, 'CANDIDATE');
  assert.equal(rebuilt.verifiedAt, undefined);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.index.activate', indexId: rebuilt.indexId }, context), /검증을 통과/);
  applyAiCommand(state, { kind: 'ai.index.run', jobId: second.jobId }, operator);
  applyAiCommand(state, { kind: 'ai.index.run', jobId: second.jobId }, operator);
  applyAiCommand(state, { kind: 'ai.index.verify', indexId: rebuilt.indexId }, operator);
  applyAiCommand(state, { kind: 'ai.index.activate', indexId: rebuilt.indexId }, context);
  assert.deepEqual(effectiveIndexDocuments(state).map(ref => ref.placeId).sort(), ['a', 'b', 'food', 'stay']);
});

test('a verified candidate can be rebuilt after its source changes, while unchanged verified work cannot be retried', () => {
  const state = indexedState(), job = queueAndVerify(state);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.index.retry', jobId: job.jobId }, operator), /현재 자료와 달라진/);
  state.places[0].published.ai.text = '검증 뒤 새 설명';
  applyAiCommand(state, { kind: 'ai.index.retry', jobId: job.jobId }, operator);
  const candidate = state.ai.indices.find(index => index.indexId === job.indexId);
  assert.deepEqual(candidate.documents.find(ref => ref.placeId === 'a'), documentRef(state.places[0]));
  assert.equal(candidate.state, 'CANDIDATE');
  assert.equal(job.state, 'QUEUED');
});

test('rollback never resurrects tombstones even when index removal has failed', () => {
  const state = indexedState(), previousIndex = state.ai.activeIndexId, job = queueAndVerify(state);
  applyAiCommand(state, { kind: 'ai.index.activate', indexId: job.indexId }, context);
  const before = structuredClone(state.places[0].published); state.places[0].revoked = true; state.places[0].state = 'INACTIVE';
  onPublishedPlaceChange(state, 'a', before, now);
  assert.equal(state.ai.jobs[0].mode, 'REMOVAL');
  applyAiCommand(state, { kind: 'ai.index.run', jobId: state.ai.jobs[0].jobId, simulateFailure: true }, context);
  state.places[1].published.operation = 'CLOSED'; state.places[2].published.ai.text = '원문 변경';
  applyAiCommand(state, { kind: 'ai.index.rollback', indexId: previousIndex }, context);
  assert.deepEqual(effectiveIndexDocuments(state).map(ref => ref.placeId), ['stay']);
});

test('document jobs cannot silently switch embedding models and candidate duplicates fail verification', () => {
  const state = indexedState();
  assert.throws(() => applyAiCommand(state, { kind: 'ai.index.queue', mode: 'DOCUMENT', placeId: 'a', embeddingProfile: 'new' }, context), /전체 후보/);
  applyAiCommand(state, { kind: 'ai.index.queue', mode: 'FULL' }, context); const job = state.ai.jobs[0], index = state.ai.indices[0]; index.documents.push(index.documents[0]);
  applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, context); applyAiCommand(state, { kind: 'ai.index.run', jobId: job.jobId }, context); applyAiCommand(state, { kind: 'ai.index.verify', indexId: job.indexId }, context);
  assert.equal(index.state, 'FAILED'); assert.match(index.validationErrors.join(' '), /중복/);
});

test('external supplementation enforces grounded model failures, full-request one-call cap, configured time and cost', () => {
  const policy = { ...makeAiSeed().policies[0], externalEnabled: true };
  for (const patch of [{ timeoutMs: null }, { externalBudgetKrw: null }, { timeoutMs: 0 }, { externalBudgetKrw: 0 }, { externalMaxCalls: 2 }, { channels: ['CHATBOT'] }]) assert.ok(validateAiPolicy({ ...policy, ...patch }).length);
  assert.equal(externalFallbackDecision(policy, 'MODEL_FORMAT', true).eligible, true);
  for (const error of ['DATA_MISSING', 'COORDINATES_MISSING', 'CONNECTION_FAILED', 'REVISION_CONFLICT', 'INPUT_MISSING']) assert.equal(externalFallbackDecision(policy, error, true).eligible, false);
  assert.equal(externalFallbackDecision(policy, 'MODEL_FORMAT', false).eligible, false);
  assert.equal(externalFallbackDecision(policy, 'MODEL_FORMAT', true, 1).eligible, false);
});

test('policy save/test/activation is admin-only, draft changes preserve active policy and require retest', () => {
  const state = indexedState(), original = state.ai.activePolicyId;
  const input = { ...policyInput(state.ai.policies[0]), label: '새 정책' };
  assert.throws(() => applyAiCommand(state, { kind: 'ai.policy.save', policy: input }, operator), /최고관리자/);
  applyAiCommand(state, { kind: 'ai.policy.save', policy: input }, context); const draft = state.ai.policies[0];
  assert.equal(state.ai.activePolicyId, original);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.policy.activate', policyId: draft.policyId }, context), /규칙 검수/);
  applyAiCommand(state, { kind: 'ai.policy.test', policyId: draft.policyId }, context); assert.equal(draft.state, 'TESTED');
  draft.promptVersion = 'unsaved-mutated'; assert.notEqual(policyFingerprint(draft), draft.testedFingerprint);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.policy.activate', policyId: draft.policyId }, context), /규칙 검수/);
  applyAiCommand(state, { kind: 'ai.policy.test', policyId: draft.policyId }, context);
  applyAiCommand(state, { kind: 'ai.policy.activate', policyId: draft.policyId }, context); assert.equal(state.ai.activePolicyId, draft.policyId);
  applyAiCommand(state, { kind: 'ai.policy.rollback', policyId: original }, context); assert.equal(state.ai.activePolicyId, original);
});

test('fixture runs never fabricate missing businesses, write trips, collect raw customer prompts or fake latency/cost', () => {
  const state = indexedState(); const beforePlaces = structuredClone(state.places), beforeOps = structuredClone(state.ops);
  applyAiCommand(state, { kind: 'ai.fixture.run', fixtureId: 'fixture-simple' }, operator);
  const result = state.ai.results[0], request = state.ai.requests[0];
  assert.equal(result.outcome, 'PASS'); assert.equal(result.saved, false); assert.equal(result.externalCalls, 0);
  assert.ok(result.visits.every(visit => state.places.some(place => place.placeId === visit.placeId)));
  assert.equal(request.latencyMs, null); assert.equal(request.externalCostKrw, null); assert.equal(request.prompt, undefined); assert.equal(request.conversation, undefined);
  assert.deepEqual(state.places, beforePlaces); assert.deepEqual(state.ops, beforeOps);
  state.places = state.places.filter(place => place.draft.kind !== 'FOOD');
  applyAiCommand(state, { kind: 'ai.fixture.run', fixtureId: 'fixture-simple' }, operator);
  assert.equal(state.ai.results[0].outcome, 'BLOCKED'); assert.equal(state.ai.results[0].errorCode, 'DATA_MISSING');
});

test('partial-revision fixture preserves fixed lodging and other DAY and stale revision remains unsaved', () => {
  const state = indexedState(); applyAiCommand(state, { kind: 'ai.fixture.run', fixtureId: 'fixture-revision' }, operator);
  const result = state.ai.results[0]; assert.equal(result.outcome, 'PASS');
  for (const original of result.originalVisits.filter(visit => visit.bookingFixed || visit.day === 2)) assert.ok(result.visits.some(visit => JSON.stringify(visit) === JSON.stringify(original)));
  assert.equal(result.visits.some(visit => visit.day === 1 && visit.slot === 'AFTERNOON'), false);
  state.ai.fixtures.find(fixture => fixture.fixtureId === 'fixture-revision').scenario = 'STALE_REVISION';
  applyAiCommand(state, { kind: 'ai.fixture.run', fixtureId: 'fixture-revision' }, operator);
  assert.equal(state.ai.results[0].errorCode, 'REVISION_CONFLICT'); assert.equal(state.ai.results[0].saved, false);
});

test('revision and chatbot expected IDs are evaluated against the final proposal after removals', () => {
  const state = indexedState();
  for (const channel of ['REVISION', 'CHATBOT']) {
    const fixture = { ...state.ai.fixtures[0], channel, dayCount: 1, includeFood: false, includeStay: false, expectedPlaceIds: ['b'] };
    const result = simulateAiFixture(state, fixture, state.ai.policies[0], state.ai.activeIndexId, now);
    assert.equal(result.originalVisits.some(visit => visit.placeId === 'b'), true);
    assert.equal(result.visits.some(visit => visit.placeId === 'b'), false);
    assert.equal(result.checks.find(check => check.label === '기대 장소 ID').passed, false);
    assert.equal(result.outcome, 'FAIL');
    assert.equal(result.saved, false);
    fixture.expectedPlaceIds = ['a'];
    assert.equal(simulateAiFixture(state, fixture, state.ai.policies[0], state.ai.activeIndexId, now).outcome, 'PASS');
  }
});

test('chatbot starts disabled, uses synthetic multi-turn generation/revision contract and never executes customer actions', () => {
  const state = indexedState(); assert.equal(state.ai.policies[0].channels.includes('CHATBOT'), false);
  applyAiCommand(state, { kind: 'ai.fixture.run', fixtureId: 'fixture-chatbot' }, operator);
  const result = state.ai.results[0]; assert.equal(result.messages.length, 6); assert.equal(result.outcome, 'PASS'); assert.equal(result.saved, false);
  assert.match(result.messages.at(-1).text, /최신 revision.*예약 고정.*승인/);
  assert.equal(result.externalCalls, 0); assert.equal(state.ai.policies[0].channels.includes('CHATBOT'), false);
  assert.equal(result.visits.some(visit => visit.day === 1 && visit.slot === 'AFTERNOON'), false);
  assert.ok(result.originalVisits.filter(visit => visit.day === 2).every(original => result.visits.some(next => JSON.stringify(next) === JSON.stringify(original))));
});

test('same name branches remain distinct IDs and expected IDs cannot be satisfied by invented records', () => {
  const state = indexedState(); state.places[0].published.name = '같은 상호'; state.places[1].published.name = '같은 상호';
  const fixture = structuredClone(state.ai.fixtures[0]); fixture.includeFood = false; fixture.expectedPlaceIds = ['a', 'b'];
  assert.equal(simulateAiFixture(state, fixture, state.ai.policies[0], state.ai.activeIndexId, now).outcome, 'PASS');
  fixture.expectedPlaceIds.push('missing'); const result = simulateAiFixture(state, fixture, state.ai.policies[0], state.ai.activeIndexId, now);
  assert.equal(result.outcome, 'FAIL'); assert.equal(result.visits.some(visit => visit.placeId === 'missing'), false);
});

test('empty approved dataset blocks generation and no fallback covers missing grounds', () => {
  const state = makeState(); const result = simulateAiFixture(state, state.ai.fixtures[0], state.ai.policies[0], state.ai.activeIndexId, now);
  assert.equal(result.outcome, 'BLOCKED'); assert.deepEqual(result.visits, []); assert.equal(result.externalEligibility, false);
});

test('guide fixtures show only approved source text and reviewed English, never draft translation', () => {
  const state = indexedState(); state.places[0].draft.guide.english = 'private unfinished translation';
  applyAiCommand(state, { kind: 'ai.fixture.run', fixtureId: 'fixture-guide' }, operator);
  const result = state.ai.results[0];
  assert.equal(result.outcome, 'PASS'); assert.equal(result.guideEvidence.length, 1);
  assert.equal(result.guideEvidence[0].text, state.places[0].published.ai.text);
  assert.equal(result.guideEvidence[0].english, ''); assert.equal(JSON.stringify(result).includes('private unfinished'), false);
});

test('cached fixture and policy edits compare their original entity revision instead of overwriting newer saved input', () => {
  const state = indexedState(); const fixture = state.ai.fixtures[0], cachedRevision = fixture.revision;
  const { fixtureId, source, revision, ...input } = structuredClone(fixture);
  applyAiCommand(state, { kind: 'ai.fixture.save', fixtureId, fixture: { ...input, title: '다른 창 수정' }, entityRevision: cachedRevision }, operator);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.fixture.save', fixtureId, fixture: { ...input, title: '오래된 캐시' }, entityRevision: cachedRevision }, operator), /다른 창/);
  assert.equal(state.ai.fixtures.find(value => value.fixtureId === fixtureId).title, '다른 창 수정');
  applyAiCommand(state, { kind: 'ai.policy.save', policy: policyInput(state.ai.policies[0]) }, context);
  const draft = state.ai.policies[0], cachedVersion = draft.version;
  applyAiCommand(state, { kind: 'ai.policy.save', policyId: draft.policyId, policy: { ...policyInput(draft), label: '다른 창 정책' }, entityRevision: cachedVersion }, context);
  assert.throws(() => applyAiCommand(state, { kind: 'ai.policy.save', policyId: draft.policyId, policy: { ...policyInput(draft), label: '오래된 정책' }, entityRevision: cachedVersion }, context), /다른 창/);
  assert.equal(state.ai.policies.find(value => value.policyId === draft.policyId).label, '다른 창 정책');
});
