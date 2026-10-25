import { ChatContractError, type ChatRequest } from './chat-contract';
import type { ServerEnvironment } from './flowise-adapter';
import type { RagRetrieval, AnswerContext } from './rag-types';
import { readRagConfig, retrieveForChat, validateRetrievedEvidence, type RagConfig } from './rag-adapter';
import { weatherContextForChat, type WeatherContext } from './weather-tool';
import { places } from './trip-data';
import { jejuKnowledgeDocuments } from './jeju-knowledge';
import { namedKnowledgePlaceIds } from './rag-catalog';
import { assessRetrievalCoverage, itineraryRequest, type RetrievalCoverage } from './itinerary-retrieval';
import { usesLocalFeatureNavigator } from './local-feature-intent';

export type ChatResources = {
  retrieval?: RagRetrieval;
  retrievalStatus: 'available' | 'empty' | 'unavailable' | 'not-needed' | 'disabled';
  retrievalInstruction: string;
  weather?: WeatherContext;
  coverage?: RetrievalCoverage;
  modelRouting?: AnswerContext['modelRouting'];
};

export function answerContext(resources?: ChatResources): AnswerContext | undefined {
  if (!resources) return;
  const weather = resources.weather;
  return {
    retrievalStatus: resources.retrievalStatus,
    ...(resources.modelRouting ? { modelRouting: resources.modelRouting } : {}),
    ...(weather ? { weather: { status: weather.status, retrievedAt: weather.retrievedAt,
      ...(weather.location ? { location: weather.location.name } : {}),
      ...(weather.dates ? { dates: weather.dates } : {}),
    } } : {}),
  };
}

export function needsTravelRetrieval(request: ChatRequest) {
  if (request.action.type !== 'message') return false;
  if (usesLocalFeatureNavigator(request)) return false;
  const text = request.action.text;
  if (/^(?:안녕(?:하세요)?|반가워|고마워|감사(?:해|합니다)|ㅎ+|하이|hello|hi)[.!~\s]*$/i.test(text.trim())) return false;
  return /제주|서울|여행|관광|장소|일정|여기|거기|그곳|해변|바다|숲|오름|폭포|근거|추천|카페|숙소|맛집|코스|박\s*\d*\s*일|찜|담아|예약|입장|운영|휴무|통제|주차|교통|비오는|비가\s*오|아이|유모차|휠체어/.test(text) ||
    places.some((p) => text.includes(p.name.replace(/\s/g, '')) || text.includes(p.name)) ||
    jejuKnowledgeDocuments.some((doc) => text.includes(doc.title.split(/\s*[|·:—–]\s*/)[0].trim())) ||
    // Exact registered business names also need their checked basic-fact source,
    // even when a short question contains no generic travel keyword.
    namedKnowledgePlaceIds(text).length > 0;
}

// Retrieval augments a real model call. Availability errors must not turn every
// ordinary conversation into a failed search. Invalid/revoked evidence is never
// passed on; evidence already used by a model is still revalidated before commit.
export async function gatherChatResources(
  request: ChatRequest,
  environment: ServerEnvironment,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Promise<{ resources: ChatResources; ragConfig?: RagConfig }> {
  const weather = await weatherContextForChat(request, fetcher);
  const base: ChatResources = {
    retrievalStatus: 'not-needed',
    retrievalInstruction: '이 요청은 장소 자료 검색 없이 일반 지식으로 답할 수 있다. 조회하지 않은 출처나 현재 사실을 확인했다고 말하지 않는다.',
    ...(weather ? { weather } : {}),
  };
  // A forecast alone needs no place evidence. A user can request both a new
  // itinerary and a forecast, in which case each independent source is needed.
  if ((weather && !itineraryRequest(request).requested) || !needsTravelRetrieval(request)) return { resources: base };
  let config: RagConfig | null;
  try {
    config = readRagConfig(environment);
    if (!config) return { resources: { ...base, coverage: assessRetrievalCoverage(request, undefined, 'disabled'), retrievalStatus: 'disabled', retrievalInstruction: '장소 검색이 설정되지 않았다. 확인되지 않은 장소 운영·가격·실시간 정보는 단정하지 않는다. 새로운 관광지 일정 생성에는 검색 근거가 필요하다. 이미 존재하는 여행의 이름·날짜·방문 시간·메모·DAY 편집, 명시해 담은 업체만으로 구성하는 일정, 앱 화면 연결은 현재 상태와 허용 도구로 처리할 수 있다.' } };
    const retrieval = await retrieveForChat(request, config, fetcher);
    await validateRetrievedEvidence(retrieval, config, fetcher);
    return {
      ragConfig: config,
      resources: { ...base, retrieval, coverage: assessRetrievalCoverage(request, retrieval), retrievalStatus: retrieval.results.length ? 'available' : 'empty', retrievalInstruction: '공식 요약과 체험 설명을 구분한다. 일반 지식으로 보완한 내용은 검색으로 확인한 사실처럼 쓰지 않는다. 새 관광지 일정 생성은 itineraryCandidates 중 실제 검색된 장소를 골라 build.visits로 날짜와 순서를 정한다. 검색 자료에 없는 관광지를 자동으로 채우지 않는다. 이미 존재하는 여행의 메타정보·방문 시간·메모·DAY 편집과 명시해 담은 업체만의 일정, 앱 화면 연결에는 해당 기능의 현재 상태를 사용한다. 새 사실·장소를 확인할 근거가 부족할 때에만 needsMoreContext:true와 actions:[]로 반환한다.' },
    };
  } catch (error) {
    if (!(error instanceof ChatContractError) || error.code === 'RAG_QUERY_TOO_LONG') throw error;
    return { resources: { ...base, coverage: assessRetrievalCoverage(request, undefined, 'unavailable'), retrievalStatus: 'unavailable', retrievalInstruction: '장소 자료 검색을 사용할 수 없다. 검색 자료로 현재 운영·가격·통제·예약을 확인했다고 말하지 않는다. 날씨는 별도의 context.weather 도구 결과만 사용한다. evidenceIds와 검색 근거 없는 새 관광지 일정은 반환하지 않는다. 기존 여행 이름·날짜·방문 시간·메모·DAY 수정, 명시해 담은 업체만의 일정, 앱 화면 연결은 허용 도구와 현재 상태로 처리한다.' } };
  }
}
