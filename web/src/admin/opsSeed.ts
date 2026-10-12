import type { OpsPopularitySnapshot, OpsState } from './opsTypes';

export function makeOpsPopularitySeed(): OpsPopularitySnapshot {
  return { basis: 'SAVES', source: 'SAMPLE', observedAt: '2026-10-09T00:00:00.000Z', items: [
    { targetType: 'PLACE', targetId: 'jeju-hyeopjae', saveCount: 384 },
    { targetType: 'PLACE', targetId: 'gangneung-anmok', saveCount: 321 },
    { targetType: 'PLACE', targetId: 'seoul-seoulforest', saveCount: 242 },
    { targetType: 'PLACE', targetId: 'busan-gamcheon', saveCount: 216 },
    { targetType: 'PLACE', targetId: 'review-landmark', saveCount: 128 },
    { targetType: 'PLACE', targetId: 'review-landmark-2', saveCount: 96 },
    { targetType: 'PLACE', targetId: 'review-food', saveCount: 74 },
    { targetType: 'PLACE', targetId: 'review-cafe', saveCount: 61 },
    { targetType: 'JOURNAL', targetId: 'review-journal-1', saveCount: 42 },
  ] };
}

/** Synthetic records for isolated administrator review; never reads customer storage. */
export function makeOpsSeed(): OpsState {
  const seed: OpsState = {
    popularity: makeOpsPopularitySeed(),
    exposures: [], curatedTrips: [{ curatedTripId: 'review-curated-1', revision: 1, title: '운영 일정 검수 예시', introduction: '공개 운영 콘텐츠를 고르는 예시입니다.', placeIds: [], visibility: 'PRIVATE' }],
    journals: [
      { journalId: 'review-journal-1', revision: 1, title: '샘플 여행기 · 바다 산책', original: '사진을 보며 천천히 걸었던 날입니다. 실제 회원의 기록이 아닌 운영 검수용 글입니다.', english: 'A slow walk by the sea. This is a synthetic review journal.', authorId: 'review-member-1', ownerVisibility: 'PUBLIC', moderation: 'VISIBLE', createdAt: '2026-10-04T04:00:00.000Z', cards: [{ cardId: 'review-card-1', placeId: 'review-landmark', name: '샘플 장소 카드 A', original: '조용히 둘러본 장소입니다.', english: 'A place for a quiet walk.' }, { cardId: 'review-card-2', placeId: 'review-landmark', name: '샘플 장소 카드 B · 같은 장소', original: '같은 장소라도 카드의 대화는 따로 보존합니다.', english: 'Conversations remain separate for each card.' }], translation: { sourceRevision: 1, status: 'SAMPLE', note: '검수용 영어 예시' } },
      { journalId: 'review-journal-2', revision: 1, title: '샘플 여행기 · 작성자가 비공개 전환', original: '', english: '', authorId: 'review-member-2', ownerVisibility: 'PRIVATE', moderation: 'HIDDEN', createdAt: '2026-10-03T04:00:00.000Z', cards: [], translation: { sourceRevision: 1, status: 'REVIEW', note: '비공개 원문은 관리자 기본 조회에서 제외' } },
    ],
    comments: [
      { commentId: 'review-comment-1', revision: 1, journalId: 'review-journal-1', authorId: 'review-member-2', original: '전체 여행기에 남기는 샘플 댓글입니다.', english: 'A sample comment on the whole journal.', createdAt: '2026-10-04T05:00:00.000Z', moderation: 'VISIBLE' },
      { commentId: 'review-comment-2', revision: 1, journalId: 'review-journal-1', cardId: 'review-card-1', authorId: 'review-member-2', original: '첫 번째 카드에 남기는 샘플 댓글입니다.', english: 'A sample comment on the first card.', createdAt: '2026-10-04T05:05:00.000Z', moderation: 'VISIBLE' },
      { commentId: 'review-comment-3', revision: 1, journalId: 'review-journal-1', cardId: 'review-card-1', parentId: 'review-comment-2', authorId: 'review-member-1', original: '첫 번째 카드 댓글의 샘플 답글입니다.', english: 'A sample reply to the first card comment.', createdAt: '2026-10-04T05:10:00.000Z', moderation: 'VISIBLE' },
      { commentId: 'review-comment-4', revision: 1, journalId: 'review-journal-1', cardId: 'review-card-2', authorId: 'review-member-2', original: '두 번째 카드만의 댓글입니다.', english: 'A separate comment on the second card.', createdAt: '2026-10-04T05:07:00.000Z', moderation: 'VISIBLE' },
    ],
    reports: [
      { reportId: 'review-report-1', revision: 1, targetType: 'COMMENT', targetId: 'review-comment-2', journalId: 'review-journal-1', cardId: 'review-card-1', category: 'CONTENT', original: '댓글 내용 검수가 필요하다는 샘플 신고입니다.', status: 'OPEN', createdAt: '2026-10-04T06:00:00.000Z', decision: '' },
      { reportId: 'review-report-2', revision: 1, targetType: 'JOURNAL', targetId: 'review-journal-1', journalId: 'review-journal-1', category: 'COPYRIGHT', original: '사진 권리 확인을 요청하는 샘플 이의입니다.', status: 'OPEN', createdAt: '2026-10-04T07:00:00.000Z', decision: '' },
      { reportId: 'review-report-3', revision: 1, targetType: 'PROFILE', targetId: 'review-member-2', category: 'INFORMATION', original: '공개 프로필 점검 요청 예시', status: 'OPEN', createdAt: '2026-10-04T08:00:00.000Z', decision: '' },
    ],
    members: [
      { memberId: 'review-member-1', revision: 1, name: '검수 회원 A', publicIntroduction: '바다와 산책을 좋아하는 샘플 공개 프로필', icon: 'A', state: 'ACTIVE', warnings: [], publicActivity: { journals: null, followers: null }, notificationOptOut: false },
      { memberId: 'review-member-2', revision: 1, name: '검수 회원 B', publicIntroduction: '실제 개인 일정과 메모는 포함하지 않습니다.', icon: 'B', state: 'ACTIVE', warnings: [], publicActivity: { journals: null, followers: null }, notificationOptOut: true, deletionRequest: { requestedAt: '2026-10-04T08:00:00.000Z', status: 'RECEIVED' } },
    ],
    inquiries: [{ inquiryId: 'review-inquiry-1', revision: 1, subject: '샘플 문의 · 사진 사용 조건', original: '장소 사진의 출처를 어디에서 확인할 수 있나요?', memberId: 'review-member-1', status: 'OPEN', assigneeId: 'review-operator', replyRecords: [] }],
    operators: [
      { operatorId: 'operator-admin', revision: 1, name: '내부 관리자', role: 'ADMIN', active: true, sessions: [{ sessionId: 'review-session-admin', status: 'ACTIVE' }] },
      { operatorId: 'review-operator', revision: 1, name: '검수 운영자', role: 'OPERATOR', active: true, sessions: [{ sessionId: 'review-session-operator', status: 'ACTIVE' }] },
    ],
    references: [
      { referenceId: 'review-region-1', revision: 1, category: 'REGION', name: '부산', value: 'BUSAN', enabled: true },
      { referenceId: 'review-category-1', revision: 1, category: 'CATEGORY', name: '랜드마크', value: 'LANDMARK', enabled: true },
      { referenceId: 'review-tag-1', revision: 1, category: 'TAG', name: '산책', value: 'walk', enabled: true },
      { referenceId: 'review-glossary-1', revision: 1, category: 'GLOSSARY', name: '여행기', value: 'Travel journal', enabled: true },
      { referenceId: 'review-grade-1', revision: 1, category: 'GRADE', name: '등급 기준 검수 초안', value: '실제 집계 연결 후 적용할 기준을 작성하세요.', enabled: false },
      { referenceId: 'review-announcement-1', revision: 1, category: 'ANNOUNCEMENT', name: '서비스 안내 예시', value: '현재 관리자 화면은 독립된 로컬 검수본입니다.', enabled: true },
    ],
    templates: [{ templateId: 'review-template-1', revision: 1, title: '문의 처리 안내', body: '접수하신 문의의 처리 상태가 변경되었습니다.', enabled: true }],
    notifications: [
      { notificationId: 'review-notification-1', revision: 1, memberId: 'review-member-1', templateId: 'review-template-1', dedupeKey: 'review-inquiry-1', status: 'FAILED', attempts: 1, error: '샘플 발송 실패 · 실제 알림 서버 미연결' },
      { notificationId: 'review-notification-2', revision: 1, memberId: 'review-member-2', templateId: 'review-template-1', dedupeKey: 'review-opt-out', status: 'OPTED_OUT', attempts: 0, error: '수신 거부' },
      { notificationId: 'review-notification-3', revision: 1, memberId: 'review-member-1', templateId: 'review-template-1', dedupeKey: 'review-inquiry-1', status: 'DUPLICATE', attempts: 0, error: '중복 요청' },
    ],
    connections: ['지도 SDK', '주소 조회', '경로 계산', '외부 업체 검색', '사진 저장소', '알림 발송', '회원 인증', '팔로우', '받은 알림함', '서비스 DB', '맥미니 RAG', '소형 로컬 LLM', '임베딩 AI', '외부 대형 LLM', 'Flowise'].map((name, index) => ({ connectionId: `review-connection-${index}`, name, configured: false, status: 'UNCONNECTED' as const, scope: index === 7 || index === 8 ? 'FOLLOW_UP' as const : 'CURRENT' as const, limit: null, unit: '월 요청', detail: index === 7 || index === 8 ? '후속 문의 기능 범위 · 실제 서비스 상태는 미연결' : '로컬 검수 환경 · 실제 서비스 연결 없음' })),
    supplyJobs: [{ jobId: 'review-supply-1', source: '권리 검수 샘플 자료', status: 'FAILED', error: '확인일 누락 · 자동 수급 미연결', retryReviews: 0 }],
    trash: [
      { trashId: 'review-trash-trip', revision: 1, kind: 'TRIP', ownerId: 'review-member-1', deletedAt: '2026-09-30T15:00:00.000Z', status: 'TRASHED', mediaIds: ['review-shared-media'] },
      { trashId: 'review-trash-journal', revision: 1, kind: 'JOURNAL', ownerId: 'review-member-1', deletedAt: '2026-09-30T15:00:00.000Z', status: 'TRASHED', mediaIds: ['review-shared-media'] },
      { trashId: 'review-trash-expired', revision: 1, kind: 'TRIP', ownerId: 'review-member-2', deletedAt: '2025-08-31T14:00:00.000Z', status: 'EXPIRED', mediaIds: [] },
    ],
    mediaCleanup: [
      { mediaId: 'review-shared-media', revision: 1, references: [{ targetId: 'review-trash-trip', kind: 'TRIP' }, { targetId: 'review-trash-journal', kind: 'JOURNAL' }], status: 'WAITING', note: '다른 기록에서 사용하는 샘플 사진' },
      { mediaId: 'review-orphan-media', revision: 1, references: [], status: 'WAITING', note: '참조 없는 샘플 파일 · 실제 파일 삭제 기능 미연결' },
    ],
  };
  for (const journal of seed.journals) {
    journal.sourceKind = 'SYNTHETIC'; journal.authorName = seed.members.find(member => member.memberId === journal.authorId)?.name;
    if (journal.ownerVisibility === 'PUBLIC') {
      journal.metrics = { cheers: 3, copies: null, views: null, source: 'SAMPLE' };
      for (const [index, card] of journal.cards.entries()) { card.image = '/admin-review.svg'; card.likes = index + 1; card.description = '합성 검수 샘플 장소 사진과 본문입니다.'; card.sourceCredit = { provider: 'Spotlog 로컬 검수 도안', sourceUrl: '', license: '검수용 합성 자료' }; }
    }
  }
  for (const member of seed.members) { member.avatarUrl = '/admin-review.svg'; member.grade = null; member.sourceKind = 'SYNTHETIC'; member.publicActivity = { ...member.publicActivity, copies: null, views: null, source: 'SAMPLE' }; }
  for (const comment of seed.comments) comment.sourceKind = 'SYNTHETIC';
  return seed;
}
