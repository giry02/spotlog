import { businessDetails } from './business-details';
import {
  places,
  restaurants,
  stays,
  findPlace,
  findFood,
  findStay,
  money,
  getKnownEntityPrice,
} from './trip-data';
import { getRegisteredEntity, straightDistanceKm } from './registered-catalog';
import { placeMapCoordinates } from './trip-map-data';
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
  kind: 'place' | 'food' | 'cafe' | 'shop' | 'stay';
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
const foodKind = (cuisine: string): ChatCandidate['kind'] => cuisine === '카페' ? 'cafe' : cuisine === '상점' ? 'shop' : 'food';
function entityCoordinate(id: string | null | undefined) {
  const registered = getRegisteredEntity(id);
  if (registered) return registered;
  return id && Object.hasOwn(placeMapCoordinates, id) ? placeMapCoordinates[id] : undefined;
}
function registeredDistance(s: TripState, id: string) {
  const anchor = entityCoordinate(s.anchorId), destination = entityCoordinate(id);
  return anchor && destination
    ? `기준 장소에서 직선 ${straightDistanceKm(anchor, destination).toFixed(1)}km · 이동시간 미조회`
    : '직선거리·이동시간 미조회';
}
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
                  foodKind(f.cuisine),
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
      kind: foodKind(f.cuisine),
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
          location: p.address ?? `${p.region} · ${p.district}`,
          price: '확인 필요',
          priceLabel: '입장료 미조회',
          walk: registeredDistance(s, p.id),
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
          ? foodKind(f.cuisine)
          : ('stay' as const),
        image: d.image,
        location: d.location,
        price: d.price,
        priceLabel: d.priceLabel,
        walk: d.registered ? registeredDistance(s, id) : f ? `도보 ${f.walk}분 예시` : '실제 이동시간 미조회',
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
  totalLabel: string;
  hasUnpricedItems: boolean;
  unpricedCount: number;
  /** The demo and the unpriced registered catalog cannot confirm a real budget. */
  canConfirmBudget: boolean;
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
    const unitPrice = getKnownEntityPrice(h ?? f);
    if (unitPrice === null || f?.cuisine === '상점') {
      excluded.push({ visitId: v.id, name: visitName(v), reason: f?.cuisine === '상점' ? '구매할 상품·수량·현재 가격 미확인' : '현재 가격 미확인 · 0원이나 예산 충족으로 계산하지 않음' });
      continue;
    }
    const category = h ? 'stay' : f?.cuisine === '카페' ? 'cafe' : 'food';
    const quantity = h ? rooms : people;
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
  const total = lines.reduce((n, l) => n + l.amount, 0);
  const unpricedCount = excluded.filter(item => !/건너뛴/.test(item.reason)).length;
  return {
    people,
    rooms,
    lines,
    foodTotal: sum('food'),
    cafeTotal: sum('cafe'),
    stayTotal: sum('stay'),
    total,
    totalLabel: lines.length ? `${money(total)}${unpricedCount ? ' + 미확인 비용' : ' (예시)'}` : '계산할 가격 미확인',
    hasUnpricedItems: unpricedCount > 0,
    unpricedCount,
    canConfirmBudget: false,
    excluded,
    note: '예시 가격이 있는 항목만 계산한 부분 합계입니다. 등록 업체의 미확인 가격을 무료로 계산하지 않으며 전체 여행이 예산을 충족한다고 판단하지 않습니다. 교통비·입장료·주차비·미정 항목·예약 숙소 결제금액은 제외했고 객실 수는 인원수로 자동 결정하지 않습니다.',
  };
}
export type ItineraryCheck = {
  id: string;
  level: 'warning' | 'info';
  title: string;
  description: string;
  visitId?: string;
  day?: number;
  focus?: 'time' | 'location' | 'candidate';
  relatedVisitIds?: string[];
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
      p?.region ?? h?.region ?? f?.region ?? findPlace(f?.placeId ?? null)?.region;
    if (region && region !== s.region)
      checks.push({
        id: `region-${v.id}`,
        level: 'warning',
        title: '일정 지역 확인',
        description: `${visitName(v)}의 지역이 현재 여행 지역과 달라요.`,
        visitId: v.id,
        day: v.day,
      });
    const price = getKnownEntityPrice(h ?? f);
    if ((f || h) && !v.locked && price === null)
      checks.push({
        id: `price-unknown-${v.id}`, level: 'warning', title: '가격 미확인 · 예산 판단 불가',
        description: `${visitName(v)}의 현재 가격이 없어 예산 조건을 충족하는지 확인할 수 없어요. 0원으로 계산하지 않았어요.`,
        visitId: v.id, day: v.day, focus: 'candidate',
      });
    if ((v.entityId || v.locked) && !entityCoordinate(v.entityId))
      checks.push({
        id: `location-unknown-${v.id}`, level: 'warning', title: '위치 미확인 · 동선에서 제외',
        description: `${visitName(v)}의 확인된 대표 좌표가 없어 지도 핀과 이동 경로에 포함하지 않았어요. 기준 장소의 좌표를 대신 쓰지 않았어요.`,
        visitId: v.id, day: v.day, focus: 'location',
      });
    if (f && price !== null && price > (s.foodBudget ?? Infinity))
      checks.push({
        id: `food-budget-${v.id}`,
        level: 'warning',
        title: '메뉴 예산 초과',
        description: `${visitName(v)} 예시 가격 ${money(f.price)}이 1인 메뉴 조건을 초과해요.`,
        visitId: v.id,
        day: v.day,
      });
    if (h && !v.locked && price !== null && price > s.stayBudget)
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
  // Only explicit visit start times and positive explicit durations create an
  // interval. Catalog stay suggestions and road/walk estimates never fill gaps.
  const intervals = s.plan.flatMap(visit => {
    if (visit.status === 'skipped' || !visit.time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(visit.time) || !Number.isInteger(visit.durationMinutes) || !visit.durationMinutes || visit.durationMinutes < 0 || visit.durationMinutes > 1440) return [];
    const [hours, minutes] = visit.time.split(':').map(Number);
    const start = (visit.day - 1) * 1440 + hours * 60 + minutes;
    return [{ visit, start, end: start + visit.durationMinutes }];
  }).sort((a,b) => a.start - b.start || a.visit.id.localeCompare(b.visit.id));
  for (let first = 0; first < intervals.length; first++) {
    for (let next = first + 1; next < intervals.length; next++) {
      const earlier = intervals[first], later = intervals[next];
      if (later.start >= earlier.end) break;
      if (earlier.start < later.end && later.start < earlier.end)
        checks.push({
          id: `time-overlap-${earlier.visit.id}-${later.visit.id}`, level: 'warning',
          title: '입력한 방문 시간이 겹쳐요',
          description: `DAY ${earlier.visit.day} ${visitName(earlier.visit)}(${earlier.visit.time}, ${earlier.visit.durationMinutes}분)와 DAY ${later.visit.day} ${visitName(later.visit)}(${later.visit.time}, ${later.visit.durationMinutes}분)의 입력 시간이 겹쳐요. 이동시간을 더하지 않고 비교한 결과예요.`,
          visitId: later.visit.id, day: later.visit.day, relatedVisitIds: [earlier.visit.id, later.visit.id], focus: 'time',
        });
    }
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
        '지역·미정 항목·중복 방문·확인된 가격 조건과 직접 입력한 시간의 겹침만 확인한 결과예요. 전체 예산이나 실제 이동 가능 여부를 보증하지 않아요.',
    });
  checks.push({
    id: 'live-not-checked',
    level: 'info',
    title: '실제 영업·이동시간은 미확인이에요',
    description:
      '직접 입력한 시작시간과 체류시간이 모두 있는 방문의 겹침만 비교했어요. 실시간 영업시간·교통수단별 이동시간·예약 가능 여부는 조회하지 않아 실제 방문 가능 여부는 판단하지 않았어요.',
  });
  return checks;
}
export function chatEntityDetail(s: TripState) {
  const id = s.detailId ?? null,
    p = findPlace(id);
  if (p)
    return {
      registered: Boolean(p.registered), photos: p.photos ?? [],
      sourceUrl: p.sourceUrl, sourceProvider: p.sourceProvider, sourceVerifiedAt: p.sourceVerifiedAt,
      id: p.id,
      name: p.name,
      kind: '장소',
      image: p.image,
      imageAlt: p.name,
      headline: p.description,
      description: p.registered ? `Spotlog에 등록된 공식 기본정보와 직접 작성한 안내입니다. 자료 확인일 ${p.sourceVerifiedAt}. 현재 운영·입장 조건은 방문 전에 원문에서 확인해 주세요.` : `${p.imageKind === 'illustration' ? '장소를 설명하기 위한 그림이며 실제 현장 사진이 아닙니다.' : '장소 사진은 실제 장소를 나타냅니다.'} 분위기 태그와 추천 순위는 체험용 설정입니다.${p.durationMinutes ? ` 체류 약 ${p.durationMinutes}분은 체험용 가정이며 실제 소요시간을 조회한 값이 아닙니다.` : ''}`,
      location: p.address ?? `${p.region}${p.district ? ` · ${p.district}` : ''}`,
      features: [...p.tags],
      hours: '실제 운영시간 미조회',
      price: '확인 필요',
      priceLabel: '입장료 미조회',
      primary: p.tags.join(' · '),
      menu: [] as { name: string; price: number; note: string }[],
      room: null,
      walk: null,
      check:
        p.visitNote ??
        '방문 전 최신 영업·입장 정보를 지도나 공식 채널에서 확인해 주세요.',
    };
  if (!id) return undefined;
  return businessDetails({ kind: findFood(id) ? 'food' : 'stay', id });
}
export const chatHelpGroups = [
  {
    title: '여행 이름·날짜·7일 일정',
    examples: [
      '부산 6박 7일 여행 일정 짜줘',
      '여행 이름을 부산 바다 일주로 바꿔줘',
      '여행 시작일을 2026-11-01로 바꿔줘',
      'DAY 1 첫 번째 방문은 10시, 체류시간은 60분으로 저장해줘',
      'DAY 1 첫 번째 방문에 편한 신발 챙기기라고 메모해줘',
    ],
  },
  {
    title: '다른 여행자의 공개 코스',
    examples: [
      '다른 여행자가 만든 제주 여행 보여줘',
      '다른 사람의 바다 코스 보여줘',
      '첫 번째 코스를 내 여행으로 가져와',
      '일정 저장해줘',
    ],
  },
  {
    title: '장소와 주변 후보',
    examples: [
      '제주에서 바다 볼 만한 곳 찾아줘',
      '오설록처럼 초록이 많은 곳 찾아줘',
      '해운대해수욕장 근처 식당 찾아줘',
      '해운대해수욕장 근처 상점 찾아줘',
      '주변 후보를 15km까지 넓혀줘',
      '첫 번째 식당 골라줘',
      '이 두 식당 비교해줘',
      '첫 번째 식당 메뉴 보여줘',
    ],
  },
  {
    title: '조건과 상세',
    examples: [
      '3km 안의 등록 업체 찾아줘',
      '한식만 보여줘',
      '식당 1만5천원 이하로',
      '숙소 10만원 이하로',
      '금수복국 해운대본점 상세정보 보여줘',
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
    title: '후보를 모으고 마지막에 확정',
    examples: [
      '이 식당 두 곳을 DAY 1 점심 후보로 보관해줘',
      'DAY 1 점심 후보에서 두 번째 식당 선택해줘',
      '선택한 후보를 일정에 확정해줘',
      '후보 선택 취소해줘',
    ],
  },
  {
    title: '숙박 날짜와 DAY 편집',
    examples: [
      '웨스틴 조선 부산을 DAY 1부터 2박으로 배치해줘',
      'DAY 1을 새 날짜로 복사해줘',
      'DAY 2 다음에 빈 날짜 추가해줘',
      'DAY 1 첫 번째 방문을 DAY 3에도 복사해줘',
      'DAY 3을 삭제해줘',
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
  {
    title: '여행 휴지통과 앱 화면 연결',
    examples: [
      '첫 번째 저장한 여행을 휴지통으로 옮겨줘',
      '여행 휴지통 보여줘',
      '휴지통의 첫 번째 여행 복원해줘',
      'Spotlog 저장한 장소 화면 열어줘',
      'Spotlog 내 여행 화면 열어줘',
      'Spotlog 여행기 작성 화면 열어줘',
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
