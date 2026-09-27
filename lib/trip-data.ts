import { places, restaurants } from './connected-data';

export { places, restaurants };
export type Region = '제주' | '서울';
export type Stay = {
  id: string;
  name: string;
  region: Region;
  near: string[];
  price: number;
  tags: string[];
};
// Fictional businesses and sample prices. Never used as live availability or travel advice.
export const stays: Stay[] = [
  {
    id: 'stay-coast',
    name: '바다곁 스테이',
    region: '제주',
    near: ['hyeopjae', 'saebyeol'],
    price: 120000,
    tags: ['바다 중심', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-tea',
    name: '차밭 작은집',
    region: '제주',
    near: ['osulloc', 'saebyeol'],
    price: 90000,
    tags: ['조용한 휴식', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-garden',
    name: '가든 패밀리 스테이',
    region: '제주',
    near: ['osulloc', 'hyeopjae', 'saebyeol'],
    price: 180000,
    tags: ['여럿이 함께', '4인 객실', '가상 숙소'],
  },
  {
    id: 'stay-forest',
    name: '숲옆 시티 스테이',
    region: '서울',
    near: ['seoulforest'],
    price: 110000,
    tags: ['서울숲 중심', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-city',
    name: '성수 작은방',
    region: '서울',
    near: ['seoulforest'],
    price: 80000,
    tags: ['작은 객실', '1~2인', '가상 숙소'],
  },
];
export const scenarios = [
  {
    id: 'coast',
    title: '장소부터 하나씩',
    subtitle: '장소 → 식당 → 숙소 → 내 여행',
    prompt: '제주에서 바다 볼 만한 곳 찾아줘',
    image: '/images/hyeopjae-scenery.jpg',
    label: '차근차근',
  },
  {
    id: 'similar',
    title: '이런 분위기의 다른 곳',
    subtitle: '비슷한 장소 → 찜 → 주변 탐색',
    prompt: '오설록처럼 초록이 많은 제주 장소 찾아줘',
    image: '/images/osulloc-tea.jpg',
    label: '취향으로 발견',
  },
  {
    id: 'complete',
    title: '일정부터 한 번에',
    subtitle: '1박 2일 초안 → 식당 교체 → 저장',
    prompt: '제주 1박 2일, 바다와 맛집, 숙소까지 일정 짜줘',
    image: '/images/saebyeol-autumn.jpg',
    label: '바로 초안',
  },
  {
    id: 'booked',
    title: '숙소는 이미 예약했어요',
    subtitle: '예약 유지 → 방문·식사 조정',
    prompt: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
    image: '/images/osulloc-museum.jpg',
    label: '예약 유지',
  },
  {
    id: 'seoul',
    title: '서울숲에서 반나절',
    subtitle: '산책 → 점심 → 카페 → 방문 순서',
    prompt: '서울숲에서 반나절 일정 짜줘. 점심과 카페를 넣어줘',
    image: '/images/seoulforest-path.jpg',
    label: '가벼운 나들이',
  },
  {
    id: 'saved',
    title: '찜한 장소로 여행 만들기',
    subtitle: '샘플 찜 2곳 → DAY 배치 → 저장',
    prompt: '찜한 제주 장소로 1박 2일 일정 짜줘',
    image: '/images/hyeopjae-scenery.jpg',
    label: '찜에서 출발',
  },
] as const;
export const findPlace = (id: string | null) => places.find((p) => p.id === id);
export const findFood = (id: string | null) =>
  restaurants.find((p) => p.id === id);
export const findStay = (id: string | null) => stays.find((p) => p.id === id);
export const period = (days: number) =>
  days === 1 ? '당일' : `${days - 1}박 ${days}일`;
export const money = (n: number) => n.toLocaleString('ko-KR') + '원';
