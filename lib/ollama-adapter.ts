import {
  ChatContractError,
  MAX_MODEL_RESPONSE_BYTES,
  parseModelReply,
  explicitConversationControl,
  type ChatRequest,
  type ModelReply,
} from './chat-contract';
import { boundedResponse, type FlowiseConfig, type ServerEnvironment } from './flowise-adapter';
import { buildModelInput, resolveModelEvidenceIds, usesItineraryPlanner } from './model-input';
import { parseProviderReply } from './model-output';
import { isLocalOllamaModelName, verifyLocalOllamaWeights } from './local-model-policy';
export { compactModelContext } from './model-input';

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export function readOllamaConfig(env: ServerEnvironment): OllamaConfig | null {
  if (env.CHAT_PROVIDER !== 'ollama') return null;
  try {
    const url = new URL(
      String(env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'),
    );
    const model = String(env.OLLAMA_MODEL ?? '');
    const timeoutMs = Number(env.OLLAMA_TIMEOUT_MS ?? 45000);
    // Initial unauthenticated development provider is loopback only.
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !isLocalOllamaModelName(model) ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 45000
    )
      throw new Error();
    return { baseUrl: url.origin, model, timeoutMs };
  } catch {
    throw new ChatContractError(
      'OLLAMA_CONFIG_INVALID',
      '로컬 모델 연결 설정을 확인해 주세요.',
      503,
    );
  }
}

/** An explicit local planner opt-in never changes ordinary or remote Flowise chat. */
export function readLocalItineraryPlannerConfig(
  request: ChatRequest,
  environment: ServerEnvironment,
  flowise: FlowiseConfig | null,
): OllamaConfig | null {
  const model = typeof environment.LOCAL_ITINERARY_MODEL === 'string'
    ? environment.LOCAL_ITINERARY_MODEL.trim() : '';
  if (!model || environment.CHAT_PROVIDER !== 'flowise' || !usesItineraryPlanner(request) ||
      !flowise?.plannerChatflowId || !/^[A-Za-z0-9_-]{1,160}$/.test(flowise.plannerChatflowId) ||
      environment.FLOWISE_PLANNER_CHATFLOW_ID !== flowise.plannerChatflowId) return null;
  const explicitLoopback = (value: unknown) => {
    if (typeof value !== 'string' ||
        !/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(value.trim())) return false;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
        !url.username && !url.password && !url.search && !url.hash;
    } catch { return false; }
  };
  if (!explicitLoopback(environment.FLOWISE_BASE_URL) || !explicitLoopback(flowise.baseUrl) ||
      !explicitLoopback(environment.OLLAMA_BASE_URL)) return null;
  try {
    const config = readOllamaConfig({ ...environment, CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: model });
    const timeoutMs = environment.LOCAL_ITINERARY_TIMEOUT_MS === undefined
      ? 75_000 : Number(environment.LOCAL_ITINERARY_TIMEOUT_MS);
    if (!config || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 90_000) return null;
    return { ...config, timeoutMs };
  } catch (error) {
    if (error instanceof ChatContractError && error.code === 'OLLAMA_CONFIG_INVALID') return null;
    throw error;
  }
}

export async function predictOllama(
  request: ChatRequest,
  config: OllamaConfig,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  evidence?: unknown,
): Promise<ModelReply> {
  if (
    request.action.type !== 'message' ||
    explicitConversationControl(request.action.text)
  )
    throw new ChatContractError(
      'OLLAMA_ACTION_INVALID',
      '질문만 모델로 전달할 수 있어요.',
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const input = buildModelInput(request, evidence);
  try {
    await verifyLocalOllamaWeights(config, fetcher, controller.signal);
    const response = await fetcher(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think: false,
        format: 'json',
        options: { temperature: 0, num_ctx: 12288, num_predict: 1200 },
        messages: input.messages,
      }),
    });
    if (!response.ok)
      throw new ChatContractError(
        'OLLAMA_UPSTREAM_ERROR',
        '로컬 모델 응답을 받지 못했어요.',
        502,
      );
    let body;
    try {
      body = JSON.parse(
        await boundedResponse(response, MAX_MODEL_RESPONSE_BYTES),
      );
    } catch (error) {
      if (error instanceof ChatContractError) throw error;
      throw new ChatContractError(
        'MODEL_OUTPUT_INVALID',
        '로컬 모델 응답 형식을 확인해 주세요.',
        502,
      );
    }
    if (body?.done !== true || typeof body.message?.content !== 'string')
      throw new ChatContractError(
        'MODEL_OUTPUT_INVALID',
        '모델 응답이 완성되지 않아 화면을 유지했어요.',
        502,
      );
    let reply;
    try {
      reply = JSON.parse(body.message.content);
    } catch {
      throw new ChatContractError(
        'MODEL_OUTPUT_INVALID',
        '모델의 기능 응답 형식을 확인해 주세요.',
        502,
      );
    }
    return parseModelReply(resolveModelEvidenceIds(parseProviderReply(reply), evidence));
  } catch (error) {
    if (error instanceof ChatContractError) throw error;
    throw new ChatContractError(
      controller.signal.aborted ? 'OLLAMA_TIMEOUT' : 'OLLAMA_UNAVAILABLE',
      '로컬 모델 요청을 처리하지 못했어요. 현재 화면에서 다시 시도해 주세요.',
      controller.signal.aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}
