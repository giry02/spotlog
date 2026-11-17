import type { Place, PlaceKind } from './data';
import { publicPlaceRegion, type HomeRegionReference } from './homeDiscovery.ts';
import { PLANNING_AI_CANDIDATE_LIMIT } from './planningAiService.ts';

export const placeAssistantPromptLimit = 240;
export type PlaceAssistantKind = PlaceKind | 'ALL';
export interface PlaceAssistantInput {
  prompt: string;
  region?: string;
  initialRegion?: string;
  initialDistrict?: string;
  kind?: PlaceAssistantKind;
}

const kinds: ReadonlyArray<{ kind: PlaceKind; words: string }> = [
  { kind: 'FOOD', words: '맛집|음식점|식당|식사|점심|저녁|국밥|갈비|횟집|브런치|고깃집|한정식|밥집|밥' },
  { kind: 'CAFE', words: '카페|커피|베이커리|빵집|찻집|디저트' },
  { kind: 'STAY', words: '숙소|숙박|호텔|펜션|리조트|게스트하우스' },
  { kind: 'LANDMARK', words: '명소|랜드마크|관광지|산책|나들이|공원|박물관|미술관|전망대|해변' },
  { kind: 'LEISURE', words: '레저|체험|액티비티|트레킹|등산|워크숍' },
  { kind: 'SHOP', words: '쇼핑|시장|상점|기념품|편집숍' },
];

const knownRegions: Readonly<Record<string, readonly string[]>> = {
  서울: ['서울특별시'], 부산: ['부산광역시'], 대구: ['대구광역시'], 인천: ['인천광역시'], 광주: ['광주광역시'], 대전: ['대전광역시'], 울산: ['울산광역시'],
  세종: ['세종시', '세종특별자치시'], 경기: ['경기도'], 강원: ['강원도', '강원특별자치도'], 충북: ['충청북도'], 충남: ['충청남도'], 경북: ['경상북도'], 경남: ['경상남도'],
  전북: ['전라북도', '전북특별자치도'], 전남: ['전라남도'], 제주: ['제주도', '제주시', '제주특별자치도'],
  다낭: [], 호이안: [], 하노이: [], 도쿄: [], 오사카: [], 후쿠오카: [],
};

const descriptorTerms: readonly string[] = ['오션뷰', '야경', '바다', '갈비', '국밥', '회', '브런치', '디저트', '전시', '한옥', '숲', '해변', '벚꽃', '단풍', '일몰', '일출'];
const unverifiedRules: ReadonlyArray<[RegExp, string]> = [
  [/주차/, '주차'], [/반려동물|강아지|반려견|애견|고양이/, '반려동물 동반'], [/휠체어|유모차|무장애|계단|장애인|접근성/, '이동·접근 편의'],
  [/영업|지금\s*열|오늘\s*열|휴무|문\s*열|오픈|심야|늦게까지/, '영업 시간'], [/가성비|가격|저렴|요금|예산|\d\s*(?:만|천)?\s*원/, '가격'],
  [/예약|웨이팅|대기/, '예약·대기'], [/조용|한적|혼잡|붐비|여유로운/, '혼잡도'], [/단체|룸\s*(?:있|예약)|아이\s*동반|어린이|아기\s*의자/, '시설·단체 이용'],
  [/근처|가까|도보|내\s*주변/, '이동 거리'],
];

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ');
const escapeRegExp = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentioned = (text: string, word: string) => new RegExp(`(?:^|[^가-힣a-z0-9])${escapeRegExp(normalize(word))}(?=$|[^가-힣a-z0-9]|(?:에서부터|에서만|에서|으로|까지|주변|근처|쪽|에|로|의|은|는|과|와|랑|하고|가|이|를|을|만|도)(?=$|[^가-힣a-z0-9]))`).test(text);
const excludeWord = (text: string, words: string) => new RegExp(`(?:${words})(?:은|는|를|을|도|만)?\\s*(?:말고|빼(?:고|줘|주세요)|제외(?:하고|해|해줘)?(?!하지)|아닌|없이)`).test(text);
const trimDistrictSuffix = (district: string) => district.length >= 3 ? district.replace(/[시군구읍면동]$/, '') : district;
const districtTokens = (place: Place, region: string) => place.area.normalize('NFKC').split(/[\s·,/]+/).slice(1)
  .map(trimDistrictSuffix).filter(token => token.length >= 2 && token !== region);

function publicPlaces(places: ReadonlyArray<Place>) {
  const ids = new Set<string>();
  return places.filter(place => {
    if (place.personal || !place.id.trim() || !place.name.trim() || ids.has(place.id)) return false;
    ids.add(place.id);
    return true;
  });
}

