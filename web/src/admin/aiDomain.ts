import type { AdminPlace, AdminState, MutationContext, MutationOutcome, PlaceContent } from './types';
import type { AiCommand, AiDocumentRef, AiErrorCode, AiFixtureInput, AiIndexJob, AiIndexVersion, AiPolicy, AiPolicyInput, AiTestFixture, AiTestResult, AiTestVisit } from './aiTypes';
import { aiEligiblePublished, distanceKm } from './selectors.ts';

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const requireAdmin = (context: MutationContext) => { if (context.actor.role !== 'ADMIN') throw new Error('최고관리자만 정책과 색인 적용·복구를 관리할 수 있어요.'); };
const hash = (value: unknown) => {
  let n = 2166136261;
  for (const character of JSON.stringify(value)) { n ^= character.charCodeAt(0); n = Math.imul(n, 16777619); }
  return (n >>> 0).toString(16);
};

export function documentRef(place: AdminPlace): AiDocumentRef | null {
  const content = aiEligiblePublished(place);
  if (!content) return null;
  return { placeId: place.placeId, version: content.ai.version, fingerprint: hash({ text: content.ai.text, tags: content.ai.tags, sourceUrl: content.ai.sourceUrl, provider: content.ai.provider, checkedAt: content.ai.checkedAt, english: content.guide.englishStatus === 'REVIEWED' ? content.guide.english : '', englishSource: content.guide.englishStatus === 'REVIEWED' ? content.guide.sourceUrl : '', englishSourceRevision: content.guide.englishStatus === 'REVIEWED' ? content.guide.sourceRevision : 0 }) };
}

/** Metadata comes from the source DB at read time; only approved embedding content changes enqueue work. */
export function onPublishedPlaceChange(state: AdminState, placeId: string, previous: PlaceContent | undefined, now: string): void {
  const record = state.places.find(value => value.placeId === placeId);
  const current = record && documentRef(record);
  const previousRef = previous && documentRef({ placeId, revision: 0, state: 'PUBLISHED', published: previous, draft: previous, revoked: false, updatedAt: now });
  if (current && previousRef && current.fingerprint === previousRef.fingerprint && current.version === previousRef.version) return;
  if (!current && !previousRef) return;
  const pending = state.ai.jobs.find(job => job.placeId === placeId && job.mode === (current ? 'DOCUMENT' : 'REMOVAL') && ['QUEUED', 'RUNNING', 'VALIDATION_PENDING'].includes(job.state));
  if (pending) {
    const index = state.ai.indices.find(value => value.indexId === pending.indexId);
    if (index?.documents.some(ref => ref.placeId === placeId && ref.fingerprint === current?.fingerprint)) return;
    if (!current && index && !index.documents.some(ref => ref.placeId === placeId)) return;
  }
  if (!record) {
    // Only unreferenced unpublished drafts can be deleted. No public document existed.
    return;
  }
  applyAiCommand(state, { kind: 'ai.index.queue', mode: current ? 'DOCUMENT' : 'REMOVAL', placeId }, { actor: { operatorId: 'system', name: '자료 변경 작업', role: 'OPERATOR' }, now });
}

/** Always re-check live source permissions, state and version. A rollback cannot resurrect removed documents. */
export function effectiveIndexDocuments(state: AdminState, indexId = state.ai.activeIndexId): AiDocumentRef[] {
  const index = state.ai.indices.find(value => value.indexId === indexId);
  if (!index || !['ACTIVE', 'ARCHIVED', 'VERIFIED'].includes(index.state)) return [];
  return index.documents.filter(ref => {
    const place = state.places.find(value => value.placeId === ref.placeId);
    const current = place && documentRef(place);
    return current && current.fingerprint === ref.fingerprint && current.version === ref.version;
  });
}

export function approvedDocuments(state: AdminState) {
  return state.places.flatMap(place => {
    const content = aiEligiblePublished(place), ref = documentRef(place);
    return content && ref ? [{ place, content, ref }] : [];
  });
}

