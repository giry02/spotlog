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
import jejuHyeopjaeTidepool from '../../assets/spotlog/jeju-hyeopjae-tidepool.webp';
import jejuHyeopjaeUdonDinner from '../../assets/spotlog/jeju-hyeopjae-udon-dinner.webp';
import jejuOsullocMorningDew from '../../assets/spotlog/jeju-osulloc-morning-dew.webp';
import jejuSagyeTidepool from '../../assets/spotlog/jeju-sagye-tidepool.webp';
import jejuSaebyeolTrail from '../../assets/spotlog/jeju-saebyeol-trail.webp';
import jejuAewolTravelNotes from '../../assets/spotlog/jeju-aewol-travel-notes.webp';
import busanHaeundaeCover from '../../assets/spotlog/busan-haeundae-blue-hour.webp';
import gangwonEastSeaCover from '../../assets/spotlog/gangwon-east-sea-sunrise.webp';
import seoulForestCover from '../../assets/spotlog/seoul-forest-evening.webp';
import spa from '../../assets/spotlog/spa.jpg';

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
  motionImages?: string[];
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
  views?: number;
  days: JourneyDay[];
  author: string;
  isMine: boolean;
  sourceJourneyId?: string;
  sourceAuthor?: string;
}

export const discoveryLandmarks: Place[] = [
  {
    id: 'jeju-hyeopjae', kind: 'LANDMARK', name: '협재해수욕장', area: '제주 한림', address: '제주 제주시 한림읍 협재리 2497-1', lat: 33.3938, lng: 126.2397,
    creator: 'slow.jeju', hook: '제주의 하루가 가장 천천히 끝나는 곳', description: '비양도 너머로 빛이 내려앉는 저녁. 이 장면을 다음 제주 여행의 첫 장소로 담아보세요.', note: '바람이 잦아 얇은 겉옷을 챙겼어요.', duration: '1시간', bestTime: '일몰 40분 전', image: jejuHyeopjaeTidepool, motionImages: [jejuGuideCover, jejuHyeopjaeTidepool, jejuHyeopjaeUdonDinner], tags: ['제주', '노을', '해변'],
  },
  {
    id: 'gangneung-anmok', kind: 'LANDMARK', name: '안목해변', area: '강원 강릉', address: '강원 강릉시 창해로 14번길', lat: 37.7712, lng: 128.9474,
    creator: 'eastsea.notes', hook: '커피 한 잔 들고 오래 걷기 좋은 동해', description: '아침 파도와 해변 산책이 하루의 방향을 정해주는 강릉의 대표 장면입니다.', note: '해가 뜬 직후에는 산책로가 비교적 한산해요.', duration: '50분', bestTime: '07:00–09:00', image: gangwonEastSeaCover, motionImages: [gangwonEastSeaCover], tags: ['강릉', '동해', '아침산책'],
  },
  {
    id: 'jeongseon-rail', kind: 'LANDMARK', name: '정선 아우라지', area: '강원 정선', address: '강원 정선군 여량면 아우라지길 69', lat: 37.4728, lng: 128.7232,
    creator: 'weekend.route', hook: '물길과 산길이 만나는 정선의 여름', description: '빠르게 지나가기보다 강변에 앉아 주변 마을의 시간을 느껴보는 장소입니다.', note: '비 온 뒤에는 강가 진입 안내를 확인하세요.', duration: '1시간 20분', bestTime: '10:00–12:00', image: mountain, motionImages: [mountain], tags: ['정선', '강변', '국내여행'],
  },
  {
    id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374,
    creator: 'seoul.afterwork', hook: '도심에서 가장 쉽게 만나는 초록의 저녁', description: '퇴근 뒤에도 충분한 산책. 성수의 작은 가게와 이어 한나절 여행으로 만들기 좋습니다.', note: '자전거 길과 보행로가 나뉘는 구간을 확인하세요.', duration: '1시간 30분', bestTime: '16:00–18:00', image: seoulForestCover, motionImages: [seoulForestCover], tags: ['서울', '산책', '성수'],
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
      { id: 'j1d1-text-1', type: 'TEXT', heading: '비양도가 보이는 첫 장면', body: '제주에 도착한 날은 욕심내지 않고 서쪽으로 바로 향했다. 오후 네 시가 넘으니 한낮의 관광객이 조금씩 빠지고, 바다는 민트색에서 은빛으로 천천히 바뀌기 시작했다.\n\n협재의 좋은 점은 멀리 이동하지 않아도 백사장, 검은 현무암, 비양도까지 서로 다른 장면을 한 번에 볼 수 있다는 것이다. 주차장과 가까운 입구는 붐볐지만 서쪽으로 10분쯤 걸으니 앉아서 파도 소리를 들을 자리가 충분했다.' },
      { id: 'j1d1-image-1', type: 'IMAGE', image: jejuGuideCover, caption: '해가 낮아질수록 물빛이 옅어지는 협재. 일몰 40분 전부터 천천히 걷기 시작했다.' },
      { id: 'j1d1-place-1', type: 'PLACE', placeId: 'jeju-hyeopjae' },
      { id: 'j1d1-text-2', type: 'TEXT', heading: '백사장보다 오래 남은 갯바위', body: '사진으로 볼 때는 고운 모래와 물빛이 먼저 눈에 들어왔지만, 실제로는 물이 빠진 뒤 드러난 현무암 사이가 더 재미있었다. 작은 물웅덩이마다 해초와 조개껍데기가 남아 있어 같은 해변 안에서도 풍경이 계속 달라졌다.\n\n좋았던 점은 산책 방향을 정하지 않아도 비양도가 기준점이 되어 길을 잃을 일이 없다는 것. 다만 돌 표면이 젖으면 꽤 미끄러워 운동화가 아니라면 모래 쪽으로 걷는 편이 안전하다.' },
      { id: 'j1d1-image-2', type: 'IMAGE', image: jejuHyeopjaeTidepool, caption: '물이 빠진 뒤에야 보였던 협재의 작은 풍경. 현무암 사이 얕은 물에 저녁빛과 비양도가 함께 비쳤다.' },
      { id: 'j1d1-text-3', type: 'TEXT', heading: '저녁은 멀리 움직이지 않기', body: '노을을 끝까지 보고 나면 생각보다 금방 어두워진다. 첫날에는 유명한 곳을 하나 더 넣는 대신 걸어서 갈 수 있는 식당을 골랐다. 덕분에 차를 다시 찾고 주차할 필요 없이 바다의 여운을 저녁까지 이어갈 수 있었다.' },
      { id: 'j1d1-image-3', type: 'IMAGE', image: jejuHyeopjaeUdonDinner, caption: '바람을 오래 맞은 뒤라 뜨거운 국물이 잘 어울렸다. 겉옷을 의자에 걸어둔 채 오늘 찍은 사진부터 천천히 넘겨봤다.' },
      { id: 'j1d1-place-2', type: 'PLACE', placeId: 'jeju-suudon' },
      { id: 'j1d1-text-4', type: 'TEXT', heading: '먹어본 뒤의 솔직한 평가', body: '국물은 자극적이지 않고 면은 예상보다 단단해서 천천히 먹기 좋았다. 해변 근처 식당이지만 관광지 느낌보다 동네 식당의 편안함이 남았다.\n\n다시 간다면 일몰 직후보다 조금 일찍 방문할 것 같다. 대기 방식이 날마다 달라질 수 있고, 인기 시간에는 바다에서의 여유를 식당 앞에서 그대로 써버릴 수 있다는 점은 아쉬웠다.' },
      { id: 'j1d1-text-5', type: 'TEXT', heading: '숙소는 시설보다 다음 날의 방향', body: '다음 날 오설록과 산방산 방향으로 내려갈 계획이라 숙소는 서남쪽 이동이 편한 곳으로 잡았다. 밤에 다시 제주시로 올라가지 않아도 되는 점이 가장 좋았다.\n\n객실 자체보다 주차가 편하고 아침 동선이 짧다는 점에 높은 점수를 주고 싶다. 반대로 제주다운 작은 숙소의 분위기를 기대한다면 규모가 크게 느껴질 수 있다. 이 여행에서는 숙소도 목적지라기보다 하루와 다음 날을 연결하는 거점으로 기록했다.' },
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
      { id: 'j1d2-text-1', type: 'TEXT', heading: '초록으로 시작하는 아침', body: '숙소에서 가까운 오설록을 첫 장소로 두니 단체 방문객이 몰리기 전에 차밭을 걸을 수 있었다. 전날 밤 비가 조금 내려 찻잎에는 물방울이 남아 있었고, 실내보다 바깥 공기가 먼저 잠을 깨웠다.\n\n입구에서 바로 전시관으로 들어가기보다 돌담을 따라 차밭 끝까지 걸은 뒤 실내를 보는 순서가 좋았다. 사진을 찍는 사람도 적고, 차밭이 관광 시설이기 전에 제주의 밭이라는 느낌을 받을 수 있었다.' },
      { id: 'j1d2-image-1', type: 'IMAGE', image: jejuOsullocMorningDew, caption: '비가 그친 아침의 찻잎. 반듯한 차밭 사이에도 제주 돌담과 검은 흙이 그대로 남아 있었다.' },
      { id: 'j1d2-place-1', type: 'PLACE', placeId: 'jeju-osulloc' },
      { id: 'j1d2-text-2', type: 'TEXT', heading: '오설록에서 좋았던 것과 아쉬웠던 것', body: '가장 좋았던 곳은 유명한 포토존보다 건물 뒤편의 낮은 차밭 길이었다. 바람에 잎이 한 방향으로 움직이는 모습과 젖은 흙 냄새가 사진보다 또렷하게 기억에 남았다.\n\n전시와 매장은 동선이 편하지만 오전 열한 시가 가까워지자 빠르게 붐볐다. 차를 천천히 마시는 것이 목적이라면 개장 시간에 맞춰 오거나, 쇼핑보다 산책 시간을 먼저 확보하는 편을 추천한다.' },
      { id: 'j1d2-text-3', type: 'TEXT', heading: '산방산을 바라보며 쉬기', body: '산방산 쪽으로 내려오면 카페 자체보다 어느 방향에 앉는지가 더 중요하다. 오전 이동 뒤 잠깐 쉬면서 다음 해안 산책을 준비하기에는 알맞았고, 산과 바다가 동시에 보여 지도를 보지 않아도 이동 방향이 이해됐다.' },
      { id: 'j1d2-place-2', type: 'PLACE', placeId: 'jeju-oneonly' },
      { id: 'j1d2-text-4', type: 'TEXT', heading: '전망은 좋지만 자리는 복불복', body: '야외에서 산방산을 정면으로 볼 수 있다는 점은 분명 좋았다. 음료를 오래 평가하기보다 다음 장소로 가기 전 풍경과 그늘을 함께 빌리는 곳에 가깝다.\n\n사람이 많은 시간에는 창가와 야외 좌석의 경험 차이가 크고 음악도 조금 크게 느껴졌다. 조용한 카페를 기대하기보다 산방산 아래에서 한 시간 쉬어가는 전망 포인트라고 생각하면 만족도가 높다.' },
      { id: 'j1d2-image-2', type: 'IMAGE', image: jejuSagyeTidepool, caption: '사계해안에서 고개를 들면 산방산, 아래를 보면 투명한 물웅덩이가 보였다. 큰 풍경과 작은 관찰이 한자리에 있었다.' },
      { id: 'j1d2-place-3', type: 'PLACE', placeId: 'jeju-sagye' },
      { id: 'j1d2-text-5', type: 'TEXT', heading: '바다로 하루를 닫으며', body: '사계해안은 산방산과 바다를 한 화면에 담을 수 있지만, 오래 남은 건 검은 바위 틈의 작은 물웅덩이였다. 물이 빠진 자리에서 소라와 해초를 들여다보는 시간이 생각보다 길어졌다.\n\n좋은 점은 카페에서 차로 몇 분이면 전혀 다른 분위기의 해안에 닿는다는 것. 아쉬운 점은 물때와 바람에 따라 걸을 수 있는 구간이 크게 달라진다는 것이다. 길찾기뿐 아니라 당일 현장 상태를 확인하고 미끄럽지 않은 신발을 챙기는 편이 좋다.' },
    ],
  },
  {
    day: 3, date: '5월 18일', title: '오름 하나만 남기는 아침', story: '마지막 날은 공항으로 돌아가는 길에 새별오름 한 곳만 들렀다. 마지막까지 일정을 채우기보다 제주를 떠나는 마음을 정리하는 시간으로 남겼다.',
    places: [
      { id: 'jeju-saebyeol', kind: 'LANDMARK', name: '새별오름', area: '제주 애월', address: '제주 제주시 애월읍 봉성리 산59-8', lat: 33.3663, lng: 126.3577, image: jejuSaebyeolOreum, description: '완만한 능선을 따라 제주의 중산간 풍경을 넓게 볼 수 있는 오름.', note: '그늘이 적어 물과 모자를 챙기고, 바람이 강하면 정상 체류 시간을 줄이는 편이 좋아요.', duration: '1시간 20분', time: '09:30', move: '숙소에서 차량 24분' },
      { id: 'jeju-aewol-bakery', kind: 'CAFE', name: '애월의 작은 베이커리', area: '제주 애월', address: '제주 제주시 애월읍 애월로 1', lat: 33.4624, lng: 126.3113, image: jejuAewolBakery, description: '공항으로 돌아가기 전 가볍게 쉬며 여행을 정리한 동네 빵집.', note: '유명 메뉴보다 바로 먹을 한 가지와 돌아가는 길에 나눌 빵만 골랐어요.', duration: '40분', time: '12:00', move: '차량 22분' },
    ],
    blocks: [
      { id: 'j1d3-text-1', type: 'TEXT', heading: '마지막 날에는 한 곳만', body: '체크아웃 뒤 남은 시간을 계산해 보니 두세 곳을 더 들를 수도 있었다. 하지만 여행의 마지막 장면이 주차장과 대기 줄이 되는 건 싫었다. 새별오름을 천천히 오르는 것으로 충분했다.\n\n입구에서는 경사가 완만해 보였지만 중간부터 숨이 차기 시작했다. 정상에 빨리 닿는 것보다 억새 사이에서 뒤를 돌아보는 순간들이 더 좋았고, 올라온 길과 제주 중산간이 한꺼번에 보일 때 비로소 여행의 거리가 실감났다.' },
      { id: 'j1d3-image-1', type: 'IMAGE', image: jejuSaebyeolTrail, caption: '정상보다 기억에 남은 오름 중턱의 길. 바람이 불 때마다 억새가 한쪽으로 누우며 지나온 방향을 보여줬다.' },
      { id: 'j1d3-place-1', type: 'PLACE', placeId: 'jeju-saebyeol' },
      { id: 'j1d3-text-2', type: 'TEXT', heading: '오름은 짧아도 준비는 필요했다', body: '한 시간 남짓한 코스지만 그늘이 거의 없어 햇빛과 바람을 그대로 받는다. 능선이 열려 있어 전망은 시원했고 길도 단순한 것이 장점이었다.\n\n반대로 바람이 강한 날에는 정상에서 오래 머물기 어렵고 내려오는 흙길이 미끄러울 수 있다. 물, 모자, 밑창이 미끄럽지 않은 신발만 챙겨도 체감이 크게 달라진다. 사진은 정상보다 사람이 드문 중턱에서 더 자연스럽게 나왔다.' },
      { id: 'j1d3-text-3', type: 'TEXT', heading: '여행을 정리하는 작은 테이블', body: '공항으로 바로 향하지 않고 애월의 작은 가게에 잠깐 앉았다. 사진을 고르고, 좋았던 장면 세 가지와 다음에는 빼도 될 장소 하나를 메모했다. 다음 여행을 위한 정보보다 이번 여행을 오래 기억하게 하는 시간이었다.' },
      { id: 'j1d3-image-2', type: 'IMAGE', image: jejuAewolTravelNotes, caption: '빵 두 개와 커피 한 잔을 두고 사진을 골랐다. 협재의 저녁, 젖은 찻잎, 오름의 바람을 이번 여행의 세 장면으로 남겼다.' },
      { id: 'j1d3-place-2', type: 'PLACE', placeId: 'jeju-aewol-bakery' },
      { id: 'j1d3-text-4', type: 'TEXT', heading: '다시 간다면 이렇게', body: '이 빵집은 일부러 멀리서 찾아갈 목적지라기보다 공항으로 가는 흐름을 끊지 않고 쉬기 좋은 곳이었다. 창밖 돌담과 바다가 보여 마지막까지 제주에 있다는 기분이 남았다.\n\n다시 간다면 빵을 많이 사기보다 바로 먹을 것 하나만 고르고 30분 정도 머물 것 같다. 여행의 마지막에는 새로운 장소를 더 소비하는 것보다 이미 지나온 장면을 정리하는 시간이 더 필요했다.' },
    ],
  },
];

