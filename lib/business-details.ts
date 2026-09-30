import { findFood, findPlace, findStay, money } from './trip-data';
import type { TripState } from './trip-engine';

export type BusinessRef = {
  kind: 'food' | 'stay';
  id: string;
  visitId?: string;
};
type MenuItem = { name: string; price: number; note: string };
type Profile = {
  headline: string;
  description: string;
  features: string[];
  hours: string;
  check: string;
  extras: MenuItem[];
};

// Authored fictional profiles. Operating hours, facilities and prices are demo data.
const foodProfiles: Record<string, Profile> = {
  'of-rice': {
    headline: '차밭 산책 뒤, 가볍게 먹는 채소 한 상',
    description:
      '작은 나무 테이블에서 계절 채소와 따뜻한 국을 함께 먹는 한식집으로 설정했어요. 조용한 점심과 부담 없는 식사를 원하는 여행에 어울려요.',
    features: ['차분한 식사', '1인 식사', '채소 중심'],
    hours: '11:00–19:00 · 화요일 휴무 · 주문 마감 18:00',
    check:
      '채소 정식에도 육수나 달걀이 포함될 수 있어요. 재료와 식단 선택 가능 여부를 확인하는 상황을 체험해 보세요.',
    extras: [
      { name: '두부 구이 정식', price: 15000, note: '두부와 반찬 구성' },
      { name: '따뜻한 유자차', price: 4500, note: '식사 뒤 한 잔' },
    ],
  },
  'of-pasta': {
    headline: '초록 풍경 뒤에 이어지는 캐주얼한 한 끼',
    description:
      '열린 주방과 밝은 테이블이 있는 양식집으로 설정했어요. 산책 뒤 파스타를 나눠 먹으며 이야기하기 좋은, 조금 활기 있는 공간이에요.',
    features: ['캐주얼한 분위기', '둘이 식사', '열린 주방'],
    hours: '11:30–20:30 · 수요일 휴무 · 쉬는 시간 15:00–17:00',
    check:
      '오후 쉬는 시간이 있는 예시예요. 산책을 마치는 시간과 식사 시간을 함께 맞춰보세요.',
    extras: [
      { name: '구운 채소 샐러드', price: 13000, note: '곁들여 나누기' },
      { name: '레몬 에이드', price: 6000, note: '탄산 음료' },
    ],
  },
  'of-cafe': {
    headline: '조용히 앉아 차 한 잔으로 산책을 마무리',
    description:
      '찻잔과 작은 디저트, 창가 좌석을 갖춘 찻집으로 설정했어요. 커피보다 차를 좋아하거나 오래 걷고 잠깐 쉬고 싶은 여행에 어울려요.',
    features: ['차 메뉴', '창가 좌석', '조용한 대화'],
    hours: '10:00–18:00 · 목요일 휴무 · 주문 마감 17:30',
    check:
      '작은 공간이라 여럿이 함께 앉을 자리가 필요한 경우 좌석 구성을 확인하는 흐름이 필요해요.',
    extras: [
      { name: '제주 녹차', price: 5500, note: '따뜻하게 또는 차갑게' },
      { name: '버터 스콘', price: 4000, note: '차와 곁들이기' },
    ],
  },
  'sf-rice': {
    headline: '서울숲 산책 전후에 빠르게 먹는 한식',
    description:
      '혼자 앉을 수 있는 좌석과 작은 테이블이 있는 밥집으로 설정했어요. 반나절 나들이에서 점심을 간단히 해결하고 산책을 이어가기 좋아요.',
    features: ['1인 식사', '가벼운 점심', '담백한 메뉴'],
    hours: '11:00–20:00 · 월요일 휴무 · 쉬는 시간 15:00–16:30',
    check:
      '점심만 먹고 산책을 이어갈지, 카페까지 들를지에 따라 쉬는 시간을 함께 살펴보세요.',
    extras: [
      { name: '두부 된장 정식', price: 12000, note: '따뜻한 국과 밥' },
      { name: '작은 계란말이', price: 6000, note: '곁들임 메뉴' },
    ],
  },
  'sf-pasta': {
    headline: '그늘에서 쉬듯, 천천히 즐기는 파스타',
    description:
      '창가 테이블과 차분한 조명을 갖춘 양식집으로 설정했어요. 서울숲을 걷고 난 뒤 앉아서 대화하며 식사하고 싶은 두 사람에게 어울려요.',
    features: ['차분한 분위기', '창가 테이블', '둘이 식사'],
    hours: '11:30–21:00 · 화요일 휴무 · 쉬는 시간 15:00–17:00',
    check:
      '크림 메뉴 대신 다른 소스를 원하는 경우 메뉴 구성을 비교하는 상황을 체험할 수 있어요.',
    extras: [
      { name: '토마토 리소토', price: 17000, note: '다른 소스 선택' },
      { name: '그린 샐러드', price: 9000, note: '곁들임 메뉴' },
    ],
  },
  'sf-cafe': {
    headline: '커피와 샌드위치로 이어지는 가벼운 오후',
    description:
      '밝은 창과 함께 앉는 큰 테이블이 있는 카페로 설정했어요. 커피만 마시기보다 간단한 간식까지 먹고, 친구와 이야기하는 나들이에 어울려요.',
    features: ['샌드위치', '친구와 대화', '밝고 활기 있는 공간'],
    hours: '10:00–21:00 · 매일 운영 · 주문 마감 20:30',
    check:
      '조용히 혼자 머무는 공간보다 대화하는 분위기의 예시예요. 원하는 휴식 방식과 맞는지 비교해 보세요.',
    extras: [
      { name: '아메리카노', price: 5000, note: '커피만 선택' },
      { name: '치즈 샌드위치', price: 8000, note: '가벼운 간식' },
    ],
  },
  'sb-rice': {
    headline: '오름을 걷고 나서 먹는 따뜻한 버섯 정식',
    description:
      '편한 좌석에서 국과 반찬을 함께 먹는 작은 한식집으로 설정했어요. 오름 산책 뒤 멀리 이동하지 않고 쉬면서 식사하기 좋아요.',
    features: ['따뜻한 정식', '차분한 식사', '1인 식사'],
    hours: '10:30–18:30 · 수요일 휴무 · 주문 마감 18:00',
    check:
      '이른 저녁에 마감하는 예시예요. 오름을 오후 늦게 방문한다면 식사 순서를 먼저 잡아보세요.',
    extras: [
      { name: '버섯 비빔밥', price: 12000, note: '가벼운 한 그릇' },
      { name: '감자전', price: 8000, note: '나눠 먹는 메뉴' },
    ],
  },
  'sb-pasta': {
    headline: '걷고 난 뒤 여럿이 나누는 채소 파스타',
    description:
      '넓은 테이블과 밝은 분위기의 양식집으로 설정했어요. 산책 후 여럿이 앉아 파스타와 곁들임을 나눠 먹는 일정에 어울려요.',
    features: ['여럿이 식사', '구운 채소', '활기 있는 분위기'],
    hours: '11:00–20:00 · 월요일 휴무 · 쉬는 시간 15:00–17:00',
    check:
      '한식 후보보다 메뉴 가격이 높은 예시예요. 인원수와 곁들임 메뉴를 고려해 식사 예산을 비교해 보세요.',
    extras: [
      { name: '토마토 파스타', price: 18000, note: '다른 메뉴 후보' },
      { name: '구운 채소 플레이트', price: 12000, note: '함께 나누기' },
    ],
  },
  'sb-cafe': {
    headline: '걷고 난 다리를 쉬게 하는 토스트와 차',
    description:
      '편안한 좌석과 작은 창가가 있는 카페로 설정했어요. 오름을 다녀온 뒤 식사 대신 가벼운 간식과 차를 먹으며 쉬기 좋아요.',
    features: ['토스트', '차 메뉴', '조용한 휴식'],
    hours: '10:00–19:00 · 화요일 휴무 · 주문 마감 18:30',
    check:
      '다른 식당보다 걸어가는 시간이 긴 예시예요. 산책 후에도 더 걸을 수 있는지 함께 판단해 보세요.',
    extras: [
      { name: '꿀 버터 토스트', price: 6500, note: '가벼운 간식' },
      { name: '허브차', price: 5500, note: '커피 대신 한 잔' },
    ],
  },
  'hj-rice': {
    headline: '바다 산책 뒤 든든하게 먹는 생선구이 한 상',
    description:
      '여행 중 편하게 들어가 생선구이와 밥, 반찬을 먹는 캐주얼한 한식집으로 설정했어요. 해변 산책과 점심을 짧은 이동으로 묶고 싶을 때 어울려요.',
    features: ['든든한 정식', '짧은 이동', '활기 있는 식사'],
    hours: '11:00–20:00 · 목요일 휴무 · 쉬는 시간 15:00–17:00',
    check:
      '생선 메뉴 중심의 예시예요. 생선을 먹지 않는 동행이 있다면 다른 메뉴 후보와 비교해 보세요.',
    extras: [
      { name: '전복죽', price: 16000, note: '따뜻한 한 그릇' },
      { name: '해물전', price: 12000, note: '함께 나누기' },
    ],
  },
  'hj-pasta': {
    headline: '해변 뒤, 조용한 테이블에서 해산물 파스타',
    description:
      '여유 있는 작은 테이블과 차분한 분위기의 양식집으로 설정했어요. 바다를 걷고 나서 두 사람이 앉아 천천히 식사하는 일정에 어울려요.',
    features: ['해산물 메뉴', '차분한 분위기', '둘이 식사'],
    hours: '11:30–21:00 · 화요일 휴무 · 쉬는 시간 15:00–17:00',
    check:
      '가까운 한식 후보보다 조금 더 걷고 예산도 높은 예시예요. 분위기와 가격 중 무엇이 중요한지 비교해 보세요.',
    extras: [
      { name: '토마토 파스타', price: 18000, note: '다른 메뉴 후보' },
      { name: '시트러스 샐러드', price: 10000, note: '산뜻한 곁들임' },
    ],
  },
  'hj-cafe': {
    headline: '바다를 걷고 난 뒤, 커피와 간식으로 쉬어가기',
    description:
      '창가 좌석과 작은 테이블을 갖춘 차분한 카페로 설정했어요. 해변 산책 뒤 커피 한 잔을 마시거나, 샌드위치로 가볍게 배를 채우는 일정에 어울려요.',
    features: ['조용한 대화', '샌드위치', '창가 좌석'],
    hours: '09:30–19:00 · 수요일 휴무 · 주문 마감 18:30',
    check:
      '해변 바로 앞이라는 뜻은 아니에요. 예시 도보 시간과 원하는 이동 범위를 함께 확인해 보세요.',
    extras: [
      { name: '아메리카노', price: 5000, note: '커피만 선택' },
      { name: '에그 샌드위치', price: 8000, note: '가벼운 간식' },
    ],
  },
};

