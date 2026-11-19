import type { Place } from './data';
import type { HomeRegionReference } from './homeDiscovery';
import { interestKindLabels } from './interestCollectionStore.ts';
import { preparePlaceAssistant, type PlaceAssistantInput } from './placeAssistantModel.ts';

export type PlaceSearchSort = 'RECOMMENDED' | 'MATCH' | 'DISTANCE' | 'NAME';
export interface PlaceSearchRow {
  place: Place;
  /** Relative recommendation order before the viewer changes sorting. Never a popularity score. */
  recommendationRank: number;
  matchedConditions: string[];
  distanceKm: number | null;
  reason: string;
}
export interface PlaceSearchPresentationInput {
  input: PlaceAssistantInput;
  places: ReadonlyArray<Place>;
  references?: ReadonlyArray<HomeRegionReference>;
  resultIds: ReadonlyArray<string>;
  sort?: PlaceSearchSort;
  originId?: string;
  mode?: 'model' | 'catalog';
}

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const particle = '에서부터|에서만|에서|으로|까지|주변|근처|쪽|에|로|의|은|는|과|와|랑|하고|가|이|를|을|만|도';
const mentions = (text: string, value: string) => new RegExp(`(?:^|[^가-힣a-z0-9])${escapeRegExp(normalize(value))}(?=$|[^가-힣a-z0-9]|(?:${particle})(?=$|[^가-힣a-z0-9]))`).test(text);
const excludes = (text: string, value: string) => new RegExp(`${escapeRegExp(normalize(value))}(?:은|는|를|을|도|만)?\\s*(?:말고|빼(?:고|줘|주세요)|제외(?:하고|해|해줘)?(?!하지)|아닌|없이)`).test(text);
const denies = (text: string, value: string) => excludes(text, value)
  || new RegExp(`${escapeRegExp(normalize(value))}(?:\\s*(?:전망|뷰|풍경))?(?:은|는|이|가|을|를)?\\s*(?:없|아니|미제공|불가|불가능)`).test(text);
const descriptors = ['오션뷰', '전망', '야경', '바다', '갈비', '국밥', '회', '브런치', '디저트', '전시', '한옥', '숲', '해변', '벚꽃', '단풍', '일몰', '일출'];
const knownSorts: PlaceSearchSort[] = ['RECOMMENDED', 'MATCH', 'DISTANCE', 'NAME'];

/** Coordinate distance uses registered public positions only, never a guessed city center or GPS. */
const hasPublicPosition = (place: Place) => !place.personal && place.locationVerified !== false
  && Number.isFinite(place.lat) && Number.isFinite(place.lng)
  && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180
  && !(place.lat === 0 && place.lng === 0);

/** Pass the desired public region catalogue. Origin kinds intentionally do not depend on result kinds. */
export function placeSearchOriginOptions(places: ReadonlyArray<Place>): Place[] {
  const seen = new Set<string>();
  return places.filter(place => {
    if (!place.id.trim() || !place.name.trim() || !hasPublicPosition(place) || seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  }).sort((left, right) => Number(right.kind === 'LANDMARK') - Number(left.kind === 'LANDMARK')
    || left.name.localeCompare(right.name, 'ko-KR') || left.id.localeCompare(right.id));
}

function straightDistance(from: Place, to: Place): number | null {
  if (!hasPublicPosition(from) || !hasPublicPosition(to)) return null;
  const radians = (value: number) => value * Math.PI / 180;
  const latitude = radians(to.lat - from.lat), longitude = radians(to.lng - from.lng);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function formatPlaceSearchDistance(distanceKm: number | null | undefined): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) return '거리 미확인';
  return distanceKm < 1 ? `직선 ${Math.round(distanceKm * 1000)}m` : `직선 ${distanceKm.toFixed(1)}km`;
}

