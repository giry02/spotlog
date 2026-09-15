import type { Journey, Place, PlaceKind } from './data';

export type TravelPace = 'slow' | 'balanced' | 'full';
export type TravelTransport = 'undecided' | 'walk' | 'transit' | 'car';
export interface TravelConditions {
  region: string;
  dayCount: number;
  pace: TravelPace;
  transport: TravelTransport;
  interests: string[];
  excludedKinds: PlaceKind[];
  excludedThemes: string[];
}
export interface TravelInput {
  prompt: string;
  overrides?: Partial<Pick<TravelConditions, 'region' | 'dayCount' | 'pace' | 'transport'>>;
}
export interface TravelInterpretation { conditions: TravelConditions; errors: string[]; notices: string[] }
export interface TravelDraftResult extends TravelInterpretation {
  provider: 'local-catalog';
  journey: Journey | null;
  sourcePlaceIds: string[];
  omittedPlaceIds: string[];
}
/** A future server adapter can replace this boundary without changing the sheet. */
export interface TravelDraftProvider {
  id: string;
  generate(input: TravelInput, places: Place[]): Promise<TravelDraftResult>;
}

const provinceAliases: Record<string, string[]> = {
  서울: ['서울', 'seoul'], 부산: ['부산', 'busan'], 제주: ['제주', 'jeju'], 경기: ['경기', '경기도'],
  인천: ['인천', 'incheon'], 강원: ['강원', '강원도'], 충북: ['충북', '충청북도'], 충남: ['충남', '충청남도'],
  대전: ['대전', 'daejeon'], 세종: ['세종', 'sejong'], 전북: ['전북', '전라북도'], 전남: ['전남', '전라남도'],
  광주: ['광주', 'gwangju'], 경북: ['경북', '경상북도'], 경남: ['경남', '경상남도'], 대구: ['대구', 'daegu'], 울산: ['울산', 'ulsan'],
};
const cityProvinces = new Set(['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남']);
const themes = [
  { label: '바다', words: ['바다', '해변', '해안', '동해', '서해', '남해'] },
  { label: '숲·자연', words: ['숲', '자연', '정원', '수목원', '공원', '초록'] },
  { label: '역사·문화', words: ['역사', '문화', '전시', '박물관', '한옥', '고택', '사찰'] },
  { label: '야경·노을', words: ['야경', '노을', '일몰', '저녁빛'] },
  { label: '산책', words: ['산책', '걷기', '도보'] },
];
const kindWords: { kind: PlaceKind; label: string; words: string[] }[] = [
  { kind: 'CAFE', label: '카페', words: ['카페', '커피', '베이커리'] },
  { kind: 'FOOD', label: '음식', words: ['식당', '음식점', '음식', '맛집', '먹거리'] },
  { kind: 'STAY', label: '숙소', words: ['숙소', '숙박', '호텔'] },
  { kind: 'SHOP', label: '쇼핑', words: ['쇼핑', '상점', '로컬숍'] },
];
const negative = (text: string, word: string) => new RegExp(`${word}(?:은|는|를|을|도)?\\s*(?:빼|제외|말고|안\\s*가|안\\s*넣|없이|싫|없었|없으면)`).test(text);
const unique = <T,>(values: T[]): T[] => [...new Set(values)];

export function travelRegionOptions(places: Place[]): string[] {
  const values = places.flatMap((place) => {
    const [province, city] = place.area.split(/\s+/);
    return province ? [province, ...(city && cityProvinces.has(province) ? [`${province} ${city}`] : [])] : [];
  });
  return unique(values);
}