const stayProfiles: Record<string, Omit<Profile, 'extras'> & { room: string }> =
  {
    'stay-coast': {
      headline: '바다 여행의 하루를 편하게 마무리',
      description:
        '제주 서쪽 여행을 중심으로 쉬는 작은 숙소로 설정했어요. 둘이 머무는 객실과 기본 시설을 갖춘 예시로, 바다 장소를 넣은 일정과 연결됩니다.',
      features: ['더블베드', '개별 욕실', '주차 공간', 'Wi-Fi'],
      hours: '체크인 15:00 · 체크아웃 11:00',
      room: '2인 객실 · 더블베드 1개 · 조식 미포함',
      check:
        '바다가 보이는 객실을 보장하지 않아요. 실제 연결 시 객실별 전망과 주차 가능 여부를 확인해야 해요.',
    },
    'stay-tea': {
      headline: '초록 풍경을 따라 쉬어가는 조용한 밤',
      description:
        '차밭과 오름을 찾는 두 사람을 위한 작은 숙소로 설정했어요. 큰 공용 시설보다 간단한 객실과 조용한 휴식을 원하는 일정에 어울려요.',
      features: ['더블베드', '개별 욕실', '작은 정원', 'Wi-Fi'],
      hours: '체크인 16:00 · 체크아웃 11:00',
      room: '2인 객실 · 더블베드 1개 · 조식 미포함',
      check:
        '체크인이 다른 후보보다 늦은 예시예요. 오후 방문과 숙소 도착 순서를 맞춰보세요.',
    },
    'stay-garden': {
      headline: '여럿이 함께 쉬는 넉넉한 여행의 밤',
      description:
        '가족이나 친구 네 명이 머무는 숙소로 설정했어요. 함께 앉을 공간과 간단한 취사 시설을 갖춘 예시라 여러 사람이 같은 일정으로 이동할 때 어울려요.',
      features: ['침실 2개', '간단한 취사', '공용 거실', '주차 공간'],
      hours: '체크인 15:00 · 체크아웃 10:00',
      room: '4인 객실 · 침실 2개 · 조식 미포함',
      check:
        '표시 가격은 4인 객실 한 개의 1박 예시예요. 인당 가격이나 실제 추가 인원 요금은 아니에요.',
    },
    'stay-forest': {
      headline: '서울숲 나들이를 하루 더 이어가는 객실',
      description:
        '서울숲을 기준으로 도심 나들이를 이어가는 두 사람의 숙소로 설정했어요. 별도 취사보다 편한 잠자리와 기본 시설을 중심으로 비교하는 예시예요.',
      features: ['더블베드', '개별 욕실', 'Wi-Fi', '짐 보관 예시'],
      hours: '체크인 15:00 · 체크아웃 11:00',
      room: '2인 객실 · 더블베드 1개 · 조식 미포함',
      check:
        '도심 숙소 예시라 주차 시설을 포함하지 않았어요. 차를 이용한다면 주차 정보를 별도로 확인해야 해요.',
    },
    'stay-city': {
      headline: '가볍게 머무는 작은 도심 객실',
      description:
        '서울 나들이 뒤 잠시 머무는 1~2인 객실로 설정했어요. 넓은 공간이나 공용 시설보다 낮은 1박 예산을 우선할 때 비교할 수 있는 후보예요.',
      features: ['작은 더블베드', '개별 욕실', 'Wi-Fi', '간단한 객실'],
      hours: '체크인 16:00 · 체크아웃 11:00',
      room: '1~2인 객실 · 작은 더블베드 1개 · 조식 미포함',
      check:
        '작은 객실의 예시예요. 큰 짐을 펴거나 오래 실내에서 머무를 계획이면 다른 후보와 공간을 비교해 보세요.',
    },
  };

