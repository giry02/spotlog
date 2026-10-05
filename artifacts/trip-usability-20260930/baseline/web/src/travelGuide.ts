import type { Journey, JourneyDay, Place } from './data';
import type { AiEnvelope, AiGuideRequest, AiSource, AiTranslationRequest, GuideAdapter, TranslationAdapter } from './aiPlanner';

export const TRANSLATION_GLOSSARY_VERSION = 'spotlog-ko-en-sample-1';
export type GuideIntent = 'today' | 'next' | 'highlights' | 'hours' | 'accessibility' | 'allergy' | 'emergency' | 'unknown';
export const guideDayId = (day: JourneyDay) => day.dayId ?? `day-${day.day}`;
export const guideVisitId = (place: Place, index: number) => place.visitId ?? `${place.id}:${index}`;
export interface GuideSession {
  dayId: string;
  visitsByDay: Record<string, string>;
  question: string;
  answers: Record<string, { question: string; value: AiEnvelope<{ text: string }> }>;
  lastAnswerByScope: Record<string, string>;
}
export const guideAnswerKey = (scope: string, question: string) => JSON.stringify([scope, question.trim()]);
export const guideSessionKey = (journey: Journey, initialDay: number) => JSON.stringify([journey.id, sourceVersion(journey), initialDay]);
/** Session-only recovery: no private questions are persisted or added to the public catalog. */
export function createGuideSessionStore(limit = 20) {
  const entries = new Map<string, GuideSession>();
  return {
    read(key: string) { const value = entries.get(key); return value ? structuredClone(value) : null; },
    write(key: string, value: GuideSession) {
      const copy = structuredClone(value);
      copy.answers = Object.fromEntries(Object.entries(copy.answers).slice(-40));
      entries.delete(key); entries.set(key, copy);
      while (entries.size > Math.max(1, limit)) entries.delete(entries.keys().next().value!);
    },
    clear() { entries.clear(); },
  };
}

/** Content identity, not a time stamp: edits invalidate an in-flight response. */
export function sourceVersion(value: unknown): string {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `v-${(hash >>> 0).toString(36)}`;
}

export function guideIntent(question: string): GuideIntent {
  const text = question.trim().toLowerCase();
  if (/응급|긴급|구급|구조|emergency|ambulance|danger/.test(text)) return 'emergency';
  if (/알레르기|알러지|견과|allerg|nuts|gluten/.test(text)) return 'allergy';
  if (/접근|휠체어|계단|유모차|accessib|wheelchair|stairs|stroller/.test(text)) return 'accessibility';
  if (/영업|운영|대기|오늘.*열|몇.*시|휴무|opening|open now|hours|queue|wait|price|가격|요금/.test(text)) return 'hours';
  if (/다음|이동|next|route|direction/.test(text)) return 'next';
  if (/오늘|일정|today|plan|schedule/.test(text)) return 'today';
  if (/볼거리|소개|무엇|하이라이트|highlight|about|see/.test(text)) return 'highlights';
  return 'unknown';
}

const unavailable = (language: 'ko' | 'en', intent: GuideIntent) => {
  const ko: Partial<Record<GuideIntent, string>> = {
    hours: '현재 영업 여부·대기시간·요금은 확인된 자료가 없어요. 방문 전에 시설의 공식 안내나 현장 직원에게 직접 확인해 주세요.',
    accessibility: '휠체어 진입·경사·엘리베이터 등 접근성 정보가 등록되어 있지 않아요. 이용 가능한 입구와 편의시설을 시설에 직접 확인해 주세요.',
    allergy: '원재료와 교차 접촉 여부를 확인할 수 없어요. 이 안내만으로 안전하다고 판단하지 말고, 주문 전에 알레르기 내용을 업체에 직접 알려 확인해 주세요.',
    emergency: '이 안내는 긴급 상황을 판단하거나 구조를 연결하지 못해요. 가까운 직원이나 현지 응급기관에 즉시 도움을 요청해 주세요.',
    unknown: '등록된 자료에서 이 질문의 답을 찾지 못했어요. 장소 소개와 주소는 확인할 수 있지만, 최신 현장 정보는 시설에 직접 확인해 주세요.',
  };
  const en: Partial<Record<GuideIntent, string>> = {
    hours: 'Verified opening status, waiting times and prices are not available. Check the venue’s official information or ask its staff before visiting.',
    accessibility: 'Verified wheelchair access, slopes and elevator information are not available. Ask the venue directly about accessible entrances and facilities.',
    allergy: 'Ingredients and cross-contact cannot be verified here. Do not rely on this guide to decide whether food is safe. Tell the venue about your allergy and confirm before ordering.',
    emergency: 'This guide cannot assess an emergency or contact emergency services. Seek immediate help from nearby staff or local emergency services.',
    unknown: 'The saved information does not answer this question. You can view the place description and address, but please confirm current details directly with the venue.',
  };
  return (language === 'en' ? en : ko)[intent] ?? '';
};

