import {
  ChatContractError,
  MAX_MODEL_RESPONSE_BYTES,
  explicitConversationControl,
  namedNearbyFoodAnchor,
  parseModelReply,
  type ChatRequest,
  type ModelReply,
} from './chat-contract';
import { explanation } from './trip-engine';
export { modelContext } from './model-context';
import { buildModelInput, resolveModelEvidenceIds, usesItineraryPlanner } from './model-input';
import { parseProviderReply } from './model-output';

export type FlowiseConfig = {
  baseUrl: string;
  chatflowId: string;
  plannerChatflowId?: string;
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
  const plannerChatflowId = value('FLOWISE_PLANNER_CHATFLOW_ID');
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
  if (plannerChatflowId && !/^[A-Za-z0-9_-]{1,160}$/.test(plannerChatflowId)) invalid();
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
    ...(plannerChatflowId ? { plannerChatflowId } : {}),
    ...(apiKey ? { apiKey } : {}),
    timeoutMs,
  };
}

export async function boundedResponse(
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
    return parseProviderReply(body.json);
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
      return parseProviderReply(JSON.parse(raw));
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
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  evidence?: unknown,
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
  const history = namedNearbyFoodAnchor(request) ? [] : request.session.turns.slice(-12).flatMap((turn) =>
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
      `${config.baseUrl}/api/v1/prediction/${encodeURIComponent(usesItineraryPlanner(request) && config.plannerChatflowId ? config.plannerChatflowId : config.chatflowId)}`,
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
          question: JSON.stringify(buildModelInput(request, evidence).question),
          streaming: false,
          // The demo session ID is client controlled, not an authenticated memory
          // namespace. Use isolated provider memory; bounded history above carries
          // conversation context until a server-owned session store is connected.
          overrideConfig: { sessionId: `moa_${crypto.randomUUID()}` },
          history,
        }),
        signal: controller.signal,
        redirect: 'manual',
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
    return parseModelReply(resolveModelEvidenceIds(predictionReply(body), evidence));
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
