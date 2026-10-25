import { env } from 'cloudflare:workers';
import {
  ChatContractError,
  MAX_CHAT_REQUEST_BYTES,
  MAX_SESSION_TURNS,
  applyModelReply,
  chatResponse,
  explicitConversationControl,
  parseChatRequest,
  parseTripSession,
  validateActionContext,
} from '@/lib/chat-contract';
import { appendTrip, currentTrip } from '@/lib/trip-engine';
import { predictFlowise, readFlowiseConfig } from '@/lib/flowise-adapter';
import { predictOllama, readOllamaConfig, readLocalItineraryPlannerConfig } from '@/lib/ollama-adapter';
import { missingRegionPreflight } from '@/lib/chat-preflight';
import { explicitExistingDayView, explicitExistingItineraryCheck, builtItineraryMessage } from '@/lib/chat-result-summary';
import { formatWeatherAnswer, isStandaloneWeatherRequest } from '@/lib/weather-tool';
import { explicitFullDayScheduleNotice } from '@/lib/chat-constraints';
import {
  revalidateRetrieval,
} from '@/lib/rag-adapter';
import { answerContext, gatherChatResources } from '@/lib/chat-resources';
import { readEscalationModelConfigs } from '@/lib/large-model-adapter';
import { routeModelReply, remainingModelRoutingBudget } from '@/lib/model-routing';
import { findFood, findStay } from '@/lib/trip-data';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