export function answerGuide(request: AiGuideRequest): AiEnvelope<{ text: string }> {
  const { journey, language } = request;
  const day = journey.days.find(value => guideDayId(value) === request.dayId);
  if (!day) throw new Error('DAY_NOT_FOUND');
  const intent = guideIntent(request.question);
  const index = request.visitId ? day.places.findIndex((place, i) => guideVisitId(place, i) === request.visitId)
    : request.placeId ? day.places.findIndex(place => place.id === request.placeId) : 0;
  if (request.visitId && index < 0 || request.placeId && index < 0) throw new Error('PLACE_NOT_FOUND');
  const current = day.places[index];
  let text: string;
  const source: AiSource = { id: `trip:${journey.id}:${request.dayId}`, label: language === 'en' ? 'Your itinerary · saved information' : '내 여행 · 등록된 정보', checkedAt: null, sourceVersion: request.sourceVersion };
  if (intent === 'today') text = day.places.length
    ? `${language === 'en' ? 'Saved stops for' : '등록된 방문 순서'} DAY ${day.day}\n${day.places.map((place, i) => `${i + 1}. ${place.name}${place.time ? ` · ${place.time}` : ''}`).join('\n')}\n\n${language === 'en' ? 'These are planned stops. Opening hours and travel times are not verified.' : '계획된 방문 순서예요. 실제 영업 여부와 이동 시간은 확인되지 않았어요.'}`
    : language === 'en' ? 'There are no places in this day yet.' : '이 DAY에 담긴 장소가 없어요.';
  else if (intent === 'next') {
    const next = day.places[index + 1];
    text = next ? `${language === 'en' ? 'Next stop' : '다음 장소'}: ${next.name}\n${next.address || (language === 'en' ? 'Address unavailable' : '주소 미등록')}\n\n${language === 'en' ? 'This is the next stop in your saved order. A route and travel time have not been verified.' : '저장한 순서의 다음 장소예요. 실제 이동 경로와 소요 시간은 확인되지 않았어요.'}`
      : language === 'en' ? 'This is the last stop in this day. Choose another DAY to see its plan.' : '이 DAY의 마지막 장소예요. 다른 DAY를 선택해 다음 일정을 볼 수 있어요.';
  } else if (intent === 'highlights') {
    const description = current?.description.trim();
    const translated = description ? sampleTranslations.get(description) : undefined;
    text = description ? `${current.name}\n${language === 'en' && translated ? translated : description}${language === 'en' && !translated ? '\n\nAn English translation is not available. The saved Korean description is shown.' : ''}`
      : language === 'en' ? 'No description has been saved for this place.' : '이 장소의 소개가 아직 등록되지 않았어요.';
  } else text = unavailable(language, intent);
  return { requestId: request.requestId, sourceVersion: request.sourceVersion, mock: true, data: { text }, sources: [source], warnings: [], unplaced: [] };
}

function aborted(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); }

const responseObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const responseText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function validCheckedAt(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d))?$/.test(value)) return false;
  const day = value.slice(0, 10);
  return Number.isFinite(Date.parse(value)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}

/** Validate runtime data before it reaches React or the translation cache. */
function responseEnvelope(value: unknown, request: { requestId: string; sourceVersion: string }): AiEnvelope<{ text: string }> {
  if (!responseObject(value) || value.requestId !== request.requestId || value.sourceVersion !== request.sourceVersion || typeof value.mock !== 'boolean'
    || !responseObject(value.data) || !responseText(value.data.text)
    || !Array.isArray(value.sources) || !value.sources.every(item => responseObject(item) && responseText(item.id) && responseText(item.label) && responseText(item.sourceVersion) && validCheckedAt(item.checkedAt) && (item.url === undefined || typeof item.url === 'string'))
    || !Array.isArray(value.warnings) || !value.warnings.every(item => typeof item === 'string')
    || !Array.isArray(value.unplaced) || !value.unplaced.every(item => responseObject(item) && responseText(item.placeId) && typeof item.reason === 'string')) throw new Error('INVALID_GUIDE_RESPONSE');
  // Keep a detached, narrow copy so an adapter cannot later mutate validated fields.
  return {
    requestId: request.requestId, sourceVersion: request.sourceVersion, mock: value.mock,
    data: { text: value.data.text },
    sources: value.sources.map(item => ({ id: item.id, label: item.label, sourceVersion: item.sourceVersion, checkedAt: item.checkedAt, ...(item.url === undefined ? {} : { url: item.url }) })),
    warnings: [...value.warnings], unplaced: value.unplaced.map(item => ({ placeId: item.placeId, reason: item.reason })),
  };
}

