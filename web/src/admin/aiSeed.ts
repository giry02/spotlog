import type { AiState } from './aiTypes';

export function makeAiSeed(): AiState {
  const createdAt = '2026-10-05T00:00:00.000Z';
  return {
    activeIndexId: 'idx-local-empty',
    activePolicyId: 'policy-local-1',
    paused: false,
    indices: [{ indexId: 'idx-local-empty', label: '초기 색인 · 자료 0건', embeddingProfile: 'local-embedding-review', state: 'ACTIVE', documents: [], createdAt, verifiedAt: createdAt, appliedAt: createdAt, localSimulation: true, validationErrors: [] }],
    jobs: [],
    policies: [{ policyId: 'policy-local-1', label: '소형 LLM 우선', version: 1, state: 'ACTIVE', smallLocalProfile: 'mac-mini-small-review', embeddingProfile: 'local-embedding-review', externalProfile: 'external-fallback-unconnected', flowiseProfile: 'flowise-unconnected', promptVersion: 'spotlog-small-v1', regions: ['서울', '부산', '제주', '강릉', '경주'], channels: ['SIMPLE', 'SAVED', 'REVISION', 'GUIDE'], externalEnabled: false, externalMaxCalls: 1, timeoutMs: 30000, externalBudgetKrw: 100, createdAt, testedAt: createdAt, validationErrors: [] }],
    fixtures: [
      { fixtureId: 'fixture-simple', title: '간단 생성 · 식사 순서', prompt: '[운영자 작성 예시] 서울 당일 여행, 점심을 포함한 일정 초안을 확인한다.', channel: 'SIMPLE', region: '서울', dayCount: 1, includeFood: true, includeStay: false, expectedPlaceIds: [], scenario: 'NORMAL', source: 'OPERATOR_SYNTHETIC', revision: 1 },
      { fixtureId: 'fixture-saved', title: '저장 장소 추천 · 공개 자료만', prompt: '[운영자 작성 예시] 공개된 저장 장소 후보에서 서울 일정을 구성한다.', channel: 'SAVED', region: '서울', dayCount: 1, includeFood: false, includeStay: false, expectedPlaceIds: [], scenario: 'NORMAL', source: 'OPERATOR_SYNTHETIC', revision: 1 },
      { fixtureId: 'fixture-revision', title: '부분 수정 · 예약 고정 보호', prompt: '[운영자 작성 예시] DAY 1 방문을 조정하면서 고정 숙소와 DAY 2를 유지한다.', channel: 'REVISION', region: '서울', dayCount: 2, includeFood: true, includeStay: true, expectedPlaceIds: [], scenario: 'NORMAL', source: 'OPERATOR_SYNTHETIC', revision: 1 },
      { fixtureId: 'fixture-guide', title: '관광 안내 · 공개 근거', prompt: '[운영자 작성 예시] 공개 자료의 방문 안내와 출처를 확인한다.', channel: 'GUIDE', region: '서울', dayCount: 1, includeFood: false, includeStay: false, expectedPlaceIds: [], scenario: 'NORMAL', source: 'OPERATOR_SYNTHETIC', revision: 1 },
      { fixtureId: 'fixture-chatbot', title: '챗봇 후속 · 다중 대화 계약', prompt: '[운영자 작성 예시] 장소 추천 → 일정 초안 → 특정 DAY 수정. 고객의 적용 전까지 저장하지 않는다.', channel: 'CHATBOT', region: '서울', dayCount: 2, includeFood: true, includeStay: false, expectedPlaceIds: [], scenario: 'NORMAL', source: 'OPERATOR_SYNTHETIC', revision: 1 },
    ],
    results: [],
    requests: [],
    feedback: [],
  };
}
