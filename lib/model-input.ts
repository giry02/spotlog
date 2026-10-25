import type { ChatRequest, ModelReply } from './chat-contract';
import { namedBusinessCollectionCandidates, namedBusinessCollectorScope, namedItineraryAdditionScope, namedNearbyFoodAnchor, namedVisitRemovalScope } from './chat-contract';
import { modelContext } from './model-context';
import { currentTrip, foodResults, MAX_COLLECTED_ENTITIES, visitName } from './trip-engine';
import { modelSystemPrompt, itinerarySystemPrompt } from './model-system-prompt';
import type { ChatResources } from './chat-resources';
import type { RagRetrieval } from './rag-types';
import { itineraryEvidenceCandidates, itineraryRequest, itineraryRetrievalScope } from './itinerary-retrieval';
import { findFood, findPlace, findStay, getKnownEntityPrice, REGIONS } from './trip-data';
import { findTripAnchor } from './trip-anchor';
import { isWholeDayCopyOnlyRequest } from './trip-edit-intent';
import { isTripTitleCopyRequest, localFeatureTask } from './local-feature-intent';
import { SPOTLOG_ENTRIES, SPOTLOG_ENTRY_TARGETS } from './spotlog-app-bridge';
import { currentTripOfflineSaveIssue, workingTripMatchesSaved } from './trip-local-features';
import { registeredBusinessFactQueryIds } from './rag-catalog';
import { REGISTERED_BUSINESS_FACT_HINT } from './registered-business-grounding';
import { socialRequestCandidates, socialRequestedView } from './social-intent';
import { socialModelSamples } from './social-model-samples';

export function compactModelContext(request: ChatRequest) {
  // Give each fact one role: catalog holds descriptions and constraints while
  // candidates holds every currently eligible ID. No candidate is truncated.
  const context = modelContext(request);
  const courses = context.publicCourses.candidates.map(
    ({ id, title, region, days, theme, author, authorId, contentType, sourceKind, sourceAppId }) => ({
      id,
      title,
      region,
      days,
      theme,
      author,
      authorId, contentType, sourceKind, sourceAppId,
    }),
  );
  return JSON.parse(
    JSON.stringify(
      {
        ...context,
        catalog: {
          places: context.catalog.places.map(
            ({ id, name, region, area, tags, description, visitNote }) =>
              ({ id, name, region, area, tags, description, ...(visitNote ? { visitNote } : {}) }),
          ),
          food: context.catalog.food.map(
            (item) => ({ id:item.id, placeId:item.placeId, region:item.region ?? findTripAnchor(item.placeId)?.region, name:item.name, cuisine:item.cuisine, price:getKnownEntityPrice(item), quiet:item.quiet, walk:item.walkVerified === false ? null : item.walk, registered:Boolean(item.registered), sourceVerifiedAt:item.sourceVerifiedAt }),
          ),
          stays: context.catalog.stays.map(
            (item) => ({ id:item.id, name:item.name, region:item.region, near:item.near, price:getKnownEntityPrice(item), tags:item.tags, registered:Boolean(item.registered), sourceVerifiedAt:item.sourceVerifiedAt }),
          ),
        },
        candidates: {
          places: context.candidates.places.map(({ id }) => ({ id })),
          food: context.candidates.food.map(
            (item) => ({ id:item.id, placeId:item.placeId, cuisine:item.cuisine, price:getKnownEntityPrice(item) }),
          ),
          cafes: context.candidates.cafes.map(
            (item) => ({ id:item.id, placeId:item.placeId, cuisine:item.cuisine, price:getKnownEntityPrice(item) }),
          ),
          shops: context.candidates.shops.map(item => ({ id:item.id, placeId:item.placeId, cuisine:item.cuisine, price:getKnownEntityPrice(item) })),
          stays: context.candidates.stays.map(item => ({ id:item.id, near:item.near, price:getKnownEntityPrice(item) })),
        },
        publicCourses: { ...context.publicCourses, candidates: courses },
      },
      (key, value) =>
        ['image', 'credit', 'sourceUrl', 'sourceVerifiedAt'].includes(key)
          ? undefined
          : value,
    ),
  );
}

function originalRetrieval(evidence?: unknown): RagRetrieval | undefined {
  if (!evidence || typeof evidence !== 'object') return;
  if ('retrievalStatus' in evidence) return (evidence as ChatResources).retrieval;
  if ('results' in evidence) return evidence as RagRetrieval;
}

function compactRetrieval(retrieval: RagRetrieval) {
  return {
    dataMode: retrieval.dataMode,
    results: retrieval.results.map((item, index) => ({
      evidenceId: `ref${index + 1}`,
      placeId: item.placeId,
      ...(item.title ? { title: item.title } : {}),
      text: item.text,
      sourceKind: item.sourceKind,
      ...(item.checkedAt ? { checkedAt: item.checkedAt } : {}),
    })),
  };
}

/** The narrow planner cannot execute edits, additions or saving an existing trip. */
export function usesItineraryPlanner(request: ChatRequest) {
  if (localFeatureTask(request) || namedItineraryAdditionScope(request)) return false;
  const needs = itineraryRequest(request);
  if (!needs.requested || request.action.type !== 'message') return false;
  const collected = currentTrip(request.session).collectedIds ?? [];
  if (collected.length && collected.every(id => !findPlace(id))) return false;
  const text = request.action.text;
  // An explicit no-additions clause protects a complete new itinerary; it is
  // not an instruction to edit the existing trip or to add a new business.
  const edits = text.replace(/추가\s*하지\s*(?:마(?:세요)?|말아\s*(?:줘|주세요)|말고)/g, '');
  if (/저장|찜|담아|담고|담기|교체|바꿔|바꾸|수정|추가|삭제|제거|옮겨|이동|예약해|결제|길찾기/.test(edits)) return false;
  // "일정에 장소를 넣어줘" on an existing plan is an addition, whereas the
  // same wording on a fresh session can request a complete first itinerary.
  return !currentTrip(request.session).plan.length || /만들|짜|구성|배치|계획해/.test(text) ||
    (needs.daysSpecified && !/(?:일정|코스)(?:에|의)/.test(text));
}

function plannerConversation(recentConversation: { question: string; answer?: string }[]) {
  const answers = new Map<string, number>();
  let hasRepeatedAnswer = false;
  const conversation = recentConversation.map((turn, index) => {
    if (!turn.answer) return turn;
    const previous = answers.get(turn.answer);
    if (previous !== undefined) {
      hasRepeatedAnswer = true;
      return { question: turn.question, answerSameAsConversation: previous };
    }
    answers.set(turn.answer, index + 1);
    return turn;
  });
  // Suggestions and numbered alternatives may not exist in the current state.
  // Preserve every distinct answer verbatim; only exact duplicate strings use
  // a reference to the earlier, complete answer in this same bounded history.
  return {
    recentConversation: conversation,
    ...(hasRepeatedAnswer ? {
      recentConversationFormat: 'answerSameAsConversation은 recentConversation의 1부터 시작하는 앞선 항목 번호다. 해당 항목의 answer 원문과 완전히 동일한 답변을 뜻한다.',
    } : {}),
  };
}

function plannerRetrieval(retrieval: ReturnType<typeof compactRetrieval>) {
  return {
    ...retrieval,
    // The original RAG body already starts with this exact title. Every byte of
    // the body and every source reference remains available to the planner.
    results: retrieval.results.map(({ title, ...item }) => ({
      ...item,
      ...(title && item.text !== title && !item.text.startsWith(`${title}\n`) ? { title } : {}),
    })),
  };
}

