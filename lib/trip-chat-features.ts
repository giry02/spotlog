import { businessDetails } from './business-details';
import {
  places,
  restaurants,
  stays,
  findPlace,
  findFood,
  findStay,
  money,
} from './trip-data';
import {
  foodResults,
  placeResults,
  stayResults,
  visitName,
  type TripState,
  type TripSession,
} from './trip-engine';

export type ChatCandidate = {
  id: string;
  name: string;
  kind: 'place' | 'food' | 'cafe' | 'stay';
};
export type ComparisonRow = ChatCandidate & {
  image: string;
  location: string;
  price: string;
  priceLabel: string;
  walk: string;
  features: string[];
  description: string;
};
export function visibleChatCandidates(s: TripState): ChatCandidate[] {
  const mapPlace = (p: (typeof places)[number]): ChatCandidate => ({
    id: p.id,
    name: p.name,
    kind: 'place',
  });
  if (s.stage === 'compare' || s.stage === 'collection')
    return (
      s.stage === 'collection'
        ? (s.collectedIds ?? [])
        : (s.comparisonIds ?? [])
    ).flatMap((id) => {
      const p = findPlace(id),
        f = findFood(id),
        h = findStay(id);
      return p
        ? [mapPlace(p)]
        : f
          ? [
              {
                id,
                name: f.name,
                kind:
                  f.cuisine === '카페' ? ('cafe' as const) : ('food' as const),
              },
            ]
          : h
            ? [{ id, name: h.name, kind: 'stay' as const }]
            : [];
    });
  if (s.stage === 'food')
    return foodResults(s).map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.cuisine === '카페' ? 'cafe' : 'food',
    }));
  if (s.stage === 'stay')
    return stayResults(s).map((h) => ({
      id: h.id,
      name: h.name,
      kind: 'stay',
    }));
  if (s.stage === 'saved')
    return places
      .filter(
        (p) =>
          s.savedIds.includes(p.id) && (!s.region || p.region === s.region),
      )
      .map(mapPlace);
  if (s.stage === 'place')
    return places.filter((p) => p.id === s.anchorId).map(mapPlace);
  return placeResults(s).map(mapPlace);
}
export function comparisonRows(s: TripState): ComparisonRow[] {
  return (s.comparisonIds ?? []).flatMap<ComparisonRow>((id) => {
    const p = findPlace(id);
    if (p)
      return [
        {
          id,
          name: p.name,
          kind: 'place' as const,
          image: p.image,
          location: p.region,
          price: '확인 필요',
          priceLabel: '입장료 미조회',
          walk: '실제 이동시간 미조회',
          features: [...p.tags],
          description: p.description,
        },
      ];
    const f = findFood(id),
      h = findStay(id);
    const d = businessDetails({ kind: f ? 'food' : 'stay', id });
    if (!d || (!f && !h)) return [];
    return [
      {
        id,
        name: d.name,
        kind: f
          ? f.cuisine === '카페'
            ? ('cafe' as const)
            : ('food' as const)
          : ('stay' as const),
        image: d.image,
        location: d.location,
        price: d.price,
        priceLabel: d.priceLabel,
        walk: f ? `도보 ${f.walk}분 예시` : '실제 이동시간 미조회',
        features: [...d.features],
        description: d.headline,
      },
    ];
  });
}
export type BudgetLine = {
  visitId: string;
  name: string;
  category: 'food' | 'cafe' | 'stay';
  unitPrice: number;
  quantity: number;
  amount: number;
  basis: string;
};
export type BudgetSummary = {
  people: number;
  rooms: number;
  lines: BudgetLine[];
  foodTotal: number;
  cafeTotal: number;
  stayTotal: number;
  total: number;
  excluded: { visitId: string; name: string; reason: string }[];
  note: string;
};
export function budgetSummary(s: TripState): BudgetSummary {
  const people = s.budgetPeople ?? 2,
    rooms = s.budgetRooms ?? 1;
  const lines: BudgetLine[] = [],
    excluded: BudgetSummary['excluded'] = [];
  for (const v of s.plan) {
    const f = findFood(v.entityId),
      h = findStay(v.entityId);
    if (v.status === 'skipped') {
      excluded.push({
        visitId: v.id,
        name: visitName(v),
        reason: '건너뛴 방문',
      });
      continue;
    }
    if (v.locked) {
      excluded.push({
        visitId: v.id,
        name: visitName(v),
        reason: '예약한 숙소의 실제 결제금액을 알 수 없음',
      });
      continue;
    }
    if (v.kind === 'place' || !v.entityId || (!f && !h)) {
      excluded.push({
        visitId: v.id,
        name: visitName(v),
        reason:
          v.kind === 'place'
            ? '입장료·주차비 미조회'
            : '선택한 업체 또는 가격이 미정',
      });
      continue;
    }
    const category = h ? 'stay' : f?.cuisine === '카페' ? 'cafe' : 'food';
    const unitPrice = h?.price ?? f!.price,
      quantity = h ? rooms : people;
    lines.push({
      visitId: v.id,
      name: visitName(v),
      category,
      unitPrice,
      quantity,
      amount: unitPrice * quantity,
      basis: h
        ? `1객실 1박 예시 × ${rooms}객실`
        : `대표 메뉴 1인 예시 × ${people}명`,
    });
  }
  const sum = (kind: BudgetLine['category']) =>
    lines.filter((l) => l.category === kind).reduce((n, l) => n + l.amount, 0);
  return {
    people,
    rooms,
    lines,
    foodTotal: sum('food'),
    cafeTotal: sum('cafe'),
    stayTotal: sum('stay'),
    total: lines.reduce((n, l) => n + l.amount, 0),
    excluded,
    note: '가상 업체의 체험 가격 합계입니다. 교통비·입장료·주차비·미정 항목·예약 숙소 결제금액은 포함하지 않았습니다. 객실 수는 인원수로 자동 결정하지 않습니다.',
  };
}
export type ItineraryCheck = {
  id: string;
  level: 'warning' | 'info';
  title: string;
  description: string;
  visitId?: string;
  day?: number;
};
export function itineraryChecks(s: TripState): ItineraryCheck[] {
  if (!s.plan.length)
    return [
      {
        id: 'empty',
        level: 'info',
        title: '먼저 일정을 만들어 주세요',
        description: '방문·식사·숙박이 담긴 일정이 있어야 점검할 수 있어요.',
      },
    ];
  const checks: ItineraryCheck[] = [];
  for (const v of s.plan) {
    if (v.status === 'skipped') continue;
    const p = findPlace(v.entityId),
      f = findFood(v.entityId),
      h = findStay(v.entityId);
    if (!v.entityId && !v.locked)
      checks.push({
        id: `missing-${v.id}`,
        level: 'warning',
        title: `DAY ${v.day} ${v.label} 미정`,
        description: '이 자리의 후보를 선택해 주세요.',
        visitId: v.id,
        day: v.day,
      });
    if (v.locked)
      checks.push({
        id: `locked-${v.id}`,
        level: 'info',
        title: '예약 숙소 유지',
        description:
          '예약 숙소는 수정하지 않았어요. 실제 주소·결제금액·체크인 시간은 미조회예요.',
        visitId: v.id,
        day: v.day,
      });
    const region =
      p?.region ?? h?.region ?? findPlace(f?.placeId ?? null)?.region;
    if (region && region !== s.region)
      checks.push({
        id: `region-${v.id}`,
        level: 'warning',
        title: '일정 지역 확인',
        description: `${visitName(v)}의 지역이 현재 여행 지역과 달라요.`,
        visitId: v.id,
        day: v.day,
      });
    if (f && f.price > (s.foodBudget ?? Infinity))
      checks.push({
        id: `food-budget-${v.id}`,
        level: 'warning',
        title: '메뉴 예산 초과',
        description: `${visitName(v)} 예시 가격 ${money(f.price)}이 1인 메뉴 조건을 초과해요.`,
        visitId: v.id,
        day: v.day,
      });
    if (h && !v.locked && h.price > s.stayBudget)
      checks.push({
        id: `stay-budget-${v.id}`,
        level: 'warning',
        title: '숙박 예산 초과',
        description: `${visitName(v)} 1객실·1박 예시가 숙박 조건을 초과해요.`,
        visitId: v.id,
        day: v.day,
      });
    if (
      v.entityId &&
      s.plan.some(
        (other) =>
          other.id !== v.id &&
          other.day === v.day &&
          other.entityId === v.entityId &&
          other.status !== 'skipped',
      )
    )
      checks.push({
        id: `repeat-${v.id}`,
        level: 'warning',
        title: '같은 DAY의 중복 방문',
        description: `${visitName(v)}이 같은 날에 여러 번 들어 있어요.`,
        visitId: v.id,
        day: v.day,
      });
  }
  for (let day = 1; day <= s.days; day++) {
    if (!s.plan.some((v) => v.day === day && v.status !== 'skipped'))
      checks.push({
        id: `empty-day-${day}`,
        level: 'warning',
        title: `DAY ${day} 일정 없음`,
        description:
          '다른 DAY의 방문을 옮기거나 이 날짜에 장소를 추가해 주세요.',
        day,
      });
  }
  if (!checks.some((c) => c.level === 'warning'))
    checks.push({
      id: 'supported-pass',
      level: 'info',
      title: '저장된 항목에서 충돌을 찾지 못했어요',
      description:
        '지역·미정 항목·중복 방문·설정한 가격 조건만 확인한 결과예요.',
    });
  checks.push({
    id: 'live-not-checked',
    level: 'info',
    title: '실제 시간 점검은 아직 연결 전이에요',
    description:
      '여행 날짜·예약 시간·교통수단·실시간 영업시간·이동시간이 없어 시간상 방문 가능 여부는 판단하지 않았어요.',
  });
  return checks;
}
export function chatEntityDetail(s: TripState) {
  const id = s.detailId ?? null,
    p = findPlace(id);
  if (p)
    return {
      id: p.id,
      name: p.name,
      kind: '장소',
      image: p.image,
      imageAlt: p.name,
      headline: p.description,
      description:
        '장소 사진은 실제 장소를 나타냅니다. 분위기 태그와 추천 순위는 체험용 설정입니다.',
      location: p.region,
      features: [...p.tags],
      hours: '실제 운영시간 미조회',
      price: '확인 필요',
      priceLabel: '입장료 미조회',
      primary: p.tags.join(' · '),
      menu: [] as { name: string; price: number; note: string }[],
      room: null,
      walk: null,
      check:
        '방문 전 최신 영업·입장 정보를 지도나 공식 채널에서 확인해 주세요.',
    };
  if (!id) return undefined;
  return businessDetails({ kind: findFood(id) ? 'food' : 'stay', id });
}
export const chatHelpGroups = [
  {
    title: '장소와 주변 후보',
    examples: [
      '제주에서 바다 볼 만한 곳 찾아줘',
      '오설록처럼 초록이 많은 곳 찾아줘',
      '협재 근처 식당 찾아줘',
      '첫 번째 식당 골라줘',
      '이 두 식당 비교해줘',
      '첫 번째 식당 메뉴 보여줘',
    ],
  },
  {
    title: '조건과 상세',
    examples: [
      '도보 10분 안에서 찾아줘',
      '한식만 보여줘',
      '식당 1만5천원 이하로',
      '숙소 10만원 이하로',
      '바다 앞 한상 영업시간 알려줘',
    ],
  },
  {
    title: '이번 여행에 여러 곳 담기',
    examples: [
      '협재 여행에 담아줘',
      '오설록도 담아줘',
      '바다 앞 한상도 담아줘',
      '담은 곳 보여줘',
      '협재 담은 목록에서 빼줘',
      '담은 곳으로 일정 짜줘',
    ],
  },
  {
    title: '찜과 여행 만들기',
    examples: [
      '협재 찜해줘',
      '협재 찜 해제해줘',
      '찜한 장소 보여줘',
      '제주 1박 2일 일정 짜줘',
      '숙소는 이미 예약했어',
      '이 카페를 일정에 추가해줘',
    ],
  },
  {
    title: '일정 수정과 점검',
    examples: [
      'DAY 2 일정 보여줘',
      'DAY 1 점심 바꿔줘',
      'DAY 1 점심 일정에서 빼줘',
      '첫 번째 방문 순서를 뒤로 옮겨줘',
      'DAY 1 첫 번째 방문을 DAY 2로 옮겨줘',
      '방금 수정 취소해줘',
      '2인 1객실 여행 예산 계산해줘',
      '일정 점검해줘',
    ],
  },
  {
    title: '저장과 방문 기록',
    examples: [
      '일정 저장해줘',
      '저장한 여행 보여줘',
      '첫 번째 저장한 여행 열어줘',
      '대화 기록 보여줘',
      '3번째 결과에서 이어갈래',
      '다녀왔어',
      '다음 장소 길찾기 해줘',
      '대화 초기화해줘',
    ],
  },
] as const;
export function libraryCards(session: TripSession) {
  return session.library.map((p) => ({ ...p, count: p.visits.length }));
}
export function historyCards(session: TripSession) {
  return session.turns
    .filter((t) => Boolean(t.state.question))
    .map((t) => ({
      id: t.id,
      question: t.state.question,
      stage: t.state.stage,
    }));
}
