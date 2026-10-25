import {
  ChatContractError,
  MAX_MODEL_RESPONSE_BYTES,
  explicitConversationControl,
  namedBusinessCollectionCandidates,
  namedItineraryAdditionScope,
  namedNearbyFoodAnchor,
  namedVisitRemovalScope,
  parseModelReply,
  type ChatRequest,
  type ModelReply,
} from './chat-contract';
import { buildModelInput, resolveModelEvidenceIds, usesKnownTripEditor, usesCollectedBusinessPlanner, usesNamedBusinessCollector } from './model-input';
import { parseProviderReply } from './model-output';
import { currentTrip } from './trip-engine';
import type { ChatResources } from './chat-resources';
import type { RagRetrieval } from './rag-types';
import { geminiGenerationConfig, isGeminiTextModel } from './gemini-models';
import { readGeminiFreePolicy, reserveGeminiFreeCall, type GeminiFreePolicy } from './gemini-free-policy';
import { isLocalOllamaModelName, verifyLocalOllamaWeights } from './local-model-policy';
import { itineraryRequest } from './itinerary-retrieval';
import { REGIONS, getRegisteredEntity } from './trip-data';
import { localFeatureTask, usesLocalFeatureNavigator, mediaActionMatchesRequest, publicCourseCopyTarget } from './local-feature-intent';
import { mediaModelCandidates } from './discovery-media';
import { socialActionMatchesRequest } from './social-intent';

type CommonLargeModelConfig = {
  model: string;
  timeoutMs: number;
};
export type LargeModelConfig = CommonLargeModelConfig & (
  { provider: 'gemini'; apiKey: string; freePolicy?: GeminiFreePolicy } |
  { provider: 'openai-compatible'; baseUrl: string; apiKey: string } |
  { provider: 'ollama'; baseUrl: string }
);

const invalidConfiguration = (): never => {
  throw new ChatContractError(
    'LARGE_MODEL_CONFIG_INVALID',
    '대형 모델의 서버 연결 설정을 확인해 주세요.',
    503,
  );
};

function compatibleBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { return invalidConfiguration(); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    !host.includes('.') || host.includes(':') ||
    /(?:^|\.)(?:localhost|local|internal|lan|home|localdomain)$/.test(host) ||
    !/^[a-z0-9.-]+$/.test(host)
  ) return invalidConfiguration();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b, c] = host.split('.').map(Number);
    if (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    ) return invalidConfiguration();
  }
  return url.toString().replace(/\/$/, '');
}

function localBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value || 'http://127.0.0.1:11434'); } catch { return invalidConfiguration(); }
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) return invalidConfiguration();
  return url.origin;
}

function parameterBillions(model: string): number | undefined {
  const match = model.match(/(?:^|[:/_-])(\d+(?:\.\d+)?)b(?:$|[:/_-])/i);
  return match ? Number(match[1]) : undefined;
}

/** Credentials and model selection are server owned; a client cannot set an endpoint. */
export function readLargeModelConfig(
  environment: Record<string, unknown>,
): LargeModelConfig | null {
  const value = (name: string) =>
    typeof environment[name] === 'string' ? (environment[name] as string).trim() : '';
  const provider = value('LARGE_MODEL_PROVIDER');
  if (!provider || provider === 'disabled') return null;
  if (!['gemini', 'openai-compatible', 'ollama'].includes(provider)) return invalidConfiguration();
  const model = value('LARGE_MODEL_NAME');
  const timeoutValue = value('LARGE_MODEL_TIMEOUT_MS');
  const timeoutMs = timeoutValue ? Number(timeoutValue) : provider === 'ollama' ? 180_000 : 60_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > (provider === 'ollama' ? 180_000 : 90_000)) return invalidConfiguration();
  if (provider === 'ollama') {
    const size = parameterBillions(model);
    const primarySize = parameterBillions(value('OLLAMA_MODEL')) ?? 8;
    if (!isLocalOllamaModelName(model) || size === undefined || size <= primarySize || size <= 8) return invalidConfiguration();
    return { provider, baseUrl: localBaseUrl(value('LARGE_MODEL_BASE_URL')), model, timeoutMs };
  }
  const apiKey = value('LARGE_MODEL_API_KEY') || (provider === 'gemini' ? value('GEMINI_API_KEY') || value('GOOGLE_API_KEY') : value('OPENAI_API_KEY'));
  if (
    (provider === 'gemini'
      ? !isGeminiTextModel(model)
      : !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(model)) ||
    apiKey.length < 16 || apiKey.length > 512 || /[\r\n\x00-\x1f\x7f]/.test(apiKey)
  ) return invalidConfiguration();
  return provider === 'gemini'
    ? { provider, model, apiKey, timeoutMs, freePolicy: readGeminiFreePolicy(environment) }
    : { provider: 'openai-compatible', baseUrl: compatibleBaseUrl(value('LARGE_MODEL_BASE_URL')), model, apiKey, timeoutMs };
}