/** A single explicit requested venue count, never party size, price or an ambiguous pair of counts. */
export function placeSearchRequestedCount(prompt: string): number | undefined {
  const text = prompt.normalize('NFKC');
  const matches = [...text.matchAll(/(?:^|[^0-9])(\d{1,2})\s*(?:곳|군데|개)(?=$|[\s.,!?]|[을를은는와과만]|정도|추천|골라|찾아)/g)];
  const counts = matches.filter(match => !/^(?:은|는|를|을)?\s*(?:제외|빼고|말고)/.test(text.slice(match.index! + match[0].length)))
    .map(match => Number(match[1]));
  return counts.length === 1 && counts[0] >= 1 && counts[0] <= 60 ? counts[0] : undefined;
}

/** Public evidence only. Private notes, ratings, saves and inferred amenities do not affect order. */
export function buildPlaceSearchPresentation(options: PlaceSearchPresentationInput) {
  const prepared = preparePlaceAssistant(options.input, options.places, options.references);
  const requestedCount = placeSearchRequestedCount(options.input.prompt);
  const eligible = new Map(prepared.eligiblePlaces.map(place => [place.id, place]));
  const origins = placeSearchOriginOptions(options.places);
  const origin = options.originId ? origins.find(place => place.id === options.originId) ?? null : null;
  const requestedSort = knownSorts.includes(options.sort as PlaceSearchSort) ? options.sort! : 'RECOMMENDED';
  const originIssue = options.originId && !origin
    ? '거리 기준 장소가 공개 목록에서 변경됐거나 위치를 확인할 수 없어요. 다시 선택해 주세요.'
    : requestedSort === 'DISTANCE' && !origin ? '가까운 순으로 보려면 거리 기준 장소를 선택해 주세요.' : '';
  const sort = requestedSort === 'DISTANCE' && !origin ? 'RECOMMENDED' : requestedSort;
  const requestedDescriptors = descriptors.filter(value => mentions(prepared.prompt, value) && !denies(prepared.prompt, value));
  const seen = new Set<string>();
  const rows: PlaceSearchRow[] = [];
  for (const id of options.resultIds) {
    const place = eligible.get(id);
    if (!place || seen.has(id)) continue;
    seen.add(id);
    // A venue name such as “바다 카페” is an identity, not proof that it has a sea view.
    const publicFields = [place.hook, place.description, ...(place.tags ?? [])].filter((value): value is string => typeof value === 'string').map(normalize);
    const matchedConditions = [
      ...(prepared.requestedKinds.includes(place.kind) ? [interestKindLabels[place.kind]] : []),
      ...requestedDescriptors.filter(value => !publicFields.some(field => denies(field, value)) && publicFields.some(field => mentions(field, value))),
    ];
    const exactName = mentions(prepared.prompt, place.name) && !excludes(prepared.prompt, place.name);
    if (exactName) matchedConditions.unshift('이름 일치');
    const uniqueConditions = [...new Set(matchedConditions)];
    rows.push({ place, recommendationRank: rows.length + 1, matchedConditions: uniqueConditions,
      distanceKm: origin ? straightDistance(origin, place) : null,
      reason: exactName ? '입력한 이름과 일치하는 공개 장소예요.'
        : uniqueConditions.length ? `등록 정보에서 ${uniqueConditions.slice(0, 3).join(' · ')} 조건을 확인했어요.`
          : options.mode === 'model' ? 'AI가 현재 공개 후보에서 추천한 장소예요.' : '선택한 지역·종류에 등록된 장소예요.',
    });
    if (requestedCount && rows.length >= requestedCount) break;
  }
  const recommendationOrder = (left: PlaceSearchRow, right: PlaceSearchRow) => left.recommendationRank - right.recommendationRank;
  if (sort === 'MATCH') rows.sort((left, right) => right.matchedConditions.length - left.matchedConditions.length || recommendationOrder(left, right));
  if (sort === 'DISTANCE') rows.sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity) || recommendationOrder(left, right));
  if (sort === 'NAME') rows.sort((left, right) => left.place.name.localeCompare(right.place.name, 'ko-KR') || recommendationOrder(left, right));
  return { rows, sort, requestedSort, origin, originIssue, requestedCount, matchingConditionCount: requestedDescriptors.length + Number(prepared.requestedKinds.length > 0) };
}