export function interpretTravelPrompt(input: TravelInput, places: Place[]): TravelInterpretation {
  const prompt = input.prompt.trim().toLowerCase();
  const errors: string[] = [];
  const notices: string[] = [];
  const options = travelRegionOptions(places);
  const matchingCities = options.filter((region) => region.includes(' ') && prompt.includes(region.split(' ')[1]));
  const matchingProvinces = Object.entries(provinceAliases).filter(([, words]) => words.some((word) => prompt.includes(word))).map(([region]) => region);
  const destinations = unique([...matchingCities, ...matchingProvinces.filter((region) => !matchingCities.some((city) => city.startsWith(`${region} `)))]);
  let region = input.overrides?.region ?? (destinations.length === 1 ? destinations[0] : '');
  if (!prompt) errors.push('가고 싶은 지역과 여행 내용을 적어 주세요.');
  if (input.overrides?.region && !options.includes(region)) errors.push('현재 준비된 지역을 선택해 주세요.');
  if (!region) errors.push(destinations.length > 1 ? '여러 지역이 적혀 있어요. 이번 초안을 만들 지역 하나를 선택해 주세요.' : '여행할 지역을 찾지 못했어요. 아래에서 지역을 선택하거나 지역명을 적어 주세요.');
  if (region && !options.includes(region)) { errors.push(`${region}의 장소 데이터가 아직 준비되지 않았어요. 다른 지역을 선택해 주세요.`); region = ''; }
  const nightsAndDays = prompt.match(/(\d+)\s*박\s*(\d+)\s*일/);
  const nights = prompt.match(/(\d+)\s*박/);
  const explicitDays = prompt.replace(/\d+\s*월\s*\d+\s*일/g, '').match(/(\d+)\s*(?:일(?:간|동안|\s*여행)?|days?)/);
  let dayCount = nightsAndDays ? Number(nightsAndDays[2]) : /당일|하루|당일치기/.test(prompt) ? 1 : /일주일|일주일간/.test(prompt) ? 7 : explicitDays ? Number(explicitDays[1]) : nights ? Number(nights[1]) + 1 : 2;
  if (nightsAndDays && Number(nightsAndDays[1]) + 1 !== Number(nightsAndDays[2]) && input.overrides?.dayCount === undefined) errors.push('숙박 수와 여행 일수가 달라요. 아래에서 여행 기간을 다시 선택해 주세요.');
  if (!nightsAndDays && !nights && !explicitDays && !/당일|하루|일주일/.test(prompt) && input.overrides?.dayCount === undefined) notices.push('기간을 따로 적지 않아 1박 2일로 제안해요. 아래에서 바꿀 수 있어요.');
  dayCount = input.overrides?.dayCount ?? dayCount;
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7) errors.push('로컬 추천 미리보기는 당일치기부터 6박 7일까지 지원해요. 여행 기간을 선택해 주세요.');
  if (/\d+\s*월|\d{4}[-./]\d|내일|모레|주말|다음\s*주/.test(prompt)) notices.push('날짜 표현은 아직 자동 적용하지 않아요. DAY별 초안으로 만들며 실제 날짜는 내 여행에서 정해 주세요.');
  const interests: string[] = [];
  const excludedThemes: string[] = [];
  const excludedKinds: PlaceKind[] = [];
  themes.forEach(({ label, words }) => {
    if (words.some((word) => negative(prompt, word))) excludedThemes.push(label);
    else if (words.some((word) => prompt.includes(word))) interests.push(label);
  });
  kindWords.forEach(({ kind, label, words }) => {
    if (words.some((word) => negative(prompt, word))) excludedKinds.push(kind);
    else if (words.some((word) => prompt.includes(word))) interests.push(label);
  });
  const pace: TravelPace = input.overrides?.pace ?? (/천천히|여유|덜\s*걷|많이\s*걷기?\s*싫|느리|적게\s*걷/.test(prompt) ? 'slow' : /알차|많이\s*보|빼곡|빡빡/.test(prompt) ? 'full' : 'balanced');
  const transport: TravelTransport = input.overrides?.transport ?? (/대중교통|지하철|버스/.test(prompt) ? 'transit' : /렌[트터]|자동차|차량|드라이브|자차/.test(prompt) ? 'car' : /도보|걸어서/.test(prompt) ? 'walk' : 'undecided');
  return { conditions: { region, dayCount, pace, transport, interests: unique(interests), excludedKinds, excludedThemes }, errors: unique(errors), notices };
}