export const initialJourneys: Journey[] = [
  {
    id: 'jeju-west-slow', title: '바람을 따라 걷는 제주 서쪽', region: '제주', dateRange: '2026.05.16 — 05.18', duration: '2박 3일', status: 'PUBLISHED', visibility: 'PUBLIC', cover: jejuGuideCover,
    summary: '협재의 저녁부터 산방산 아래 바다, 마지막 오름까지. 많이 보지 않고 좋은 장면에 오래 머문 2박 3일.', story: '이번 제주는 체크리스트 대신 하루의 결을 남기기로 했다. 왜 이 순서로 움직였는지, 어디에서 쉬었는지, 숙소가 다음 날 동선에 어떤 도움이 됐는지를 사진과 함께 적었다. 그대로 따라가도 좋고 마음에 드는 하루만 복사해도 되는 제주 서쪽 가이드다.', tags: ['제주서쪽', '2박3일', '느린여행', '숙소동선'], saves: 1284, views: 12480, days: jejuDays, author: '제주책갈피', isMine: false,
  },
];

export const placeKindLabel: Record<PlaceKind, string> = {
  LANDMARK: '랜드마크', STAY: '숙소', FOOD: '맛집', CAFE: '카페', SHOP: '로컬숍',
};

const samplePlace = (
  id: string,
  name: string,
  area: string,
  address: string,
  lat: number,
  lng: number,
  image: string,
  description: string,
  note: string,
  duration = '1시간 20분',
  kind: PlaceKind = 'LANDMARK',
): Place => ({
  id,
  kind,
  name,
  area,
  address,
  lat,
  lng,
  image,
  description,
  note,
  duration,
  creator: 'spotlog.local',
  hook: `${area} 여행에서 천천히 머물러볼 대표 장소`,
  bestTime: '방문 전 운영 정보 확인',
  tags: [area.split(' ')[0], area.split(' ')[1], '국내여행'].filter((tag): tag is string => Boolean(tag)),
});