async function readBody(request: Request): Promise<unknown> {
  if (
    Number(request.headers.get('content-length') ?? 0) > MAX_CHAT_REQUEST_BYTES
  )
    throw new ChatContractError(
      'REQUEST_TOO_LARGE',
      '대화 기록이 너무 커요. 저장한 여행을 남기고 대화를 초기화해 주세요.',
      413,
    );
  if (!request.body)
    throw new ChatContractError('INVALID_REQUEST', '요청 내용이 비어 있어요.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let raw = '';
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_CHAT_REQUEST_BYTES) {
        await reader.cancel();
        throw new ChatContractError(
          'REQUEST_TOO_LARGE',
          '대화 기록이 너무 커요. 저장한 여행을 남기고 대화를 초기화해 주세요.',
          413,
        );
      }
      raw += decoder.decode(next.value, { stream: true });
    }
    try {
      return JSON.parse(raw + decoder.decode());
    } catch {
      throw new ChatContractError('INVALID_JSON', '요청 형식을 확인해 주세요.');
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  try {
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new ChatContractError(
        'ORIGIN_REJECTED',
        '허용되지 않은 요청이에요.',
        403,
      );
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get('content-type') ?? '',
      )
    )
      throw new ChatContractError(
        'CONTENT_TYPE_INVALID',
        'JSON 형식으로 요청해 주세요.',
        415,
      );
    const body = parseChatRequest(await readBody(request));
    const control =
      body.action.type === 'message'
        ? explicitConversationControl(body.action.text)
        : null;
    if (
      body.session.turns.length >= MAX_SESSION_TURNS &&
      body.action.type !== 'reset' &&
      control?.type !== 'reset'
    )
      throw new ChatContractError(
        'SESSION_LIMIT',
        '대화가 길어졌어요. 저장한 여행은 유지하고 대화를 초기화해 주세요.',
        413,
      );
    if (control) validateActionContext(control, body.session, false);
    const dayView = explicitExistingDayView(body);
    if (dayView) {
      const session = applyModelReply(body, { message: '', actions: [dayView] }, 'local-action', undefined, { retrievalStatus: 'not-needed' });
      return Response.json(chatResponse(body, session, 'local-action'), { headers });
    }
    const itineraryCheck = explicitExistingItineraryCheck(body);
    if (itineraryCheck) {
      const session = applyModelReply(body, {
        message: '일정을 바꾸지 않고 저장된 항목을 점검했어요. 시간 겹침 등 계산된 결과는 아래 점검 카드에서 확인해 주세요. 실제 영업·이동시간은 조회하지 않았어요.',
        actions: [itineraryCheck],
      }, 'local-action', undefined, { retrievalStatus: 'not-needed' });
      return Response.json(chatResponse(body, session, 'local-action'), { headers });
    }
    if (missingRegionPreflight(body)) {
      const session = applyModelReply(body, { message: '어느 지역으로 여행할까요? 여행할 지역을 알려주세요.', actions: [] }, 'clarify');
      return Response.json(chatResponse(body, session, 'clarify'), { headers });
    }
    // Cloudflare bindings and local server environment are never serialized to the browser.
    const serverEnvironment = {
      ...process.env,
      ...(env as Record<string, unknown>),
    };
    const { resources, ragConfig } = body.action.type === 'message' && !control
      ? await gatherChatResources(body, serverEnvironment)
      : { resources: undefined, ragConfig: undefined };
    const retrieval = resources?.retrieval;
    // The tool has already validated the source, time and units. A standalone
    // forecast should not ask a language model to rewrite those measurements.
    if (resources?.weather && isStandaloneWeatherRequest(body)) {
      const session = applyModelReply(body, {
        message: formatWeatherAnswer(resources.weather), actions: [],
      }, 'local-action', undefined, answerContext(resources));
      return Response.json(chatResponse(body, session, 'local-action'), { headers });
    }
    const explicitOllama =
      body.action.type === 'message' && !control
        ? readOllamaConfig(serverEnvironment)
        : null;
    const config =
      body.action.type === 'message' && !control
        ? readFlowiseConfig({
            ...process.env,
            ...(env as Record<string, unknown>),
          })
        : null;
    const ollama = explicitOllama ?? (body.action.type === 'message' && !control
      ? readLocalItineraryPlannerConfig(body, serverEnvironment, config)
      : null);
    if ((ollama || config) && resources) {
      const primary = ollama
        ? { provider: 'ollama' as const, model: ollama.model, predict: (context: typeof resources, remaining = ollama.timeoutMs) => predictOllama(body, { ...ollama, timeoutMs: Math.min(ollama.timeoutMs, remaining) }, undefined, context) }
        : { provider: 'flowise' as const, model: typeof serverEnvironment.OLLAMA_MODEL === 'string' && serverEnvironment.OLLAMA_MODEL ? serverEnvironment.OLLAMA_MODEL : 'qwen3:8b', predict: (context: typeof resources, remaining = config!.timeoutMs) => predictFlowise(body, { ...config!, timeoutMs: Math.min(config!.timeoutMs, remaining) }, undefined, context) };
      const routed = await routeModelReply({
        request: body, resources, primary,
        timeoutMs: remainingModelRoutingBudget(requestStartedAt),
        ...readEscalationModelConfigs(serverEnvironment),
        validate(reply, mode, context) {
          if (mode === 'demo') throw new ChatContractError('MODEL_OUTPUT_INVALID', '모델 연결을 확인해 주세요.', 502);
          const collected=currentTrip(body.session).collectedIds??[];
          const collectedBusinessesOnly=collected.length>0&&collected.every(id=>Boolean(findFood(id)||findStay(id)));
          if (reply.actions.some(action => action.type === 'build') && !retrieval?.results.length && !collectedBusinessesOnly)
            throw new ChatContractError('MODEL_ITINERARY_UNGROUNDED', '일정에 사용할 검색 근거를 찾지 못했어요. 조건을 더 알려주세요.', 502);
          applyModelReply(body, reply, mode, retrieval, answerContext(context));
        },
      });
      if (retrieval && ragConfig)
        await revalidateRetrieval(retrieval, routed.reply, ragConfig);
      if (routed.mode === 'demo') throw new ChatContractError('MODEL_OUTPUT_INVALID', '모델 연결을 확인해 주세요.', 502);
      let session = applyModelReply(body, routed.reply, routed.mode, retrieval, answerContext(routed.resources));
      // A combined itinerary/forecast still uses the model's grounded place
      // selection. Present the weather from the validated tool, independently
      // of any numerical or unit mistakes in the generated completion text.
      if (resources.weather && routed.reply.actions.some(action => action.type === 'build')) {
        const latest = session.turns.at(-1)!;
        const state = currentTrip(session);
        const caption = builtItineraryMessage(state, '');
        const fullDayNotice = explicitFullDayScheduleNotice(body, state);
        session = { ...session, turns: [...session.turns.slice(0, -1), {
          ...latest, assistantMessage: [caption, fullDayNotice, formatWeatherAnswer(resources.weather)].filter(Boolean).join('\n\n'),
        }] };
        parseTripSession(session);
      }
      return Response.json(
        chatResponse(
          body,
          session,
          routed.mode,
        ),
        { headers },
      );
    }
    const session = appendTrip(body.session, control ?? body.action);
    parseTripSession(session);
    return Response.json(chatResponse(body, session, 'demo'), { headers });
  } catch (error) {
    const known =
      error instanceof ChatContractError
        ? error
        : new ChatContractError(
            'CHAT_UNAVAILABLE',
            '대화를 처리하지 못했어요. 현재 화면에서 다시 시도해 주세요.',
            500,
          );
    return Response.json(
      {
        protocolVersion: 1,
        error: { code: known.code, message: known.message },
      },
      { status: known.status, headers },
    );
  }
}