export function policyFingerprint(policy: AiPolicy | AiPolicyInput): string {
  return hash({ label: policy.label, smallLocalProfile: policy.smallLocalProfile, embeddingProfile: policy.embeddingProfile, externalProfile: policy.externalProfile, flowiseProfile: policy.flowiseProfile, promptVersion: policy.promptVersion, regions: policy.regions, channels: policy.channels, externalEnabled: policy.externalEnabled, externalMaxCalls: policy.externalMaxCalls, timeoutMs: policy.timeoutMs, externalBudgetKrw: policy.externalBudgetKrw });
}

export function validateAiPolicy(policy: AiPolicy | AiPolicyInput): string[] {
  const errors: string[] = [];
  for (const [label, value] of [['정책 이름', policy.label], ['소형 로컬 연결 이름', policy.smallLocalProfile], ['임베딩 연결 이름', policy.embeddingProfile], ['Flowise 연결 이름', policy.flowiseProfile], ['프롬프트 버전', policy.promptVersion]]) if (!value.trim()) errors.push(`${label}을 입력해 주세요.`);
  if (!policy.regions.length || policy.regions.some(value => !value.trim())) errors.push('사용 지역을 입력해 주세요.');
  if (!policy.channels.length) errors.push('적어도 하나의 사용 기능을 선택해 주세요.');
  if (policy.channels.includes('CHATBOT')) errors.push('챗봇 고객 채널은 후속 연결 전이에요. 운영자 합성 시험만 이용할 수 있어요.');
  if (!Number.isInteger(policy.externalMaxCalls) || policy.externalMaxCalls < 0 || policy.externalMaxCalls > 1) errors.push('외부 보완은 요청 전체에서 최대 1회만 허용해요.');
  if (policy.timeoutMs !== null && (!Number.isFinite(policy.timeoutMs) || policy.timeoutMs <= 0)) errors.push('시간 제한은 0보다 큰 값이어야 해요.');
  if (policy.externalBudgetKrw !== null && (!Number.isFinite(policy.externalBudgetKrw) || policy.externalBudgetKrw <= 0)) errors.push('외부 비용 제한은 0보다 큰 값이어야 해요.');
  if (policy.externalEnabled && (!policy.externalProfile.trim() || policy.timeoutMs === null || policy.externalBudgetKrw === null || policy.externalMaxCalls !== 1)) errors.push('외부 호출 사용에는 연결 이름·시간·비용 제한과 1회 한도가 필요해요.');
  return errors;
}

export function externalFallbackDecision(policy: AiPolicy, errorCode: AiErrorCode, grounded: boolean, callsUsed = 0) {
  const modelFailure = ['MODEL_FORMAT', 'MODEL_INTERPRETATION', 'MODEL_EXPLANATION'].includes(errorCode);
  const eligible = policy.externalEnabled && grounded && modelFailure && callsUsed === 0 && policy.externalMaxCalls === 1 && validateAiPolicy(policy).length === 0;
  return { eligible, reason: eligible ? '근거가 충분한 소형 모델 실패 부분에 한해 보완 가능 · 실제 호출 전' : !grounded ? '공개 근거 부족 · 자료 보완 필요' : !modelFailure ? '자료·연결·버전 오류는 대형 모델 보완 대상이 아님' : callsUsed > 0 ? '요청 전체의 외부 1회 한도 사용 완료' : '외부 보완이 꺼져 있거나 정책 한도 검수가 필요함' };
}