export function validateGuideResponse(value: unknown, request: Pick<AiGuideRequest, 'requestId' | 'sourceVersion'>): AiEnvelope<{ text: string }> {
  return responseEnvelope(value, request);
}

export function validateTranslationResponse(value: unknown, request: Pick<AiTranslationRequest, 'requestId' | 'sourceVersion' | 'text'>): AiEnvelope<{ text: string; status: 'sample' | 'reviewed' | 'unavailable' }> {
  const envelope = responseEnvelope(value, request);
  const status: unknown = responseObject(value) && responseObject(value.data) ? value.data.status : undefined;
  if (status !== 'sample' && status !== 'reviewed' && status !== 'unavailable') throw new Error('INVALID_TRANSLATION_RESPONSE');
  if (status === 'unavailable' && envelope.data.text !== request.text) throw new Error('INVALID_TRANSLATION_RESPONSE');
  return { ...envelope, data: { text: envelope.data.text, status } };
}

export const localGuideAdapter: GuideAdapter = {
  async answer(request, signal) { aborted(signal); await Promise.resolve(); aborted(signal); return answerGuide(request); },
};

/** Explicit, exact-match sample translations. Unknown user text stays untouched. */
export const sampleTranslations = new Map<string, string>([
  ['비양도 너머로 빛이 내려앉는 저녁. 이 장면을 다음 제주 여행의 첫 장소로 담아보세요.', 'Evening light settles beyond Biyangdo. Save this scene as the first stop on your next trip to Jeju.'],
  ['아침 파도와 해변 산책이 하루의 방향을 정해주는 강릉의 대표 장면입니다.', 'Morning waves and a beach walk set the pace for the day in Gangneung.'],
  ['빠르게 지나가기보다 강변에 앉아 주변 마을의 시간을 느껴보는 장소입니다.', 'Take a seat by the river and enjoy the pace of the surrounding village instead of rushing through.'],
  ['퇴근 뒤에도 충분한 산책. 성수의 작은 가게와 이어 한나절 여행으로 만들기 좋습니다.', 'Make time for a walk after work, then visit the small shops of Seongsu as part of a half-day trip.'],
  ['차밭과 전시 공간을 함께 걷는 제주 서쪽의 대표 장소.', 'Explore tea fields and exhibition spaces in western Jeju.'],
  ['산방산 아래 검은 바위와 낮은 바다가 이어지는 해안.', 'A coast of dark rocks and shallow water beneath Sanbangsan.'],
  ['산복도로와 바다가 층층이 이어지는 부산 원도심의 풍경.', 'Hillside roads and the sea form layers across Busan’s old city.'],
  ['해가 낮아질수록 물빛이 옅어지는 협재. 일몰 40분 전부터 천천히 걷기 시작했다.', 'The water at Hyeopjae grew paler as the sun sank. I started walking slowly 40 minutes before sunset.'],
  ['물이 빠진 뒤에야 보였던 협재의 작은 풍경. 현무암 사이 얕은 물에 저녁빛과 비양도가 함께 비쳤다.', 'A small scene at Hyeopjae appeared only after the tide receded. Evening light and Biyangdo were reflected in shallow pools between basalt rocks.'],
  ['협재의 저녁부터 산방산 아래 바다, 마지막 오름까지. 많이 보지 않고 좋은 장면에 오래 머문 2박 3일.', 'From an evening at Hyeopjae to the coast below Sanbangsan and a final climb up an oreum. A 3-day, 2-night trip with fewer stops and more time for memorable scenes.'],
  ['이번 제주는 체크리스트 대신 하루의 결을 남기기로 했다. 왜 이 순서로 움직였는지, 어디에서 쉬었는지, 숙소가 다음 날 동선에 어떤 도움이 됐는지를 사진과 함께 적었다. 그대로 따라가도 좋고 마음에 드는 하루만 복사해도 되는 제주 서쪽 가이드다.', 'On this trip to Jeju, I decided to record the feel of each day instead of following a checklist. Alongside my photos, I wrote about why I chose this order, where I rested, and how my accommodation helped with the next day’s route. Follow this western Jeju guide as it is, or copy just the day you like.'],
  ['제주에 도착한 날은 욕심내지 않고 서쪽으로 바로 향했다. 오후 네 시가 넘으니 한낮의 관광객이 조금씩 빠지고, 바다는 민트색에서 은빛으로 천천히 바뀌기 시작했다.\n\n협재의 좋은 점은 멀리 이동하지 않아도 백사장, 검은 현무암, 비양도까지 서로 다른 장면을 한 번에 볼 수 있다는 것이다. 주차장과 가까운 입구는 붐볐지만 서쪽으로 10분쯤 걸으니 앉아서 파도 소리를 들을 자리가 충분했다.', 'On the day I arrived in Jeju, I headed straight west without trying to do too much. After four in the afternoon, the daytime visitors gradually left, and the sea slowly changed from mint green to silver.\n\nAt Hyeopjae, you can see white sand, dark basalt and Biyangdo without travelling far. The entrance near the car park was busy, but after walking west for about 10 minutes, I found plenty of space to sit and listen to the waves.'],
  ['좋은 장소네요.', 'This looks like a lovely place.'],
]);

