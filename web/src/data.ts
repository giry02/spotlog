import beach from '../../assets/spotlog/danang-beach.jpg';
import food from '../../assets/spotlog/local-food.jpg';
import mountain from '../../assets/spotlog/marble-mountain.jpg';
import night from '../../assets/spotlog/night-market.jpg';
import resort from '../../assets/spotlog/resort.jpg';
import jejuAewolBakery from '../../assets/spotlog/jeju-aewol-bakery.jpg';
import jejuGuideCover from '../../assets/spotlog/jeju-west-guide-cover.jpg';
import jejuHotelNight from '../../assets/spotlog/jeju-west-hotel-night.jpg';
import jejuOsullocTeaField from '../../assets/spotlog/jeju-osulloc-tea-field.jpg';
import jejuSaebyeolOreum from '../../assets/spotlog/jeju-saebyeol-oreum.jpg';
import jejuSagyeCoast from '../../assets/spotlog/jeju-sagye-coast.jpg';
import jejuSanbangsanCafe from '../../assets/spotlog/jeju-sanbangsan-cafe.jpg';
import jejuSuudon from '../../assets/spotlog/jeju-hyeopjae-udon.jpg';

const cloudinaryVideo = (id: string) => `https://res.cloudinary.com/demo/video/upload/c_fill,g_center,h_1280,w_720,q_auto:eco/${id}.mp4`;

export type PlaceKind = 'LANDMARK' | 'STAY' | 'FOOD' | 'CAFE' | 'SHOP';
export type JourneyStatus = 'PLANNING' | 'TRAVELING' | 'PUBLISHED';

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  image: string;
  description: string;
  note: string;
  duration: string;
  time?: string;
  move?: string;
  creator?: string;
  hook?: string;
  bestTime?: string;
  video?: string;
  tags?: string[];
}

export interface JourneyDay {
  day: number;
  date: string;
  title: string;
  story: string;
  places: Place[];
  blocks: StoryBlock[];
}

export interface StoryBlock {
  id: string;
  type: 'TEXT' | 'IMAGE' | 'PLACE';
  heading?: string;
  body?: string;
  image?: string;
  caption?: string;
  placeId?: string;
}

export interface Journey {
  id: string;
  title: string;
  region: string;
  dateRange: string;
  duration: string;
  status: JourneyStatus;
  visibility: 'PUBLIC' | 'PRIVATE';
  cover: string;
  summary: string;
  story: string;
  tags: string[];
  saves: number;
  days: JourneyDay[];
  author: string;
  isMine: boolean;
  sourceJourneyId?: string;
  sourceAuthor?: string;
}

export const discoveryLandmarks: Place[] = [
  {
    id: 'jeju-hyeopjae', kind: 'LANDMARK', name: '협재해수욕장', area: '제주 한림', address: '제주 제주시 한림읍 협재리 2497-1', lat: 33.3938, lng: 126.2397,
    creator: 'slow.jeju', hook: '제주의 하루가 가장 천천히 끝나는 곳', description: '비양도 너머로 빛이 내려앉는 저녁. 이 장면을 다음 제주 여행의 첫 장소로 담아보세요.', note: '바람이 잦아 얇은 겉옷을 챙겼어요.', duration: '1시간', bestTime: '일몰 40분 전', image: beach, video: cloudinaryVideo('docs/sunset_waves'), tags: ['제주', '노을', '해변'],
  },
  {
    id: 'gangneung-anmok', kind: 'LANDMARK', name: '안목해변', area: '강원 강릉', address: '강원 강릉시 창해로 14번길', lat: 37.7712, lng: 128.9474,
    creator: 'eastsea.notes', hook: '커피 한 잔 들고 오래 걷기 좋은 동해', description: '아침 파도와 해변 산책이 하루의 방향을 정해주는 강릉의 대표 장면입니다.', note: '해가 뜬 직후에는 산책로가 비교적 한산해요.', duration: '50분', bestTime: '07:00–09:00', image: resort, video: cloudinaryVideo('kayak'), tags: ['강릉', '동해', '아침산책'],
  },
  {
    id: 'jeongseon-rail', kind: 'LANDMARK', name: '정선 아우라지', area: '강원 정선', address: '강원 정선군 여량면 아우라지길 69', lat: 37.4728, lng: 128.7232,
    creator: 'weekend.route', hook: '물길과 산길이 만나는 정선의 여름', description: '빠르게 지나가기보다 강변에 앉아 주변 마을의 시간을 느껴보는 장소입니다.', note: '비 온 뒤에는 강가 진입 안내를 확인하세요.', duration: '1시간 20분', bestTime: '10:00–12:00', image: mountain, video: cloudinaryVideo('rafting_short'), tags: ['정선', '강변', '국내여행'],
  },
  {
    id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374,
    creator: 'seoul.afterwork', hook: '도심에서 가장 쉽게 만나는 초록의 저녁', description: '퇴근 뒤에도 충분한 산책. 성수의 작은 가게와 이어 한나절 여행으로 만들기 좋습니다.', note: '자전거 길과 보행로가 나뉘는 구간을 확인하세요.', duration: '1시간 30분', bestTime: '16:00–18:00', image: food, video: cloudinaryVideo('forest_bike'), tags: ['서울', '산책', '성수'],
  },
];

