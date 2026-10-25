import type { Region } from './trip-data';
import appEditorial from './community-discovery-snapshot';
import { jejuVerifiedCourse } from './jeju-verified-course';

export type CommunityVisit = {
  day: number;
  kind: 'place' | 'food' | 'cafe' | 'shop' | 'stay';
  entityId: string;
  anchorId: string;
  label: string;
};
export type CommunityTrip = {
  id: string;
  title: string;
  author: string;
  sourceKind: 'demo';
  region: Region;
  days: number;
  theme: 'sea' | 'green' | 'all';
  description: string;
  coverPlaceId: string;
  visits: readonly CommunityVisit[];
  notes?: readonly string[];
  authorId?: string;
  contentType?: 'traveler' | 'ai';
  sourceAppId?: string;
  sourceMetadata?: { file: string; importedAt: string; recommendationKind?: 'AI'; recommendationBasis?: 'OFFICIAL_SOURCE_SAMPLE' };
  story?: string;
  dayStories?: readonly { day: number; title: string; story: string; provenance: 'app-editorial' | 'authored-demo'; blocks: readonly CommunityContentBlock[] }[];
};
export type CommunityContentBlock =
  | { id: string; type: 'text'; heading: string; body: string; visitEntityId?: string | null }
  | { id: string; type: 'photo'; photoId: string; caption: string }
  | { id: string; type: 'place'; entityId: string };