const placeText = (place: Place) => `${place.name} ${place.description} ${(place.tags ?? []).join(' ')}`;
const hasTheme = (place: Place, label: string) => themes.find((theme) => theme.label === label)?.words.some((word) => placeText(place).includes(word)) ?? false;
const distance = (a: Place, b: Place) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad; const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** Catalog-only demo: grouping uses straight-line proximity, NEVER verified routes or popularity. */
export function buildLocalTravelDraft(input: TravelInput, places: Place[]): TravelDraftResult {
  const parsed = interpretTravelPrompt(input, places);
  const result: TravelDraftResult = { ...parsed, provider: 'local-catalog', journey: null, sourcePlaceIds: [], omittedPlaceIds: [] };
  if (parsed.errors.length) return result;
  const { conditions } = parsed;
  const regional = [...new Map(places.filter((place) => place.area === conditions.region || place.area.startsWith(`${conditions.region} `)).map((place) => [place.id, place])).values()];
  const candidates = regional.filter((place) => !conditions.excludedKinds.includes(place.kind) && !conditions.excludedThemes.some((theme) => hasTheme(place, theme)) && (place.kind !== 'STAY' || conditions.interests.includes('숙소')));
  const valid = candidates.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng) && place.lat >= 33 && place.lat <= 39 && place.lng >= 124 && place.lng <= 132);
  if (valid.length !== candidates.length) result.notices.push('좌표가 없거나 국내 위치로 확인되지 않은 장소는 배치하지 않았어요.');
  const scored = valid.map((place, order) => ({ place, order, score: conditions.interests.reduce((sum, interest) => sum + (hasTheme(place, interest) || kindWords.some((kind) => kind.kind === place.kind && kind.label === interest) ? 5 : 0), place.kind === 'LANDMARK' ? 1 : 0) })).sort((a, b) => b.score - a.score || a.order - b.order);
  if (!scored.length) { result.errors.push('선택한 지역과 제외 조건에 맞는 장소가 아직 없어요. 조건을 바꿔 주세요.'); return result; }
  const unmatched = conditions.interests.filter((interest) => !scored.some(({ place }) => hasTheme(place, interest) || kindWords.some((kind) => kind.label === interest && kind.kind === place.kind)));
  if (unmatched.length) result.notices.push(`${unmatched.join(' · ')} 조건에 맞는 장소는 현재 자료에서 찾지 못했어요. 다른 등록 장소만 제안해요.`);
  const maxPerDay = conditions.pace === 'slow' ? 2 : conditions.pace === 'full' ? 4 : 3;
  const selected = scored.slice(0, conditions.dayCount * maxPerDay).map(({ place }) => place);
  const pool = [...selected];
  const id = `journey-${crypto.randomUUID()}`;
  const days: Journey['days'] = [];
  // Pick one nearby group per day; no interleaved round-robin through distant cities.
  for (let dayIndex = 0; dayIndex < conditions.dayCount; dayIndex += 1) {
    const remainingDays = conditions.dayCount - dayIndex;
    const target = Math.min(maxPerDay, Math.ceil(pool.length / remainingDays));
    const group: Place[] = [];
    if (pool.length) group.push(pool.shift()!);
    while (group.length < target && pool.length) {
      const previous = group[group.length - 1];
      const nearest = pool.map((place, index) => ({ index, km: distance(previous, place) })).sort((a, b) => a.km - b.km)[0];
      const maxGroupingDistance = conditions.transport === 'walk' ? 3 : conditions.pace === 'slow' ? 15 : 40;
      if (nearest.km > maxGroupingDistance) break;
      group.push(pool.splice(nearest.index, 1)[0]);
    }
    const visits = group.map((place, index) => ({ ...structuredClone(place), visitId: `${id}:day-${dayIndex + 1}:visit-${index}`, time: undefined, move: '경로·이동시간 확인 필요' }));
    days.push({ day: dayIndex + 1, date: `DAY ${dayIndex + 1}`, title: visits.length ? visits.map((place) => place.name).join(' · ') : '장소를 더 골라 주세요', story: visits.length ? '등록된 장소 자료와 직선거리로 묶은 로컬 초안입니다. 방문 순서·교통편·영업시간은 아직 검증되지 않았습니다.' : '준비된 장소가 부족해 비워 두었습니다. 내 여행에서 장소를 추가해 주세요.', places: visits, blocks: visits.map((place) => ({ id: `${place.visitId}:block`, type: 'PLACE', placeId: place.id, visitId: place.visitId })) });
  }
  result.sourcePlaceIds = days.flatMap((day) => day.places.map((place) => place.id));
  result.omittedPlaceIds = candidates.filter((place) => !result.sourcePlaceIds.includes(place.id)).map((place) => place.id);
  if (days.some((day) => !day.places.length)) result.notices.push('장소 자료가 부족한 DAY는 빈 상태로 남겼어요. 여행 기간을 임의로 줄이지 않았어요.');
  if (pool.length) result.notices.push('멀리 떨어져 같은 날 묶지 않은 장소가 있어요. 나머지 장소는 내 여행에서 직접 확인해 주세요.');
  if (conditions.pace === 'slow') result.notices.push('여유롭게 보기 위해 하루 최대 2곳만 제안해요. 계단·실제 걷기 부담까지 검증한 것은 아니에요.');
  result.notices.push('현재 등록 자료에 샘플 사진·설명이 포함돼 있어요. 실제 방문 전 장소·영업·사진을 확인해 주세요.');
  result.notices.push('외부 AI·실시간 교통·예약은 연결되지 않았어요. 인기 순위가 아닌 입력 단어와 등록 자료의 일치 기준이에요.');
  const journey: Journey & { recommendationKind: 'AI' } = {
    id, title: `${conditions.region} ${conditions.dayCount === 1 ? '당일' : `${conditions.dayCount - 1}박 ${conditions.dayCount}일`} 여행`,
    region: conditions.region, dateRange: '날짜 미정', duration: conditions.dayCount === 1 ? '당일 여행' : `${conditions.dayCount - 1}박 ${conditions.dayCount}일`,
    status: 'PLANNING', visibility: 'PRIVATE', cover: days.flatMap((day) => day.places)[0]?.image ?? '',
    summary: `원하는 내용을 바탕으로 ${result.sourcePlaceIds.length}곳을 고른 로컬 추천 초안입니다.`,
    story: `요청: ${input.prompt.trim()}\n\n등록된 장소 자료를 조건별로 고른 로컬 추천 미리보기입니다. 외부 AI와 실제 경로는 아직 연결되지 않았습니다. 여행 전 운영·이동 정보를 확인해 주세요.`,
    tags: [...conditions.interests, '로컬 추천 초안'], saves: 0, views: 0, author: 'Spotlog 여행자', isMine: true, recommendationKind: 'AI', days,
  };
  result.journey = journey;
  return result;
}

export const localTravelDraftProvider: TravelDraftProvider = {
  id: 'local-catalog',
  generate: async (input, places) => buildLocalTravelDraft(input, places),
};