function getPolicy(state: AdminState, policyId: string) {
  const policy = state.ai.policies.find(value => value.policyId === policyId);
  if (!policy) throw new Error('정책을 찾을 수 없어요.');
  return policy;
}
function getIndex(state: AdminState, indexId: string) {
  const index = state.ai.indices.find(value => value.indexId === indexId);
  if (!index) throw new Error('색인 버전을 찾을 수 없어요.');
  return index;
}
function getJob(state: AdminState, jobId: string) {
  const job = state.ai.jobs.find(value => value.jobId === jobId);
  if (!job) throw new Error('색인 작업을 찾을 수 없어요.');
  return job;
}
function snapshotForJob(state: AdminState, mode: AiIndexJob['mode'], placeId?: string): AiDocumentRef[] {
  if (mode === 'FULL') return approvedDocuments(state).map(value => value.ref);
  const existing = effectiveIndexDocuments(state).filter(ref => ref.placeId !== placeId);
  const place = state.places.find(value => value.placeId === placeId);
  if (!place) throw new Error('장소를 찾을 수 없어요.');
  if (mode === 'REMOVAL') return existing;
  const ref = documentRef(place);
  if (!ref) throw new Error('공개·영업·좌표·AI 사용권 검수를 마친 자료만 재색인할 수 있어요.');
  return [...existing, ref];
}
function validateSnapshot(state: AdminState, index: AiIndexVersion): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const ref of index.documents) {
    if (ids.has(ref.placeId)) errors.push(`${ref.placeId}: 중복 자료`);
    ids.add(ref.placeId);
    const record = state.places.find(value => value.placeId === ref.placeId), current = record && documentRef(record);
    if (!current) errors.push(`${ref.placeId}: 비공개·영업 상태·좌표·사용권 변경`);
    else if (current.fingerprint !== ref.fingerprint || current.version !== ref.version) errors.push(`${ref.placeId}: 원문 변경 · 새 색인 필요`);
  }
  if (!index.embeddingProfile.trim()) errors.push('임베딩 연결 이름 누락');
  return errors;
}

/** A candidate prepared earlier must not discard documents applied by another job. */
export function indexActivationErrors(state: AdminState, indexId: string): string[] {
  const index = getIndex(state, indexId);
  const errors = validateSnapshot(state, index);
  const documents = new Set(index.documents.map(ref => `${ref.placeId}:${ref.version}:${ref.fingerprint}`));
  for (const ref of effectiveIndexDocuments(state)) {
    if (!documents.has(`${ref.placeId}:${ref.version}:${ref.fingerprint}`)) errors.push(`${ref.placeId}: 현재 색인에 반영된 자료 누락 · 현재 자료로 다시 준비`);
  }
  return errors;
}

function validateFixture(input: AiFixtureInput) {
  if (!input.title.trim() || !input.prompt.trim() || !input.region.trim()) throw new Error('시험 이름·운영자 작성 문장·지역을 입력해 주세요.');
  if (input.prompt.length > 4000) throw new Error('운영자 시험 문장은 4,000자 이내로 입력해 주세요.');
  if (!Number.isInteger(input.dayCount) || input.dayCount < 1 || input.dayCount > 7) throw new Error('시험 기간은 1~7일로 입력해 주세요.');
}

function publicCandidates(state: AdminState, indexId: string, region: string) {
  const indexedIds = new Set(effectiveIndexDocuments(state, indexId).map(ref => ref.placeId));
  return approvedDocuments(state).filter(value => indexedIds.has(value.place.placeId) && value.content.area.includes(region));
}

function draftVisits(state: AdminState, fixture: AiTestFixture, indexId: string): { visits: AiTestVisit[]; missing: string[] } {
  const candidates = publicCandidates(state, indexId, fixture.region);
  const landmarks = candidates.filter(value => value.content.kind === 'LANDMARK'), visits: AiTestVisit[] = [], missing: string[] = [];
  const nearby = (anchor: PlaceContent, kind: string) => candidates.filter(value => value.content.kind === kind && distanceKm(anchor, value.content) <= 3).sort((a, b) => distanceKm(anchor, a.content) - distanceKm(anchor, b.content))[0];
  const append = (item: (typeof candidates)[number], day: number, slot: AiTestVisit['slot'], bookingFixed = false) => visits.push({ visitId: `fixture-visit-${day}-${slot.toLowerCase()}`, placeId: item.place.placeId, kind: item.content.kind, name: item.content.name, day, slot, bookingFixed });
  if (!landmarks.length) return { visits, missing: ['공개 색인에 해당 지역의 랜드마크가 없어요.'] };
  if (fixture.channel === 'GUIDE') { append(landmarks[0], 1, 'MORNING'); return { visits, missing }; }
  for (let day = 1; day <= fixture.dayCount; day++) {
    const anchor = landmarks[(day - 1) % landmarks.length];
    append(anchor, day, 'MORNING');
    if (fixture.includeFood) { const food = nearby(anchor.content, 'FOOD'); if (food) append(food, day, 'LUNCH'); else missing.push(`DAY ${day}: 직선 3km 안의 공개 음식점 근거가 없어요.`); }
    if (landmarks.length > 1) append(landmarks[day % landmarks.length], day, 'AFTERNOON');
    if (fixture.includeStay && day < fixture.dayCount) { const stay = nearby(anchor.content, 'STAY'); if (stay) append(stay, day, 'LODGING', fixture.channel === 'REVISION' || fixture.channel === 'CHATBOT'); else missing.push(`DAY ${day}: 직선 3km 안의 공개 숙소 근거가 없어요.`); }
  }
  return { visits, missing };
}