/** Kept independent of the Gemini settings so loss of remote quota cannot remove local fallback. */
export function readLocalLargeModelConfig(environment: Record<string, unknown>): Extract<LargeModelConfig, { provider: 'ollama' }> {
  const config = readLargeModelConfig({
    LARGE_MODEL_PROVIDER: 'ollama',
    LARGE_MODEL_NAME: environment.LOCAL_LARGE_MODEL_NAME || 'qwen3:14b',
    LARGE_MODEL_BASE_URL: environment.LOCAL_LARGE_MODEL_BASE_URL || 'http://127.0.0.1:11434',
    LARGE_MODEL_TIMEOUT_MS: environment.LOCAL_LARGE_MODEL_TIMEOUT_MS || '180000',
    OLLAMA_MODEL: environment.OLLAMA_MODEL,
  });
  if (!config || config.provider !== 'ollama') return invalidConfiguration();
  return config;
}

export function readEscalationModelConfigs(environment: Record<string, unknown>) {
  const localFallback = readLocalLargeModelConfig(environment);
  try { return { large: readLargeModelConfig(environment), localFallback }; }
  catch (error) {
    // A removed/revoked remote key or invalid free-policy setting must not remove
    // the installed local model. Unexpected implementation failures still surface.
    if (['gemini', 'openai-compatible'].includes(String(environment.LARGE_MODEL_PROVIDER)) && error instanceof ChatContractError && /^LARGE_MODEL_/.test(error.code))
      return { large: localFallback, localFallback };
    throw error;
  }
}

