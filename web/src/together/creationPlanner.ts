import type { Place } from '../data';
import type { GroupKind, GroupTopic } from './model';

export type CreationPurpose = 'MEETUP' | 'OUTING' | 'TRIP' | 'GROUP';
export interface CreationBrief {
  prompt: string; purpose: CreationPurpose; region: string; date: string; endDate: string; startTime: string;
  people?: number; budgetPerPerson?: number; walkingLimitMinutes?: number;
  transport: 'UNSET' | 'WALK' | 'PUBLIC' | 'CAR';
  theme: 'FOOD' | 'CAFE' | 'FOLIAGE' | 'CULTURE' | 'TRAVEL' | 'OTHER'; notes: string; dayCount?: number;
  /** Shared interests describe content; purpose describes the saved item. */
  topics?: GroupTopic[];
  /** Explicit choice only. An empty-location draft is never a verified route. */
  locationUndecided?: boolean;
}
export interface CreationPlan {
  id: string; source: 'CATALOG'; title: string; placeIds: string[]; days: { day: number; placeIds: string[] }[];
  explanation: string[]; unknowns: string[];
}
export interface CreationGroupDraft {
  name: string; kind: GroupKind; region: string; introduction: string;
  topics?: GroupTopic[]; welcome?: string; joinGuide?: string; firstActivityIdea?: string; joinMode?: 'DIRECT' | 'APPROVAL';
}

/** Only a future server boundary. No provider invocation or client-side API keys. */
export interface CreationPlannerRequestV1 {
  requestId: string; brief: CreationBrief; catalogVersion: string; eligiblePlaceIds: string[];
  mode: 'NEW'; locale: string; timeZone: string;
}
export interface CreationPlannerResponseV1 {
  requestId: string; source: 'LLM'; status: 'READY' | 'INSUFFICIENT_DATA'; catalogVersion: string;
  plans: Array<Omit<CreationPlan, 'source'> & { source: 'LLM' }>;
}

const regionAliases: Record<string, string> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주',
  대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 세종시: '세종', 경기도: '경기',
  강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 경상북도: '경북', 경상남도: '경남',
  전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 제주특별자치도: '제주', 제주도: '제주',
};
const regionRoots = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '경북', '경남', '전북', '전남', '제주'];
const boundedText = (value: unknown, limit = 1000): string => typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
const normalizedRegion = (value: unknown): string => {
  let text = boundedText(value, 100);
  for (const [original, replacement] of Object.entries(regionAliases)) text = text.replaceAll(original, replacement);
  return text.replace(/[,/·]+/g, ' ').replace(/\s+/g, ' ').trim();
};
const regionTokens = (value: string) => normalizedRegion(value).split(' ').filter(Boolean).map(token => token.replace(/(?:특별자치시|광역시|특별시|특별자치도|[시군구])$/, ''));
const rootRegion = (value: string) => normalizedRegion(value).split(' ')[0] || '';
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const validTime = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const dateRangeDays = (start: string, end: string) => validDate(start) && validDate(end) ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1 : undefined;
const boundedNumber = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const purposeValues: CreationPurpose[] = ['MEETUP', 'OUTING', 'TRIP', 'GROUP'];
const themes: CreationBrief['theme'][] = ['FOOD', 'CAFE', 'FOLIAGE', 'CULTURE', 'TRAVEL', 'OTHER'];
const transports: CreationBrief['transport'][] = ['UNSET', 'WALK', 'PUBLIC', 'CAR'];
const placeKinds: Place['kind'][] = ['LANDMARK', 'LEISURE', 'FOOD', 'CAFE', 'STAY', 'SHOP'];
const topicRules: [GroupTopic, RegExp][] = [
  ['FOOD', /맛집|음식점|식당|식사|점심|저녁|밥/], ['CAFE', /카페|커피|차\s*마/], ['BOOK', /독서|책\s*읽|북클럽|책\s*모임/],
  ['TRAVEL', /여행/], ['WALK', /산책|나들이|걷기\s*(?:모임|운동)|함께\s*걷|걷고\s*싶/], ['OUTDOOR', /단풍|꽃놀이|자연|등산|캠핑|야외|트레킹|바다|숲|공원/], ['CULTURE', /전시|박물관|미술관|문화|공연|영화|뮤지컬/],
  ['FAMILY', /가족|부모님|엄마|아빠/], ['PHOTO', /사진|촬영/], ['SOCIAL', /친구|친목|사교|새로운\s*사람|동네\s*사람/],
  ['SPORTS', /운동|러닝|달리기|축구|농구|배드민턴|테니스|볼링|탁구|자전거/], ['GAME', /게임|체스|바둑|마작/],
  ['LANGUAGE', /영어|일본어|중국어|외국어|언어\s*교환/], ['MUSIC', /노래|음악|악기|피아노|합창|밴드/],
  ['CRAFT', /공예|도예|뜨개|그림|그리기/], ['PETS', /반려|강아지|고양이|펫/],
];
const topicIds = topicRules.map(([id]) => id);
const themeTopics: Partial<Record<CreationBrief['theme'], GroupTopic>> = { FOOD: 'FOOD', CAFE: 'CAFE', FOLIAGE: 'OUTDOOR', CULTURE: 'CULTURE', TRAVEL: 'TRAVEL' };
const topicNames: Record<GroupTopic, string> = { FOOD: '맛집', CAFE: '카페', BOOK: '독서', TRAVEL: '여행', WALK: '산책', OUTDOOR: '자연·야외', CULTURE: '문화', FAMILY: '가족', PHOTO: '사진', SOCIAL: '친목', SPORTS: '운동', GAME: '보드게임', LANGUAGE: '언어', MUSIC: '음악', CRAFT: '공예', PETS: '반려동물' };

