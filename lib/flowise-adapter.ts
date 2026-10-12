import {
  ChatContractError,
  MAX_MODEL_RESPONSE_BYTES,
  explicitConversationControl,
  parseModelReply,
  type ChatRequest,
  type ModelReply,
} from './chat-contract';
import {
  currentTrip,
  communityResults,
  explanation,
  foodResults,
  placeResults,
  stayResults,
} from './trip-engine';
import { places, restaurants, stays } from './trip-data';

export type FlowiseConfig = {
  baseUrl: string;
  chatflowId: string;
  apiKey?: string;
  timeoutMs: number;
};
export type ServerEnvironment = Record<string, unknown>;

export function readFlowiseConfig(
  environment: ServerEnvironment,
): FlowiseConfig | null {
  const value = (name: string) =>
    typeof environment[name] === 'string'
      ? (environment[name] as string).trim()
      : '';
  const base = value('FLOWISE_BASE_URL');
  const chatflowId = value('FLOWISE_CHATFLOW_ID');
  const apiKey = value('FLOWISE_API_KEY');
  if (!base && !chatflowId && !apiKey) return null;
  const invalid = () => {
    throw new ChatContractError(
      'FLOWISE_CONFIG_INVALID',
      '서버의 챗봇 연결 설정을 확인해 주세요.',
      503,
    );
  };
  if (!base || !chatflowId || !/^[A-Za-z0-9_-]{1,160}$/.test(chatflowId))
    invalid();
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return invalid();
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    invalid();
  const timeoutValue = value('FLOWISE_TIMEOUT_MS');
  const timeoutMs = timeoutValue ? Number(timeoutValue) : 20_000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 45_000
  )
    invalid();
  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    chatflowId,
    ...(apiKey ? { apiKey } : {}),
    timeoutMs,
  };
}

/** A server-owned snapshot of canonical IDs and fields; no client-supplied endpoint is forwarded. */
export function modelContext(request: ChatRequest) {
  const s = currentTrip(request.session);
  return {
    dataMode: 'authored-demo-data',
    warning:
      '식당·카페·숙소는 가상 업체/예시 가격. 공개 코스와 작성자 프로필도 데모 예시이며 실제 회원 게시물 아님. 실제 영업·좌표·예약·결제 정보 없음.',
    state: {
      stage: s.stage,
      region: s.region,
      days: s.days,
      activeDay: s.activeDay,
      theme: s.theme,
      similarTo: s.similarTo,
      anchorId: s.anchorId,
      foodId: s.foodId,
      cafeId: s.cafeId,
      stayId: s.stayId,
      foodKind: s.foodKind,
      cuisine: s.cuisine,
      walk: s.walk,
      foodBudget: s.foodBudget,
      stayBudget: s.stayBudget,
      booked: s.booked,
      meals: s.meals,
      cafes: s.cafes,
      lodging: s.lodging,
      editingId: s.editingId,
      savedIds: s.savedIds,
      collectedIds: s.collectedIds ?? [],
      plan: s.plan,
      comparisonIds: s.comparisonIds ?? [],
      detailId: s.detailId ?? null,
      communitySourceId: s.communitySourceId ?? null,
      communityRegion: s.communityRegion ?? null,
      communityTheme: s.communityTheme ?? 'all',
    },
    candidates: {
      places: placeResults(s),
      food: foodResults(s),
      stays: s.booked ? [] : stayResults(s),
    },
    // This bounded authored catalog enables selecting new search parameters before
    // selecting a candidate in the same batch; execution still checks live filters.
    catalog: { places, food: restaurants, stays },
    // Course IDs use a separate namespace from place/business IDs.
    // Only the filtered visible courses may be copied, with their source preserved.
    publicCourses: {
      sourceKind: 'demo',
      notice:
        '공개 여행 화면을 위한 데모 작성자·코스 예시. 실제 Spotlog 회원 기록을 조회한 결과가 아님.',
      candidates: communityResults(s),
    },
    savedTrips: request.session.library,
    allowedToolTypes: [
      'configure',
      'region',
      'show',
      'place',
      'food',
      'stay',
      'select-entity',
      'collect-entity',
      'uncollect-entity',
      'bookmark',
      'walk',
      'cuisine',
      'stay-budget',
      'compare',
      'detail',
      'budget',
      'check',
      'build',
      'day',
      'add-selected',
      'add-entity',
      'edit',
      'remove',
      'move',
      'transfer',
      'directions',
      'progress',
      'save',
      'open',
      'library',
      'history',
      'help',
      'copy-community',
      'community-filter',
    ],
    conversationControls:
      'reset/undo/resume는 명시적 사용자 문구를 서버에서 별도 처리하므로 모델 actions에 넣지 말 것.',
  };
}