async function readResponse(response: Response): Promise<string> {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > MAX_MODEL_RESPONSE_BYTES)
    throw new ChatContractError('LARGE_MODEL_RESPONSE_TOO_LARGE', '대형 모델 응답이 너무 커서 화면을 유지했어요.', 502);
  if (!response.body)
    throw new ChatContractError('LARGE_MODEL_RESPONSE_INVALID', '대형 모델의 답변이 비어 있어요.', 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_MODEL_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ChatContractError('LARGE_MODEL_RESPONSE_TOO_LARGE', '대형 모델 응답이 너무 커서 화면을 유지했어요.', 502);
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function responseReply(value: unknown, provider: LargeModelConfig['provider']): ModelReply {
  const invalid = (): never => {
    throw new ChatContractError('LARGE_MODEL_RESPONSE_INVALID', '대형 모델의 응답 형식을 확인해 주세요.', 502);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  if (provider === 'ollama') {
    const body = value as Record<string, unknown>;
    const message = body.message as { content?: unknown; tool_calls?: unknown[] } | undefined;
    if (body.done !== true || (body.done_reason !== undefined && body.done_reason !== 'stop') || typeof message?.content !== 'string' || message.tool_calls?.length) return invalid();
    let reply: unknown;
    try { reply = JSON.parse(message.content); } catch { return invalid(); }
    return parseProviderReply(reply);
  }
  if (provider === 'openai-compatible') {
    const choices = (value as Record<string, unknown>).choices;
    if (!Array.isArray(choices) || choices.length !== 1) return invalid();
    const choice = choices[0];
    if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || choice.message.refusal || choice.message.tool_calls?.length || choice.message.function_call) return invalid();
    let body: unknown;
    try { body = JSON.parse(choice.message.content); } catch { return invalid(); }
    return parseProviderReply(body);
  }
  const candidates = (value as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length !== 1) return invalid();
  const candidate = candidates[0];
  if (!candidate || candidate.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) return invalid();
  const finalParts = candidate.content.parts.filter((part: { thought?: boolean }) => !part.thought);
  if (!finalParts.length || finalParts.some((part: { text?: unknown }) => typeof part.text !== 'string')) return invalid();
  const text = finalParts.map((part: { text: string }) => part.text).join('').trim();
  if (!text) return invalid();
  let body: unknown;
  try { body = JSON.parse(text); } catch { return invalid(); }
  return parseProviderReply(body);
}

type KnownStateScope = 'nearby-anchor' | 'named-addition' | 'known-edit' | 'business-plan' | 'saved-trip' | 'named-collector' | 'local-feature';

/** A local feature can navigate its own verified UI, not acquire tourism edit
 * authority merely because its request does not need RAG. Execution still runs
 * the normal atomic context/ID/negative-intent validators after this boundary.
 */
function localFeatureActionAllowed(action: ModelReply['actions'][number], request: ChatRequest): boolean {
  const task = localFeatureTask(request);
  if (!task || request.action.type !== 'message') return false;
  const text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  if (task === 'social') return action.type === 'social' && socialActionMatchesRequest(action, currentTrip(request.session), request.action.text);
  if (task === 'reorder') return action.type === 'show' && action.stage === 'plan' || action.type === 'reorder-visits';
  if (task === 'media') return action.type === 'media' && mediaActionMatchesRequest(action, request.action.text) ||
    action.type === 'detail' && Boolean(action.id) && mediaModelCandidates().some(candidate => candidate.id === action.id);
  if (task === 'community') return action.type === 'community-filter' ||
    action.type === 'show' && action.stage === 'community' ||
    action.type === 'copy-community' && action.id === publicCourseCopyTarget(request);
  if (task === 'app') {
    if (action.type !== 'open_spotlog' || action.journeyId !== undefined) return false;
    // Navigation creates only a destination card. The host still asks the user
    // to select and confirm the actual app record; never substitute a chatbot ID.
    const requested: {target:string;entry:string}[] = [];
    if (/여행기.*미리보기|미리보기.*여행기/.test(text)) requested.push({target:'journal',entry:'journal-preview'});
    if (/여행기.*공개(?:범위|설정)|공개범위/.test(text)) requested.push({target:'journal',entry:'journal-visibility'});
    const draftNavigationForbidden = /초안(?:화면)?(?:은|는|을|를|으로|로)?(?:아직|절대)?(?:(?:열|불러오|불러|이어가|이어|복구|실행)(?:어주|어|하|해주|해)?지(?:마|말|않)|안(?:열|불러|이어|복구|실행))/.test(text);
    if (!draftNavigationForbidden && /여행기.{0,12}초안|초안.*(?:이어|복구)|(?:이어|복구).*초안|여행기.*이어/.test(text)) requested.push({target:'journal',entry:'journal-draft'});
    if (/사진.*(?:첨부|업로드|올리|넣|추가)/.test(text)) requested.push({target:'journal',entry:'journal-photos'});
    if (/(?:여행기|여행기록).*(?:작성|쓰기|편집)|글.*(?:쓰|작성)/.test(text)) requested.push({target:'journal',entry:'journal-text'});
    if (/좋아요|장소반응/.test(text)) requested.push({target:'community',entry:'place-reaction'});
    if (/여행기(?:전체)?댓글|전체댓글/.test(text)) requested.push({target:'community',entry:'journey-comment'});
    else if (/댓글|답글|스레드/.test(text)) requested.push({target:'community',entry:'place-comment'});
    if (/응원/.test(text)) requested.push({target:'community',entry:'journey-cheer'});
    if (/내활동|기기활동|활동통계|프로필활동/.test(text)) requested.push({target:'profile',entry:'profile-activity'});
    else if (/내프로필|내등급|프로필(?:화면|요약|등급)/.test(text)) requested.push({target:'profile',entry:'profile-summary'});
    if (/개인장소|직접장소등록|장소.*직접.*등록/.test(text)) requested.push({target:'trips',entry:'personal-place'});
    if (/비밀번호.*(?:재설정|찾|잊)|암호.*(?:재설정|찾)/.test(text)) requested.push({target:'account',entry:'account-reset'});
    if (/로그아웃/.test(text)) requested.push({target:'account',entry:'account-logout'});
    if (/탈퇴|계정삭제/.test(text)) requested.push({target:'account',entry:'account-delete'});
    if (/이메일.*(?:로그인|인증)/.test(text)) requested.push({target:'account',entry:'account-email'});
    if (!requested.some(item => item.target === action.target && item.entry === action.entry)) return false;
    if (action.placeId !== undefined) {
      const state = currentTrip(request.session);
      const knownIds = [...(state.collectedIds ?? []), ...state.plan.map(visit => visit.entityId), state.anchorId, state.foodId, state.cafeId, state.stayId];
      if (!knownIds.includes(action.placeId)) return false;
    }
    if (action.day !== undefined) {
      const stated = text.match(/(?:DAY|데이)(\d{1,2})|(\d{1,2})일차/i)?.slice(1).find(Boolean);
      if (!stated || action.day !== Number(stated)) return false;
    }
    return true;
  }
  const offline = /오프라인|사본/.test(text);
  const completion = /작성완료|완료(?:로|상태)|초안(?:으로|상태)|일정완료|최종확정/.test(text);
  const saved = /찜/.test(text);
  if (action.type === 'plan-status') return completion && (action.status === 'READY'
    ? /작성완료|일정완료|최종확정|완료해/.test(text) : /초안|작성중|완료.*(?:취소|되돌)/.test(text));
  if (action.type === 'offline-save') return offline && /저장|보관|갱신/.test(text);
  if (action.type === 'offline-remove') return offline && /삭제|지워|제거/.test(text);
  if (action.type === 'offline-library') return offline && /목록|보여|조회|확인|보기|열어/.test(text);
  if (action.type === 'offline-open') return offline && /열어|읽어|불러|보기|보여/.test(text) && !/목록/.test(text);
  if (action.type === 'continue-trip') return /최근|마지막/.test(text) && /이어|계속|열어|불러/.test(text);
  if (action.type === 'saved-filter') return saved;
  if (action.type === 'save') return /저장해|저장할|저장하고|보관해/.test(text) &&
    (!offline || /(?:여행|일정)(?:을|은)?저장(?:해|하고|할)/.test(text));
  if (action.type === 'show') return saved && action.stage === 'saved' || completion && action.stage === 'plan';
  return false;
}

function knownSavedTripRequest(request: ChatRequest) {
  if (request.action.type !== 'message' || itineraryRequest(request).requested) return false;
  const text = request.action.text;
  if (/방법|어떻게|무슨\s*뜻|설명|하지\s*마|하지\s*말|하지\s*않|지우지|옮기지|되살리지|되돌리지/.test(text)) return false;
  const state = currentTrip(request.session);
  return state.plan.length > 0 && /(?:일정|여행).{0,15}(?:저장해|저장할|보관해)|^\s*저장해(?:줘|주세요)?[.!?\s]*$/.test(text) ||
    request.session.library.length > 0 && /저장(?:한|된)?\s*(?:내\s*)?(?:여행|일정)|휴지통/.test(text) && /열어|불러|보여|목록|삭제|지워|옮겨|복원|되살려|되돌려/.test(text);
}

function knownStateActionAllowed(action: ModelReply['actions'][number], scope: KnownStateScope, request: ChatRequest) {
  if (scope === 'local-feature') return localFeatureActionAllowed(action, request);
  if (scope === 'nearby-anchor') {
    const anchor = namedNearbyFoodAnchor(request);
    return Boolean(anchor) && (action.type === 'place' && action.id === anchor?.id || action.type === 'show' &&
      (action.stage === 'plan' || action.stage === 'food' && (action.kind === undefined || action.kind === '식당')));
  }
  if (scope === 'named-addition') {
    const addition = namedItineraryAdditionScope(request);
    return action.type === 'add-entity' && Boolean(addition?.candidate.eligible) && action.id === addition?.candidate.id && action.day === addition?.day;
  }
  if (scope === 'named-collector') {
    const state = currentTrip(request.session);
    const regions = request.action.type === 'message' ? REGIONS.filter(region => request.action.type === 'message' && request.action.text.includes(region)) : [];
    const region = state.region ?? (regions.length === 1 ? regions[0] : null);
    if (action.type === 'region') return state.region === null && regions.length === 1 && action.region === region;
    return action.type === 'collect-entity' && Boolean(getRegisteredEntity(action.id)) &&
      namedBusinessCollectionCandidates(request, { ...state, region }).some(candidate => candidate.id === action.id && candidate.registered && candidate.eligible);
  }
  if (scope === 'business-plan') return action.type === 'build' && action.visits === undefined ||
    action.type === 'configure' && Object.keys(action).every(key => ['type', 'days', 'meals', 'cafes', 'lodging'].includes(key));
  if (scope === 'known-edit' && action.type === 'remove') {
    const removal = namedVisitRemovalScope(request);
    return removal?.targets.length === 1 && !removal.targets[0].locked && action.id === removal.targets[0].id;
  }
  if (scope === 'known-edit') return ['trip-meta', 'visit-details', 'stay-placement', 'day-add', 'day-copy', 'day-delete', 'visit-copy'].includes(action.type);
  return ['save', 'open', 'library', 'trash-list', 'trash', 'restore'].includes(action.type) ||
    action.type === 'show' && ['library', 'trash', 'saved', 'plan'].includes(action.stage);
}

function largeModelInput(request: ChatRequest, evidence?: unknown) {
  const object = evidence && typeof evidence === 'object' ? evidence : undefined;
  const resources = object && 'retrievalStatus' in object ? object as ChatResources : undefined;
  const retrieval = resources?.retrieval ?? (object && 'results' in object ? object as RagRetrieval : undefined);
  // Fresh tourism cards still require current retrieval. Editing a known trip
  // or arranging explicitly collected businesses uses existing canonical state.
  const missingGrounding = !retrieval?.results.length || resources?.coverage?.reason === 'outside-corpus';
  const knownStateScope: KnownStateScope | undefined = usesLocalFeatureNavigator(request) ? 'local-feature' : namedNearbyFoodAnchor(request) ? 'nearby-anchor' : namedItineraryAdditionScope(request) ? 'named-addition' : missingGrounding
    ? usesKnownTripEditor(request) ? 'known-edit' : usesCollectedBusinessPlanner(request) ? 'business-plan' : usesNamedBusinessCollector(request) ? 'named-collector' : knownSavedTripRequest(request) ? 'saved-trip' : undefined
    : undefined;
  const readOnly = missingGrounding && !knownStateScope;
  if (!readOnly) {
    const input = buildModelInput(request, evidence);
    const role = resources?.modelRouting?.reason === 'primary'
      ? '당신은 이번 요청에 우선 호출된 모델이다.'
      : '당신은 자료가 부족한 요청을 처리하는 대형 모델이다.';
    return { readOnly, knownStateScope, messages: [
      { role: 'system', content: input.messages[0].content + '\n' + role + ' 제공된 검색 자료와 검증된 후보 ID를 우선 사용한다. 검색 도구를 호출한 적이 없으므로 웹에서 확인했다고 말하지 않는다. 검색 근거 없이 답하는 부분은 일반 지식에 따른 제안임을 밝힌다. 실시간 가격·영업·날씨·운항과 등록되지 않은 장소 ID 또는 출처를 만들어내지 않는다.' + (knownStateScope === 'local-feature' ? '\n이번 요청은 검수된 로컬 기능의 탐색 또는 명시한 작성 상태·기기 사본 작업이다. requestedFeature에 해당하는 필요한 도구만 사용한다. 관광지 생성·수집·일정 재생성·원본 편집·무관한 앱 화면 열기와 evidenceIds 생성은 금지한다.' : knownStateScope === 'nearby-anchor' ? '\n이번 요청은 현재 일정의 명시한 장소에서 식당 후보를 조회하는 작업이다. context.nearbyAnchorRequest의 ID를 place로 선택하고 show food kind식당으로 목록을 연다. 편집 대기 중이면 먼저 show plan으로 해제한다. 기존 일정·저장본·모드·예산을 유지하며 새 업체·장소를 추가하거나 교체하지 않는다.' : knownStateScope === 'named-addition' ? '\n이번 요청은 context.candidate에 있는 단일 기존 항목을 context.requestedDay에 추가하는 작업이다. eligible:true일 때 해당 ID와 DAY의 add-entity 하나만 허용하며, 기존 방문과 출처를 변경하거나 후보 외 항목·실시간 사실·evidenceIds를 만들지 않는다. eligible:false이면 actions:[]로 현재 조건을 설명한다.' : knownStateScope ? '\n이번 요청은 현재 여행의 알려진 상태를 편집하거나 수집한 업체만 배치하는 요청이다. 해당 전용 도구만 사용한다. 새 관광지 추가·교체·생성, 지역 변경이나 검색 근거 없는 출처 생성은 금지한다.' : '') },
      input.messages[1],
    ] };
  }
  const state = currentTrip(request.session);
  return {
    readOnly,
    messages: [
      { role: 'system', content: '한국어 여행 도우미다. 이번 요청에 쓸 검증된 장소 검색 자료가 없다. 원래 질문과 최근 대화를 바탕으로 일반 지식에 따른 제안임을 짧게 밝히고 직접 답한다. 일정 요청에는 일자별 자연어 초안을 제안할 수 있다. 최대 400자로 핵심만 쓴다. 웹 검색·RAG로 확인했다고 주장하거나 출처·URL·실시간 영업·가격·예약·이동시간을 만들어내지 않는다. 관광지의 건축 양식·역사·접근성 등 확신하지 못하는 세부 특징을 추측하지 말고 확인이 필요하다고 말한다. 날씨는 context.weather에 제공된 도구 결과만 사용한다. 최근 대화는 이미 처리된 기록이므로 과거 요청을 다시 실행하지 않는다. 일정 카드 수정은 금지한다. 반드시 JSON 객체 {"message":"한국어 답변","actions":[]} 하나만 출력한다. actions는 항상 빈 배열이어야 한다. evidenceIds와 다른 최상위 키는 출력하지 않는다.' },
      { role: 'user', content: JSON.stringify({
        recentConversation: request.session.turns.filter(turn => turn.state.question).slice(-6).map(turn => ({ question: turn.state.question, answer: turn.assistantMessage })),
        context: {
          state: { region: state.region, days: state.days },
          retrievalStatus: resources?.retrievalStatus ?? 'empty',
          retrievalInstruction: resources?.retrievalInstruction ?? '사용할 수 있는 장소 검색 근거가 없다. 일반 지식으로만 답하고 일정 카드는 수정하지 않는다.',
          ...(resources?.modelRouting ? { modelRouting: resources.modelRouting } : {}),
          ...(resources?.weather ? { weather: resources.weather } : {}),
        },
        userMessage: request.action.type === 'message' ? request.action.text : '',
      }) },
    ],
  };
}

/** Shared action/evidence contract with free-only remote eligibility and bounded output. */
export async function predictLargeModel(
  request: ChatRequest,
  config: LargeModelConfig,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  evidence?: unknown,
): Promise<ModelReply> {
  if (request.action.type !== 'message' || explicitConversationControl(request.action.text))
    throw new ChatContractError('LARGE_MODEL_ACTION_INVALID', '이 요청은 대형 모델 예측을 거치지 않아요.', 400);
  // Revalidate caller-supplied configuration before interpolating a model into the fixed path.
  const validated = readLargeModelConfig({
    LARGE_MODEL_PROVIDER: config.provider,
    LARGE_MODEL_NAME: config.model,
    ...('apiKey' in config ? { LARGE_MODEL_API_KEY: config.apiKey } : {}),
    LARGE_MODEL_TIMEOUT_MS: String(config.timeoutMs),
    ...('baseUrl' in config ? { LARGE_MODEL_BASE_URL: config.baseUrl } : {}),
    ...(config.provider === 'gemini' && config.freePolicy ? {
      GEMINI_BILLING_VERIFICATION_TOKEN: config.freePolicy.verificationAccessToken,
      GEMINI_BILLING_VERIFICATION_PROJECT: config.freePolicy.verificationProject,
      ...(config.freePolicy.verificationCredentials ? { GEMINI_BILLING_VERIFICATION_CREDENTIALS: JSON.stringify(config.freePolicy.verificationCredentials) } : {}),
      GEMINI_FREE_MAX_REQUESTS_PER_MINUTE: String(config.freePolicy.maxRequestsPerMinute),
      GEMINI_FREE_MAX_REQUESTS_PER_DAY: String(config.freePolicy.maxRequestsPerDay),
    } : {}),
  });
  if (!validated) return invalidConfiguration();
  const { messages, readOnly, knownStateScope } = largeModelInput(request, evidence);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let freePermit: Awaited<ReturnType<typeof reserveGeminiFreeCall>> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ChatContractError('LARGE_MODEL_TIMEOUT', '대형 모델 응답 시간이 초과됐어요. 현재 화면을 유지했습니다.', 504));
    }, config.timeoutMs);
  });
  const predict = async () => {
    // All remote generation is free-only. A provider key or a local budget cannot
    // override this check, and compatible paid APIs have no approved free proof.
    if (validated.provider === 'openai-compatible')
      throw new ChatContractError('LARGE_MODEL_FREE_TIER_UNVERIFIED', '무료 사용이 확인되지 않은 외부 API 대신 로컬 모델을 사용합니다.', 503);
    if (validated.provider === 'gemini') {
      freePermit = await reserveGeminiFreeCall(validated.apiKey, validated.model, validated.freePolicy, fetcher);
      if (controller.signal.aborted) { freePermit.release(); return Promise.reject(new ChatContractError('LARGE_MODEL_TIMEOUT', '대형 모델 응답 시간이 초과됐어요.', 504)); }
    }
    if (validated.provider === 'ollama') {
      try { await verifyLocalOllamaWeights(validated, fetcher, controller.signal, 8); }
      catch (error) {
        if (error instanceof ChatContractError)
          throw new ChatContractError('LARGE_MODEL_LOCAL_UNVERIFIED', '설치된 대형 로컬 모델을 확인하지 못했어요. 클라우드 모델은 사용하지 않습니다.', 503);
        throw error;
      }
    }
    const response = await fetcher(
      validated.provider === 'gemini'
        ? `https://generativelanguage.googleapis.com/v1beta/models/${validated.model}:generateContent`
        : `${validated.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(validated.provider === 'gemini' ? { 'x-goog-api-key': validated.apiKey } : {}) },
        body: JSON.stringify(validated.provider === 'gemini' ? {
          systemInstruction: { parts: [{ text: messages[0].content }] },
          contents: [{ role: 'user', parts: [{ text: messages[1].content }] }],
          generationConfig: geminiGenerationConfig(validated.model),
        } : {
          model: validated.model, messages, stream: false, think: false, format: 'json', keep_alive: 0,
          options: { temperature: 0, num_ctx: 12288, num_predict: 900, repeat_penalty: 1.1 },
        }),
        signal: controller.signal,
        redirect: 'manual',
      },
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new ChatContractError('LARGE_MODEL_AUTH_REJECTED', '대형 모델의 인증이 거부됐어요. 서버의 API 키 설정을 확인해 주세요.', 503);
      if (response.status === 429) {
        freePermit?.quotaExceeded(response.headers.get('retry-after'));
        throw new ChatContractError('LARGE_MODEL_QUOTA_EXCEEDED', '대형 모델의 사용 한도에 도달했어요. 현재 화면을 유지했습니다.', 503);
      }
      throw new ChatContractError('LARGE_MODEL_UPSTREAM_ERROR', '대형 모델에서 답변을 받지 못했어요. 현재 화면을 유지했습니다.', 502);
    }
    let body: unknown;
    try { body = JSON.parse(await readResponse(response)); } catch (error) {
      if (error instanceof ChatContractError) throw error;
      throw new ChatContractError('LARGE_MODEL_RESPONSE_INVALID', '대형 모델의 응답 형식을 확인해 주세요.', 502);
    }
    const reply = parseModelReply(resolveModelEvidenceIds(responseReply(body, validated.provider), evidence));
    if (readOnly && (reply.actions.length || reply.evidenceIds?.length))
      throw new ChatContractError('LARGE_MODEL_READONLY_VIOLATION', '검색 근거가 없는 답변에서 화면 변경이나 출처 생성을 시도해 현재 화면을 유지했어요.', 502);
    const addition = knownStateScope === 'named-addition' ? namedItineraryAdditionScope(request) : undefined;
    if (addition && reply.actions.length && (reply.actions.length !== 1 || reply.actions[0].type !== 'add-entity' ||
        reply.actions[0].id !== addition.candidate.id || reply.actions[0].day !== addition.day || !addition.candidate.eligible))
      throw new ChatContractError('LARGE_MODEL_READONLY_VIOLATION', '명시한 한 항목과 DAY에 추가하는 행동만 허용해요.', 502);
    const publicCopyTarget = knownStateScope === 'local-feature' && localFeatureTask(request) === 'community' ? publicCourseCopyTarget(request) : undefined;
    if (publicCopyTarget && (reply.actions.length !== 1 || reply.actions[0].type !== 'copy-community' || reply.actions[0].id !== publicCopyTarget))
      throw new ChatContractError('LARGE_MODEL_READONLY_VIOLATION', '명시한 공개 코스 하나를 개인 초안으로 복사하는 행동만 허용해요.', 502);
    if (knownStateScope && (reply.actions.some(action => !knownStateActionAllowed(action, knownStateScope, request)) || (knownStateScope === 'local-feature' || knownStateScope === 'named-addition' || !((evidence as ChatResources | undefined)?.retrieval?.results.length ?? (evidence as RagRetrieval | undefined)?.results?.length)) && reply.evidenceIds?.length))
      throw new ChatContractError('LARGE_MODEL_READONLY_VIOLATION', '현재 여행의 편집 범위를 벗어난 장소 변경이나 출처 생성을 시도해 화면을 유지했어요.', 502);
    return reply;
  };
  try {
    return await Promise.race([predict(), deadline]);
  } catch (error) {
    const timedOut = controller.signal.aborted;
    controller.abort();
    if (error instanceof ChatContractError) throw error;
    if (timedOut)
      throw new ChatContractError('LARGE_MODEL_TIMEOUT', '대형 모델 응답 시간이 초과됐어요. 현재 화면을 유지했습니다.', 504);
    throw new ChatContractError('LARGE_MODEL_UNAVAILABLE', '대형 모델에 연결하지 못했어요. 현재 화면을 유지했습니다.', 502);
  } finally {
    if (timer) clearTimeout(timer);
    freePermit?.release();
  }
}