export type TranslationState = 'original' | 'sample' | 'reviewed' | 'stale' | 'unavailable';
export interface TranslationRecord {
  sourceId: string; sourceVersion: string; original: string; language: 'ko' | 'en'; glossaryVersion: string;
  translated: string; status: 'sample' | 'reviewed' | 'unavailable';
}
export function translationCacheKey(request: Pick<AiTranslationRequest, 'sourceId' | 'sourceVersion' | 'language' | 'glossaryVersion' | 'text'>): string {
  return JSON.stringify([request.sourceId, request.sourceVersion, request.language, request.glossaryVersion, request.text]);
}
export function translationState(record: TranslationRecord | null, request: Pick<AiTranslationRequest, 'sourceId' | 'sourceVersion' | 'language' | 'glossaryVersion' | 'text'>): TranslationState {
  if (!record) return 'original';
  if (record.sourceId !== request.sourceId || record.sourceVersion !== request.sourceVersion || record.original !== request.text || record.language !== request.language || record.glossaryVersion !== request.glossaryVersion) return 'stale';
  return record.status;
}
export function createTranslationCache(limit = 100) {
  const records = new Map<string, TranslationRecord>();
  return {
    get(request: AiTranslationRequest) { return records.get(translationCacheKey(request)) ?? null; },
    put(request: AiTranslationRequest, record: TranslationRecord) {
      if (translationState(record, request) === 'stale') return false;
      const key = translationCacheKey(request); records.delete(key); records.set(key, record);
      while (records.size > Math.max(1, limit)) records.delete(records.keys().next().value!);
      return true;
    },
    clear() { records.clear(); },
    get size() { return records.size; },
  };
}

export const localTranslationAdapter: TranslationAdapter = {
  async translate(request, signal) {
    aborted(signal); await Promise.resolve(); aborted(signal);
    const known = request.glossaryVersion === TRANSLATION_GLOSSARY_VERSION && request.language === 'en' ? sampleTranslations.get(request.text) : undefined;
    return {
      requestId: request.requestId, sourceVersion: request.sourceVersion, mock: true,
      data: { text: known ?? request.text, status: known ? 'sample' : 'unavailable' },
      sources: [{ id: `translation:${request.sourceId}`, label: request.language === 'en' ? 'Spotlog sample translation' : 'Spotlog 번역 예시', checkedAt: null, sourceVersion: request.sourceVersion }],
      warnings: [], unplaced: [],
    };
  },
};

export function koreanPlaceAddress(place: Pick<Place, 'name' | 'address'>) {
  return [place.name, place.address.trim()].filter(Boolean).join('\n');
}

export function guideRequest(journey: Journey, day: JourneyDay, current: Place | undefined, index: number, question: string, language: 'ko' | 'en'): AiGuideRequest {
  return {
    requestId: crypto.randomUUID(), sourceVersion: sourceVersion(journey), language,
    selectedPlaceIds: day.places.map(place => place.id), dayIds: [guideDayId(day)],
    lockedVisitIds: day.places.flatMap((place, i) => place.bookingFixed ? [guideVisitId(place, i)] : []),
    journey, dayId: guideDayId(day), question, placeId: current?.id, visitId: current ? guideVisitId(current, index) : undefined,
  };
}