const jejuDays: JourneyDay[] = [
  {
    day: 1, date: '5월 16일', title: '바다를 오래 보는 날', story: '도착하자마자 일정을 채우지 않았다. 협재의 빛이 바뀌는 시간을 보고, 가까운 곳에서 저녁을 먹은 뒤 숙소로 들어갔다.',
    places: [
      { ...discoveryLandmarks[0], time: '16:30', move: '여행 시작' },
      { id: 'jeju-suudon', kind: 'FOOD', name: '수우동', area: '제주 한림', address: '제주 제주시 한림읍 협재1길 11', lat: 33.3961, lng: 126.2421, image: jejuSuudon, description: '협재 골목 안에서 한 끼를 천천히 먹기 좋은 우동집.', note: '대기 등록 방식을 방문 전에 확인하는 편이 좋아요.', duration: '1시간', time: '19:00', move: '도보 7분' },
      { id: 'jeju-shinhwa', kind: 'STAY', name: '제주신화월드 메리어트', area: '제주 안덕', address: '제주 서귀포시 안덕면 신화역사로304번길 38', lat: 33.3062, lng: 126.3172, image: jejuHotelNight, description: '서쪽과 남서쪽 일정을 잇는 숙박 거점.', note: '이 여행에서는 예약 정보나 비용 없이 위치와 숙박 경험만 기록합니다.', duration: '숙박', time: '21:00', move: '차량 28분' },
    ],
    blocks: [
      { id: 'j1d1-text-1', type: 'TEXT', heading: '비양도가 보이는 첫 장면', body: '제주에 도착한 날은 욕심내지 않고 서쪽으로 바로 향했다. 협재는 바다가 얕고 비양도가 정면에 있어, 제주 여행의 시작을 실감하기 좋은 곳이었다.' },
      { id: 'j1d1-image-1', type: 'IMAGE', image: jejuGuideCover, caption: '해가 낮아질수록 물빛이 옅어지는 협재. 일몰 40분 전부터 천천히 걷기 시작했다.' },
      { id: 'j1d1-place-1', type: 'PLACE', placeId: 'jeju-hyeopjae' },
      { id: 'j1d1-text-2', type: 'TEXT', heading: '저녁은 멀리 움직이지 않기', body: '노을을 끝까지 보고 나면 생각보다 금방 어두워진다. 첫날에는 유명한 곳을 더 넣는 대신 걸어서 갈 수 있는 식당을 골랐다. 덕분에 바다의 여운을 끊지 않고 저녁으로 이어갈 수 있었다.' },
      { id: 'j1d1-place-2', type: 'PLACE', placeId: 'jeju-suudon' },
      { id: 'j1d1-text-3', type: 'TEXT', heading: '서쪽 여행의 숙박 거점', body: '다음 날 오설록과 산방산 방향으로 내려갈 계획이라 숙소는 서남쪽 이동이 편한 곳으로 잡았다. 밤에 다시 제주시로 올라가지 않아도 되는 점이 가장 좋았다.' },
      { id: 'j1d1-place-3', type: 'PLACE', placeId: 'jeju-shinhwa' },
    ],
  },
  {
    day: 2, date: '5월 17일', title: '차 향과 산방산 사이', story: '둘째 날은 초록에서 시작해 바다로 내려갔다. 장소 사이 거리가 짧아 머무는 시간을 늘릴 수 있었다.',
    places: [
      { id: 'jeju-osulloc', kind: 'LANDMARK', name: '오설록 티뮤지엄', area: '제주 안덕', address: '제주 서귀포시 안덕면 신화역사로 15', lat: 33.3059, lng: 126.2895, image: jejuOsullocTeaField, description: '차밭과 전시 공간을 함께 걷는 제주 서쪽의 대표 장소.', note: '오전 문을 여는 시간대가 비교적 여유로웠어요.', duration: '1시간 20분', time: '09:30', move: '차량 9분' },
      { id: 'jeju-oneonly', kind: 'CAFE', name: '원앤온리', area: '제주 안덕', address: '제주 서귀포시 안덕면 산방로 141', lat: 33.2392, lng: 126.3194, image: jejuSanbangsanCafe, description: '산방산과 바다를 한 자리에서 바라보는 카페.', note: '실내보다 야외 좌석에서 방향감이 더 잘 느껴졌어요.', duration: '1시간', time: '12:30', move: '차량 24분' },
      { id: 'jeju-sagye', kind: 'LANDMARK', name: '사계해안', area: '제주 안덕', address: '제주 서귀포시 안덕면 사계리', lat: 33.2285, lng: 126.3086, image: jejuSagyeCoast, description: '산방산 아래 검은 바위와 낮은 바다가 이어지는 해안.', note: '물이 빠지는 시간을 확인하면 해안의 표정이 더 잘 보여요.', duration: '1시간', time: '15:00', move: '차량 6분' },
    ],
    blocks: [
      { id: 'j1d2-text-1', type: 'TEXT', heading: '초록으로 시작하는 아침', body: '숙소에서 가까운 오설록을 첫 장소로 두니 단체 방문객이 몰리기 전에 차밭을 걸을 수 있었다. 전시보다 바깥 풍경을 먼저 보는 순서가 좋았다.' },
      { id: 'j1d2-place-1', type: 'PLACE', placeId: 'jeju-osulloc' },
      { id: 'j1d2-text-2', type: 'TEXT', heading: '산방산을 바라보며 쉬기', body: '산방산 쪽으로 내려오면 카페 자체보다 창밖 방향이 더 중요하다. 오전 이동 뒤 잠깐 앉아 다음 해안 산책을 준비하기에 알맞았다.' },
      { id: 'j1d2-place-2', type: 'PLACE', placeId: 'jeju-oneonly' },
      { id: 'j1d2-text-3', type: 'TEXT', heading: '바다로 하루를 닫다', body: '사계해안은 산방산과 바다를 한 화면에 담을 수 있다. 물때에 따라 걸을 수 있는 구간이 달라지므로 길찾기만큼 현장 상태를 확인하는 것이 중요했다.' },
      { id: 'j1d2-place-3', type: 'PLACE', placeId: 'jeju-sagye' },
    ],
  },
  {
    day: 3, date: '5월 18일', title: '오름 하나만 남기는 아침', story: '마지막 날은 공항으로 돌아가는 길에 새별오름 한 곳만 들렀다. 마지막까지 일정을 채우기보다 제주를 떠나는 마음을 정리하는 시간으로 남겼다.',
    places: [
      { id: 'jeju-saebyeol', kind: 'LANDMARK', name: '새별오름', area: '제주 애월', address: '제주 제주시 애월읍 봉성리 산59-8', lat: 33.3663, lng: 126.3577, image: jejuSaebyeolOreum, description: '완만한 능선을 따라 제주의 중산간 풍경을 넓게 볼 수 있는 오름.', note: '그늘이 적어 물과 모자를 챙기고, 바람이 강하면 정상 체류 시간을 줄이는 편이 좋아요.', duration: '1시간 20분', time: '09:30', move: '숙소에서 차량 24분' },
      { id: 'jeju-aewol-bakery', kind: 'CAFE', name: '애월의 작은 베이커리', area: '제주 애월', address: '제주 제주시 애월읍 애월로 1', lat: 33.4624, lng: 126.3113, image: jejuAewolBakery, description: '공항으로 돌아가기 전 가볍게 쉬며 여행을 정리한 동네 빵집.', note: '유명 메뉴보다 바로 먹을 한 가지와 돌아가는 길에 나눌 빵만 골랐어요.', duration: '40분', time: '12:00', move: '차량 22분' },
    ],
    blocks: [
      { id: 'j1d3-text-1', type: 'TEXT', heading: '마지막 날에는 한 곳만', body: '체크아웃 뒤 남은 시간을 계산해 보니 두세 곳을 더 들를 수도 있었다. 하지만 여행의 마지막 장면이 주차장과 대기 줄이 되는 건 싫었다. 새별오름을 천천히 오르는 것으로 충분했다.' },
      { id: 'j1d3-place-1', type: 'PLACE', placeId: 'jeju-saebyeol' },
      { id: 'j1d3-text-2', type: 'TEXT', heading: '여행을 정리하는 작은 테이블', body: '공항으로 바로 향하지 않고 애월의 작은 가게에 잠깐 앉았다. 사진을 고르고, 좋았던 장면 세 가지를 메모했다. 다음 여행을 위한 정보보다 이번 여행을 오래 기억하게 하는 시간이었다.' },
      { id: 'j1d3-place-2', type: 'PLACE', placeId: 'jeju-aewol-bakery' },
    ],
  },
];