/** An explicit empty selection must not reintroduce stale prompt/theme interests. */
export function creationBriefTopics(brief: Pick<CreationBrief, 'topics' | 'theme'>): GroupTopic[] {
  if (Array.isArray(brief.topics)) return [...new Set(brief.topics.filter(topic => topicIds.includes(topic)))];
  const fallback = themeTopics[brief.theme];
  return fallback ? [fallback] : [];
}

function eligiblePlace(place: Place): boolean {
  if (!place || typeof place !== 'object') return false;
  const status = place as Place & { visibility?: string; publicationStatus?: string; operatingStatus?: string };
  return Boolean(boundedText(place.id, 200) && boundedText(place.name, 200) && boundedText(place.address, 400)
    && placeKinds.includes(place.kind) && !place.personal && !place.bookingFixed && place.locationVerified !== false
    && status.visibility !== 'PRIVATE' && !['DRAFT', 'WITHDRAWN', 'HIDDEN'].includes(status.publicationStatus ?? '')
    && !['CLOSED', 'TEMPORARILY_CLOSED', 'UNVERIFIED'].includes(status.operatingStatus ?? '')
    && Number.isFinite(place.lat) && place.lat >= -90 && place.lat <= 90
    && Number.isFinite(place.lng) && place.lng >= -180 && place.lng <= 180 && !(place.lat === 0 && place.lng === 0));
}