/** Deterministic contract fixture, not LLM, semantic search, routing or customer trip execution. */
export function simulateAiFixture(state: AdminState, fixture: AiTestFixture, policy: AiPolicy, indexId: string, now: string): AiTestResult {
  const checks: AiTestResult['checks'] = [];
  const add = (label: string, passed: boolean, detail: string) => checks.push({ label, passed, detail });
  const policyErrors = validateAiPolicy(policy), index = state.ai.indices.find(value => value.indexId === indexId);
  const available = publicCandidates(state, indexId, fixture.region);
  const { visits: constructed, missing } = draftVisits(state, fixture, indexId);
  const revising = fixture.channel === 'REVISION' || fixture.channel === 'CHATBOT';
  const originalVisits = revising ? structuredClone(constructed) : [];
  let visits = structuredClone(constructed), errorCode: AiErrorCode = 'NONE';
  const enabled = fixture.channel === 'CHATBOT' || policy.channels.includes(fixture.channel);
  add('정책·지역·채널', policyErrors.length === 0 && enabled && policy.regions.includes(fixture.region), fixture.channel === 'CHATBOT' ? '후속 챗봇 합성 계약 시험 · 고객 채널 활성화 아님' : policyErrors.join(' / ') || '선택 기능과 사용 지역 확인');
  add('색인·임베딩 버전', !!index && ['ACTIVE', 'VERIFIED', 'ARCHIVED'].includes(index.state) && index.embeddingProfile === policy.embeddingProfile, index?.embeddingProfile === policy.embeddingProfile ? '같은 임베딩 프로필' : '검증된 색인과 정책의 임베딩 프로필을 맞춰 주세요.');
  add('현재 공개 근거', available.length > 0 && missing.length === 0, missing.join(' / ') || `현재 사용 가능한 공용 근거 ${available.length}건`);
  if (fixture.scenario === 'MISSING_DATA') { visits = []; errorCode = 'DATA_MISSING'; add('자료 부족 보류', false, '누락 시나리오 · 업체·좌표를 생성하지 않고 보류'); }
  if (fixture.scenario === 'CONNECTION_FAILURE') { errorCode = 'CONNECTION_FAILED'; add('연결 장애', false, '연결 실패 시나리오 · 외부 모델로 장애 우회하지 않음'); }
  if (fixture.scenario === 'MODEL_FORMAT') { errorCode = 'MODEL_FORMAT'; add('모델 출력 형식', false, '소형 출력 형식 오류 시나리오 · 외부 보완 자격만 판정'); }
  if (fixture.scenario === 'STALE_REVISION') { errorCode = 'REVISION_CONFLICT'; add('최신 여행 버전', false, '합성 여행 revision 7 / 요청 revision 6 · 병합·저장 차단'); }
  if (errorCode === 'NONE' && (!available.length || missing.length)) errorCode = 'DATA_MISSING';
  add('실제 자료 ID·사용권', visits.every(visit => available.some(value => value.place.placeId === visit.placeId)), '원본 DB의 현재 공개·영업·좌표·사용권과 대조');
  add('방문·식사·숙박 순서', visits.every((visit, i) => i === 0 || visit.day > visits[i - 1].day || ['MORNING', 'LUNCH', 'AFTERNOON', 'DINNER', 'LODGING'].indexOf(visit.slot) >= ['MORNING', 'LUNCH', 'AFTERNOON', 'DINNER', 'LODGING'].indexOf(visits[i - 1].slot)), '오전 → 점심 → 오후 → 저녁 → 숙박 · 이동 시간 계산 전');
  if (revising) {
    const first = visits.findIndex(visit => visit.day === 1 && !visit.bookingFixed && visit.slot === 'AFTERNOON');
    if (first >= 0) visits.splice(first, 1);
    add('고정 예약·다른 DAY 보호', originalVisits.filter(value => value.bookingFixed || value.day !== 1).every(value => visits.some(next => JSON.stringify(next) === JSON.stringify(value))), '합성 DAY 1의 오후 방문만 제외 · 예약 고정 및 DAY 2 보존');
  }
  const expected = fixture.expectedPlaceIds.every(placeId => visits.some(visit => visit.placeId === placeId));
  add('기대 장소 ID', expected, fixture.expectedPlaceIds.length ? `최종 제안과 대조: ${fixture.expectedPlaceIds.join(', ')}` : '추가 기대 ID 없음');
  add('고객 승인 전 저장 금지', true, '검수 결과만 보관 · 고객 여행·찜·공개·삭제 API 호출 0회');
  const fallback = externalFallbackDecision(policy, errorCode, available.length > 0 && missing.length === 0);
  const messages: AiTestResult['messages'] = fixture.channel === 'CHATBOT' ? [
    { role: 'USER', text: '[합성] 서울의 공개 장소를 추천해 줘.' },
    { role: 'ASSISTANT', text: `공개 근거 ${available.length}건을 확인했습니다. 장소 카드 확인 후 선택 버튼으로 찜할 수 있습니다. 현재 찜 변경은 없습니다.` },
    { role: 'USER', text: '[합성] 선택 장소로 일정 초안을 보여 줘.' },
    { role: 'ASSISTANT', text: `공통 생성 계약으로 ${fixture.dayCount}일 초안을 제안했습니다. 저장 버튼 승인 전입니다.` },
    { role: 'USER', text: '[합성] DAY 1만 조정해 줘.' },
    { role: 'ASSISTANT', text: '공통 부분 수정 계약으로 DAY 1 변경을 제안했습니다. 최신 revision과 예약 고정을 검사하고 적용 버튼 승인을 기다립니다.' },
  ] : [];
  const guideEvidence = fixture.channel === 'GUIDE' ? available.filter(value => visits.some(visit => visit.placeId === value.place.placeId)).map(value => ({ placeId: value.place.placeId, text: value.content.ai.text, sourceUrl: value.content.ai.sourceUrl, english: value.content.guide.englishStatus === 'REVIEWED' ? value.content.guide.english : '' })) : [];
  return { resultId: id('fixture-result'), fixtureId: fixture.fixtureId, fixtureRevision: fixture.revision, policyId: policy.policyId, indexId, createdAt: now, outcome: checks.every(value => value.passed) ? 'PASS' : errorCode === 'REVISION_CONFLICT' || errorCode === 'DATA_MISSING' || errorCode === 'CONNECTION_FAILED' ? 'BLOCKED' : 'FAIL', errorCode, checks, sources: effectiveIndexDocuments(state, indexId).filter(ref => available.some(value => value.place.placeId === ref.placeId)), visits, originalVisits, guideEvidence, messages, proposedRevision: 8, expectedRevision: fixture.scenario === 'STALE_REVISION' ? 6 : 7, externalCalls: 0, externalEligibility: fallback.eligible, externalReason: fallback.reason, localSimulation: true, saved: false };
}

