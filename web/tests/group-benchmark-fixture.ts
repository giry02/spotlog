import type { Place } from '../src/data';
import type { TogetherGroup, TogetherState } from '../src/together/model';

export const GROUP_BENCHMARK_OWNER = 'spotlog-local-review-member';
export const GROUP_BENCHMARK_IDS = { golf: 'benchmark-golf-example', legacy: 'benchmark-legacy-sports', pending: 'benchmark-pending-member' } as const;

/** Installs authored examples only in platform-review's isolated in-memory state. No storage or network access. */
export function installGroupBenchmarkExamples(state: TogetherState, ownerId: string, places: readonly Place[], at = new Date()): void {
  const family = state.groups.find(group => group.id === 'family-busan' && group.ownerId === GROUP_BENCHMARK_OWNER);
  const publicGroup = state.groups.find(group => group.id === 'membership-review-club' && group.sourceKind === 'EXAMPLE' && group.ownerId === GROUP_BENCHMARK_OWNER);
  if (ownerId !== GROUP_BENCHMARK_OWNER || !family || !publicGroup) throw new Error('격리된 모임 화면 자료에서만 예시를 준비할 수 있어요.');
  publicGroup.discovery = { ...publicGroup.discovery!, subtopics: ['SOCIAL_NEIGHBORS', 'CAFE_COFFEE', 'BOOK_FREE'] };
  publicGroup.joinFields = { welcome: '책을 다 읽지 않아도 괜찮아요. 서로의 이야기를 존중해요.', questions: [{ id: 'activity', label: '함께해 보고 싶은 활동은 무엇인가요?' }, { id: 'first-meeting', label: '첫 모임에서 궁금한 점이 있나요?' }], availableTimes: ['WEEKDAY_EVENING', 'WEEKEND_DAY'] };
  const joinProfile = { nickname: '책과 커피', introduction: '퇴근 후 가볍게 책 이야기를 나누고 싶어요.', answers: [{ questionId: 'activity', question: '함께해 보고 싶은 활동은 무엇인가요?', answer: '각자의 책을 읽고 기억에 남은 문장 하나를 소개하고 싶어요.' }], availableTimes: ['WEEKDAY_EVENING' as const], rulesAccepted: true };
  if (!state.members.some(member => member.id === GROUP_BENCHMARK_IDS.pending)) state.members.push({ id: GROUP_BENCHMARK_IDS.pending, name: '하린' });
  if (!state.applications.some(application => application.id === 'benchmark-pending-application')) state.applications.push({ id: 'benchmark-pending-application', groupId: publicGroup.id, userId: GROUP_BENCHMARK_IDS.pending, status: 'PENDING', createdAt: at.toISOString(), joinProfile, joinQuestions: structuredClone(publicGroup.joinFields.questions) });

  const authoredGroups: TogetherGroup[] = [
    { id: GROUP_BENCHMARK_IDS.golf, name: '동래 처음 함께하는 골프', kind: 'HOBBY', region: '부산', introduction: '가볍게 연습하고 서로의 자세와 안전을 배려하는 골프 모임 예시예요.', cover: '', ownerId: 'benchmark-golf-host', memberIds: ['benchmark-golf-host'], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true, sourceKind: 'EXAMPLE', createdAt: new Date(at.getTime() - 86400000).toISOString(), discovery: { topics: ['SPORTS'], subtopics: ['SPORTS_GOLF'], district: '동래구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', joinMode: 'DIRECT', welcome: '처음 골프를 시작하는 분도 환영해요.', joinGuide: '모임에 가입한 뒤 연습 일정과 비용을 따로 확인해 주세요.' } },
    { id: GROUP_BENCHMARK_IDS.legacy, name: '기존 운동 모임 · 분류 미지정', kind: 'HOBBY', region: '부산', introduction: '세부 관심사를 지정하지 않은 이전 구조의 비교용 모임이에요.', cover: '', ownerId: 'benchmark-legacy-host', memberIds: ['benchmark-legacy-host'], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true, discovery: { topics: ['SPORTS'], district: '동래구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '다양한 운동 이야기를 나눠요.', joinGuide: '기존 모임은 세부 관심사를 자동으로 정하지 않아요.' } },
  ];
  for (const group of authoredGroups) if (!state.groups.some(existing => existing.id === group.id)) {
    state.groups.push(group);
    if (!state.members.some(member => member.id === group.ownerId)) state.members.push({ id: group.ownerId, name: group.id === GROUP_BENCHMARK_IDS.golf ? '골프 안내자' : '운동 안내자' });
  }
  const scene = places.find(place => place.area.startsWith('부산') && place.image) || places.find(place => place.image);
  if (scene) for (const [id, activityId, caption] of [
    ['benchmark-general-photo', undefined, '전체 모임방에서 나눈 장소 사진'],
    ['benchmark-activity-photo', 'family-next', '이번 가족여행 대화방에서 나눈 장소 사진'],
    ['benchmark-past-photo', 'family-past', '지난 일정에만 보관된 장소 사진'],
  ] as const) if (!state.media.some(media => media.id === id)) state.media.push({ id, groupId: family.id, ...(activityId ? { activityId } : {}), authorId: ownerId, url: scene.image, kind: 'PHOTO', caption, createdAt: at.toISOString() });
}