const stop = (
  day: number,
  entityId: string,
  label: string,
  kind: CommunityVisit['kind'] = 'place',
  anchorId = entityId,
): CommunityVisit => ({ day, kind, entityId, anchorId, label });
const demoNotes = [
  '다른 여행자의 공개 코스를 둘러보고 복사하는 흐름을 위한 제작 예시입니다. 실제 회원 게시물·후기·좋아요가 아닙니다.',
  '오전·오후는 제안한 방문 순서입니다. 실제 영업시간·예약·이동시간을 조회하지 않았습니다.',
  '식당·카페·숙소는 가상 업체이며 메뉴·숙박 금액은 체험용입니다.',
];
const legacyCommunityTrips: readonly CommunityTrip[] = [
  {
    id: 'community-jeju-west-sea',
    title: '서쪽 바다와 차밭 1박 2일',
    author: '바람친구 · 데모 프로필',
    sourceKind: 'demo',
    region: '제주',
    days: 2,
    theme: 'sea',
    coverPlaceId: 'hyeopjae',
    description:
      '협재와 금능의 바다를 보고, 다음 날 차밭과 송악산으로 이어지는 서쪽 여행 예시예요.',
    visits: [
      stop(1, 'hyeopjae', '오전 방문'),
      stop(1, 'hj-rice', '점심', 'food', 'hyeopjae'),
      stop(1, 'geumneung', '오후 방문'),
      stop(1, 'geumneung-cafe', '카페에서 쉬기', 'cafe', 'geumneung'),
      stop(1, 'stay-coast', '숙박', 'stay', 'hyeopjae'),
      stop(2, 'osulloc', '오전 방문'),
      stop(2, 'of-rice', '점심', 'food', 'osulloc'),
      stop(2, 'songaksan', '오후 방문'),
      stop(2, 'songaksan-cafe', '카페에서 쉬기', 'cafe', 'songaksan'),
    ],
    notes: demoNotes,
  },
  {
    id: 'community-jeju-west-green',
    title: '차밭과 오름에서 보내는 하루',
    author: '초록산책 · 데모 프로필',
    sourceKind: 'demo',
    region: '제주',
    days: 1,
    theme: 'green',
    coverPlaceId: 'osulloc',
    description:
      '오설록에서 오전을 시작해 새별오름을 오후 방문으로 담은 서쪽 당일 여행 예시예요.',
    visits: [
      stop(1, 'osulloc', '오전 방문'),
      stop(1, 'of-rice', '점심', 'food', 'osulloc'),
      stop(1, 'saebyeol', '오후 방문'),
      stop(1, 'sb-cafe', '카페에서 쉬기', 'cafe', 'saebyeol'),
    ],
    notes: demoNotes,
  },
  {
    id: 'community-jeju-east-sea',
    title: '성산과 섭지코지 동쪽 하루',
    author: '바다메모 · 데모 프로필',
    sourceKind: 'demo',
    region: '제주',
    days: 1,
    theme: 'sea',
    coverPlaceId: 'seongsan',
    description:
      '성산일출봉과 섭지코지를 오전·오후로 나누고 주변 식사와 카페를 연결한 동쪽 코스예요.',
    visits: [
      stop(1, 'seongsan', '오전 방문'),
      stop(1, 'seongsan-rice', '점심', 'food', 'seongsan'),
      stop(1, 'seopjikoji', '오후 방문'),
      stop(1, 'seopjikoji-cafe', '카페에서 쉬기', 'cafe', 'seopjikoji'),
    ],
    notes: demoNotes,
  },
  {
    id: 'community-jeju-east-green',
    title: '비자림과 동쪽 바다 1박 2일',
    author: '느린숲길 · 데모 프로필',
    sourceKind: 'demo',
    region: '제주',
    days: 2,
    theme: 'green',
    coverPlaceId: 'bijarim',
    description:
      '첫날 비자림과 함덕, 둘째 날 성산과 섭지코지를 담은 동쪽 1박 2일 제작 예시예요.',
    visits: [
      stop(1, 'bijarim', '오전 방문'),
      stop(1, 'bijarim-rice', '점심', 'food', 'bijarim'),
      stop(1, 'hamdeok', '오후 방문'),
      stop(1, 'hamdeok-cafe', '카페에서 쉬기', 'cafe', 'hamdeok'),
      stop(1, 'stay-east', '숙박', 'stay', 'hamdeok'),
      stop(2, 'seongsan', '오전 방문'),
      stop(2, 'seongsan-rice', '점심', 'food', 'seongsan'),
      stop(2, 'seopjikoji', '오후 방문'),
      stop(2, 'seopjikoji-cafe', '카페에서 쉬기', 'cafe', 'seopjikoji'),
    ],
    notes: demoNotes,
  },
  {
    id: 'community-jeju-south',
    title: '서귀포 폭포와 해안 산책',
    author: '남쪽발걸음 · 데모 프로필',
    sourceKind: 'demo',
    region: '제주',
    days: 1,
    theme: 'all',
    coverPlaceId: 'cheonjiyeon',
    description:
      '천지연폭포와 대포 주상절리를 오전·오후로 나눈 서귀포 당일 여행 예시예요.',
    visits: [
      stop(1, 'cheonjiyeon', '오전 방문'),
      stop(1, 'cheonjiyeon-rice', '점심', 'food', 'cheonjiyeon'),
      stop(1, 'jusangjeolli', '오후 방문'),
      stop(1, 'jusangjeolli-cafe', '카페에서 쉬기', 'cafe', 'jusangjeolli'),
    ],
    notes: demoNotes,
  },
  {
    id: 'community-seoul-halfday',
    title: '서울숲에서 쉬는 반나절',
    author: '도시산책 · 데모 프로필',
    sourceKind: 'demo',
    region: '서울',
    days: 1,
    theme: 'green',
    coverPlaceId: 'seoulforest',
    description:
      '서울숲 오전 산책에 점심과 카페를 더한 반나절 나들이 예시예요.',
    visits: [
      stop(1, 'seoulforest', '오전 방문'),
      stop(1, 'sf-rice', '점심', 'food', 'seoulforest'),
      stop(1, 'sf-cafe', '카페에서 쉬기', 'cafe', 'seoulforest'),
    ],
    notes: demoNotes,
  },
];
export const communityTrips: readonly CommunityTrip[] = [
  jejuVerifiedCourse,
  ...legacyCommunityTrips.map((trip): CommunityTrip => ({
    ...trip, contentType: 'traveler', authorId: `demo-author-${trip.id.replace('community-', '')}`,
    story: `${trip.description}\n\n여행자 코스 형식의 제작 예시입니다. 실제 여행자가 올린 글이나 방문 후기라는 뜻은 아닙니다.`,
    dayStories: Array.from({length:trip.days},(_,i)=>({day:i+1,title:`${trip.region}에서 보내는 DAY ${i+1}`,story:'오전·오후의 방문과 쉬는 순서를 설명하기 위해 작성한 데모입니다. 원본 회원 여행기의 본문이 아닙니다.',provenance:'authored-demo' as const,blocks:[]})),
  })),
  ...appEditorial.journeys.map((item): CommunityTrip => ({
    id: `community-app-${item.sourceAppId}`, sourceAppId:item.sourceAppId,
    title:item.title,author:`${item.author} · 기획 샘플`,authorId:'spotlog-public-editorial',sourceKind:'demo',
    contentType:'ai',region:item.region as Region,days:item.days.length,
    theme:item.tags.some(tag=>/산책|초록/.test(tag))?'green':'all',
    description:item.description,story:item.story,coverPlaceId:item.coverPlaceId,
    sourceMetadata:{file:appEditorial.sourceFile,importedAt:appEditorial.importedAt,recommendationKind:'AI',recommendationBasis:'OFFICIAL_SOURCE_SAMPLE'},
    visits:item.days.flatMap(day=>day.visits.map(visit=>({...visit,day:day.day,kind:visit.kind as CommunityVisit['kind']}))),
    dayStories:item.days.map(day=>({...day,provenance:'app-editorial' as const,blocks:day.blocks as CommunityContentBlock[]})),
    notes:['Spotlog 앱에 포함된 공공 관광자료 기반 AI 추천 기획 샘플입니다. 실시간 모델 생성 결과나 실제 회원 게시물이 아닙니다.','원본에 존재하는 DAY 글·사진·장소 순서를 보존했습니다. 현재 영업·예약·이동시간은 확인하지 않았습니다.'],
  })),
];
export const findCommunityTrip = (id: string | null | undefined) =>
  communityTrips.find((course) => course.id === id);
