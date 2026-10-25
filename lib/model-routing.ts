import { ChatContractError, type ChatRequest, type ModelReply, type ChatMode } from './chat-contract';
import type { ChatResources } from './chat-resources';
import { predictLargeModel, type LargeModelConfig } from './large-model-adapter';
import { usesKnownTripEditor, usesCollectedBusinessPlanner, usesNamedBusinessCollector } from './model-input';
import { usesLocalFeatureNavigator } from './local-feature-intent';

type Primary = { provider: 'flowise' | 'ollama'; model?: string; predict: (resources: ChatResources, remainingTimeoutMs?: number) => Promise<ModelReply> };
type Options = {
  request: ChatRequest;
  resources: ChatResources;
  primary: Primary;
  large: LargeModelConfig | null;
  /** An independently configured, loopback-only larger model; never a paid API. */
  localFallback?: Extract<LargeModelConfig, { provider: 'ollama' }> | null;
  predictLarge?: typeof predictLargeModel;
  validate: (reply: ModelReply, mode: ChatMode, resources: ChatResources) => void;
  /** Entire model chain stays below the browser's 240-second deadline. */
  timeoutMs?: number;
};

function modelFailure(error: unknown) {
  return error instanceof ChatContractError && /^(?:FLOWISE_|OLLAMA_|MODEL_)/.test(error.code);
}

/** Leave 15 seconds for final source revalidation and 15 more before the client deadline. */
export function remainingModelRoutingBudget(requestStartedAt: number, now = Date.now()) {
  const remaining = 210000 - Math.max(0, now - requestStartedAt);
  if (remaining < 1000)
    throw new ChatContractError('MODEL_ROUTING_TIMEOUT', '모델 응답 시간이 초과됐어요. 현재 화면을 유지했습니다.', 504);
  return remaining;
}