// Aliases exist only at the model boundary. The original server-owned evidence
// is retained for source validation, audit history and the UI's official links.
export function resolveModelEvidenceIds(reply: ModelReply, evidence?: unknown): ModelReply {
  const retrieval = originalRetrieval(evidence);
  if (!retrieval) return reply;
  // Preserve explicit reference lists that a local model put in answer text.
  // Only this exact presentation fragment moves to the citation field. Unknown
  // references remain unknown and are rejected by the existing source verifier.
  const inline: string[] = [];
  const message = reply.message.replace(
    /[（(]\s*(?:evidenceIds?|참고(?:\s*자료)?|근거|출처)\s*[:：]\s*(ref\d+(?:\s*[,、]\s*ref\d+)*)\s*[）)]/gi,
    (_fragment, ids: string) => { inline.push(...(ids.match(/ref\d+/gi) ?? [])); return ''; },
  ).replace(
    /\[ref\d+\]\(#ref\d+\)(?:\s*[,、]\s*\[ref\d+\]\(#ref\d+\))*/gi,
    (fragment) => { inline.push(...(fragment.match(/ref\d+/gi) ?? [])); return '아래 검색 자료'; },
  ).replace(/\bref\d+\b/gi, (id) => { inline.push(id); return '검색 자료'; })
    .replace(/\bevidenceIds\b\s*[:：]?/g, '참고 자료:').trim();
  if (!reply.evidenceIds && !inline.length) return reply;
  const aliases = new Map(
    (retrieval?.results ?? []).map((item, index) => [`ref${index + 1}`, item.evidenceId]),
  );
  return { ...reply, message, evidenceIds: [...new Set([...(reply.evidenceIds ?? []), ...inline])].map((id) => aliases.get(id) ?? id) };
}

export function usesCollectedBusinessPlanner(request: ChatRequest): boolean {
  if (request.action.type !== 'message') return false;
  const state = currentTrip(request.session), needs = itineraryRequest(request);
  const ids = state.collectedIds ?? [], text = request.action.text;
  if (!state.region || !ids.length || !needs.requested || needs.outsideCorpus || needs.region !== state.region || needs.namedPlaceIds.length ||
      !ids.every(id => !findPlace(id) && Boolean(findFood(id) || findStay(id))) ||
      !/담은|담아\s*둔|모은|모아\s*둔|수집한|수집\s*목록|현재\s*후보|(?:이|그|위의?)\s*(?:업체|식당|카페|상점|숙소)/.test(text) ||
      /새(?:로운)?\s*(?:관광지|관광\s*명소|명소)|관광\s*명소|관광지\s*(?:일정|위주|중심)|관광지(?:도|를|까지)\s*(?:추천|포함|추가)/.test(text) ||
      !/만들|짜\s*(?:줘|주|줄|고)|짜줘|구성|계획해/.test(text) ||
      /저장|찜|담아|담고|담기|교체|바꿔|바꾸|수정해|수정하(?!지)|추가해|추가하(?!지)|삭제|제거|옮겨|이동해|복사|예약해|결제|날씨|예보/.test(text)) return false;
  return true;
}

export function usesNamedBusinessCollector(request: ChatRequest): boolean {
  return Boolean(namedBusinessCollectorScope(request));
}

export function usesKnownTripEditor(request: ChatRequest): boolean {
  if (request.action.type !== 'message' || !currentTrip(request.session).plan.length || namedItineraryAdditionScope(request)) return false;
  if (namedVisitRemovalScope(request)) return true;
  const text = request.action.text, compact = text.replace(/\s+/g, '');
  if (/만들|짜\s*(?:줘|주|줄|고)|생성|구성|계획해|저장|찜|담아|담기|휴지통|복원|초기화|리셋|날씨|예보|추천|찾아|검색|비교|예약해|결제|대화/.test(text) ||
      /어떻게|방법|설명|무슨뜻|가능|할수있|알려|보여|조회|확인해/.test(compact)) return false;
  // A protection clause about other items must not cancel the requested edit.
  const commands = text.replace(/안\s*(?:바꿔(?:줘)?|수정해(?:줘)?|변경해(?:줘)?|추가해(?:줘)?|삭제해(?:줘)?|복사해(?:줘)?|배치해(?:줘)?|넣어(?:줘)?|적용해(?:줘)?|반영해(?:줘)?)/g, ' ');
  const adding = /추가해|추가하(?!지|면)|넣어/.test(commands);
  if (adding && (/(?:관광지|방문지|명소|장소|식당|카페|상점).{0,30}(?:추가해|추가하(?!지|면)|넣어)/.test(commands) ||
      itineraryRequest(request).namedPlaceIds.some(id => !currentTrip(request.session).plan.some(visit => visit.entityId === id)))) return false;
  const edit = /바꿔|바꾸(?!지|면)|변경해|변경하(?!지|면)|설정해|수정해|수정하(?!지|면)|정해|맞춰|적어|써줘|써주|지워|없애|해제|(?:으?로)\s*해\s*줘/.test(commands) || isTripTitleCopyRequest(request);
  const meta = /여행\s*(?:이름|제목|날짜)|여행명|출발일|시작\s*(?:일|날짜)/.test(text);
  const details = /메모|체류|머물|소요|시각|시간|\d\s*시|\d\s*분/.test(text);
  const dayOrVisit = /DAY|데이|일차|하루|빈\s*날|새\s*날|방문|일정\s*항목/i.test(text) || currentTrip(request.session).plan.some(visit => text.includes(visitName(visit)));
  const dayEdit = /추가해|추가하(?!지|면)|늘려|늘리(?!지|면)|복사해|복사하(?!지|면)|삭제해|삭제하(?!지|면)|지워|빼줘/.test(commands);
  const stay = /숙소|숙박|호텔|체크인|체크아웃|박수/.test(text) && /체크인|DAY|데이|일차|\d\s*박/i.test(text) && (edit || /배치해|배치하(?!지|면)|넣어|적용해|반영해|체크인.{0,20}(?:해줘|할래)/.test(commands));
  return (edit && (meta || details)) || (dayOrVisit && dayEdit) || stay;
}

function namedNearbyFoodInput(request: ChatRequest) {
  const anchor = namedNearbyFoodAnchor(request);
  if (!anchor || request.action.type !== 'message') return;
  const state = currentTrip(request.session);
  const candidates = foodResults({ ...state, anchorId: anchor.id, foodKind: '식당', cuisine: '전체' })
    .filter(item => (item.region ?? findTripAnchor(item.placeId)?.region) === state.region)
    .map(item => ({ id: item.id, name: item.name, region: item.region ?? findTripAnchor(item.placeId)?.region,
      registered: Boolean(item.registered), fictional: !item.registered, price: getKnownEntityPrice(item) }));
  const hints = '이번 요청은 현재 일정의 명시한 장소 주변 식당 후보 패널을 여는 긍정 요청이다. 출력은 {"message":"250자 이내 한국어 설명","actions":[허용 행동]} JSON 하나이며 actions를 비워 성공 안내만 하지 않는다.\n' +
    '기준 장소는 ' + anchor.name + '(id:' + anchor.id + ')이며 context.nearbyAnchorRequest와 일치해야 한다. state.editingId가 있으면 먼저 {"type":"show","stage":"plan"}으로 편집 대기를 해제한다. 현재 anchorId가 기준 ID와 다르면 {"type":"place","id":"' + anchor.id + '"}로 해당 장소를 선택한다. 마지막에는 {"type":"show","stage":"food","kind":"식당"}으로 식당 후보 패널을 반드시 연다. 전체 행동은 1~3개다.\n' +
    'foodCandidates는 현재 업체 모드·도보·예산으로 그 패널에 표시될 canonical 후보 전부다. 0곳이어도 패널을 열고 현재 후보가 0곳임을 말한다. foodCandidates에 없는 식당이나 다른 지역 업체를 추천하지 않는다. fictional:true이면 가상 체험 업체임을 밝힌다. 가격 null은 미확인이며 현재 영업·예약·실제 이동시간을 추측하지 않는다.\n' +
    '허용 행동은 위 place와 show plan/show food 식당뿐이다. 기존 일정·방문·메모·시각·체류·DAY·제목·날짜·저장본을 유지하고 food/stay/edit/build/configure/add-entity/collect-entity로 선택·교체·추가하거나 모드를 변경하지 않는다. 마지막 userMessage만 처리한다. evidenceIds·URL·다른 최상위 키를 만들지 않는다.';
  const question = {
    context: { task: 'named-nearby-food-browse', allowedToolTypes: ['place', 'show'], nearbyAnchorRequest: anchor,
      state: { region: state.region, anchorId: state.anchorId, editingId: state.editingId, businessMode: state.businessMode ?? 'registered' },
      foodCandidates: candidates },
    serverExecutionHints: hints,
    userMessage: request.action.text,
  };
  return { question, messages: [{ role: 'system', content: hints }, { role: 'user', content: JSON.stringify(question) }] };
}

function namedItineraryAdditionInput(request: ChatRequest) {
  const scope = namedItineraryAdditionScope(request);
  if (!scope || request.action.type !== 'message') return;
  const state = currentTrip(request.session);
  const question = {
    context: {
      task: 'named-itinerary-addition', allowedToolTypes: scope.candidate.eligible ? ['add-entity'] : [],
      requestedDay: scope.day, candidate: scope.candidate, existingStay: scope.existingStay, instruction: scope.instruction,
      state: { region: state.region, days: state.days, businessMode: state.businessMode ?? 'registered', booked: state.booked,
        plan: state.plan.map(visit => ({ id: visit.id, day: visit.day, kind: visit.kind, entityId: visit.entityId, entityName: visitName(visit), locked: visit.locked })) },
    },
    userMessage: request.action.text,
  };
  const system = '너는 Spotlog의 기존 여행에 사용자가 이름과 DAY를 명시한 단일 항목만 추가하는 도우미다. 마지막 userMessage를 해석해 {"message":"250자 이내 한국어 설명","actions":[]} JSON 객체 하나만 반환한다.\n' +
    'candidate.eligible:true이면 허용 행동은 {"type":"add-entity","id":"candidate.id의 실제 ID","day":context.requestedDay의 정수} 정확히 한 개다. 이름을 ID로 쓰거나 entityType/targetType/visitId/fields/name/kind 같은 필드를 넣지 않는다. 이미 처리한 과거 요청을 재실행하지 않는다.\n' +
    'context.existingStay가 있으면 해당 DAY에는 그 이름의 숙박이 이미 있어 새 숙소를 추가·교체하지 않았고 기존 숙박을 유지한다고 명확히 설명하며 actions:[]를 쓴다. 추가합니다/추가했어요/추가가 제한될 수 있어요 같은 불확실한 완료 안내를 하지 않는다. candidate.eligible:false이면 actions:[]로 현재 조건을 설명하고 필요한 확인만 질문한다. 등록 모드를 임의로 체험 모드로 바꾸거나 예산·음식·도보 조건을 바꾸지 않는다. fictional:true 업체는 가상 체험 데이터이며 실제 영업·가격·예약·위치를 검증했다고 말하지 않는다.\n' +
    '기존 방문·식당·숙소·메모·시각·체류·여행명·기간·출발일·공개 출처·저장본은 유지한다. build/configure/collect-entity/stay-placement/day-add/day-copy/visit-copy/trip-meta/visit-details/다른 행동을 덧붙이지 않는다. 숙박 중복·마지막 DAY·예약 보호는 add-entity가 서버에서 검사하며, 기존 숙소를 교체하는 도구로 바꾸지 않는다. 이미 해당 DAY에 같은 항목이나 숙박이 있으면 추가되지 않을 수 있음을 현재 plan을 보고 정확히 안내한다.\n' +
    '후보는 이미 존재하는 catalog 항목 한 개이며 새 관광지나 업체를 만들지 않는다. 검색·실시간 사실을 새로 확인한 작업이 아니므로 evidenceIds·URL·다른 최상위 키를 만들지 않는다. 대상이 불분명하면 actions:[]로 확인한다.';
  return { question, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(question) }] };
}