async function boundedResponse(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maxBytes)
    throw new ChatContractError(
      'FLOWISE_RESPONSE_TOO_LARGE',
      '챗봇 응답이 너무 커서 화면을 유지했어요.',
      502,
    );
  if (!response.body)
    throw new ChatContractError(
      'FLOWISE_RESPONSE_INVALID',
      '챗봇의 응답이 비어 있어요.',
      502,
    );
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ChatContractError(
          'FLOWISE_RESPONSE_TOO_LARGE',
          '챗봇 응답이 너무 커서 화면을 유지했어요.',
          502,
        );
      }
      text += decoder.decode(result.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function predictionReply(value: unknown): ModelReply {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ChatContractError(
      'FLOWISE_RESPONSE_INVALID',
      '챗봇 응답 형식을 확인해 주세요.',
      502,
    );
  const body = value as Record<string, unknown>;
  if (body.json !== undefined && body.json !== null)
    return parseModelReply(body.json);
  if (typeof body.text !== 'string' || !body.text.trim())
    throw new ChatContractError(
      'FLOWISE_RESPONSE_INVALID',
      '챗봇의 답변이 비어 있어요.',
      502,
    );
  const text = body.text.trim();
  // JSON-shaped but malformed outputs are never treated as a successful text answer.
  if (text.startsWith('{') || text.startsWith('[') || text.startsWith('```')) {
    const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      return parseModelReply(JSON.parse(raw));
    } catch {
      throw new ChatContractError(
        'MODEL_OUTPUT_INVALID',
        '챗봇의 기능 응답 형식이 올바르지 않아 화면을 유지했어요.',
        502,
      );
    }
  }
  return parseModelReply({ message: text, actions: [] });
}

export async function predictFlowise(
  request: ChatRequest,
  config: FlowiseConfig,
  fetcher: typeof fetch = fetch,
): Promise<ModelReply> {
  if (
    request.action.type !== 'message' ||
    explicitConversationControl(request.action.text)
  ) {
    throw new ChatContractError(
      'FLOWISE_ACTION_INVALID',
      '이 요청은 챗봇 예측을 거치지 않아요.',
      400,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const history = request.session.turns.slice(-12).flatMap((turn) =>
    turn.state.question
      ? [
          { role: 'userMessage', content: turn.state.question },
          {
            role: 'apiMessage',
            content: turn.assistantMessage ?? explanation(turn.state),
          },
        ]
      : [],
  );
  try {
    const response = await fetcher(
      `${config.baseUrl}/api/v1/prediction/${encodeURIComponent(config.chatflowId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        // Keep context in question so no generic node-config override must be enabled.
        body: JSON.stringify({
          question: JSON.stringify({
            userMessage: request.action.text,
            context: modelContext(request),
          }),
          streaming: false,
          overrideConfig: { sessionId: request.sessionId },
          history,
        }),
        signal: controller.signal,
        redirect: 'error',
      },
    );
    if (!response.ok)
      throw new ChatContractError(
        'FLOWISE_UPSTREAM_ERROR',
        '연결된 챗봇에서 답변을 받지 못했어요. 현재 화면을 유지했습니다.',
        502,
      );
    let body: unknown;
    try {
      body = JSON.parse(
        await boundedResponse(response, MAX_MODEL_RESPONSE_BYTES),
      );
    } catch (error) {
      if (error instanceof ChatContractError) throw error;
      throw new ChatContractError(
        'FLOWISE_RESPONSE_INVALID',
        '연결된 챗봇의 응답 형식을 확인해 주세요.',
        502,
      );
    }
    return predictionReply(body);
  } catch (error) {
    if (error instanceof ChatContractError) throw error;
    if (controller.signal.aborted)
      throw new ChatContractError(
        'FLOWISE_TIMEOUT',
        '챗봇 응답 시간이 초과됐어요. 현재 화면에서 다시 시도해 주세요.',
        504,
      );
    throw new ChatContractError(
      'FLOWISE_UNAVAILABLE',
      '챗봇에 연결하지 못했어요. 현재 화면을 유지했습니다.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}