const catalogOnlyPlaces: Place[] = [
  { id: 'busan-gamcheon', kind: 'LANDMARK', name: '감천문화마을', area: '부산 사하', address: '부산 사하구 감내2로 203', lat: 35.0975, lng: 129.0107, image: night, description: '산복도로와 바다가 층층이 이어지는 부산 원도심의 풍경.', note: '주민이 생활하는 골목이라 지정된 관람 동선을 따라 걸었어요.', duration: '1시간 30분', move: '여행 시작' },
  { id: 'busan-signiel', kind: 'STAY', name: '시그니엘 부산', area: '부산 해운대', address: '부산 해운대구 달맞이길 30', lat: 35.1601, lng: 129.1695, image: resort, description: '해운대와 달맞이길 일정을 연결하기 좋은 바다 앞 숙박 거점.', note: '객실 비용보다 해변 산책과 다음 날 동선을 중심으로 기록할 수 있어요.', duration: '숙박', move: '차량 32분' },
  { id: 'busan-amso', kind: 'FOOD', name: '해운대암소갈비집', area: '부산 해운대', address: '부산 해운대구 중동2로10번길 32-10', lat: 35.1635, lng: 129.166, image: food, description: '해운대에서 오랫동안 자리를 지켜온 식당.', note: '식사 시간을 동선에 넣을 때 현장 대기와 운영 여부를 먼저 확인하세요.', duration: '1시간 20분', move: '도보 8분' },
  { id: 'busan-waveon', kind: 'CAFE', name: '웨이브온 커피', area: '부산 기장', address: '부산 기장군 장안읍 해맞이로 286', lat: 35.3214, lng: 129.2663, image: beach, description: '기장 해안을 바라보며 동부산 드라이브 중 쉬어가기 좋은 카페.', note: '해운대에서 바로 이어가기보다 기장 일정과 같은 날 묶는 편이 좋아요.', duration: '1시간', move: '차량 45분' },
  samplePlace('busan-haedong-yonggungsa', '해동용궁사', '부산 기장', '부산 기장군 기장읍 용궁길 86', 35.1884, 129.2233, gangwonEastSeaCover, '바다와 맞닿은 절벽을 따라 전각과 해안 풍경을 함께 보는 부산의 해안 사찰.', '계단이 많고 주말에는 입구가 붐비므로 이른 오전에 방문하는 편이 좋습니다.', '1시간 30분'),
  samplePlace('gyeonggi-suwon-hwaseong', '수원화성', '경기 수원', '경기 수원시 장안구 영화동 320-2', 37.2877, 127.0134, busanHaeundaeCover, '성곽길을 따라 수원 구도심과 장안문, 화홍문의 풍경을 이어 걷는 역사 산책지.', '전 구간을 걷기보다 장안문에서 화홍문까지 한 구간을 정하면 일정에 담기 편합니다.', '2시간'),
  samplePlace('gyeonggi-yangpyeong-dumulmeori', '두물머리', '경기 양평', '경기 양평군 양서면 양수리 697', 37.5325, 127.3122, jejuHyeopjaeTidepool, '두 강이 만나는 물가에서 느티나무와 잔잔한 아침 풍경을 보는 양평의 산책지.', '물안개를 보고 싶다면 해 뜨기 전후에 도착하고 강변 바람에 대비하세요.', '1시간 30분'),
  samplePlace('incheon-songdo-central-park', '송도 센트럴파크', '인천 연수', '인천 연수구 컨벤시아대로 160', 37.3926, 126.6386, resort, '수로와 고층 건물 사이를 걸으며 낮과 야경이 다른 송도의 도시 풍경을 보는 공원.', '한옥마을 쪽에서 시작해 수로를 따라 걷고 해 질 무렵 전망을 보는 동선이 좋습니다.', '1시간 40분'),
  samplePlace('incheon-open-port', '인천 개항장거리', '인천 중구', '인천 중구 신포로27번길 80', 37.4739, 126.6214, night, '근대 건축과 오래된 골목, 차이나타운을 한 번에 이어 걷는 인천 원도심 여행지.', '개항장과 차이나타운을 따로 보지 말고 자유공원까지 하나의 도보 동선으로 묶어보세요.', '2시간'),
  samplePlace('chungbuk-danyang-dodamsambong', '도담삼봉', '충북 단양', '충북 단양군 매포읍 삼봉로 644', 36.9855, 128.3818, mountain, '남한강 한가운데 솟은 세 봉우리와 단양의 산 능선을 한눈에 보는 대표 전망지.', '전망대만 보고 이동하기보다 강변 산책로를 함께 걸으면 머무는 장면이 더 풍성합니다.', '1시간'),
  samplePlace('chungbuk-cheongju-sangdangsanseong', '상당산성', '충북 청주', '충북 청주시 상당구 성내로124번길 14', 36.6586, 127.5425, jejuSaebyeolTrail, '완만한 성곽길을 따라 숲과 청주 시내 전망을 번갈아 보는 걷기 좋은 산성.', '남문에서 시작하는 짧은 순환 구간은 가족 여행 일정에도 넣기 수월합니다.', '1시간 40분'),
  samplePlace('chungnam-gongju-gongsanseong', '공산성', '충남 공주', '충남 공주시 웅진로 280', 36.4627, 127.1279, jejuGuideCover, '금강을 내려다보는 성곽길에서 백제의 흔적과 공주의 저녁 풍경을 만나는 곳.', '해가 낮아지는 시간에 성곽을 걸으면 금강 쪽 빛과 야경을 함께 볼 수 있습니다.', '1시간 40분'),
  samplePlace('chungnam-taean-kkoji', '꽃지해수욕장', '충남 태안', '충남 태안군 안면읍 승언리', 36.4974, 126.3357, jejuSagyeCoast, '할미·할아비바위 사이로 해가 내려앉는 장면이 유명한 태안의 서해 노을 명소.', '물때와 일몰 시각을 함께 확인해야 갯벌과 노을의 표정이 좋은 시간을 고를 수 있습니다.', '1시간 30분'),
  samplePlace('daejeon-hanbat-arboretum', '한밭수목원', '대전 서구', '대전 서구 둔산대로 169', 36.3665, 127.388, seoulForestCover, '도심 한가운데 넓은 정원과 산책로가 이어져 계절 식물을 보기 좋은 수목원.', '동원과 서원의 휴원일이 다를 수 있어 방문할 구역과 운영 시간을 먼저 확인하세요.', '1시간 40분'),
  samplePlace('daejeon-daedong-sky-park', '대동하늘공원', '대전 동구', '대전 동구 동대전로110번길 182', 36.3311, 127.4437, night, '언덕 마을 위에서 대전 시내의 지붕과 저녁 불빛을 내려다보는 작은 전망 공원.', '주거 골목을 지나므로 조용히 이동하고 일몰 뒤에는 밝은 큰길로 내려오세요.', '1시간'),
  samplePlace('sejong-national-arboretum', '국립세종수목원', '세종 세종동', '세종 수목원로 136', 36.4989, 127.2848, jejuOsullocTeaField, '한국전통정원부터 사계절전시온실까지 여러 정원 풍경을 한 공간에서 보는 곳.', '온실 관람 시간을 먼저 정하고 야외 정원은 계절에 맞춰 두세 구역만 골라보세요.', '2시간 30분'),
  samplePlace('sejong-lake-park', '세종호수공원', '세종 세종동', '세종 다솜로 216', 36.4974, 127.2704, seoulForestCover, '넓은 호수 둘레를 걸으며 세종의 현대 건축과 저녁 하늘을 함께 보는 산책지.', '전체를 한 바퀴 돌기보다 국립세종도서관과 물놀이섬 사이 구간을 골라 걸어보세요.', '1시간 30분'),
  samplePlace('gwangju-acc', '국립아시아문화전당', '광주 동구', '광주 동구 문화전당로 38', 35.1468, 126.9199, busanHaeundaeCover, '전시와 공연, 넓은 지상 공원을 오가며 광주의 현재 문화를 만나는 복합 공간.', '전시 하나와 야외 공간을 함께 고르면 짧은 일정에도 기록할 장면이 충분합니다.', '2시간'),
  samplePlace('gwangju-yangnim-dong', '양림동 역사문화마을', '광주 남구', '광주 남구 서서평길 7', 35.1394, 126.9141, jejuAewolBakery, '오래된 선교 건축과 골목, 작은 문화 공간이 이어지는 광주의 도보 여행지.', '펭귄마을만 보고 돌아가기보다 오웬기념각과 오래된 주택 골목까지 걸어보세요.', '1시간 40분'),
  samplePlace('gyeongbuk-gyeongju-daereungwon', '대릉원', '경북 경주', '경북 경주시 황남동 31-1', 35.838, 129.2123, jejuSaebyeolOreum, '고분 사이의 완만한 길을 걸으며 경주의 계절과 오래된 도시 풍경을 보는 곳.', '황리단길과 붙어 있지만 대릉원 안에서는 산책 시간을 넉넉히 분리해두는 편이 좋습니다.', '1시간 30분'),
  samplePlace('gyeongbuk-andong-hahoe', '안동 하회마을', '경북 안동', '경북 안동시 풍천면 전서로 186', 36.539, 128.518, jejuGuideCover, '낙동강이 감싸는 마을에서 고택과 골목, 부용대 풍경을 천천히 둘러보는 곳.', '마을 안 관람과 부용대 전망은 이동 시간이 달라 반나절 일정으로 잡는 편이 안전합니다.', '3시간'),
  samplePlace('daegu-apsan-observatory', '앞산전망대', '대구 남구', '대구 남구 앞산순환로 454', 35.8277, 128.5878, mountain, '앞산 능선에서 대구 도심이 넓게 펼쳐지는 모습을 보는 대표 야경 전망지.', '케이블카 운행 종료와 하산 시간을 확인하고 야간에는 체온을 지킬 겉옷을 챙기세요.', '1시간 40분'),
  samplePlace('daegu-kim-gwangseok-street', '김광석 다시그리기길', '대구 중구', '대구 중구 달구벌대로 2238', 35.8603, 128.6062, night, '노래와 벽화, 작은 공연장이 이어지는 골목에서 대구의 문화 장면을 만나는 거리.', '벽화만 빠르게 찍기보다 방천시장과 작은 공연 공간을 함께 둘러보세요.', '1시간 20분'),
  samplePlace('ulsan-daewangam-park', '대왕암공원', '울산 동구', '울산 동구 등대로 95', 35.4928, 129.4395, gangwonEastSeaCover, '해송 숲을 지나 바다 위 바위와 출렁다리까지 이어 걷는 울산의 해안 공원.', '바람이 강한 날에는 출렁다리 운영 여부를 확인하고 해송 숲길을 중심으로 걸어보세요.', '2시간'),
  samplePlace('ulsan-taehwagang-garden', '태화강 국가정원', '울산 중구', '울산 중구 태화강국가정원길 154', 35.5504, 129.2949, jejuOsullocTeaField, '대숲과 계절 정원, 태화강 산책로가 길게 이어지는 울산 도심의 초록 여행지.', '십리대숲과 계절꽃 구역 사이가 넓으므로 보고 싶은 장면을 먼저 골라 이동하세요.', '1시간 40분'),
  samplePlace('jeonbuk-gunsan-modern-street', '군산 근대역사문화거리', '전북 군산', '전북 군산시 해망로 240', 35.9908, 126.7119, night, '근대 건축과 오래된 항구 골목을 따라 군산의 시간을 걸어보는 원도심 여행지.', '박물관 운영 시간 안에 실내를 먼저 보고 해 질 무렵 항구 골목을 걷는 순서가 좋습니다.', '2시간'),
  samplePlace('gyeongnam-jinju-castle', '진주성', '경남 진주', '경남 진주시 남강로 626', 35.1892, 128.0796, busanHaeundaeCover, '남강을 따라 성곽과 촉석루를 걸으며 진주의 역사와 강변 풍경을 보는 곳.', '낮에는 성 안을 보고 해 질 무렵 남강 건너편에서 촉석루를 바라보면 장면이 달라집니다.', '1시간 40분'),
  samplePlace('seoul-seongsu-yeonbang', '성수연방', '서울 성동', '서울 성동구 성수이로14길 14', 37.541, 127.0562, jejuAewolBakery, '오래된 공장 건물 안에 작은 상점과 카페가 모인 성수의 생활 문화 공간.', '서울숲에서 걸어오기 좋고, 골목의 작은 가게를 함께 둘러보면 성수의 분위기가 더 잘 보입니다.', '1시간'),
  samplePlace('seoul-tukseom-hangang', '뚝섬한강공원', '서울 광진', '서울 광진구 강변북로 139', 37.5293, 127.0697, seoulForestCover, '성수 골목에서 이어 걸어 저녁의 한강 풍경을 보기 좋은 도심 산책지.', '해가 지기 40분 전에 도착하면 낮과 야경을 모두 볼 수 있어요.', '1시간 30분'),
  samplePlace('jeonju-hanok', '전주한옥마을', '전북 전주', '전북 전주시 완산구 기린대로 99', 35.815, 127.153, busanHaeundaeCover, '한옥 골목과 작은 공방, 오래된 생활 풍경을 천천히 걸어보는 전주의 중심.', '큰길보다 경기전 뒤편 골목을 걸으면 한결 조용한 장면을 만날 수 있습니다.', '2시간'),
  samplePlace('jeonju-nambu-market', '전주남부시장', '전북 전주', '전북 전주시 완산구 풍남문1길 19-3', 35.8116, 127.1477, night, '전주의 식재료와 오래된 가게, 청년몰의 새로운 분위기가 함께 있는 시장.', '시장 음식은 한 번에 많이 고르기보다 작은 메뉴를 나눠 맛보는 편이 좋아요.', '1시간 20분', 'FOOD'),
  samplePlace('damyang-juknokwon', '죽녹원', '전남 담양', '전남 담양군 담양읍 죽녹원로 119', 35.32, 126.9859, jejuOsullocTeaField, '대나무 숲길의 빛과 바람 소리를 오래 느끼며 걷기 좋은 담양의 대표 산책지.', '사람이 적은 오전에는 대숲의 소리와 빛이 더 또렷하게 느껴집니다.', '1시간 30분'),
  samplePlace('damyang-metasequoia', '메타세쿼이아길', '전남 담양', '전남 담양군 담양읍 메타세쿼이아로 12', 35.3328, 126.989, jejuSaebyeolTrail, '곧게 뻗은 나무 사이를 걸으며 담양의 계절을 사진으로 남기기 좋은 길.', '한낮보다 빛이 비스듬한 늦은 오후에 길의 깊이가 더 잘 보입니다.', '1시간'),
  samplePlace('suncheon-garden', '순천만국가정원', '전남 순천', '전남 순천시 국가정원1호길 47', 34.9274, 127.499, jejuGuideCover, '넓은 정원 속에서 계절별 식물과 여러 나라의 정원 풍경을 보는 공간.', '전부 보려고 하기보다 관심 있는 정원 세 곳을 정해 천천히 보는 편이 좋습니다.', '2시간 30분'),
  samplePlace('suncheon-bay', '순천만습지', '전남 순천', '전남 순천시 순천만길 513-25', 34.8853, 127.509, jejuHyeopjaeTidepool, '갈대밭과 갯벌 사이로 난 길을 걸으며 해 질 무렵의 빛을 보는 습지.', '용산전망대까지 걸을 계획이라면 해 지는 시각보다 넉넉히 일찍 출발하세요.', '2시간'),
  samplePlace('yeosu-odongdo', '오동도', '전남 여수', '전남 여수시 수정동 산1-11', 34.7446, 127.766, beach, '방파제 길과 동백 숲, 바다 전망을 한 번에 이어 걷는 여수의 작은 섬.', '섬 안쪽 숲길과 해안 산책로의 분위기가 달라 한 방향씩 모두 걸어볼 만합니다.', '1시간 40분'),
  samplePlace('yeosu-dolsan', '돌산공원', '전남 여수', '전남 여수시 돌산읍 우두리 산355-1', 34.731, 127.7385, resort, '돌산대교와 여수항의 불빛을 한눈에 내려다보는 야경 전망지.', '바람이 강할 수 있으니 해가 진 뒤 오래 머문다면 얇은 겉옷을 준비하세요.', '1시간'),
  samplePlace('tongyeong-dongpirang', '동피랑 벽화마을', '경남 통영', '경남 통영시 동피랑1길 6-18', 34.8452, 128.4238, jejuHyeopjaeUdonDinner, '통영항을 내려다보는 언덕 골목에서 벽화와 주민의 생활 풍경을 만나는 곳.', '좁은 골목은 주민 생활 공간이므로 조용히 걷고 촬영 안내를 확인하세요.', '1시간 20분'),
  samplePlace('tongyeong-mireuksan', '미륵산', '경남 통영', '경남 통영시 발개로 205', 34.8262, 128.425, mountain, '정상 부근에서 통영의 섬과 바다가 겹겹이 펼쳐지는 풍경을 보는 산.', '구름이 낮은 날에는 전망이 달라지므로 출발 전 시야와 운행 정보를 확인하세요.', '2시간'),
  samplePlace('gangneung-ojukheon', '오죽헌', '강원 강릉', '강원 강릉시 율곡로3139번길 24', 37.7799, 128.8785, jejuGuideCover, '검은 대나무와 고택의 뜰을 걸으며 강릉의 차분한 시간을 만나는 곳.', '아침 바다 뒤에 방문하면 해안과 전혀 다른 강릉의 분위기를 느낄 수 있습니다.', '1시간 20분'),
  samplePlace('yangyang-naksansa', '낙산사', '강원 양양', '강원 양양군 강현면 낙산사로 100', 38.1252, 128.6278, jejuSagyeCoast, '절벽 위 전각과 동해 수평선을 함께 바라보며 걷는 양양의 해안 사찰.', '오르막과 계단이 있어 신발을 편하게 신고 바다 쪽 관람 순서를 확인하세요.', '1시간 40분'),
  samplePlace('yangyang-surfy', '서피비치', '강원 양양', '강원 양양군 현북면 하조대해안길 119', 38.0295, 128.7174, spa, '넓은 모래사장과 서핑 문화가 어우러진 양양의 활기찬 해변.', '성수기에는 체험 예약과 주차 시간을 여유 있게 잡는 편이 좋습니다.', '1시간 30분'),
  samplePlace('sokcho-yeonggeumjeong', '영금정', '강원 속초', '강원 속초시 영금정로 43', 38.213, 128.5998, gangwonEastSeaCover, '바다 위 정자에서 파도와 속초항의 아침 풍경을 가까이 듣는 곳.', '일출 직후에는 바람이 세도 빛이 맑아 사진과 산책 모두 좋습니다.', '1시간'),
  samplePlace('sokcho-central-market', '속초관광수산시장', '강원 속초', '강원 속초시 중앙로147번길 12', 38.2047, 128.5904, food, '닭강정과 해산물, 지역 먹거리를 한 자리에서 비교해 보는 속초의 시장.', '포장 음식은 숙소 동선과 먹을 시간을 먼저 정한 뒤 필요한 만큼만 고르세요.', '1시간 20분', 'FOOD'),
  samplePlace('goseong-ayajin', '아야진해변', '강원 고성', '강원 고성군 토성면 아야진해변길 157', 38.2723, 128.5539, beach, '맑은 물과 낮은 바위 지형이 이어져 천천히 해안을 관찰하기 좋은 해변.', '물때에 따라 보이는 바위와 모래 구간이 달라 산책 전 확인하면 좋아요.', '1시간 30분'),
  samplePlace('goseong-cheonjin', '천진해변', '강원 고성', '강원 고성군 토성면 천진해변길 39', 38.2577, 128.5571, jejuAewolTravelNotes, '작은 항구와 잔잔한 해변을 함께 보며 동해안 여행을 마무리하기 좋은 곳.', '아야진에서 해안도로로 이어 이동하면 마지막 날 동선이 자연스럽습니다.', '1시간'),
];

export const placeCatalog: Place[] = Array.from(new Map(
  [...discoveryLandmarks, ...initialJourneys.flatMap((journey) => journey.days.flatMap((day) => day.places)), ...catalogOnlyPlaces]
    .map((place) => [place.id, place]),
).values());