export function placeAssistantRegions(places: ReadonlyArray<Place>, references: ReadonlyArray<HomeRegionReference> = []): string[] {
  return [...new Set(publicPlaces(places).map(place => publicPlaceRegion(place, references)).filter(region => region && region !== '지역 미정'))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
}

/** Scope selection never falls back across regions or asserts unverified amenities. */
export function preparePlaceAssistant(input: PlaceAssistantInput, places: ReadonlyArray<Place>, references: ReadonlyArray<HomeRegionReference> = []) {
  const prompt = normalize(input.prompt).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, placeAssistantPromptLimit);
  const catalog = publicPlaces(places);
  const indexed = catalog.map(place => ({ place, region: publicPlaceRegion(place, references) }));
  const regions = placeAssistantRegions(catalog, references);
  const searchableRegions = [...new Set([...Object.keys(knownRegions), ...regions])];
  const regionMentions = searchableRegions.filter(region => [region, ...(knownRegions[region] ?? [])].some(label => mentioned(prompt, label)));
  const districtMentions = new Map<string, Set<string>>();
  indexed.forEach(({ place, region }) => districtTokens(place, region).forEach(district => {
    if (!mentioned(prompt, district) && !['시', '구', '군', '읍', '면', '동'].some(suffix => mentioned(prompt, district + suffix))) return;
    const owners = districtMentions.get(district) ?? new Set<string>();
    owners.add(region); districtMentions.set(district, owners);
  }));
  const districtRegions = [...new Set([...districtMentions.values()].flatMap(owners => [...owners]))];
  const manual = input.region?.trim() || '';
  const defaultRegion = input.initialRegion?.trim() || '';
  const region = manual || (regionMentions.length === 1 ? regionMentions[0] : '')
    || (districtRegions.length === 1 ? districtRegions[0] : '') || defaultRegion;
  const matchingDistricts = [...districtMentions].filter(([, owners]) => owners.has(region)).map(([district]) => district);
  const defaultDistrict = !manual && defaultRegion === region ? trimDistrictSuffix(input.initialDistrict?.trim() || '') : '';
  const district = matchingDistricts.length === 1 ? matchingDistricts[0] : defaultDistrict;
  const unverified = unverifiedRules.filter(([test]) => test.test(prompt)).map(([, label]) => label);
  const excluded = kinds.filter(({ words }) => excludeWord(prompt, words)).map(({ kind }) => kind);
  const inferred = kinds.filter(({ kind, words }) => !excluded.includes(kind) && new RegExp(words).test(prompt)).map(({ kind }) => kind);
  const requestedKinds: PlaceKind[] = input.kind && input.kind !== 'ALL' ? [input.kind] : inferred;
  const appliedKinds = requestedKinds.length ? requestedKinds : kinds.map(({ kind }) => kind).filter(kind => !excluded.includes(kind));
  const issue = !prompt ? '찾고 싶은 장소를 문장으로 입력해 주세요.'
    : regionMentions.length > 1 ? '문장에 나온 지역이 여러 곳이에요. 이번에 찾을 지역을 한 곳만 적어 주세요.'
      : manual && regionMentions.length && !regionMentions.includes(manual) ? '선택한 지역과 문장에 적은 지역이 달라요. 한 곳으로 맞춰 주세요.'
        : !region ? '검색할 지역을 선택하거나 지역 이름을 문장에 적어 주세요.'
          : districtRegions.length && !districtRegions.includes(region) ? '적은 동네가 선택한 지역에 없어요. 지역을 다시 확인해 주세요.'
            : matchingDistricts.length > 1 ? '문장에 나온 동네가 여러 곳이에요. 찾을 동네를 한 곳으로 좁혀 주세요.'
              : requestedKinds.some(kind => excluded.includes(kind)) ? '선택한 종류가 문장에서는 제외됐어요. 종류를 다시 확인해 주세요.' : '';
  const eligiblePlaces = issue ? [] : indexed.filter(item => item.region === region
    && (!district || districtTokens(item.place, item.region).includes(district)) && appliedKinds.includes(item.place.kind)).map(item => item.place);
  const descriptionTerms = descriptorTerms.filter(word => mentioned(prompt, word) && !excludeWord(prompt, escapeRegExp(word)));
  const matches = eligiblePlaces.map((place, index) => {
    const fields = normalize([place.name, place.hook, place.description, ...(place.tags ?? [])].filter(Boolean).join(' '));
    const terms = descriptionTerms.filter(word => fields.includes(word));
    const exactName = mentioned(prompt, place.name);
    return { place, index, terms, exactName };
  });
  const best = matches.filter(match => match.exactName || descriptionTerms.length > 0 && match.terms.length === descriptionTerms.length);
  const exact = best.filter(match => match.exactName);
  const localMatches = exact.length ? exact : descriptionTerms.length ? best : matches;
  return { prompt, region, district, requestedKinds, excluded, unverified, issue,
    broadCatalog: !requestedKinds.length && !descriptionTerms.length && !exact.length && !excluded.length,
    missingDescriptions: !issue && eligiblePlaces.length > 0 && descriptionTerms.length > 0 && localMatches.length === 0,
    candidateIds: matches.sort((a, b) => Number(b.exactName) - Number(a.exactName) || b.terms.length - a.terms.length || a.index - b.index)
      .slice(0, PLANNING_AI_CANDIDATE_LIMIT).map(({ place }) => place.id),
    localPlaceIds: localMatches.map(({ place }) => place.id),
    eligiblePlaces,
  };
}
