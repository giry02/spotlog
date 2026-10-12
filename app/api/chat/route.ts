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
import { appendTrip } from '@/lib/trip-engine';
import { predictFlowise, readFlowiseConfig } from '@/lib/flowise-adapter';

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
    // Cloudflare bindings and local server environment are never serialized to the browser.
    const config =
      body.action.type === 'message' && !control
        ? readFlowiseConfig({
            ...process.env,
            ...(env as Record<string, unknown>),
          })
        : null;
    if (config) {
      const reply = await predictFlowise(body, config);
      return Response.json(
        chatResponse(body, applyModelReply(body, reply), 'flowise'),
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