export const initialJourneys: Journey[] = [
  {
    id: 'jeju-west-slow', title: '바람을 따라 걷는 제주 서쪽', region: '제주', dateRange: '2026.05.16 — 05.18', duration: '2박 3일', status: 'PUBLISHED', visibility: 'PUBLIC', cover: jejuGuideCover,
    summary: '협재의 저녁부터 산방산 아래 바다, 마지막 오름까지. 많이 보지 않고 좋은 장면에 오래 머문 2박 3일.', story: '이번 제주는 체크리스트 대신 하루의 결을 남기기로 했다. 왜 이 순서로 움직였는지, 어디에서 쉬었는지, 숙소가 다음 날 동선에 어떤 도움이 됐는지를 사진과 함께 적었다. 그대로 따라가도 좋고 마음에 드는 하루만 복사해도 되는 제주 서쪽 가이드다.', tags: ['제주서쪽', '2박3일', '느린여행', '숙소동선'], saves: 1284, days: jejuDays, author: '제주책갈피', isMine: false,
  },
];

export const placeKindLabel: Record<PlaceKind, string> = {
  LANDMARK: '랜드마크', STAY: '숙소', FOOD: '맛집', CAFE: '카페', SHOP: '로컬숍',
};

const catalogOnlyPlaces: Place[] = [
  { id: 'busan-gamcheon', kind: 'LANDMARK', name: '감천문화마을', area: '부산 사하', address: '부산 사하구 감내2로 203', lat: 35.0975, lng: 129.0107, image: night, description: '산복도로와 바다가 층층이 이어지는 부산 원도심의 풍경.', note: '주민이 생활하는 골목이라 지정된 관람 동선을 따라 걸었어요.', duration: '1시간 30분', move: '여행 시작' },
  { id: 'busan-signiel', kind: 'STAY', name: '시그니엘 부산', area: '부산 해운대', address: '부산 해운대구 달맞이길 30', lat: 35.1601, lng: 129.1695, image: resort, description: '해운대와 달맞이길 일정을 연결하기 좋은 바다 앞 숙박 거점.', note: '객실 비용보다 해변 산책과 다음 날 동선을 중심으로 기록할 수 있어요.', duration: '숙박', move: '차량 32분' },
  { id: 'busan-amso', kind: 'FOOD', name: '해운대암소갈비집', area: '부산 해운대', address: '부산 해운대구 중동2로10번길 32-10', lat: 35.1635, lng: 129.166, image: food, description: '해운대에서 오랫동안 자리를 지켜온 식당.', note: '식사 시간을 동선에 넣을 때 현장 대기와 운영 여부를 먼저 확인하세요.', duration: '1시간 20분', move: '도보 8분' },
  { id: 'busan-waveon', kind: 'CAFE', name: '웨이브온 커피', area: '부산 기장', address: '부산 기장군 장안읍 해맞이로 286', lat: 35.3214, lng: 129.2663, image: beach, description: '기장 해안을 바라보며 동부산 드라이브 중 쉬어가기 좋은 카페.', note: '해운대에서 바로 이어가기보다 기장 일정과 같은 날 묶는 편이 좋아요.', duration: '1시간', move: '차량 45분' },
];

export const placeCatalog: Place[] = Array.from(new Map(
  [...discoveryLandmarks, ...initialJourneys.flatMap((journey) => journey.days.flatMap((day) => day.places)), ...catalogOnlyPlaces]
    .map((place) => [place.id, place]),
).values());