export function businessDetails(ref: BusinessRef) {
  if (ref.kind === 'food') {
    const item = findFood(ref.id),
      profile = foodProfiles[ref.id];
    if (!item || !profile) return;
    const cafe = item.cuisine === '카페';
    return {
      ...profile,
      id: item.id,
      name: item.name,
      kind: cafe ? '카페' : '식당',
      image: cafe ? '/images/demo-cafe.jpg' : '/images/demo-restaurant.jpg',
      imageAlt: cafe
        ? '밝은 창과 테이블이 있는 가상 카페의 유형 예시'
        : '나무 테이블이 있는 가상 식당의 유형 예시',
      location: `${findPlace(item.placeId)?.region} · ${findPlace(item.placeId)?.name} 인근 설정`,
      price: money(item.price),
      priceLabel: cafe ? '대표 메뉴 세트 예시' : '대표 메뉴 1인 예시',
      primary: item.menu,
      menu: [
        { name: item.menu, price: item.price, note: '대표 메뉴' },
        ...profile.extras,
      ],
      walk: item.walk,
      room: null,
    };
  }
  const item = findStay(ref.id),
    profile = stayProfiles[ref.id];
  if (!item || !profile) return;
  return {
    ...profile,
    id: item.id,
    name: item.name,
    kind: '숙소',
    image: '/images/demo-stay.jpg',
    imageAlt: '더블베드와 창이 있는 가상 숙소의 객실 유형 예시',
    location: `${item.region} · ${item.near.map((id) => findPlace(id)?.name).join(' / ')} 여행권 설정`,
    price: money(item.price),
    priceLabel: '1객실 1박 예시',
    primary: profile.room,
    menu: [],
    walk: null,
  };
}