/** Gemini is attempted once before local inference. Every attempt shares one deadline. */
export async function routeModelReply(options: Options) {
  const { request, resources, primary, validate } = options;
  const large = options.large ?? options.localFallback ?? null;
  const startedAt = Date.now();
  const budget = options.timeoutMs ?? 225000;
  if (!Number.isSafeInteger(budget) || budget < 1000 || budget > 225000)
    throw new ChatContractError('MODEL_ROUTING_CONFIG_INVALID', '모델 응답 시간 설정을 확인해 주세요.', 503);
  const remaining = () => {
    const time = budget - (Date.now() - startedAt);
    if (time < 1000) throw new ChatContractError('MODEL_ROUTING_TIMEOUT', '모델 응답 시간이 초과됐어요. 현재 화면을 유지했습니다.', 504);
    return time;
  };
  // These narrow tasks already use canonical state; missing tourism facts alone
  // must not skip the small local fallback after the free Gemini attempt.
  const knownStateTask = usesKnownTripEditor(request) || usesCollectedBusinessPlanner(request) || usesNamedBusinessCollector(request) || usesLocalFeatureNavigator(request);
  const insufficient = resources.coverage?.sufficient === false && !knownStateTask;
  // The adapter still proves free eligibility before generation. Merely selecting
  // Gemini here cannot bypass billing checks, app caps or the quota circuit.
  const preferredGemini = options.large?.provider === 'gemini' ? options.large : null;
  let primaryReply: ModelReply | undefined;
  let primaryError: unknown;
  let lastError: unknown;
  const context = (tier: 'local' | 'large', reason: 'rag-insufficient' | 'primary-failed' | 'primary', status: 'ready' | 'unavailable' | 'not-configured'): ChatResources => ({
    ...resources,
    modelRouting: { tier, reason, status, provider: tier === 'large' ? large!.provider : primary.provider,
      ...((tier === 'large' ? large?.model : primary.model) ? { model: tier === 'large' ? large!.model : primary.model } : {}),
    },
  });
  const primaryResult = async (reason: 'rag-insufficient' | 'primary-failed' | 'primary', status: 'ready' | 'unavailable' | 'not-configured') => {
    const next = context('local', reason, status);
    const reply = primaryReply ?? await primary.predict(next, remaining());
    validate(reply, primary.provider, next);
    return { reply, mode: primary.provider as ChatMode, resources: next };
  };
  const largeResources = (selected: LargeModelConfig, reason: 'rag-insufficient' | 'primary-failed' | 'primary'): ChatResources => ({
    ...context('large', reason, 'ready'),
    modelRouting: { tier: 'large', reason, status: 'ready', provider: selected.provider, model: selected.model },
    retrievalInstruction: resources.retrievalInstruction + '\n' +
      (reason === 'primary' ? '당신은 이번 요청에 우선 호출된 모델이다. ' : '당신은 자료 부족 또는 기본 모델 실패로 호출된 더 큰 모델이다. ') +
      '일반 지식으로 보완하되 검색으로 확인한 사실처럼 말하지 않는다. 관광지 일정 생성은 itineraryCandidates에서 검증한 장소만 build.visits에 넣는다. 관광지 생성 요청에서 후보가 없거나 지역이 지원되지 않으면 그 생성은 실행하지 말고 추가 질문으로 답하며 actions:[]로 둔다. 이미 알려진 여행의 이름·날짜·방문 세부·DAY편집·저장본 관리와 수집한 업체만으로 만드는 일정은 각각 허용된 도구로 처리할 수 있으며 관광지를 강제로 추가하지 않는다. 실시간 영업·예약·날씨·이동시간을 새로 확인했다고 말하지 않는다.',
  });
  const largeResult = async (selected: LargeModelConfig, reason: 'rag-insufficient' | 'primary-failed' | 'primary') => {
    const next = largeResources(selected, reason);
    const timeoutMs = Math.min(selected.timeoutMs, remaining());
    const bounded = timeoutMs === selected.timeoutMs ? selected : { ...selected, timeoutMs };
    const reply = await (options.predictLarge ?? predictLargeModel)(request, bounded, undefined, next);
    validate(reply, 'large-model', next);
    return { reply, mode: 'large-model' as ChatMode, resources: next };
  };
  const largeFailure = (error: unknown) => error instanceof ChatContractError && /^(?:LARGE_MODEL_|MODEL_)/.test(error.code);
  if (preferredGemini) {
    try { return await largeResult(preferredGemini, insufficient ? 'rag-insufficient' : 'primary'); }
    catch (error) {
      if (!largeFailure(error)) throw error;
      lastError = error;
    }
  }
  let reason: 'rag-insufficient' | 'primary-failed' = 'rag-insufficient';
  if (!insufficient) {
    try {
      const status = preferredGemini ? 'unavailable' : 'ready';
      primaryReply = await primary.predict(context('local', 'primary', status), remaining());
      if (!primaryReply.needsMoreContext) return await primaryResult('primary', status);
    } catch (error) {
      if (!modelFailure(error)) throw error;
      primaryError = error;
      reason = 'primary-failed';
    }
  }
  // A failed preferred Gemini is never put back into the escalation queue. With
  // adequate RAG the small local model gets the first fallback; only missing
  // context or a failed local answer requires the larger installed model.
  const escalation = preferredGemini ? options.localFallback ?? null : large;
  if (!escalation) {
    if (primaryError) throw primaryError;
    return primaryResult(reason, preferredGemini ? 'unavailable' : 'not-configured');
  }
  const attempts: LargeModelConfig[] = [escalation];
  if (escalation.provider !== 'ollama' && options.localFallback) attempts.push(options.localFallback);
  for (const selected of attempts) {
    try {
      return await largeResult(selected, reason);
    } catch (error) {
      if (!largeFailure(error)) throw error;
      lastError = error;
    }
  }
  if (primaryError) throw lastError;
  return primaryResult(reason, 'unavailable');
}
