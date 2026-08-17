import type { Region, SpotClip, SpotlogPlace } from '../types/domain';

export const regions: Region[] = [
  { id: 'danang', name: '다낭', country: '베트남', tagline: '바다와 골목, 느린 저녁이 이어지는 도시' },
  { id: 'bali', name: '발리', country: '인도네시아', tagline: '초록과 쉼을 따라가는 섬' },
  { id: 'kyoto', name: '교토', country: '일본', tagline: '오래 걷고 천천히 머무는 골목' },
];

export const places: SpotlogPlace[] = [
  {
    id: 'danang-mykhe', regionId: 'danang', category: 'LANDMARK', name: '미케비치 아침 산책', area: '미케비치',
    introduction: '다낭 동쪽 해안을 따라 길게 이어지는 대표 해변입니다. 해가 높아지기 전 천천히 걷고, 근처 카페에서 아침을 시작하기 좋습니다.',
    moodTags: ['일출', '산책', '바다'], bestTime: '07:00–09:00', durationMinutes: 90,
    latitude: 16.0592, longitude: 108.2472, image: require('../../assets/spotlog/danang-beach.jpg'),
  },
  {
    id: 'danang-marble', regionId: 'danang', category: 'LANDMARK', name: '오행산의 돌계단과 전망', area: '응우한선',
    introduction: '동굴 사원과 전망대를 잇는 다낭 남쪽의 랜드마크입니다. 계단이 많아 오전에 방문하고 충분한 시간을 두는 편이 좋습니다.',
    moodTags: ['전망', '사원', '걷기'], bestTime: '08:00–11:00', durationMinutes: 150,
    latitude: 16.004, longitude: 108.263, image: require('../../assets/spotlog/marble-mountain.jpg'),
  },
  {
    id: 'danang-night', regionId: 'danang', category: 'LANDMARK', name: '한강 야경과 용다리', area: '하이쩌우',
    introduction: '저녁 식사 뒤 강변을 걸으며 야경을 보기 좋은 코스입니다. 주말에는 용다리 공연 시간을 확인하세요.',
    moodTags: ['야경', '강변', '산책'], bestTime: '19:30–21:30', durationMinutes: 75,
    latitude: 16.0612, longitude: 108.2279, image: require('../../assets/spotlog/night-market.jpg'),
  },
  {
    id: 'danang-local-food', regionId: 'danang', category: 'FOOD', name: '다낭 로컬 한 상', area: '하이쩌우',
    introduction: '반쎄오와 분짜, 베트남 커피를 한 번에 경험하는 가벼운 로컬 식사 코스입니다.',
    moodTags: ['로컬', '미식', '시장'], bestTime: '11:30–13:30', durationMinutes: 75,
    latitude: 16.064, longitude: 108.221, image: require('../../assets/spotlog/local-food.jpg'),
  },
  {
    id: 'danang-spa', regionId: 'danang', category: 'WELLNESS', name: '여행 중간의 아로마 쉼', area: '안하이',
    introduction: '오래 걸은 날 저녁에 넣기 좋은 90분 아로마 프로그램입니다. 다음 일정까지 이동 여유를 함께 계산하세요.',
    moodTags: ['휴식', '아로마', '저녁'], bestTime: '16:00–19:00', durationMinutes: 120,
    latitude: 16.0691, longitude: 108.2365, image: require('../../assets/spotlog/spa.jpg'),
  },
  {
    id: 'danang-resort', regionId: 'danang', category: 'STAY', name: '논누억 해변의 조용한 숙소', area: '논누억',
    introduction: '관광지를 빠르게 도는 여행보다 바다와 수영장에서 쉬는 시간을 남기고 싶은 일정에 어울립니다.',
    moodTags: ['숙소', '수영장', '휴식'], bestTime: '체크인 15:00', durationMinutes: 0,
    latitude: 16.0397, longitude: 108.2513, image: require('../../assets/spotlog/resort.jpg'),
  },
];

export const clips: SpotClip[] = [
  { id: 'clip-mykhe-01', placeId: 'danang-mykhe', creator: '@slowly_danang', hook: '다낭에서 아침을 시작하는 가장 조용한 방법', caption: '파도가 낮은 시간에 걸으면 도시가 아직 잠든 것처럼 느껴져요.', durationLabel: '00:24' },
  { id: 'clip-marble-01', placeId: 'danang-marble', creator: '@steps.and.views', hook: '계단 끝에서 다낭의 바다가 열리는 순간', caption: '덥기 전에 올라가세요. 전망대 아래 작은 동굴 사원도 놓치지 마세요.', durationLabel: '00:31' },
  { id: 'clip-food-01', placeId: 'danang-local-food', creator: '@eat.local.vn', hook: '관광객 메뉴 대신 오늘 점심은 이렇게', caption: '반쎄오를 라이스페이퍼에 싸는 방법까지 현지 사장님께 배웠어요.', durationLabel: '00:18' },
  { id: 'clip-night-01', placeId: 'danang-night', creator: '@bluehour.log', hook: '해가 진 뒤 다낭을 한 장면으로 기억하는 법', caption: '저녁 식사 후 강변을 따라 천천히 걸어보세요.', durationLabel: '00:27' },
  { id: 'clip-spa-01', placeId: 'danang-spa', creator: '@rest.is.travel', hook: '여행 일정에도 아무것도 하지 않는 시간이 필요해요', caption: '오행산을 다녀온 날 오후에 넣기 좋은 쉼표 같은 장소예요.', durationLabel: '00:20' },
  { id: 'clip-resort-01', placeId: 'danang-resort', creator: '@stay.somewhere', hook: '숙소가 여행의 목적지가 되는 하루', caption: '하루쯤은 일정을 비우고 이곳에 머물러도 좋아요.', durationLabel: '00:25' },
];

export const findPlace = (id: string) => places.find((place) => place.id === id);