export function businessReasons(ref: BusinessRef, state: TripState): string[] {
  const details = businessDetails(ref);
  if (!details) return [];
  const place = findPlace(state.anchorId)?.name ?? state.region;
  const visit = state.plan.find((v) => v.id === ref.visitId);
  const context = visit
    ? `DAY ${visit.day}의 ${visit.label}`
    : state.editingId
      ? '교체할 일정 자리'
      : state.plan.length
        ? `DAY ${state.activeDay}`
        : '지금 선택한 여행';
  if (ref.kind === 'food') {
    const item = findFood(ref.id)!;
    return [
      `${place}에서 도보 ${item.walk}분인 예시라 산책 뒤 ${details.kind === '카페' ? '쉬어가는 코스를' : '식사를'} 연결할 수 있어요.`,
      item.quiet
        ? '차분하게 앉아 이야기하거나 쉬는 분위기로 설정했어요.'
        : '조용한 휴식보다는 함께 식사하고 대화하는 활기 있는 분위기예요.',
      `${details.primary} ${details.price} 기준으로 ${context}에 필요한 메뉴 예산을 비교할 수 있어요.`,
    ];
  }
  return [
    `${place} 중심의 ${state.region} 여행에서 비교할 숙소 후보예요. 실제 이동시간은 조회하지 않았어요.`,
    `${details.room}. 필요한 인원과 객실 구성을 비교할 수 있어요.`,
    `${details.priceLabel} ${details.price}. ${context}의 숙박 후보로 연결돼요.`,
  ];
}