function knownTripEditingInput(request: ChatRequest) {
  if (!usesKnownTripEditor(request) || request.action.type !== 'message') return;
  const state = currentTrip(request.session);
  const dayCopyOnly = isWholeDayCopyOnlyRequest(request);
  const removal = namedVisitRemovalScope(request);
  const removalTarget = removal?.targets.length === 1 ? removal.targets[0] : undefined;
  const allowedToolTypes = removal ? removalTarget && !removalTarget.locked ? ['remove'] : [] : dayCopyOnly ? ['day-copy'] : ['trip-meta', 'visit-details', 'day-add', 'day-copy', 'day-delete', 'visit-copy', 'stay-placement'];
  const knownIds = [...new Set([...state.plan.flatMap(visit => visit.entityId ? [visit.entityId] : []), ...(state.collectedIds ?? []), ...(state.stayId ? [state.stayId] : [])])];
  const knownStays = knownIds.flatMap(id => { const stay = findStay(id); return stay ? [{ id: stay.id, name: stay.name, region: stay.region, price: getKnownEntityPrice(stay) }] : []; });
  const question = {
    context: {
      task: 'known-trip-editor',
      allowedToolTypes,
      ...(removal ? { namedVisitRemoval: removal } : {}),
      state: {
        region: state.region, days: state.days, activeDay: state.activeDay,
        title: state.title ?? '', startDate: state.startDate ?? null,
        businessMode: state.businessMode ?? 'demo', booked: state.booked,
        stayBudget: state.stayBudget, stayBudgetExplicit: state.stayBudgetExplicit ?? false,
        collectedIds: state.collectedIds ?? [],
        plan: state.plan.map(({ knowledge: _knowledge, ...visit }) => ({ ...visit, entityName: visitName(visit) })),
      },
      knownStays,
    },
    userMessage: request.action.text,
  };
  const editorSystem = '너는 Spotlog의 현재 여행만 부분 편집하는 도우미다. 마지막 userMessage만 새로 실행하고 과거 생성·수집·편집은 반복하지 않는다. context.state가 실제 현재 상태이며 과거 답변의 완료 주장을 사실로 대신하지 않는다.\n' +
    '출력은 {"message":"250자 이내의 한국어 설명","actions":[]} JSON 객체 하나다. actions는 최대 4개이며 아래 exact 문법의 필요한 행동만 순서대로 넣는다. type 외에 각 문법에 없는 필드는 넣지 않는다.\n' +
    '여행명/출발일: {"type":"trip-meta","title"?:"100자 이내 여행명","startDate"?:"YYYY-MM-DD"|null}. 실제 달력 날짜만 사용한다. 하나 이상의 편집 필드가 필요하다. 날짜 해제는 null이다. 예약 날짜를 바꾼 것이 아니다. 공개 코스의 제목만 여행 이름에 복사하라는 요청도 trip-meta title만 편집하고 방문이나 코스 출처는 가져오지 않는다.\n' +
    '방문 메모/시각/체류: {"type":"visit-details","id":"현재 plan의 방문 id","note"?:"1000자 이내 메모","time"?:"HH:mm 또는 빈 문자열","durationMinutes"?:0..1440}. 바꾸려는 필드만 최상위에 쓰며 하나 이상 넣는다. memo, fields, entityType, targetType, visitId는 금지다. 메모·시각 지우기는 각각 note:"", time:""이고 체류시간 해제는 durationMinutes:0이다. id는 entityId가 아닌 plan의 방문 id다.\n' +
    'DAY 편집: {"type":"day-add","afterDay"?:1..30}, {"type":"day-copy","day":1..30,"toDay"?:1..30}, {"type":"day-delete","day":1..30}. day-add는 지정 DAY 바로 뒤에 빈 날을 넣고 기본은 마지막 뒤다. day-copy는 DAY 전체를 새 날로 복사해 삽입하고 기본은 마지막 뒤다. DAY 전체 복사는 day-copy를 정확히 한 번만 실행한다. 메모·시각·체류시간은 day-copy가 이미 전부 복사하므로 visit-copy나 visit-details를 덧붙이지 않는다. 복사·삽입·삭제는 서버가 기존 방문의 세부와 뒤 DAY 번호를 보존·이동하므로 개별 방문을 다시 편집하거나 생성하지 않는다. 적어도 하루는 남기며 최대 30일이다.\n' +
    '방문 하나 복사: {"type":"visit-copy","id":"현재 plan의 방문 id","day"?:1..30}. DAY 전체 복사와 구분한다. 메모·시각·체류시간은 서버가 함께 복사한다.\n' +
    '선택한 숙소 배치: {"type":"stay-placement","stayId":"knownStays의 숙소 id","startDay":1..29,"nights":1..29}. 사용자가 말한 체크인 DAY와 박수만 반영하고 체크아웃 startDay+nights는 state.days 이내여야 한다. 잠긴 예약을 건드리거나 현재 가격 미확인 숙소의 명시 예산 충족을 주장하지 않는다.\n' +
    '위 7종 행동 이외의 edit, visit-add, build, configure, place, food, stay, collect-entity, save, transfer 등은 반환하지 않는다. 방문 이름과 DAY를 현재 plan.entityName/day로 찾아 그 행의 id를 쓰고 없는 ID를 만들지 않는다. 잠긴 locked:true 방문은 편집·복사하지 않고 예약 숙소의 날짜가 달라지는 DAY 편집도 실행하지 않는다. 숙박을 마지막 DAY로 복사하거나 체크아웃을 기간 밖으로 밀지 않는다.\n' +
    '다른 방문·기간·제목·시작일·메모·시각·체류시간은 요청하지 않았으면 그대로 둔다. 다른 항목을 추가하지 말라는 보호 문구 때문에 명시한 DAY 복사를 생략하지 않는다. 단순 설명·조회·부정 요청이나 대상을 식별할 수 없으면 actions:[]로 필요한 점만 질문한다. RAG·현재 영업·가격·예약을 새로 확인한 편집이 아니므로 evidenceIds·URL·다른 최상위 키를 쓰지 않는다.\n' +
    '예: 현재 plan에 {id:"visit-1",entityName:"금수복국 해운대본점",day:1}이고 여행명과 그 메모/시각/60분 편집 요청이면 {"message":"여행 이름과 지정한 방문 세부를 바꿨어요.","actions":[{"type":"trip-meta","title":"부산 식당 검수"},{"type":"visit-details","id":"visit-1","note":"창가 자리 요청","time":"11:30","durationMinutes":60}]}다. 예시 ID도 현재 plan에 있을 때만 사용한다.';
  const removalInstructions = '이번 요청은 명시한 DAY의 방문 하나를 제거하는 작업이다. namedVisitRemoval.targets가 정확히 한 개이고 locked:false이면 허용 행동은 {"type":"remove","id":"그 target.id 방문 ID"} 정확히 한 개다. ID는 entityId가 아닌 plan의 방문 id이며 DAY 번호만 보고 다른 방문을 고르지 않는다. 숙소 항목도 같은 remove로 제거하며 stay/stay-placement는 제거 도구가 아니다. day-delete는 DAY 전체 삭제이므로 여기서는 사용하지 않는다. 다른 방문·메모·시각·체류·제목·시작일·DAY 수·공개출처·저장본은 유지한다. targets가 없거나 여러 개이거나 locked:true이면 actions:[]로 정확히 확인 또는 예약 보호를 설명한다. 출력은 {"message":"250자 이내 한국어 설명","actions":[]} JSON 하나이며 다른 행동이나 키를 넣지 않는다.';
  const system = removal ? removalInstructions : dayCopyOnly ? '너는 Spotlog에서 현재 DAY 전체를 새 날로 복사하는 도우미다. context.state와 이번 userMessage만 사용한다. 과거 메모 해제·재설정·생성 요청은 이미 처리됐으며 다시 실행하지 않는다.\n' +
    '출력은 {"message":"250자 이내 한국어 설명","actions":[]} JSON 하나다. 유일한 허용 행동은 {"type":"day-copy","day":1..30,"toDay"?:1..30}이며 실행 시 정확히 한 개만 반환한다. day는 복사할 현재 DAY, toDay 생략은 마지막 뒤에 새 DAY를 추가한다.\n' +
    '서버가 해당 DAY의 모든 방문과 현재 메모·시각·체류시간을 이미 복사한다. visit-copy/visit-details/trip-meta/day-add/day-delete/build/configure 등 다른 행동을 절대 덧붙이지 않는다. note/time/durationMinutes를 빈 값이나 0으로 재설정하지 않는다. 원래 방문 ID와 상태·여행명·출발일은 그대로 유지된다.\n' +
    '복사할 DAY가 없거나 잠긴 예약이 있거나 예약 날짜가 밀리거나 숙박 체크아웃이 여행 기간을 넘으면 실행하지 않고 actions:[]로 이유를 설명한다. 최대 30일이다. 다른 장소 추가 금지는 DAY 전체 복사를 취소하는 말이 아니다. 모르는 ID·도구·최상위 키·출처·URL을 만들지 않는다.' : editorSystem;
  const boundedQuestion = removal ? { ...question, serverExecutionHints: removalInstructions } : question;
  return { question: boundedQuestion, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(boundedQuestion) }] };
}

