import type { TogetherState } from '../src/together/model';
import { koreaDay, shiftDay } from '../src/together/discovery.ts';
import { DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples.ts';
import { togetherStorageKey } from '../src/together/repository.ts';

export const MEMBERSHIP_REVIEW_ACCOUNT = 'membership-flow-review-20261028';
export const MEMBERSHIP_REVIEW_KEY = togetherStorageKey(MEMBERSHIP_REVIEW_ACCOUNT);
export const MEMBERSHIP_REVIEW_GROUP = 'membership-review-club';
export const MEMBERSHIP_REVIEW_ACTIVITY = 'membership-review-coffee';
export const MEMBERSHIP_REVIEW_ROLES = {
  applicant: { id: 'review-applicant', name: '수아' },
  owner: { id: 'review-owner', name: '지민' },
  member: { id: 'review-member', name: '도윤' },
} as const;

/** Fictional shared fixture only. No customer records or authentication are read. */
export function createMembershipReviewState(now = new Date()): TogetherState {
  const date = shiftDay(koreaDay(now), 1), createdAt = now.toISOString();
  const activity: TogetherState['activities'][number] = {
    id: MEMBERSHIP_REVIEW_ACTIVITY, groupId: MEMBERSHIP_REVIEW_GROUP, kind: 'MEETUP',
    title: '퇴근 후 커피와 책 이야기', date, endDate: date, startTime: '19:30', capacity: 6,
    meetingPoint: '내부 집합 장소 확인', description: '각자 읽는 책 한 권과 근황을 나눠요. 책을 다 읽지 않아도, 처음 참석해도 괜찮아요.',
    status: 'PLANNED', leadId: MEMBERSHIP_REVIEW_ROLES.owner.id, editorIds: [],
    participants: { 'review-owner': 'JOINED', 'review-member': 'JOINED' }, arrivedIds: [], revision: 1,
  };
  return {
    schemaVersion: 1, discoveryCatalogVersion: DISCOVERY_CATALOG_VERSION,
    members: Object.values(MEMBERSHIP_REVIEW_ROLES).map(member => ({ ...member })),
    groups: [{
      id: MEMBERSHIP_REVIEW_GROUP, name: '동네 한 잔과 취미 친구', kind: 'HOBBY', region: '서울', introduction: '동네에서 커피 한 잔, 책 한 권, 가벼운 이야기를 함께 나누는 모임이에요.',
      cover: '', sourceKind: 'EXAMPLE', visibility: 'PUBLIC', ownerId: MEMBERSHIP_REVIEW_ROLES.owner.id,
      memberIds: [MEMBERSHIP_REVIEW_ROLES.owner.id, MEMBERSHIP_REVIEW_ROLES.member.id], managerIds: [], archived: false,
      promotionPublished: true, promotionActivityIds: [activity.id], interestPlaceIds: [],
      discovery: { topics: ['SOCIAL', 'CAFE', 'BOOK'], district: '성동구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '처음 오셔도 괜찮아요. 좋아하는 책과 동네 이야기를 편하게 나눠요.', joinGuide: '짧은 인사와 함께 가입을 신청해 주세요. 모임장 확인 후 가입할 수 있고, 개별 일정 참석은 따로 선택해요.' },
      promotionActivitySnapshots: [{ id: activity.id, groupId: activity.groupId, title: activity.title, date: activity.date, endDate: activity.endDate, description: activity.description, status: activity.status, kind: 'MEETUP', startTime: '19:30' }],
    }],
    activities: [activity],
    messages: [
      { id: 'membership-review-message-1', roomId: `group:${MEMBERSHIP_REVIEW_GROUP}`, authorId: 'review-owner', body: '반가워요! 처음 오신 분은 편하게 인사하고 참석할 일정을 골라 주세요.', createdAt },
      { id: 'membership-review-message-2', roomId: `group:${MEMBERSHIP_REVIEW_GROUP}`, authorId: 'review-member', body: '책을 완독하지 않아도 이야기 나눌 수 있어서 좋아요.', createdAt },
      { id: 'membership-review-message-3', roomId: `activity:${activity.id}`, authorId: 'review-owner', body: '저녁 7시 30분에 만나요. 늦는 분은 이 일정 채팅에 알려 주세요.', createdAt },
    ],
    notices: [{ id: 'membership-review-welcome', groupId: MEMBERSHIP_REVIEW_GROUP, title: '처음 함께하는 분께', body: '서로의 취향을 존중하고, 참석이 어려워지면 일정에서 참석 취소를 눌러 주세요.', createdAt }],
    tasks: [{ id: 'membership-review-task', groupId: MEMBERSHIP_REVIEW_GROUP, activityId: activity.id, title: '이야기 나눌 책 한 권 챙기기', completed: false, assigneeId: 'review-member' }],
    posts: [{ id: 'membership-review-post', groupId: MEMBERSHIP_REVIEW_GROUP, authorId: 'review-member', title: '요즘 읽는 책을 소개해요', body: '각자 읽는 속도는 달라도 함께 이야기하면 더 즐거워요.', category: 'FREE', likes: [], comments: [], createdAt }],
    polls: [], media: [], invites: [], applications: [], sharedJournals: [], readCursors: {}, mutedRooms: [], reports: [],
  };
}
export function membershipReviewPhase(state: TogetherState): '신청 전' | '승인 대기' | '가입 완료' | '신청 종료' {
  if (state.groups.find(group => group.id === MEMBERSHIP_REVIEW_GROUP)?.memberIds.includes('review-applicant')) return '가입 완료';
  const application = state.applications.find(item => item.groupId === MEMBERSHIP_REVIEW_GROUP && item.userId === 'review-applicant');
  return application?.status === 'PENDING' ? '승인 대기' : application?.status === 'DECLINED' ? '신청 종료' : '신청 전';
}

/** A hard key boundary prevents the review adapter from touching other session data. */
export function membershipReviewStorage(storage: Storage): Storage {
  const assertKey = (key: string) => { if (key !== MEMBERSHIP_REVIEW_KEY) throw new Error('이 검수 화면의 저장소만 사용할 수 있어요.'); };
  return {
    get length() { return storage.getItem(MEMBERSHIP_REVIEW_KEY) === null ? 0 : 1; },
    key: index => index === 0 && storage.getItem(MEMBERSHIP_REVIEW_KEY) !== null ? MEMBERSHIP_REVIEW_KEY : null,
    getItem: key => { assertKey(key); return storage.getItem(key); },
    setItem: (key, value) => { assertKey(key); storage.setItem(key, value); },
    removeItem: key => { assertKey(key); storage.removeItem(key); },
    clear: () => { throw new Error('전체 저장소를 초기화할 수 없어요.'); },
  };
}
