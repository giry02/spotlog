import { places } from './connected-data';
import { jejuKnowledgeDocuments } from './jeju-knowledge';
import { authoredPlaceText } from './rag-source';
import { registeredKnowledgeDocuments } from './registered-knowledge';
import { registeredPlaces, registeredBusinesses } from './registered-catalog';

export type KnowledgeSource = {
  documentId: string;
  chunkId: string;
  placeId: string;
  text: string;
  sourceKind: 'authored-demo-data' | 'curated-official-summary';
  title?: string;
  sourceUrl?: string;
  checkedAt?: string;
};

// Search covers official destination summaries and legacy authored descriptions.
// Only freshly retrieved, revalidated destination evidence can authorize a model
// itinerary selection; general planning documents do not create place cards.
export function ragCatalog(): KnowledgeSource[] {
  return [
    ...places.map((place): KnowledgeSource => ({
      documentId: `moa-place:${place.id}`,
      chunkId: `moa-place:${place.id}:description`,
      placeId: place.id,
      text: authoredPlaceText(place),
      sourceKind: 'authored-demo-data',
    })),
    ...jejuKnowledgeDocuments.map((doc): KnowledgeSource => ({
      documentId: `moa-knowledge:${doc.id}`,
      chunkId: `moa-knowledge:${doc.id}:description`,
      placeId: doc.placeId,
      text: `${doc.title}\n지역: 제주\n${doc.text}\n공식 자료 확인일: ${doc.checkedAt}`,
      sourceKind: 'curated-official-summary',
      title: doc.title,
      sourceUrl: doc.sourceUrl,
      checkedAt: doc.checkedAt,
    })),
    ...registeredKnowledgeDocuments.map((doc): KnowledgeSource => ({
      documentId: `moa-knowledge:${doc.id}`,
      chunkId: `moa-knowledge:${doc.id}:description`,
      placeId: doc.placeId, text: doc.text, sourceKind: 'curated-official-summary',
      title: doc.title, sourceUrl: doc.sourceUrl, checkedAt: doc.checkedAt,
    })),
  ];
}

export function ragAllowedPlaceIds() {
  return [...new Set(ragCatalog().map((doc) => doc.placeId))];
}

const placeAliases: Record<string, string[]> = {
  osulloc: ['오설록'], hyeopjae: ['협재'], geumneung: ['금능'], songaksan: ['송악산'],
  hamdeok: ['함덕'], jusangjeolli: ['주상절리'], aquaplanet: ['아쿠아플라넷'],
  jejumuseum: ['제주박물관'], dolculturepark: ['돌문화공원'], saryeoni: ['사려니'],
  gotjawal: ['곶자왈'], jeolmul: ['절물'], hallasan: ['한라산'],
};

/** Full registered names only: no shortened business or branch aliases. Masking
 * the matched span prevents a word inside a business name (e.g. 협재신국수)
 * from becoming an unrelated landmark alias, while separately named places
 * remain available in the rest of the query. */