function collectedBusinessPlanningInput(request: ChatRequest) {
  if (!usesCollectedBusinessPlanner(request) || request.action.type !== 'message') return;
  const state = currentTrip(request.session), needs = itineraryRequest(request);
  const ids = state.collectedIds ?? [], text = request.action.text;
  const collectedBusinesses = ids.map(id => {
    const item = findFood(id) ?? findStay(id)!;
    const food = findFood(id);
    return { id: item.id, name: item.name, kind: food ? food.cuisine === '카페' ? 'cafe' : String(food.cuisine) === '상점' ? 'shop' : 'food' : 'stay', registered: Boolean(item.registered) };
  });
  const question = {
    recentConversation: request.session.turns.slice(-6).filter(turn => turn.state.question)
      .map(turn => ({ question: turn.state.question, answer: turn.assistantMessage })),
    context: {
      task: 'collected-business-itinerary',
      state: {
        region: state.region, days: state.days, title: state.title ?? '', startDate: state.startDate ?? null,
        businessMode: state.businessMode ?? 'demo', booked: state.booked,
        meals: state.meals, cafes: state.cafes, lodging: state.lodging,
        collectedIds: ids,
        plan: state.plan.map(({ knowledge: _knowledge, ...visit }) => visit),
      },
      itineraryRequest: { days: needs.days, daysSpecified: needs.daysSpecified },
      collectedBusinesses,
    },
    userMessage: text,
  };
  const system = '너는 Spotlog에서 이미 수집한 업체만 일정으로 배치하는 도우미다. 마지막 userMessage만 새 요청이며 최근 대화의 수집·메타정보 편집을 다시 실행하지 않는다.\n' +
    '출력은 {"message":"250자 이내의 한국어 설명","actions":[]} JSON 객체 하나다. 허용 행동은 {"type":"configure","days":1..7,"meals"?:boolean,"cafes"?:boolean,"lodging"?:boolean}와 {"type":"build"}뿐이다. configure는 필요한 기간·제외 조건이 바뀔 때만 build 앞에 한 번, build는 최대 한 번 실행한다. configure에 type 외의 필드를 하나 이상 넣는다. 다른 행동·다른 최상위 키를 반환하지 않는다.\n' +
    '이 요청은 관광지 일정이 아니다. build에 visits, placeId, entityId, ids, day 필드를 넣지 않는다. 식당·카페·상점·숙소 ID를 관광지 placeId로 사용하지 않는다. 서버가 collectedIds의 업체만 담은 순서로 날짜에 배치하며 새 관광지를 추가하지 않는다. 같은 관광지 근처의 두 식당도 서로 다른 업체다.\n' +
    '당일은 days:1, 1박 2일은 days:2다. 이번 문장에 기간을 말했으면 itineraryRequest.days를 적용하며 1~7일 밖이면 행동하지 말고 범위를 설명한다. 이름·출발일·메모·시각·체류시간은 서버가 같은 업체의 기존 값으로 보존하므로 그 값을 재설정하거나 과거 편집을 되풀이하지 않는다. 예약 숙소는 유지하며 숙소 후보만 선택했다는 이유로 넣지 않는다.\n' +
    '설명이나 생성 취소 요청에는 actions:[]로 답한다. 등록 업체는 검수된 스냅샷이며 영업·가격·빈방·도보시간·예약을 새로 조회하지 않았다. 가격을 0원으로 말하거나 실제 예약 완료를 주장하지 않는다. RAG 장소 설명을 새로 인용하지 않으므로 evidenceIds를 만들지 않는다.\n' +
    '예: 현재 region:부산, days:1, collectedBusinesses에 식당 두 곳이 담겼고 당일 생성을 요청했다면 {"message":"담은 두 식당만 순서대로 당일 초안에 배치했어요.","actions":[{"type":"build"}]}. 같은 두 곳의 2일 생성 요청은 {"message":"담은 두 식당을 순서대로 이틀 초안에 배치했어요.","actions":[{"type":"configure","days":2},{"type":"build"}]}다.';
  return { question, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(question) }] };
}