/** Caller supplies the currently public, permitted catalog, never personal trips or external search results. */
export function creationCatalogPlaces(brief: Pick<CreationBrief, 'region'>, places: Place[]): Place[] {
  const tokens = regionTokens(brief.region);
  if (!tokens.length || tokens.some(token => ['전체', '전국', '어디든'].includes(token))) return [];
  const uniqueIds = new Map<string, number>();
  for (const place of places) if (place?.id) uniqueIds.set(place.id, (uniqueIds.get(place.id) ?? 0) + 1);
  return places.filter(place => {
    if (!eligiblePlace(place) || uniqueIds.get(place.id) !== 1) return false;
    const area = regionTokens(place.area), address = regionTokens(place.address);
    const expectedRoot = tokens[0];
    // A conflicting province/city cannot be repaired by a matching shop name or lower district token.
    if (regionRoots.includes(expectedRoot) && [area[0], address[0]].some(root => regionRoots.includes(root) && root !== expectedRoot)) return false;
    return tokens.every(token => [...area, ...address].some(part => part === token || (!regionRoots.includes(token) && part.startsWith(token))));
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function creationCatalogRegions(places: Place[]): string[] {
  return [...new Set(places.filter(eligiblePlace).map(place => rootRegion(place.area) || rootRegion(place.address)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

/** Conservative Korean field extraction. Relative dates and unspecified years remain for explicit confirmation. */
export function interpretCreationPrompt(prompt: string, initial: Partial<CreationBrief> = {}): CreationBrief {
  const text = boundedText(prompt), notes: string[] = [];
  const purpose: CreationPurpose = /모임\s*(?:개설|만들|시작)|동호회|정기\s*모임/.test(text) ? 'GROUP'
    : /여행|\d+\s*박\s*\d+\s*일|숙박/.test(text) ? 'TRIP' : /나들이|단풍|꽃놀이|소풍/.test(text) ? 'OUTING' : 'MEETUP';
  const theme: CreationBrief['theme'] = /단풍|꽃놀이|자연|숲|공원|야외/.test(text) ? 'FOLIAGE' : /맛집|음식점|식당|식사|밥|점심|저녁/.test(text) ? 'FOOD'
    : /카페|커피|차\s*마/.test(text) ? 'CAFE' : /전시|박물관|미술관|공연|문화/.test(text) ? 'CULTURE' : /여행/.test(text) ? 'TRAVEL' : 'OTHER';
  const normalized = normalizedRegion(text);
  const foundRegions = regionRoots.filter(region => new RegExp(`(?:^|[^가-힣])${region}(?:광역시|특별시|특별자치도|도|에서|으로|에|로|의|은|는|을|를|과|와|[\\s,.!?]|$)`).test(normalized));
  const knownForeignRegions = ['다낭', '호이안', '하노이', '도쿄', '오사카', '후쿠오카'];
  for (const foreign of knownForeignRegions) if (text.includes(foreign)) foundRegions.push(foreign);
  let region = foundRegions.length === 1 ? foundRegions[0] : '';
  if (region) {
    const district = normalized.match(new RegExp(`(?:^|[^가-힣])${region}\\s+([가-힣]{1,8}(?:구|군))(?=에서|에|로|의|은|는|을|를|과|와|[\\s,.!?]|$)`))?.[1];
    // Preserve an explicitly written district, while ordinary words such as 친구 are not districts.
    if (district && !['친구', '식구', '가구', '누구', '욕구', '탐구', '연구', '지구', '농구', '축구', '야구', '배구', '정구', '탁구'].includes(district)) region += ` ${district}`;
  }
  if (foundRegions.length > 1) notes.push('지역이 여러 곳이에요. 이번 일정의 지역을 한 곳으로 확인해 주세요.');
  const exactDates = [...text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)|(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)]
    .map(match => `${match[1] || match[4]}-${(match[2] || match[5]).padStart(2, '0')}-${(match[3] || match[6]).padStart(2, '0')}`);
  const date = validDate(exactDates[0]) ? exactDates[0] : '', endDate = validDate(exactDates[1]) ? exactDates[1] : '';
  if (/오늘|내일|모레|주말|이번\s*주|다음\s*주|이번\s*달|다음\s*달/.test(text) || (!exactDates.length && /\d+\s*월\s*\d+\s*일/.test(text))) notes.push('날짜는 연도까지 포함해 직접 확인해 주세요.');
  if (exactDates.some(value => !validDate(value))) notes.push('입력한 날짜가 달력에 있는 날짜인지 확인해 주세요.');
  const nights = text.match(/(\d{1,2})\s*박\s*(\d{1,2})\s*일/);
  const duration = text.match(/(?:^|\s)(\d{1,2})\s*일(?:\s*(?:일정|동안|여행|정도)|\s*$)/);
  let dayCount = nights ? Number(nights[2]) : duration ? Number(duration[1]) : undefined;
  if (nights && Number(nights[1]) + 1 !== Number(nights[2])) notes.push('숙박일과 여행 일수가 맞는지 확인해 주세요.');
  if (dayCount !== undefined && (dayCount < 1 || dayCount > 7)) notes.push('한 번에 1~7일 범위의 초안을 만들 수 있어요.');
  const peopleMatch = text.match(/(\d{1,3})\s*명/) || text.match(/(\d{1,3})\s*인(?!당)(?=\s*(?:가족|일행|이서|끼리|함께|참여|모임|여행|$))/);
  const budgetMatch = text.match(/(?:1\s*인(?:당)?|인당|한\s*사람당|각자)\s*(?:예산\s*(?:은|이|을|를)?\s*)?(\d+(?:\.\d+)?)\s*(만\s*원|천\s*원|원)/);
  const budgetPerPerson = budgetMatch ? Number(budgetMatch[1]) * (budgetMatch[2].includes('만') ? 10000 : budgetMatch[2].includes('천') ? 1000 : 1) : undefined;
  const walkingMatch = text.match(/(?:걷기|도보|보행|걷는\s*시간)[^\d]{0,8}(\d{1,3})\s*분|(\d{1,3})\s*분(?:\s*(?:이하|이내|정도|만))?\s*(?:걷|도보)/);
  if (/덜\s*걷|많이\s*걷.{0,8}(?:어려|싫|못)|적게\s*걷/.test(text) && !walkingMatch) notes.push('걷는 시간은 몇 분까지 가능한지 확인해 주세요.');
  const clock = text.match(/(?:^|[^\d])(\d{1,2}):(\d{2})(?!\d)/), koreanClock = text.match(/(?:(오전|오후|저녁|아침)\s*)?(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  let startTime = '';
  if (clock) { const time = `${clock[1].padStart(2, '0')}:${clock[2]}`; if (validTime(time)) startTime = time; }
  else if (koreanClock) {
    let hour = Number(koreanClock[2]); const period = koreanClock[1];
    if (period && hour >= 1 && hour <= 12) { if (hour === 12) hour = 0; if (period === '오후' || period === '저녁') hour += 12; }
    const time = `${String(hour).padStart(2, '0')}:${String(Number(koreanClock[3] || 0)).padStart(2, '0')}`;
    if ((period || hour > 12 || hour === 0) && validTime(time)) startTime = time;
    else notes.push('시각은 오전·오후를 확인해 주세요.');
  }
  const transport: CreationBrief['transport'] = /자차|운전|자동차|차량|차로\s*(?:이동|갈|가)/.test(text) ? 'CAR' : /대중교통|지하철|버스/.test(text) ? 'PUBLIC' : /도보|걸어서/.test(text) ? 'WALK' : 'UNSET';
  const result: CreationBrief = { prompt: text, purpose, region, date, endDate, startTime, transport, theme, notes: notes.join('\n'),
    people: peopleMatch ? boundedNumber(Number(peopleMatch[1]), 1, 300) : undefined, budgetPerPerson: boundedNumber(budgetPerPerson, 0, 10000000),
    walkingLimitMinutes: walkingMatch ? boundedNumber(Number(walkingMatch[1] || walkingMatch[2]), 0, 600) : undefined, dayCount };
  if (purpose !== 'GROUP' && ((dayCount ?? 1) > 1 || (dateRangeDays(date, endDate) ?? 1) > 1)) result.purpose = 'TRIP';
  const parsedTopics = topicRules.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
  if (parsedTopics.length) result.topics = parsedTopics;
  // Form selections override parsing; prompt text never invokes tools or changes existing records.
  if (purposeValues.includes(initial.purpose!)) result.purpose = initial.purpose!;
  if (initial.region !== undefined) result.region = normalizedRegion(initial.region);
  for (const key of ['date', 'endDate', 'startTime', 'notes'] as const) if (initial[key] !== undefined) result[key] = boundedText(initial[key], key === 'notes' ? 1500 : 100);
  if (themes.includes(initial.theme!)) result.theme = initial.theme!;
  if (transports.includes(initial.transport!)) result.transport = initial.transport!;
  if (Array.isArray(initial.topics)) result.topics = [...new Set(initial.topics.filter(topic => topicIds.includes(topic)))];
  if (typeof initial.locationUndecided === 'boolean') result.locationUndecided = initial.locationUndecided;
  for (const key of ['people', 'budgetPerPerson', 'walkingLimitMinutes', 'dayCount'] as const) if (initial[key] !== undefined) result[key] = initial[key];
  return result;
}

function briefIssues(brief: CreationBrief): string[] {
  const issues: string[] = [];
  if (!purposeValues.includes(brief.purpose)) issues.push('만들 항목을 확인해 주세요.');
  if (!normalizedRegion(brief.region)) issues.push('지역을 먼저 선택해 주세요.');
  if (brief.date && !validDate(brief.date)) issues.push('시작 날짜를 확인해 주세요.');
  if (brief.endDate && !validDate(brief.endDate)) issues.push('종료 날짜를 확인해 주세요.');
  if (brief.endDate && !brief.date) issues.push('시작 날짜를 먼저 확인해 주세요.');
  const duration = dateRangeDays(brief.date, brief.endDate);
  if (duration !== undefined && (duration < 1 || duration > 7)) issues.push('날짜는 시작일 이후 1~7일 범위로 선택해 주세요.');
  if (brief.dayCount !== undefined && (!Number.isInteger(brief.dayCount) || brief.dayCount < 1 || brief.dayCount > 7)) issues.push('여행 일수는 1~7일로 선택해 주세요.');
  if (brief.purpose === 'TRIP' && duration !== undefined && brief.dayCount !== undefined && duration !== brief.dayCount) issues.push('날짜와 여행 일수가 달라요. 둘을 맞춰 주세요.');
  if (brief.purpose !== 'TRIP' && duration !== undefined && duration !== 1) issues.push('하루를 넘는 일정은 여행으로 선택해 주세요.');
  if (brief.startTime && !validTime(brief.startTime)) issues.push('시각을 확인해 주세요.');
  for (const [key, min, max, label] of [['people', 1, 300, '인원'], ['budgetPerPerson', 0, 10000000, '예산'], ['walkingLimitMinutes', 0, 600, '걷기 시간']] as const) {
    if (brief[key] !== undefined && boundedNumber(brief[key], min, max) === undefined) issues.push(`${label}을 확인해 주세요.`);
  }
  if (!themes.includes(brief.theme) || !transports.includes(brief.transport)) issues.push('활동 주제와 이동 수단을 확인해 주세요.');
  if (brief.topics !== undefined && (!Array.isArray(brief.topics) || brief.topics.some(topic => !topicIds.includes(topic)))) issues.push('활동·관심사를 다시 확인해 주세요.');
  if (brief.locationUndecided !== undefined && typeof brief.locationUndecided !== 'boolean') issues.push('장소를 나중에 정할지 확인해 주세요.');
  return issues;
}
export function validateCreationBrief(brief: CreationBrief): string[] { return briefIssues(brief); }
const planDays = (brief: CreationBrief) => brief.purpose === 'TRIP' ? dateRangeDays(brief.date, brief.endDate) ?? brief.dayCount ?? 1 : 1;
const distance = (a: Place, b: Place) => {
  const rad = Math.PI / 180, dLat = (a.lat - b.lat) * rad, dLng = (a.lng - b.lng) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(value)));
};
const purposeLabel = (purpose: CreationPurpose) => ({ MEETUP: '만남', OUTING: '나들이', TRIP: '여행', GROUP: '첫 만남' })[purpose];
const natureAnchor = (place: Place): boolean => {
  if (!['LANDMARK', 'LEISURE'].includes(place.kind) || /시장|백화점|쇼핑|상가|아울렛/.test(`${place.name} ${(place.tags ?? []).join(' ')}`)) return false;
  // A city's market/alley or historical walk alone is not evidence of a nature outing.
  const evidence = `${place.name} ${(place.tags ?? []).join(' ')} ${place.description}`.replace(/골목산책|역사산책|시장산책|도심산책|골목\s+산책|역사\s+산책/g, '');
  return /단풍|숲|공원|수목|산책|정원|자연|해변|해안|바다|호수|계곡|하천|꽃/.test(evidence);
};

const specificTopics: GroupTopic[] = ['OUTDOOR', 'WALK', 'CULTURE', 'SPORTS', 'BOOK', 'GAME', 'LANGUAGE', 'MUSIC', 'CRAFT', 'PETS', 'PHOTO'];
function topicPlace(topic: GroupTopic, place: Place): boolean {
  if (topic === 'OUTDOOR' || topic === 'WALK') return natureAnchor(place);
  const text = `${place.name} ${(place.tags ?? []).join(' ')} ${place.description}`;
  const evidence: Partial<Record<GroupTopic, RegExp>> = {
    CULTURE: /박물관|미술관|전시|문화|공연|역사|영화|뮤지컬/,
    SPORTS: /운동|러닝|달리기|축구|농구|배드민턴|테니스|볼링|탁구|자전거|체육|스포츠/,
    BOOK: /독서|도서관|서점|북카페|북클럽|책방/,
    GAME: /보드게임|게임|체스|바둑|마작/, LANGUAGE: /언어\s*교환|외국어|영어\s*모임|회화/,
    MUSIC: /노래|음악|악기|피아노|합창|밴드|연습실/,
    CRAFT: /공예|도예|뜨개|그림|미술\s*공방|공방|만들기/,
    PETS: /반려|강아지|고양이|펫|애견/, PHOTO: /사진|촬영|전망|풍경|일몰|일출/,
  };
  return evidence[topic]?.test(text) ?? false;
}

/** Recompute facts after manual add/remove/replace; no stale meal or accommodation claims. */
export function refreshCreationPlan(brief: CreationBrief, plan: CreationPlan, places: Place[]): CreationPlan {
  const candidates = creationCatalogPlaces(brief, places), eligible = new Map(candidates.map(place => [place.id, place]));
  const selected = plan.placeIds.map(id => eligible.get(id)).filter((place): place is Place => Boolean(place));
  const topics = creationBriefTopics(brief);
  const foodWanted = topics.includes('FOOD'), cafeWanted = topics.includes('CAFE');
  if (brief.locationUndecided && !plan.placeIds.length) return { ...plan, placeIds: [], days: plan.days.map(day => ({ day: day.day, placeIds: [] })),
    explanation: ['장소를 나중에 정하기로 선택한 일정 초안이에요.', '활동 내용과 날짜를 먼저 정하고 장소는 만든 뒤 직접 추가해 주세요.'],
    unknowns: ['만날 장소와 방문 순서가 아직 정해지지 않았어요.', ...(!brief.date ? ['시작 날짜가 정해지지 않았어요.'] : [])] };
  const unknowns = ['영업일·운영 시간·이용 요금·예약 가능 여부는 방문 전에 확인해 주세요.', '실제 이동 경로와 시간은 지도에서 확인해야 해요.'];
  if (!brief.date) unknowns.push('시작 날짜가 정해지지 않았어요.');
  if (brief.transport === 'UNSET') unknowns.push('이동 수단이 정해지지 않았어요.');
  if (brief.budgetPerPerson !== undefined) unknowns.push(`1인 예산 ${brief.budgetPerPerson.toLocaleString('ko-KR')}원 안에 드는지는 가격 확인이 필요해요.`);
  if (brief.walkingLimitMinutes !== undefined || /덜\s*걷|많이\s*걷|적게\s*걷/.test(brief.prompt)) unknowns.push('걷기 시간·경사·접근성은 확인되지 않았어요.');
  if (topics.includes('OUTDOOR') || topics.includes('WALK')) unknowns.push(/단풍/.test(brief.prompt) ? '일반 자연 나들이 후보예요. 단풍 현황·절정 시기·날씨는 확인되지 않았어요.' : '자연·야외 후보예요. 계절별 풍경·날씨·현장 이용 조건은 확인되지 않았어요.');
  if (plan.days.length > 1) unknowns.push(selected.some(place => place.kind === 'STAY') ? '숙소는 비교 후보예요. 숙박일·연박·객실·예약을 직접 확인해 주세요.' : '이 지역에 사용할 숙소 후보가 없어요. 숙박을 직접 추가해 주세요.');
  if (foodWanted && !selected.some(place => place.kind === 'FOOD')) unknowns.push('선택한 일정에 음식점이 없어요. 식사를 직접 추가하거나 확인해 주세요.');
  if (cafeWanted && !selected.some(place => place.kind === 'CAFE')) unknowns.push('선택한 일정에 카페가 없어요. 원한다면 직접 추가해 주세요.');
  if (plan.days.some(day => !day.placeIds.length)) unknowns.push('등록 장소가 부족해 비어 있는 DAY가 있어요.');
  if (selected.length !== plan.placeIds.length) unknowns.push('현재 공개·지역·위치 조건에 맞지 않는 선택 장소가 있어요. 다시 선택해 주세요.');
  return { ...plan, placeIds: [...plan.placeIds], days: plan.days.map(day => ({ day: day.day, placeIds: [...day.placeIds] })),
    explanation: [`선택한 ${normalizedRegion(brief.region)} 지역의 등록 장소 ${selected.length}곳으로 구성했어요.`, '장소 종류와 좌표의 직선 거리를 참고한 초안이며 실제 경로 최적화 결과는 아니에요.'], unknowns };
}

/** Deterministic catalog proposals, not an LLM response or verified route/booking. Never edits an existing itinerary. */
export function buildCreationPlans(brief: CreationBrief, places: Place[]): CreationPlan[] {
  if (briefIssues(brief).length) return [];
  if (brief.locationUndecided) {
    const activity = creationBriefTopics(brief).filter(topic => !['FAMILY', 'SOCIAL', 'TRAVEL'].includes(topic)).slice(0, 2).map(topic => topicNames[topic]).join('·') || purposeLabel(brief.purpose);
    return [refreshCreationPlan(brief, { id: 'catalog-location-undecided', source: 'CATALOG', title: `${normalizedRegion(brief.region)} ${activity}${brief.purpose === 'TRIP' && activity !== '여행' ? ' 여행' : ''} · 장소 미정`, placeIds: [],
      days: Array.from({ length: planDays(brief) }, (_, index) => ({ day: index + 1, placeIds: [] })), explanation: [], unknowns: [] }, places)];
  }
  const sameDestination = (a: Place, b: Place) => {
    if (a.kind !== b.kind || a.name.normalize('NFKC').replace(/\s/g, '') !== b.name.normalize('NFKC').replace(/\s/g, '') || distance(a, b) > .15) return false;
    const addresses = [a.address, b.address].map(address => normalizedRegion(address).replace(/\s/g, '')).sort((x, y) => x.length - y.length);
    // The same street number plus an appended building description is an alias, not a second day's visit.
    // Different addresses, including street numbers 1 and 10, stay separate branches; catalog records are never merged.
    return addresses[1].startsWith(addresses[0]) && !/^\d/.test(addresses[1].slice(addresses[0].length));
  };
  const candidates = creationCatalogPlaces(brief, places).filter((place, index, all) => !all.slice(0, index).some(previous => sameDestination(previous, place)));
  if (!candidates.length) return [];
  const topics = creationBriefTopics(brief), foodWanted = topics.includes('FOOD'), cafeWanted = topics.includes('CAFE');
  if (brief.prompt.trim() && !topics.some(topic => !['FAMILY', 'SOCIAL'].includes(topic)) && !['TRIP', 'OUTING'].includes(brief.purpose) && !/만남|만나|친목|대화|이야기/.test(brief.prompt)) return [];
  const requestedSpecific = specificTopics.filter(topic => topics.includes(topic));
  if (requestedSpecific.some(topic => !candidates.some(place => topicPlace(topic, place)))) return [];
  const natureWanted = topics.includes('OUTDOOR') || topics.includes('WALK');
  const needsOuting = brief.purpose === 'OUTING' || brief.purpose === 'TRIP' || natureWanted || topics.includes('CULTURE');
  const mainKinds: Place['kind'][] = needsOuting ? ['LANDMARK', 'LEISURE'] : cafeWanted && !foodWanted ? ['CAFE'] : foodWanted ? ['FOOD'] : ['FOOD', 'CAFE', 'LANDMARK', 'LEISURE'];
  const preferred = (place: Place) => natureWanted ? /숲|공원|수목|산책|정원|해변|해안/.test(`${place.name} ${(place.tags ?? []).join(' ')}`) ? 0 : 1
    : topics.includes('CULTURE') ? /박물관|미술관|전시|문화|공연|역사/.test(`${place.name} ${(place.tags ?? []).join(' ')}`) ? 0 : 1 : 0;
  const primaryAnchors = candidates.filter(place => requestedSpecific.length ? topicPlace(requestedSpecific[0], place) : mainKinds.includes(place.kind));
  // A trip can start from a restaurant or cafe. A landmark is never a prerequisite.
  const anchors = (primaryAnchors.length ? primaryAnchors : !natureWanted && (brief.purpose === 'TRIP' || brief.purpose === 'OUTING')
    ? candidates.filter(place => ['FOOD', 'CAFE', 'LEISURE'].includes(place.kind)) : [])
    .sort((a, b) => preferred(a) - preferred(b) || a.id.localeCompare(b.id));
  if (!anchors.length) return [];
  const plans: CreationPlan[] = [], signatures = new Set<string>();
  for (let option = 0; option < Math.min(anchors.length, 3); option++) {
    const used = new Set<string>(); const anchor = anchors[option];
    const days: CreationPlan['days'] = Array.from({ length: planDays(brief) }, (_, index) => ({ day: index + 1, placeIds: [] }));
    const add = (day: number, place: Place | undefined) => { if (place && !used.has(place.id)) { days[day].placeIds.push(place.id); used.add(place.id); } };
    const nearest = (kinds: Place['kind'][], from: Place, rotation = 0) => {
      const choices = candidates.filter(place => kinds.includes(place.kind) && !used.has(place.id))
        .sort((a, b) => distance(a, from) - distance(b, from) || a.id.localeCompare(b.id));
      return choices[Math.min(rotation, choices.length - 1)];
    };
    add(0, anchor);
    for (let day = 0; day < days.length; day++) {
      const base = day === 0 ? anchor : anchors.filter(place => !used.has(place.id))
        .sort((a, b) => distance(a, anchor) - distance(b, anchor) || a.id.localeCompare(b.id))[0];
      if (day > 0) add(day, base);
      if (!base) continue;
      for (const topic of requestedSpecific) {
        if (days[day].placeIds.some(id => candidates.some(place => place.id === id && topicPlace(topic, place)))) continue;
        add(day, candidates.filter(place => !used.has(place.id) && topicPlace(topic, place)).sort((a, b) => distance(a, base) - distance(b, base) || a.id.localeCompare(b.id))[0]);
      }
      if ((foodWanted || brief.purpose === 'TRIP') && base.kind !== 'FOOD') add(day, nearest(['FOOD'], base));
      if (cafeWanted && base.kind !== 'CAFE') add(day, nearest(['CAFE'], base));
      if (day === 0 && days.length > 1) add(day, nearest(['STAY'], base));
    }
    const placeIds = days.flatMap(day => day.placeIds);
    const signature = [...placeIds].sort().join('\n'); if (signatures.has(signature)) continue; signatures.add(signature);
    plans.push(refreshCreationPlan(brief, { id: `catalog-${option + 1}-${anchor.id}`, source: 'CATALOG', title: `${normalizedRegion(brief.region)} ${purposeLabel(brief.purpose)} · ${plans.length + 1}안`, placeIds, days,
      explanation: [], unknowns: [] }, places));
  }
  return plans;
}

export function buildCreationGroupDraft(brief: CreationBrief): CreationGroupDraft {
  const text = boundedText(brief.prompt), kind: GroupKind = /가족|부모님|엄마|아빠/.test(text) ? 'FAMILY' : /친구/.test(text) ? 'FRIENDS' : /가이드|인솔/.test(text) ? 'GUIDE' : 'HOBBY';
  const topics = creationBriefTopics(brief);
  const topic = topics.filter(id => !['FAMILY', 'SOCIAL'].includes(id)).slice(0, 2).map(id => topicNames[id]).join('·') || '함께하는 시간';
  const welcome: string[] = [];
  if (/처음.{0,15}환영|신규.{0,10}환영/.test(text)) welcome.push('처음 참여하는 분도 환영해요.');
  if (/초보.{0,10}환영/.test(text)) welcome.push('초보도 환영해요.');
  if (/혼자.{0,10}환영/.test(text)) welcome.push('혼자 참여해도 환영해요.');
  const firstActivity = topics.includes('BOOK') && topics.includes('CAFE') ? '카페에서 각자 읽은 책 한 권을 소개하는 첫 만남'
    : topics.includes('FOOD') ? '함께 고른 음식점에서 취향과 다음 활동을 나누는 첫 만남'
    : topics.includes('CAFE') ? '카페에서 관심사와 앞으로 해보고 싶은 일을 나누는 첫 만남'
    : topics.includes('BOOK') ? '각자 읽은 책 한 권과 독서 취향을 소개하는 첫 만남'
    : `${topic}에 대한 관심사와 함께할 활동을 정하는 첫 만남`;
  return { name: `${normalizedRegion(brief.region)} ${topic}`.trim().slice(0, 60), kind, region: normalizedRegion(brief.region),
    introduction: `${normalizedRegion(brief.region) || '원하는 지역'}에서 ${topic}을 함께해요.\n활동 방식과 첫 만남은 함께 정해요.`,
    topics, welcome: welcome.join(' '), joinMode: 'DIRECT', joinGuide: '가입 인사는 모임 가입 후 대화방에서 나눠 주세요. 함께하고 싶은 활동과 참여 가능한 시간을 알려 주세요. 약속 참가는 따로 선택해요.',
    firstActivityIdea: `${firstActivity} · 날짜·장소는 함께 정해요.` };
}

/** Recheck an edited/model proposal against the latest public catalog before opening the existing creation form. */
export function validateCreationPlan(brief: CreationBrief, plan: CreationPlan, places: Place[]): string[] {
  const issues = briefIssues(brief), eligible = new Set(creationCatalogPlaces(brief, places).map(place => place.id));
  if (!plan || typeof plan !== 'object') return [...issues, '일정 초안을 다시 선택해 주세요.'];
  if (plan.source !== 'CATALOG') issues.push('연결되지 않은 생성 결과는 저장할 수 없어요.');
  if (!Array.isArray(plan.placeIds) || !Array.isArray(plan.days)) return [...issues, '장소와 DAY 정보를 확인해 주세요.'];
  if (brief.locationUndecided && plan.placeIds.length) issues.push('장소 미정 초안에는 방문 장소를 함께 넣을 수 없어요. 조건을 다시 확인해 주세요.');
  if ((!brief.locationUndecided && plan.placeIds.length < 1) || plan.placeIds.length > 35) issues.push('장소를 1~35곳 선택해 주세요.');
  if (new Set(plan.placeIds).size !== plan.placeIds.length) issues.push('같은 장소를 중복으로 담을 수 없어요.');
  if (plan.placeIds.some(id => typeof id !== 'string' || !eligible.has(id))) issues.push('공개 상태·지역·위치가 확인된 등록 장소만 사용할 수 있어요.');
  if (plan.days.length !== planDays(brief)) issues.push('선택한 일수와 DAY 수를 맞춰 주세요.');
  if (plan.days.some((day, index) => !day || day.day !== index + 1 || !Array.isArray(day.placeIds))) issues.push('DAY 순서와 장소를 확인해 주세요.');
  else {
    const ids = plan.days.flatMap(day => day.placeIds);
    if (ids.length !== plan.placeIds.length || ids.some((id, index) => id !== plan.placeIds[index])) issues.push('DAY별 장소와 선택한 장소를 맞춰 주세요.');
  }
  return [...new Set(issues)];
}