export function applyAiCommand(state: AdminState, command: AiCommand, context: MutationContext): MutationOutcome {
  const { now } = context;
  switch (command.kind) {
    case 'ai.index.queue': {
      const embeddingProfile = (command.embeddingProfile || getPolicy(state, state.ai.activePolicyId).embeddingProfile).trim();
      if (!embeddingProfile) throw new Error('임베딩 연결 이름을 입력해 주세요.');
      if (command.mode !== 'FULL' && getIndex(state, state.ai.activeIndexId).embeddingProfile !== embeddingProfile) throw new Error('임베딩 변경은 전체 후보 색인으로 검증해야 해요.');
      const documents = snapshotForJob(state, command.mode, command.placeId), indexId = id('idx'), jobId = id('job');
      state.ai.indices.unshift({ indexId, label: `${command.mode === 'FULL' ? '전체 재구성' : command.mode === 'REMOVAL' ? '자료 제거' : '문서 갱신'}`, embeddingProfile, state: 'CANDIDATE', documents, createdAt: now, localSimulation: true, validationErrors: [] });
      state.ai.jobs.unshift({ jobId, indexId, mode: command.mode, placeId: command.placeId, state: 'QUEUED', attempts: 0, createdAt: now, updatedAt: now, localSimulation: true });
      return { message: '색인 작업을 대기에 추가했어요.', targetId: jobId, after: 'QUEUED' };
    }
    case 'ai.index.run': {
      const job = getJob(state, command.jobId), index = getIndex(state, job.indexId), before = job.state;
      if (!['QUEUED', 'RUNNING'].includes(job.state)) throw new Error('대기 또는 실행 중인 작업만 진행할 수 있어요.');
      if (command.simulateFailure) { job.state = 'FAILED'; job.error = '운영자 선택 실패 시나리오 · 실제 연결 오류 아님'; index.state = 'FAILED'; }
      else if (job.state === 'QUEUED') { job.state = 'RUNNING'; job.attempts += 1; }
      else { job.state = 'VALIDATION_PENDING'; index.state = 'CANDIDATE'; }
      job.updatedAt = now;
      return { message: job.state === 'FAILED' ? '실패 상태를 기록했어요. 현재 색인은 유지해요.' : job.state === 'RUNNING' ? '실행 단계로 이동했어요.' : '검증 대기에 들어갔어요.', targetId: job.jobId, before, after: job.state };
    }
    case 'ai.index.retry': {
      const job = getJob(state, command.jobId), index = getIndex(state, job.indexId);
      const before = job.state;
      const staleVerified = job.state === 'VALIDATION_PENDING' && index.state === 'VERIFIED' && indexActivationErrors(state, index.indexId).length > 0;
      if (job.state !== 'FAILED' && !staleVerified) throw new Error('실패 작업 또는 현재 자료와 달라진 검증 후보만 다시 준비할 수 있어요.');
      if (job.mode !== 'FULL' && getIndex(state, state.ai.activeIndexId).embeddingProfile !== index.embeddingProfile) throw new Error('임베딩 변경은 전체 후보 색인으로 검증해야 해요.');
      index.documents = snapshotForJob(state, job.mode, job.placeId); index.state = 'CANDIDATE'; index.validationErrors = []; delete index.verifiedAt;
      job.state = 'QUEUED'; delete job.error; job.updatedAt = now;
      return { message: '현재 공개 자료로 작업을 다시 준비했어요.', targetId: job.jobId, before, after: 'QUEUED' };
    }
    case 'ai.index.verify': {
      const index = getIndex(state, command.indexId), job = state.ai.jobs.find(value => value.indexId === index.indexId);
      if (!job || job.state !== 'VALIDATION_PENDING') throw new Error('실행을 마친 검증 대기 작업을 선택해 주세요.');
      const errors = validateSnapshot(state, index); index.validationErrors = errors;
      if (errors.length) { index.state = 'FAILED'; job.state = 'FAILED'; job.error = errors.join(' / '); }
      else { index.state = 'VERIFIED'; index.verifiedAt = now; }
      job.updatedAt = now;
      return { message: errors.length ? '자료 검증 실패를 기록했어요. 현재 색인은 유지해요.' : '자료·사용권·버전 검증을 통과했어요.', targetId: index.indexId, after: index.state };
    }
    case 'ai.index.activate':
    case 'ai.index.rollback': {
      requireAdmin(context);
      const index = getIndex(state, command.indexId), before = state.ai.activeIndexId;
      if (command.kind === 'ai.index.activate') {
        if (index.state !== 'VERIFIED' || !index.verifiedAt) throw new Error('검증을 통과한 후보 색인만 적용할 수 있어요.');
        const errors = indexActivationErrors(state, index.indexId); if (errors.length) throw new Error('검증 뒤 자료 또는 현재 색인이 변경됐어요. 현재 자료로 다시 준비해 주세요. ' + errors.join(' / '));
      } else if (index.state !== 'ARCHIVED' || !index.verifiedAt || !index.appliedAt) throw new Error('이전에 적용한 정상 색인만 복구할 수 있어요.');
      const active = getIndex(state, state.ai.activeIndexId); active.state = 'ARCHIVED'; index.state = 'ACTIVE'; index.appliedAt = now; state.ai.activeIndexId = index.indexId;
      const job = state.ai.jobs.find(value => value.indexId === index.indexId); if (job) { job.state = 'APPLIED'; job.updatedAt = now; }
      return { message: command.kind === 'ai.index.rollback' ? '이전 색인 설정으로 복구했어요.' : '검증한 색인 설정을 적용했어요.', targetId: index.indexId, before, after: index.indexId };
    }
    case 'ai.fixture.save': {
      validateFixture(command.fixture);
      const existing = command.fixtureId && state.ai.fixtures.find(value => value.fixtureId === command.fixtureId);
      if (command.fixtureId && !existing) throw new Error('시험 문장을 찾을 수 없어요.');
      if (existing && command.entityRevision !== undefined && command.entityRevision !== existing.revision) throw new Error('다른 창에서 시험 조건이 변경됐어요. 보존된 입력을 확인한 뒤 최신 시험과 비교해 주세요.');
      const fixture = { ...structuredClone(command.fixture), fixtureId: existing ? existing.fixtureId : id('fixture'), revision: existing ? existing.revision + 1 : 1, source: 'OPERATOR_SYNTHETIC' as const };
      if (existing) state.ai.fixtures[state.ai.fixtures.indexOf(existing)] = fixture; else state.ai.fixtures.unshift(fixture);
      return { message: '운영자가 작성한 합성 시험을 저장했어요. 고객 원문은 수집하지 않아요.', targetId: fixture.fixtureId, after: `revision ${fixture.revision}` };
    }
    case 'ai.fixture.run': {
      const fixture = state.ai.fixtures.find(value => value.fixtureId === command.fixtureId); if (!fixture) throw new Error('시험을 찾을 수 없어요.');
      const policy = getPolicy(state, command.policyId || state.ai.activePolicyId), indexId = command.indexId || state.ai.activeIndexId;
      getIndex(state, indexId);
      const result = simulateAiFixture(state, fixture, policy, indexId, now); state.ai.results.unshift(result);
      state.ai.requests.unshift({ requestId: id('request-fixture'), channel: fixture.channel, state: result.outcome === 'PASS' ? 'SUCCESS' : 'FAILED', stage: result.errorCode === 'DATA_MISSING' ? 'SEARCH' : result.errorCode === 'REVISION_CONFLICT' ? 'VALIDATE' : result.errorCode === 'CONNECTION_FAILED' ? 'TOOL' : 'COMPOSE', modelProfile: '실제 모델 호출 없음 · 결정형 계약 시험', policyId: policy.policyId, indexId, errorCode: result.errorCode, sourcePlaceIds: result.sources.map(value => value.placeId), latencyMs: null, externalCostKrw: null, fallbackReason: result.externalReason, createdAt: now, localSimulation: true });
      return { message: `시험 결과: ${result.outcome === 'PASS' ? '통과' : result.outcome === 'BLOCKED' ? '보류' : '실패'}`, targetId: result.resultId, after: result.outcome };
    }
    case 'ai.feedback.add': {
      if (!state.ai.results.some(value => value.resultId === command.resultId)) throw new Error('시험 결과를 찾을 수 없어요.');
      if (!command.note.trim()) throw new Error('오류 평가 내용을 입력해 주세요.');
      const feedbackId = id('feedback'); state.ai.feedback.unshift({ feedbackId, resultId: command.resultId, category: command.category, note: command.note.trim(), state: 'OPEN', createdAt: now });
      return { message: '합성 시험의 오답 평가를 등록했어요.', targetId: feedbackId, after: 'OPEN', reason: command.note.trim() };
    }
    case 'ai.feedback.resolve': {
      const feedback = state.ai.feedback.find(value => value.feedbackId === command.feedbackId); if (!feedback || feedback.state !== 'OPEN') throw new Error('미처리 평가를 선택해 주세요.');
      feedback.state = 'RESOLVED'; return { message: '평가를 처리 완료로 표시했어요.', targetId: feedback.feedbackId, before: 'OPEN', after: 'RESOLVED' };
    }
    case 'ai.policy.save': {
      requireAdmin(context);
      const previous = command.policyId ? getPolicy(state, command.policyId) : undefined;
      if (previous && command.entityRevision !== undefined && command.entityRevision !== previous.version) throw new Error('다른 창에서 정책 초안이 변경됐어요. 보존된 입력을 확인한 뒤 최신 정책과 비교해 주세요.');
      const updateDraft = previous && previous.state === 'DRAFT';
      const policyId = updateDraft ? previous.policyId : id('policy');
      const policy: AiPolicy = { ...structuredClone(command.policy), policyId, version: Math.max(0, ...state.ai.policies.map(value => value.version)) + 1, state: 'DRAFT', createdAt: now, validationErrors: [] };
      if (updateDraft) state.ai.policies[state.ai.policies.indexOf(previous)] = policy; else state.ai.policies.unshift(policy);
      return { message: '정책 초안을 저장했어요. 현재 적용 정책은 유지해요.', targetId: policyId, after: 'DRAFT' };
    }
    case 'ai.policy.test': {
      requireAdmin(context);
      const policy = getPolicy(state, command.policyId);
      if (!['DRAFT', 'TESTED'].includes(policy.state)) throw new Error('초안 정책을 먼저 저장해 주세요.');
      policy.validationErrors = validateAiPolicy(policy);
      const compatibleIndex = state.ai.indices.some(index => ['ACTIVE', 'VERIFIED'].includes(index.state) && index.embeddingProfile === policy.embeddingProfile);
      if (!compatibleIndex) policy.validationErrors.push('같은 임베딩 프로필의 현재 또는 검증된 후보 색인이 필요해요.');
      policy.state = policy.validationErrors.length ? 'DRAFT' : 'TESTED'; policy.testedAt = now; policy.testedFingerprint = policyFingerprint(policy);
      return { message: policy.validationErrors.length ? '정책 검수에서 오류를 찾았어요. 현재 정책은 유지해요.' : '정책 규칙 검증을 통과했어요.', targetId: policy.policyId, after: policy.state };
    }
    case 'ai.policy.activate':
    case 'ai.policy.rollback': {
      requireAdmin(context);
      const policy = getPolicy(state, command.policyId), before = state.ai.activePolicyId, errors = validateAiPolicy(policy);
      if (errors.length) throw new Error(errors.join(' / '));
      if (command.kind === 'ai.policy.activate' && (policy.state !== 'TESTED' || !policy.testedAt || policy.testedFingerprint !== policyFingerprint(policy))) throw new Error('저장 후 규칙 검수를 통과한 정책만 적용할 수 있어요.');
      if (command.kind === 'ai.policy.rollback' && policy.state !== 'ARCHIVED') throw new Error('이전에 적용한 정상 정책만 복구할 수 있어요.');
      if (getIndex(state, state.ai.activeIndexId).embeddingProfile !== policy.embeddingProfile) throw new Error('먼저 같은 임베딩 프로필의 검증 색인을 적용해 주세요.');
      getPolicy(state, state.ai.activePolicyId).state = 'ARCHIVED'; policy.state = 'ACTIVE'; state.ai.activePolicyId = policy.policyId;
      return { message: command.kind === 'ai.policy.rollback' ? '이전 정책 설정으로 복구했어요.' : '검증한 정책 설정을 적용했어요.', targetId: policy.policyId, before, after: policy.policyId };
    }
    case 'ai.pause': {
      requireAdmin(context); const before = state.ai.paused; state.ai.paused = command.paused;
      return { message: command.paused ? '검수용 생성 상태를 일시 중지했어요. 기존 여행 저장·열람은 독립적으로 유지해요.' : '검수용 생성 상태를 재개했어요. 실제 AI 서비스 연결 전이에요.', targetId: 'ai-generation', before: String(before), after: String(command.paused) };
    }
  }
}