function demoNamedCollectionInput(request: ChatRequest) {
  const state = currentTrip(request.session);
  if (state.businessMode !== 'demo' || request.action.type !== 'message') return;
  const text = request.action.text, needs = itineraryRequest(request);
  if (needs.requested || needs.outsideCorpus ||
      /비교|메뉴|상세|날씨|예보|추천|찾아|검색|찜|저장|예약|결제|바꿔|바꾸|교체|메모|체류|시각|시간|여행\s*(?:이름|제목)|출발일|시작일|수정|복사|삭제|어떻게|방법|설명|가능|알려|보여/.test(text)) return;
  const commands = text.replace(/(?:만들|짜|생성하|구성하)지\s*(?:마(?:세요)?|말아\s*(?:줘|주세요)|말고)/g, '');
  if (/만들어|만들고|짜줘|짜\s*줘|생성해|구성해|배치해/.test(commands)) return;
  const named = namedBusinessCollectionCandidates(request, state);
  if (!named.length || named.every(item => item.registered)) return;
  const regions = REGIONS.filter(region => text.includes(region));
  const requestedRegion = state.region === null && regions.length === 1 && named.every(item => item.region === regions[0]) ? regions[0] : null;
  if (state.region === null && requestedRegion === null) return;
  const candidates = requestedRegion ? namedBusinessCollectionCandidates(request, { ...state, region: requestedRegion }) : named;
  if (candidates.some(item => !item.eligible || item.region !== (requestedRegion ?? state.region))) return;
  const question = {
    context: {
      task: 'demo-named-business-collector', dataMode: 'authored-demo-data',
      warning: '명시적으로 선택한 체험 모드다. registered:false 업체와 가격은 가상 예시이며 실제 영업·예약 자료가 아니다. registered:true 항목은 검수된 등록 스냅샷이며 현재 영업·가격·빈방은 미확인이다.',
      state: { region: state.region, days: state.days, booked: state.booked, collectedIds: state.collectedIds ?? [], hasPlan: state.plan.length > 0 },
      requestedRegion, namedBusinessCollectionCandidates: candidates,
      remainingCollectionSlots: MAX_COLLECTED_ENTITIES - (state.collectedIds?.length ?? 0),
    },
    userMessage: text,
  };
  const system = '너는 사용자가 명시적으로 선택한 가상 업체 체험의 여행 후보 수집 도우미다. 이번 userMessage만 처리한다. 출력은 {"message":"250자 이내 한국어 설명","actions":[]} JSON 하나다.\n' +
    '허용 행동은 {"type":"collect-entity","id":"이번 namedBusinessCollectionCandidates의 실제 ID"}이며 전체 최대 4개다. 서로 다른 anchor 업체도 place 전환은 필요 없다. 긍정 요청의 eligible:true 후보만 주어진 순서대로 담고 이름이나 모르는 ID를 행동에 쓰지 않는다. 이미 collectedIds에 있는 항목은 유지한다. 현재 필터·지역·예산·예약 보호와 수집 상한을 바꾸지 않는다.\n' +
    'state.region이 null이고 requestedRegion이 있으면 그 명시 지역의 {"type":"region","region":"requestedRegion의 실제 값"}을 먼저 한 번 사용한다. 그 외에는 region을 바꾸지 않는다. 수집 취소·부정·설명에는 actions:[]이며 한도를 넘으면 임의로 일부를 담지 말고 나눠 요청하도록 질문한다.\n' +
    '일정 생성·장소 전환·기존 여행 수정·저장·예약·결제는 수행하지 않는다. 가상 업체는 체험 예시로 밝히고 실제 업체나 현재 영업·예약·계정 저장을 완료한 것으로 설명하지 않는다. 다른 도구·필드·최상위 키·출처·URL을 만들지 않는다.';
  return { question, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(question) }] };
}

