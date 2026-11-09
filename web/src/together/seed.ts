import type { Journey, Place } from '../data';
import { copyJourneyForGroup, createEmptyState, roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';
import { createDiscoveryCatalog, DISCOVERY_CATALOG_VERSION } from './discoveryExamples.ts';
import { exampleGroupPhoto } from './groupPhotoAssets.ts';

export const TOGETHER_REVIEW_MEMBER_ID = 'spotlog-local-review-member';
/** Fictional review members and conversations; group covers use synthetic activity photographs. */
export function createSeedState(viewerId: string, name: string, places: Place[]): TogetherState {
  const state = createEmptyState(viewerId, name);
  const now = new Date();
  const day = (offset: number) => { const date = new Date(now); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
  const time = (minute: number) => new Date(now.getTime() - (80 - minute) * 60_000).toISOString();
  const busan = places.filter(place => place.area.startsWith('부산'));
  const cover = busan.find(place => place.kind === 'LANDMARK' && place.image)?.image ?? places.find(place => place.image)?.image ?? '';
  const catalogue = createDiscoveryCatalog(places, now);
  state.groups.push(...catalogue.groups); state.members.push(...catalogue.members); state.activities.push(...catalogue.activities);
  state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
  // Real account IDs receive no synthetic memberships or private sample conversations.
  if (viewerId !== TOGETHER_REVIEW_MEMBER_ID) return state;
  state.members.push({ id: 'example-parent', name: '엄마' }, { id: 'example-sibling', name: '지우' }, { id: 'example-friend', name: '도윤' }, { id: 'example-applicant', name: '여행 친구' });
  state.groups.push(
    { id: 'family-busan', name: '우리 가족 여행', kind: 'FAMILY', region: '부산', introduction: '다음 여행도 지난 여행도 함께 모아 두는 우리 가족 공간.', cover: exampleGroupPhoto('family-busan'),
      visibility: 'PRIVATE', ownerId: viewerId, memberIds: [viewerId, 'example-parent', 'example-sibling'], managerIds: [], archived: false, promotionPublished: false },
    { id: 'weekend-walk', name: '우리 동네 취향 모임', kind: 'FRIENDS', region: '부산', introduction: '커피 한 잔부터 책 이야기까지, 편하게 만나 서로의 취향을 나눠요.', cover: exampleGroupPhoto('weekend-walk'), sourceKind: 'EXAMPLE', createdAt: '2026-10-01T00:00:00.000Z', discovery: { joinMode: 'APPROVAL', topics: ['SOCIAL', 'BOOK', 'CAFE'], district: '부산진구', style: 'NEIGHBORHOOD', recruitment: 'PAUSED', welcome: '친구끼리 가볍게 이야기 나누는 모임이에요.', joinGuide: '초대받은 사람만 들어올 수 있어요.' },
      visibility: 'PRIVATE', ownerId: 'example-friend', memberIds: [viewerId, 'example-friend', 'example-guide'], managerIds: [], archived: false, promotionPublished: false }
  );
  const selected = [busan.find(place => place.kind === 'LANDMARK' && place.name.includes('해운대')) ?? busan.find(place => place.kind === 'LANDMARK'), busan.find(place => place.kind === 'FOOD'), busan.find(place => place.kind === 'CAFE' && place.area.includes('해운대')) ?? busan.find(place => place.kind === 'CAFE'), busan.find(place => place.kind === 'STAY')].filter((place): place is Place => Boolean(place));
  const routePlaces = selected.map((place, index) => ({ ...structuredClone(place), note: '', visitId: `family-visit-${index + 1}`, bookingFixed: undefined, anchorVisitId: undefined, time: undefined, move: undefined }));
  state.groups.find(group => group.id === 'family-busan')!.interestPlaceIds = selected.map(place => place.id);
  const journey: Journey = { id: 'family-shared-trip', purpose: 'PLAN', planStage: 'READY', title: '부산 가족여행', region: '부산', dateRange: '2박 3일', duration: '2박 3일', status: 'PLANNING', visibility: 'PRIVATE', cover,
    summary: '', story: '', tags: ['가족', '여유롭게'], saves: 0, author: name, isMine: false, days: [
      { dayId: 'family-day-1', day: 1, date: day(3), title: '바다와 한 끼', story: '', places: routePlaces.filter(place => place.kind !== 'CAFE'),
        blocks: routePlaces.filter(place => place.kind !== 'CAFE').map(place => ({ id: `block-${place.visitId}`, type: 'PLACE', placeId: place.id, visitId: place.visitId })) },
      { dayId: 'family-day-2', day: 2, date: day(4), title: '카페에서 쉬어 가기', story: '', places: routePlaces.filter(place => place.kind === 'CAFE'),
        blocks: routePlaces.filter(place => place.kind === 'CAFE').map(place => ({ id: `block-${place.visitId}`, type: 'PLACE', placeId: place.id, visitId: place.visitId })) },
      { dayId: 'family-day-3', day: 3, date: day(5), title: '돌아가는 날', story: '', places: [], blocks: [] }
    ] };
  state.activities.push(
    { id: 'family-next', groupId: 'family-busan', title: '부산 가족여행', date: day(3), endDate: day(5), meetingPoint: '부산역 2번 출구 · 10:30', description: '오래 걷지 않고 바다와 식사를 여유롭게 즐기는 여행.', status: 'PLANNED', leadId: viewerId, editorIds: ['example-sibling'], participants: { [viewerId]: 'JOINED', 'example-parent': 'JOINED', 'example-sibling': 'MAYBE' }, arrivedIds: [], journey, revision: 1 },
    { id: 'family-past', groupId: 'family-busan', title: '지난 주말 바다 나들이', date: day(-14), endDate: day(-14), meetingPoint: '해변 입구', description: '다녀온 일정과 사진을 모아 두었어요.', status: 'COMPLETED', leadId: viewerId, editorIds: [], participants: { [viewerId]: 'JOINED', 'example-parent': 'JOINED' }, arrivedIds: [viewerId, 'example-parent'], revision: 1 },
    { id: 'family-undated', groupId: 'family-busan', title: '다음에는 카페 나들이', date: '', endDate: '', meetingPoint: '', description: '장소 후보부터 모으는 중이에요.', status: 'PLANNED', leadId: viewerId, editorIds: [], participants: {}, arrivedIds: [], revision: 1 },
    { id: 'friends-next', groupId: 'weekend-walk', title: '토요일 커피와 책 이야기', date: day(6), endDate: day(6), meetingPoint: '장소 후보는 참가자끼리 정해요.', description: '읽고 있는 책이나 좋아하는 이야기 하나를 가져와 커피와 함께 나눠요. 각자 주문과 이용 비용을 확인해요.', status: 'PLANNED', kind: 'MEETUP', startTime: '14:00', capacity: 8, leadId: 'example-friend', editorIds: [], participants: { [viewerId]: 'MAYBE', 'example-friend': 'JOINED' }, arrivedIds: [], revision: 1 }
  );
  state.invites.push({ id: 'seed-family-invite', intentId: 'seed-new-trip-intent', sourceTripId: 'seed-friend-personal-trip', sourceJourney: { ...copyJourneyForGroup(journey, '도윤'), title: '바다와 카페 주말 여행' }, senderId: 'example-friend', name: '다음 주말 함께 여행', kind: 'FRIENDS', region: '부산', acceptedBy: [], expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(), revoked: false });
  state.applications.push({ id: 'seed-family-application', groupId: 'family-busan', userId: 'example-applicant', status: 'PENDING' });
  const activityRoom = roomIdForActivity('family-next');
  state.messages.push(
    { id: 'family-general-1', roomId: roomIdForGroup('family-busan'), authorId: 'example-sibling', body: '지난 여행 사진은 앨범에 모아 둘게요. 다음 여행 이야기는 부산 가족여행 일정에서 해요.', createdAt: time(1) },
    { id: 'family-general-2', roomId: roomIdForGroup('family-busan'), authorId: viewerId, body: '좋아요. 공지와 다음 일정은 모임 홈에서도 볼 수 있어요.', createdAt: time(2) },
    { id: 'family-chat-1', roomId: activityRoom, authorId: 'example-sibling', body: '부산역에서 10시쯤 만나는 건 어때요?', createdAt: time(10) },
    { id: 'family-chat-2', roomId: activityRoom, authorId: viewerId, body: '기차 시간을 확인했어요. 부산역 10시 30분, 2번 출구로 확정해요.', createdAt: time(20) },
    { id: 'family-chat-3', roomId: activityRoom, authorId: 'example-parent', body: '계단이 적고 오래 걷지 않는 곳이면 좋겠어. 중간에 카페에서 쉬자.', createdAt: time(30) },
    { id: 'family-chat-4', roomId: activityRoom, authorId: 'example-sibling', body: '점심은 식당 A와 식당 B 중 골라요. 아직 결정하지 않았어요.', createdAt: time(40) },
    { id: 'family-chat-5', roomId: activityRoom, authorId: viewerId, body: '제가 식당 예약이 가능한지 알아볼게요. 아직 예약한 건 아니에요.', createdAt: time(50) },
    { id: 'family-chat-6', roomId: activityRoom, authorId: 'example-parent', body: '각자 보조배터리와 편한 신발을 챙기자.', createdAt: time(60) },
    { id: 'friends-chat-1', roomId: roomIdForGroup('weekend-walk'), authorId: 'example-friend', body: '토요일에 읽고 있는 책이나 좋아하는 이야기를 나눠요. 새 정모에 참가 여부를 남겨 주세요.', createdAt: time(35) }
  );
  state.notices.push({ id: 'family-notice', groupId: 'family-busan', title: '우리 가족 여행 안내', body: '여행별 이야기는 해당 일정 채팅에서 해요. 사진은 일정 앨범에 모아 주세요.', createdAt: time(1) },
    { id: 'family-meeting', groupId: 'family-busan', activityId: 'family-next', title: '만나는 시간·장소', body: '부산역 2번 출구에서 10시 30분에 만나요.', createdAt: time(20) });
  state.tasks.push({ id: 'family-task-reservation', groupId: 'family-busan', activityId: 'family-next', title: '점심 식당 예약 가능 여부 확인', assigneeId: viewerId, dueDate: day(2), completed: false, sourceMessageIds: ['family-chat-5'] },
    { id: 'family-task-battery', groupId: 'family-busan', activityId: 'family-next', title: '보조배터리와 편한 신발 챙기기', completed: false, sourceMessageIds: ['family-chat-6'] });
  state.polls.push({ id: 'family-food-poll', groupId: 'family-busan', activityId: 'family-next', question: '점심 식당 후보 고르기', options: [{ id: 'food-a', label: '식당 A · 후보', voterIds: ['example-parent'] }, { id: 'food-b', label: '식당 B · 후보', voterIds: ['example-sibling'] }], closed: false });
  state.posts.push({ id: 'family-post', groupId: 'family-busan', activityId: 'family-past', authorId: 'example-parent', title: '천천히 걸어서 더 좋았던 하루', body: '많은 곳보다 함께 쉬어 간 시간이 좋았어요. 다음에도 중간에 카페 시간을 넣으면 좋겠어요.', category: 'REVIEW', createdAt: new Date(now.getTime() - 12 * 86_400_000).toISOString(), likes: [viewerId], comments: [] });
  selected.filter(place => place.image).slice(0, 3).forEach((place, index) => state.media.push({ id: `family-photo-${index}`, groupId: 'family-busan', activityId: 'family-past', authorId: viewerId, url: place.image, kind: 'PHOTO', caption: `${place.name} · 기존 장소 사진으로 보는 앨범 예시`, createdAt: time(index) }));
  state.readCursors[activityRoom] = time(15);
  return state;
}
