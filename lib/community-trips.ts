import type { Region } from './trip-data';

export type CommunityVisit = {
  day: number;
  kind: 'place' | 'food' | 'cafe' | 'stay';
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
};
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
export const communityTrips: readonly CommunityTrip[] = [
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
export const findCommunityTrip = (id: string | null | undefined) =>
  communityTrips.find((course) => course.id === id);