export function buildModelInput(request: ChatRequest, evidence?: unknown) {
  const state = currentTrip(request.session);
  const localTask = localFeatureTask(request);
  if (localTask === 'social' && request.action.type === 'message') {
    const candidates = socialRequestCandidates(state, request.action.text);
    const requestedView = socialRequestedView(request.action.text);
    const question = { userMessage: request.action.text, context: {
      task: 'local-feature-navigator', requestedFeature: 'social', allowedToolTypes: ['social'],
      state: { stage: state.stage, socialTarget: state.socialTarget ?? null, socialView: state.socialView ?? 'overview' },
      social: { candidates, requestedView,
        publicMetrics: { source: 'UNCONNECTED', copies: null, reactions: null, threads: null },
        publicSamples: socialModelSamples(candidates), writeMode: 'user-panel-only' },
    } };
    const system = `너는 Spotlog의 스레드·평가·담김 조회 도우미다. 마지막 질문을 해석하고 {"message":"한국어 안내","actions":[]} JSON 하나만 반환한다.
허용 행동은 {"type":"social","target":context.social.candidates의 정확한 target,"view":"${requestedView}"} 하나뿐이다. target의 kind는 entity(업체/장소 전체), course(공개 코스 전체), course-place(특정 공개 코스의 정확한 visitIndex 카드)이며 범위를 서로 바꾸지 않는다. visitIndex는 0부터 시작한다.
후보가 정확히 하나이고 조회/폼 열기 요청이면 그 target과 requestedView를 사용한다. 후보가 없거나 여러 개면 actions:[]로 어떤 장소·코스·방문 카드인지 질문한다. 조회 자체를 하지 말라는 요청이나 순수 기능 설명도 actions:[]다. '댓글 전송하지 마, 스레드만 보여줘'는 조회 요청을 유지한다.
publicSamples는 target별 제작된 가상 사용자 커뮤니티 체험 데이터(source:SAMPLE)다. 제공된 샘플 담김·반응·스레드 수만 샘플임을 밝혀 설명할 수 있으며 실제 회원 통계·검증된 방문 후기·평균 별점으로 말하지 않는다. 다른 target의 숫자를 섞거나 없는 숫자·후기를 만들지 않는다. publicMetrics는 실제 회원 서버 집계이며 여전히 UNCONNECTED/null이다. 기기 댓글·반응·저장 사본 수와 본문은 모델에 제공되지 않으므로 추측하지 않는다.
이 도구는 화면만 연다. 작성·수정·삭제·등록·좋아요·응원·평가 선택·본문 전송은 할 수 없다. 사용자가 패널에서 직접 버튼을 눌러 이 기기에 기록하며 실제 회원 서버 전송은 아니다. 요청에 본문이나 평가가 있어도 행동에 body/text/score/reaction/submit 등을 넣지 않고 화면만 안내한다. 일정·저장본·찜·공개 원본을 바꾸거나 다른 도구를 사용하지 않는다. evidenceIds/URL/HTML/추가 키는 만들지 않는다.`;
    return { question, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(question) }] };
  }
  if (localTask && request.action.type === 'message') {
    const full = compactModelContext(request);
    const currentSaved = request.session.library.find(plan => plan.id === state.savedPlanId && !plan.deletedAt);
    const offlineIssue = currentTripOfflineSaveIssue(state, currentSaved);
    const currentSavedTrip = { id: currentSaved?.id ?? null, status: currentSaved?.status ?? null,
      matchesCurrent: Boolean(currentSaved && workingTripMatchesSaved(state, currentSaved)),
      offlineSaveAllowed: offlineIssue === undefined, offlineSaveIssue: offlineIssue ?? null };
    const question = {
      userMessage: request.action.text,
      context: {
        task: 'local-feature-navigator', requestedFeature: localTask,
        state: { ...full.state, ...(localTask==='local-trip'?{savedPlanId:state.savedPlanId}:{}), plan: full.state.plan.map(({knowledge:_knowledge,note:_note,...visit}:Record<string,unknown>)=>({...visit,entityName:visitName(visit as unknown as Parameters<typeof visitName>[0])})) },
        ...(localTask==='local-trip'?{currentSavedTrip,savedTrips:full.savedTrips,trashedTrips:full.trashedTrips,recentTrip:full.recentTrip,offlineTrips:full.offlineTrips}:{}),
        ...(localTask==='community'?{publicCourses:full.publicCourses}:{}),
        ...(localTask==='media'?{media:full.media}:{}),
        ...(localTask==='app'?{appEntries:Object.entries(SPOTLOG_ENTRY_TARGETS).map(([entry,target])=>({entry,target,label:SPOTLOG_ENTRIES[entry as keyof typeof SPOTLOG_ENTRIES]}))}:{}),
        allowedToolTypes: localTask==='app'?['open_spotlog']:localTask==='reorder'?['show','reorder-visits']:localTask==='community'?['community-filter','copy-community','show']:localTask==='media'?['media','detail']:['saved-filter','plan-status','continue-trip','offline-save','offline-open','offline-remove','offline-library','show','save'],
      },
      recentConversation: request.session.turns.slice(-3).filter(turn=>turn.state.question).map(turn=>({question:turn.state.question,answer:turn.assistantMessage})),
    };
    const system = `너는 Spotlog의 로컬 여행 기능 도우미다. 마지막 userMessage만 해석해 {"message":"한국어 설명","actions":[]} JSON 객체 하나를 반환한다. actions는 최대4개이며 최상위 추가키/HTML/URL은 금지다. 실제 LLM이 문장의 의도를 선택하고 서버가 전체행동을 재검증한다. 순수 설명 질문이나 그 행동 자체를 하지 말라는 요청에만 actions:[]를 쓴다. 한 문장의 긍정 요청과 보호 절을 따로 해석한다. '공개 코스/사진을 보여줘, 내 일정은 바꾸지 마'는 조회 도구를 실행하고 일정 수정만 금지한다. '작성 완료해줘, 공개 게시하지 마'는 plan-status READY를 실행하고 게시하지 않는다. '오프라인 저장해줘, 서버 업로드하지 마'는 기기 사본만 저장한다. 예전 대화를 재실행하지 않는다.
허용 계약:
- 조건을 생략하지 않는다. 이번 문장의 'AI 추천'은 contentType:"ai", '여행자 코스'는 contentType:"traveler", '관광지 사진'은 kind:"LANDMARK"로 반드시 지정한다. 현재 후보가 우연히 전부 그 유형이어도 필터 값을 명시한다. 예를 들어 'AI 추천 공개 코스 중 부산 당일 코스만 보여줘. 내 일정은 바꾸지 마'의 유일한 행동은 {"type":"community-filter","region":"부산","days":1,"contentType":"ai"}다. 다른 지역·기간은 이번 요청의 값으로 고른다.
- community-filter {region?:제주|서울|부산|경주|강릉|null,theme?:all|sea|green,query?:검색어,contentType?:all|traveler|ai,days?:1..7|null,authorId?:실제작성자ID|null}. 제목·작성자이름 검색은 query, 기간은days(1박2일=2),유형은contentType. 현재여행region/days를 바꾸지 않고 공개코스만필터링한다. 기존필터를지우라고명시하면query:'',contentType:all,days:null,authorId:null,region:null,theme:all을필요한대로설정한다. 공개코스catalog는필터를바꿀때참고하는전체짧은목록,candidates는현재목록. copy-community {id:필터후코스ID}는사용자가내여행으로가져오라고명시할때만쓴다. 실제회원글/등급/인기수는없다. traveler는여행자형식데모,ai는앱공공기획샘플이다. 본문·작성자소개는코스상세버튼에서보며원문을새로만들지않는다.
- 공개 코스를 내 여행 초안으로 복사하라는 요청은 copy-community 한 번만 실행한다. 서버가 편집 가능한 개인 초안과 출처를 함께 만들므로 plan-status/trip-meta/build를 덧붙이지 않는다. '공개 원본은 그대로'는 원본 보호 조건이며 개인 사본 생성 금지가 아니다. 제목·순번이 모호하거나 복사하지 말라는 요청이면 복사하지 않고 대상을 질문한다.
- media {mode:photos|motion,region?:지원지역|null,kind?:all|LANDMARK|FOOD|CAFE|SHOP|STAY}. 사진을보여달라면이도구를쓴다. 등록사진80장은검수된스냅샷이며지금모습보장X. motion은사진확대효과,촬영영상/동영상생성X. 사진은관광지일수도있고업체일수도있다. 기존여행을바꾸지않고필터만바꾼다.
- saved-filter {region:지원지역|null}은찜표시지역만바꾼다. 어떤여행에담겼는지도찜화면에표시한다. 현재여행region변경금지.
- plan-status {status:DRAFT|READY}. 작성완료를명시해야READY. 0방문/미정방문/비교중후보/저장안된여행은완료못한다. 완료는기기저장여행확정이지공개게시/예약완료가아니다. save {}는사용자가저장을명시할때만,{type:save}로쓴다. READY뒤수정하면현재편집본은DRAFT이며저장원본은별개다.
- continue-trip {}는휴지통제외최근활성저장여행을이어연다. progress와다르다. 최근기록이없으면만들지않는다.
- reorder-visits {day:1..30,ids:해당DAY전체방문ID배열}는명시한방문순서만한번에바꾼다. ids는entityId가아닌state.plan의방문id이며해당DAY모든id를빠짐없이한번씩보낸다. 관광지바로뒤에연속연결된식당/카페/상점은한묶음이며내부순서를유지한다. 식당만있는일정의업체들을같은근처라는이유로묶지않는다. STAY/locked예약을이동하거나그앞뒤를넘지않고다른DAY/이름/날짜/메모/시각/체류/저장원본은바꾸지않는다. 순서편집창을열거나드래그방법만묻는경우는show {stage:plan,day?:명시DAY}로현재일정의방문순서편집버튼을안내한다. 실제순서변경을금지하거나대상이모호하면actions:[]다. 새방문을만들거나build/transfer/move를나열하지않는다.
- offline-save {id?:완료된활성저장여행ID}는저장당시일정·대표좌표·메모의로컬사본을보관/갱신한다. '현재 여행/이 여행'은 state.savedPlanId와 context.currentSavedTrip이 가리키는 저장본이다. 이 요청은 currentSavedTrip.offlineSaveAllowed:true일 때 id를 생략한 {type:offline-save}만 사용한다. false이면 actions:[]로 offlineSaveIssue를 정확히 설명한다. DRAFT는 저장되어 있어도 작성 완료가 필요하며, 저장 요청만으로 plan-status READY나 save를 덧붙이지 않는다. 다른 READY 여행이나 recentTrip의 ID를 대신 고르지 않는다. 현재 화면과 완료 저장본이 다르면 먼저 현재 내용을 저장하고 작성 완료해야 함을 안내한다. 저장하지 말라는 부정이나 저장 방법 설명 요청에도 actions:[]다. 사진/도로타일/재시작용화면을다운로드한게아니다. offline-library {} 목록,offline-open {id:현재오프라인사본ID}는현재여행을변경하지않고읽기,offline-remove {id:현재사본ID}는명시사본삭제요청에만사용하며원본저장여행은유지된다. offlineTrips에는메모·좌표원문이없으므로그내용을추측하지않는다.
- open_spotlog {target:discover|community|saved|trips|journal|photos|videos|profile|account|privacy|report|share_source|notifications,entry?:허용진입점,journeyId?:현재앱의여행ID,day?:명시한DAY,placeId?:알고있는장소ID}. entry는journal-target의journal-text/journal-photos/journal-draft/journal-preview/journal-visibility,community-target의place-comment/place-reaction/journey-comment/journey-cheer,profile-target의profile-summary/profile-activity,trips-target의personal-place,account-target의account-email/account-reset/account-logout/account-delete만가능하다. 챗봇savedTripID를앱journeyID라고추측하지않는다. context에확인된앱여행ID가없으면journeyId를생략하고앱에서선택하게한다. 미리보기요청의정확한예: {"message":"앱에서 여행과 DAY를 선택해 미리보기를 열 수 있어요. 게시나 사진 업로드는 실행하지 않아요.","actions":[{"type":"open_spotlog","target":"journal","entry":"journal-preview"}]}. type은반드시open_spotlog이며entry를type이나target으로쓰지않는다. 사진업로드금지절은journal-photos요청이아니다. 목적버튼만보여주고사진업로드·댓글전송·로그아웃·탈퇴·게시를이미완료했다고말하지않는다. 계정변경/앱새사본생성은사용자가앱확인화면에서직접진행한다.
- appEntries에있는추가진입점: 장소좋아요는 {type:"open_spotlog",target:"community",entry:"place-reaction"}, 여행기전체댓글은entry:"journey-comment", 여행기응원은entry:"journey-cheer"이며셋모두target:"community"다. 내프로필/내등급은target:"profile",entry:"profile-summary",내활동/기기활동통계는target:"profile",entry:"profile-activity"다. placeId는현재알려진장소ID로place-comment/place-reaction에만허용하고그외에는생략한다. 여행기댓글과장소댓글은다르다. 앱에서실제공개여행/PLACE를고른뒤사용자가직접반응/전송해야하며모델이자동좋아요·댓글·응원·프로필수정·통계조회를실행했다고말하지않는다. 실제회원통계/등급/반응수는제공되지않았으므로생성하지않는다. '좋아요창만열어줘,반응은누르지마'는조회요청을유지한다. 정확한예: {"message":"앱에서 공개 여행기와 장소 카드를 선택해 좋아요 반응 창을 열 수 있어요. 반응은 직접 선택해 주세요.","actions":[{"type":"open_spotlog","target":"community","entry":"place-reaction"}]}.
- show {stage:plan|saved|community|help|library}는조회. detail {id:현재목록의알려진장소ID}는상세조회. open {id:활성저장여행ID}, library {}는내기기저장본조회. 행동은항상type키에위이름을넣고중괄호안의허용필드만보낸다.
최종예: {"message":"여행 내용을 기기에 보관한 오프라인 사본 목록을 열게요.","actions":[{"type":"offline-library"}]}. 기존여행·찜·회원기록을바꿨다고추측하지않고실제선택한행동만250자이내로설명한다.`;
    return {question,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(question)}]};
  }
  const nearbyFood = namedNearbyFoodInput(request);
  if (nearbyFood) return nearbyFood;
  const namedAddition = namedItineraryAdditionInput(request);
  if (namedAddition) return namedAddition;
  const businessPlanning = collectedBusinessPlanningInput(request);
  if (businessPlanning) return businessPlanning;
  const knownEditing = knownTripEditingInput(request);
  if (knownEditing) return knownEditing;
  const namedBusinesses = namedBusinessCollectionCandidates(request, state);
  const namedCollection = namedBusinessCollectorScope(request);
  // An exact named-business collection does not need the entire tourism corpus
  // or 34 unrelated tools. The model still chooses its JSON actions, and the
  // server independently revalidates every ID, filter and collection limit.
  if (namedCollection) {
    const collectionActions = namedCollection.candidates.filter(candidate => !(state.collectedIds ?? []).includes(candidate.id)).map(candidate => ({ type: 'collect-entity', id: candidate.id }));
    const collectionReplyExample = namedCollection.requestedRegion && collectionActions.length <= 3 ? {
      message: '명시한 지역에서 지정한 등록 업체를 여행 후보에 담았어요.',
      actions: [{ type: 'region', region: namedCollection.requestedRegion }, ...collectionActions],
    } : undefined;
    const question = {
      context: {
        task: 'named-business-collector',
        dataMode: 'registered-business-snapshot',
        warning: '이번 문장의 긍정 담기 요청과 현재 조건으로 검증한 등록 업체만 다음 후보에 있다. 현재 영업·가격·예약은 확인하지 않았다.',
        state: { region: state.region, days: state.days, booked: state.booked, collectedIds: state.collectedIds ?? [], hasPlan: state.plan.length > 0 },
        requestedRegion: namedCollection.requestedRegion,
        ...(collectionReplyExample ? { collectionReplyExample } : {}),
        namedBusinessCollectionCandidates: namedCollection.candidates.map(({ id, name, kind, eligible, registered }) => ({ id, name, kind, eligible, registered })),
        remainingCollectionSlots: MAX_COLLECTED_ENTITIES - (state.collectedIds?.length ?? 0),
      },
      userMessage: request.action.type === 'message' ? request.action.text : '',
    };
    const system = '너는 Spotlog 여행 후보를 담는 도우미다. 마지막 userMessage의 요청만 해석한다. 출력은 {"message":"한국어 설명","actions":[]} JSON 객체 하나다. 다른 최상위 키·HTML·URL을 넣지 않는다.\n' +
      '허용 행동은 {"type":"collect-entity","id":"후보의 실제 ID"}와 아래 조건의 region뿐이며 전체 최대 4개다. type과id 외에 entityType/targetType/fields/visitId/name/kind를 행동에 넣지 않는다. state.region이 null이고 context.requestedRegion이 있으면 사용자가 이번 문장에서 직접 말한 그 지역으로 {"type":"region","region":"context.requestedRegion의 실제 지역명"}을 먼저 한 번 실행한다. 이 경우 후보의 eligible은 그 지역 설정 이후 기준이다. requestedRegion이 null이면 region 행동을 만들지 않는다. 이번 메시지에서 이름을 지정한 namedBusinessCollectionCandidates의 eligible:true/registered:true 항목만 요청한 순서대로 담는다. place 전환 없이 collect-entity로 직접 담는다. 상점의 kind:shop은 분류값일 뿐이며 type:shop/SHOP 행동을 만들지 않는다. 장소 이름이나 업체 이름을 ID로 쓰지 않는다. 후보에 없는 ID를 만들거나 현재 필터를 자동으로 바꾸지 않는다.\n' +
      '담아 달라는 긍정 요청일 때만 행동한다. 설명·부정·취소 요청이면 actions:[]로 답한다. 이미 collectedIds에 있는 항목은 유지하고 나머지 요청 항목만 담는다. 수집 상한이나 4개 행동 상한을 넘으면 임의로 일부를 고르지 말고 나눠 담도록 질문한다. eligible:false이면 해당 업체는 담지 못한 조건을 설명한다.\n' +
      (collectionReplyExample ? '현재 region이 null이므로 region 행동을 생략하지 않는다. 이번 context의 실제 지역·후보 ID를 넣은 정확한 JSON 예시: ' + JSON.stringify(collectionReplyExample) + '\n예시의 첫 region 행동 다음에 collect-entity를 순서대로 둔다. 예시에 쓰인 값도 이번 context에 있는 실제 값이며 다른 지역·후보 요청에 복사하거나 없는 ID를 만들지 않는다.\n' : '') +
      '일정 생성·장소 전환·예약·결제·새 숙소 추천을 실행하지 않는다. 기존 여행과 수집목록을 지우거나 다시 만들지 않는다. 담은 결과는 여행 후보이며 실제 예약을 완료한 것이 아니다. message는 250자 이내로 완료할 행동과 미실행 범위를 정확히 설명한다.';
    return { question, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(question) }] };
  }
  // Legacy authored examples stay compact only in explicit demo mode. They do
  // not gain the registered collector's routing or missing-evidence exception.
  const demoCollection = demoNamedCollectionInput(request);
  if (demoCollection) return demoCollection;
  const context = compactModelContext(request);
  const registeredFactIds = request.action.type === 'message' ? registeredBusinessFactQueryIds(request.action.text) : [];
  if (registeredFactIds.length) context.registeredBusinessFacts = { ids: registeredFactIds, unavailable: ['popularity', 'rank', 'rating', 'visitorCount'] };
  if (namedBusinesses.length) context.namedBusinessCollectionCandidates = namedBusinesses;
  const retrieval = originalRetrieval(evidence);
  if (evidence && typeof evidence === 'object' && 'retrievalStatus' in evidence) {
    const resources = evidence as ChatResources;
    context.retrievalStatus = resources.retrievalStatus;
    context.retrievalInstruction = resources.retrievalInstruction;
    if (resources.coverage) context.retrievalCoverage = resources.coverage;
    if (resources.modelRouting) context.modelRouting = resources.modelRouting;
    if (resources.weather) context.weather = resources.weather;
  }
  if (retrieval) context.retrieval = compactRetrieval(retrieval);
  context.itineraryCandidates = itineraryEvidenceCandidates(retrieval, request);
  context.itineraryRequest = itineraryRequest(request);
  // Evidence is supplied once; repeated long summaries in the action catalog
  // crowd out the actual request on the local model.
  if (retrieval || (evidence && typeof evidence === 'object' && 'weather' in evidence)) {
    context.catalog.places = context.catalog.places.map(({ description: _description, visitNote: _visitNote, ...place }: Record<string, unknown>) => place);
  }
  const visitSlots = context.state.plan
    .map(
      (v: { id: string; day: number; label: string; locked: boolean }) =>
        `${v.id}=DAY${v.day}/${v.label}${v.locked ? '/예약고정' : ''}`,
    )
    .join(', ');
  const citationHint = retrieval?.results.length
    ? `검색 자료의 사실을 설명한 답변은 evidenceIds 배열이 필수다. ${retrieval.results.map((_item, index) => `ref${index + 1}`).join(', ')} 중 실제 사용한 ID만 그 배열에 넣는다. message 본문에는 ref 식별자나 evidenceIds 기술 표기를 적지 않는다.`
    : '검색 근거가 없으므로 evidenceIds를 반환하지 않는다.';
  const executionHints = `현재 '여기'의 기준 장소 ID: ${context.state.anchorId ?? '미선택'}. 현재 근처 카페 ID: ${context.candidates.cafes.map((c: { id: string }) => c.id).join(', ') || '없음'}. 카페를 담을 때는 이 목록에서 골라 collect-entity로 처리한다. 이번 메시지에서 직접 이름을 지정한 namedBusinessCollectionCandidates의 eligible:true 업체는 다른 anchor라도 place 전환 없이 collect-entity로 바로 담을 수 있다. eligible:false 또는 이름을 명시하지 않은 다른 anchor 업체는 이 예외를 사용할 수 없다. 현재 plan이 있으면 담기 요청만으로 build를 다시 실행하지 않는다. 지역이 null이면 생성 전에 반드시 region 행동이 필요하다.\n현재 방문별 위치: ${visitSlots || '없음'}. 부분 교체는 이 위치에서 대상 visit ID를 고른 edit 다음 place/food/stay를 사용한다. 부분 수정에 build 금지.\nrecentConversation은 이미 처리한 과거 기록이다. 과거 요청을 재실행하지 않고 맨 마지막 userMessage만 새로 실행한다.\n최종 출력은 반드시 {"message":"한국어 답변","actions":[]} JSON 객체 하나다. 최상위 키는 message, actions, 선택적 evidenceIds, 선택적 needsMoreContext만 허용한다. status, response, data, metadata 같은 포장 키는 금지한다. 설명만 요청하면 actions는 빈 배열이다. ${citationHint}`;
  const businessOnly = (state.collectedIds?.length ?? 0) > 0 && state.collectedIds!.every(id => !findPlace(id));
  const planningHints = businessOnly ? '현재 수집한 항목은 업체뿐이다. 이 후보들로 일정 생성 요청을 받으면 visits 없는 build로 수집한 업체만 배치한다. 관광지를 강제로 추가하거나 RAG의 다른 장소로 바꾸지 않는다. 부분 수정은 편집 도구를 사용하고 재생성하지 않는다.' : `일정을 만들 때는 context.itineraryCandidates에서 장소를 선택하고 build.visits:[{"day":1,"placeId":"실제ID"}]에 날짜별 순서를 명시한다. 관광지 일정의 visits 없는 build는 거부된다. full-day 장소는 하루에 한 곳만 배치한다. 기존 고정 장소로 빈칸을 자동 채우지 않는다. 자료에 필요한 정보가 없으면 needsMoreContext:true, actions:[]로 반환해 큰 모델에 넘긴다. 근거가 전혀 없으면 일반 조언만 하고 관광지 일정 생성 actions는 빈 배열로 둔다. 여행명·메모·시간·DAY편집·후보그룹·저장본관리 등 이미 알고 있는 여행 편집은 관광지 RAG가 없어도 해당 도구로 처리한다.`;
  const question = {
    recentConversation: request.session.turns
      .slice(-6)
      .filter((t) => t.state.question)
      .map((t) => ({ question: t.state.question, answer: t.assistantMessage })),
    context,
    serverExecutionHints: executionHints + '\n' + planningHints + (registeredFactIds.length ? '\n' + REGISTERED_BUSINESS_FACT_HINT : ''),
    userMessage: request.action.type === 'message' ? request.action.text : '',
  };
  if (usesItineraryPlanner(request)) {
    const scope = itineraryRetrievalScope(request);
    const history = plannerConversation(question.recentConversation);
    const plannerQuestion = {
      recentConversation: history.recentConversation,
      context: {
        state: { ...context.state, plan: context.state.plan.map(({ knowledge: _knowledge, ...visit }: Record<string, unknown>) => visit) },
        itineraryRequest: context.itineraryRequest,
        itineraryPreferences: {
          morningAfternoon: scope.morningAfternoon,
          themes: scope.themes.map(theme => theme.name),
        },
        itineraryCandidates: context.itineraryCandidates,
        ...(context.retrieval ? { retrieval: plannerRetrieval(context.retrieval) } : {}),
        retrievalStatus: context.retrievalStatus,
        retrievalInstruction: context.retrievalInstruction,
        retrievalCoverage: context.retrievalCoverage,
        modelRouting: context.modelRouting,
        ...(context.weather ? { weather: context.weather } : {}),
      },
      userMessage: question.userMessage,
    };
    return { question: plannerQuestion, messages: [{ role: 'system', content: itinerarySystemPrompt + (history.recentConversationFormat ? `\n${history.recentConversationFormat}` : '') }, { role: 'user', content: JSON.stringify(plannerQuestion) }] };
  }
  return {
    question,
    messages: [
      { role: 'system', content: modelSystemPrompt + '\n' + executionHints + '\n' + planningHints + (registeredFactIds.length ? '\n' + REGISTERED_BUSINESS_FACT_HINT : '') },
      { role: 'user', content: JSON.stringify(question) },
    ],
  };
}