function namedRegisteredBusinessMatches(query: string) {
  const normalized = query.normalize('NFKC');
  const masked = normalized.split('');
  const occupied = new Set<number>();
  const placeIds = new Set<string>();
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const businesses = [...registeredBusinesses].sort((a, b) => b.name.replace(/\s/g, '').length - a.name.replace(/\s/g, '').length);
  for (const business of businesses) {
    const name = business.name.normalize('NFKC').replace(/\s/g, '');
    const pattern = new RegExp([...name].map(escape).join('\\s*'), 'gu');
    for (const match of normalized.matchAll(pattern)) {
      const start = match.index, end = start + match[0].length;
      if (Array.from({ length: end - start }, (_, index) => start + index).some(index => occupied.has(index))) continue;
      const before = normalized.slice(0, start), after = normalized.slice(end);
      const region = business.region === '제주' ? '제주(?:도|특별자치도)?' : business.region;
      const regionPrefix = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${region}$`, 'u');
      if (/[\p{L}\p{N}_]$/u.test(before) && !regionPrefix.test(before)) continue;
      // Permit Korean particles and ordinary direct questions, but do not turn
      // a longer unregistered name or an unknown branch into this exact entity.
      if (/^[\p{L}\p{N}_]/u.test(after) && !/^(?:은|는|이|가|을|를|의|와|과|랑|에|로|으로|부터|까지|도|만|보다|처럼|같|말고|대신|주소|위치|설명|소개|정보|전화|연락|영업|운영|메뉴|가격|요금|객실|체크인|체크아웃|알려|어때|어떤|궁금|추천|찾아|후기|평점|예약|주차|근처|주변)/u.test(after)) continue;
      placeIds.add(business.id);
      for (let index = start; index < end; index++) { occupied.add(index); masked[index] = ' '; }
    }
  }
  return { placeIds: [...placeIds], remainingQuery: masked.join('') };
}

/** A direct basic-fact question about full registered business names. */
export function registeredBusinessFactQueryIds(query: string) {
  const business = namedRegisteredBusinessMatches(query);
  const alternative = /말고/.test(query.replace(/(?:만들지|짜지|생성하지|변경하지|수정하지|예약하지|담지|실행하지|보여주지)\s*말고/g, ''));
  return business.placeIds.length && !alternative
    && /주소|위치|설명|소개|정보|전화|연락|영업|운영|메뉴|가격|요금|객실|체크인|체크아웃|출처|근거|인기|평점|별점/.test(business.remainingQuery)
    && !/처럼|비슷|같은\s*(?:분위기|느낌|곳|장소)|대신|대안|다른\s*(?:곳|장소)|주변|근처|추천/.test(business.remainingQuery)
    ? business.placeIds : [];
}

export function ragPlaceIdsForQuery(query: string) {
  // A specific destination question should not mix unrelated transport or venue
  // instructions into its evidence. Discovery requests still need broad recall.
  const alternative = /말고/.test(query.replace(/(?:만들지|짜지|생성하지|변경하지|수정하지|예약하지|담지|실행하지|보여주지)\s*말고/g, ''));
  // "업체 주소를 찾아줘" is a direct fact lookup, even though "찾아" also
  // occurs in broad discovery requests. It must not search other regions.
  if (registeredBusinessFactQueryIds(query).length) return namedKnowledgePlaceIds(query);
  if (alternative || /처럼|비슷|같은\s*(?:분위기|느낌|곳|장소)|대신|대안|다른\s*(?:곳|장소)|주변|근처|추천|찾아/.test(query)) return ragAllowedPlaceIds();
  const matches = namedKnowledgePlaceIds(query);
  return matches.length ? matches : ragAllowedPlaceIds();
}

export function namedKnowledgePlaceIds(query: string) {
  const business = namedRegisteredBusinessMatches(query);
  const remainingQuery = business.remainingQuery;
  const compact = remainingQuery.replace(/\s+/g, '');
  const matches = new Set<string>(business.placeIds);
  const names = [
    ...places.map((place) => ({ placeId: place.id, name: place.name })),
    ...registeredPlaces.map((place) => ({ placeId: place.id, name: place.name })),
    ...jejuKnowledgeDocuments.filter((doc) => doc.placeId !== 'jeju-general').map((doc) => ({ placeId: doc.placeId, name: doc.title.split('|')[0].trim() })),
  ];
  for (const { placeId, name } of names) {
    const aliases = [name, ...(placeAliases[placeId] ?? [])];
    if (aliases.some((alias) => alias === '우도'
      ? /(?:^|제주|[\s,.(])우도(?:$|[\s,.?!)]|에서|까지|가는|가|는|를|에|로|의|와|랑|과|배|여행)/.test(remainingQuery)
      : compact.includes(alias.replace(/\s+/g, '')))) matches.add(placeId);
  }
  return [...matches];
}

export function knowledgeSource(documentId: string) {
  return ragCatalog().find((doc) => doc.documentId === documentId);
}
