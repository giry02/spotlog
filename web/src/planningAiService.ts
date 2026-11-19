import { withRequestDeadline } from './requestDeadline.ts';
import type { CreationBrief, CreationGroupDraft } from './together/creationPlanner';

type Feature = 'PLACE_SEARCH' | 'GROUP_DRAFT' | 'TRIP_DRAFT';
type PlaceInput = { prompt: string; region: string; eligiblePlaceIds: string[] };
export type GroupAiCopy = Pick<CreationGroupDraft, 'name' | 'introduction' | 'welcome' | 'joinGuide' | 'firstActivityIdea'>;
export type TripAiDraft = { title: string; days: Array<{ day: number; placeIds: string[] }> };
export const PLANNING_AI_CANDIDATE_LIMIT = 60;
const noSignal = new AbortController().signal;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Never send the prompt or session to an arbitrary provider URL. */
export function configuredPlanningAiEndpoint(value: unknown): string {
  const endpoint = typeof value === 'string' ? value.trim() : '';
  return /^\/api\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\/?$/.test(endpoint) && endpoint.length <= 160 ? endpoint : '';
}

function text(value: unknown, limit: number, required = true): string {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new Error('AI 응답이나 입력 내용을 다시 확인해 주세요.');
  return value.trim();
}

function publicIds(ids: readonly string[]): string[] {
  if (!ids.length || ids.length > PLANNING_AI_CANDIDATE_LIMIT) throw new Error('이 조건에서 사용할 등록 장소를 다시 확인해 주세요.');
  const validated = ids.map(id => text(id, 180));
  if (new Set(validated).size !== validated.length) throw new Error('이 조건에서 사용할 등록 장소를 다시 확인해 주세요.');
  return validated;
}

function readIds(value: unknown, allowed: ReadonlySet<string>, max: number): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(id => typeof id !== 'string' || !allowed.has(id)) || new Set(value).size !== value.length) throw new Error('현재 등록된 장소로만 결과를 확인할 수 있어요.');
  return value as string[];
}

async function ask(endpoint: string, feature: Feature, fields: Record<string, unknown>, signal = noSignal): Promise<Record<string, unknown> | null> {
  const path = configuredPlanningAiEndpoint(endpoint);
  if (!path) throw new Error('AI 서버가 연결되어 있지 않아요.');
  const requestId = crypto.randomUUID();
  return withRequestDeadline(async requestSignal => {
    if (requestSignal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: requestSignal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, requestId, feature, ...fields }),
    }).catch(error => {
      if (requestSignal.aborted) throw error;
      throw new Error('AI 서버에 연결하지 못했어요. 입력을 유지했어요.');
    });
    if (response.status === 429) throw new Error('AI가 다른 요청을 처리 중이에요. 잠시 뒤 다시 시도해 주세요.');
    if (response.status === 504) throw new Error('AI 응답이 늦어지고 있어요. 입력을 유지했어요.');
    if (!response.ok) throw new Error('AI 결과를 받지 못했어요. 입력을 유지했어요.');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '') || Number(response.headers.get('Content-Length')) > 48_000) throw new Error('AI 응답 형식을 확인할 수 없어요.');
    const raw = await response.text();
    if (raw.length > 48_000) throw new Error('AI 응답 형식을 확인할 수 없어요.');
    let value: unknown;
    try { value = JSON.parse(raw) as unknown; } catch { throw new Error('AI 응답 형식을 확인할 수 없어요.'); }
    if (!isRecord(value) || value.schemaVersion !== 1 || value.requestId !== requestId || value.feature !== feature || value.source !== 'LLM' || !['READY', 'INSUFFICIENT_DATA'].includes(String(value.status))) throw new Error('지금 요청한 AI 결과를 확인할 수 없어요.');
    if (value.status === 'INSUFFICIENT_DATA') return null;
    if (!isRecord(value.result)) throw new Error('AI 응답 형식을 확인할 수 없어요.');
    return value.result;
  }, signal, 45_000);
}

export async function requestPlaceAi(endpoint: string, input: PlaceInput, signal?: AbortSignal): Promise<{ placeIds: string[] }> {
  const eligiblePlaceIds = publicIds(input.eligiblePlaceIds);
  const result = await ask(endpoint, 'PLACE_SEARCH', { prompt: text(input.prompt, 600), region: text(input.region, 80, false), eligiblePlaceIds }, signal);
  return { placeIds: result ? readIds(result.placeIds, new Set(eligiblePlaceIds), 12) : [] };
}

/** Only editable wording is copied; the model cannot select access, membership or publishing state. */
export async function requestGroupDraftAi(endpoint: string, brief: CreationBrief, signal: AbortSignal): Promise<GroupAiCopy | null> {
  const result = await ask(endpoint, 'GROUP_DRAFT', { prompt: text(brief.prompt, 600), region: text(brief.region, 80), topics: brief.topics?.slice(0, 16) ?? [] }, signal);
  if (!result) return null;
  return { name: text(result.name, 80), introduction: text(result.introduction, 2000),
    ...(result.welcome === undefined ? {} : { welcome: text(result.welcome, 500, false) }),
    ...(result.joinGuide === undefined ? {} : { joinGuide: text(result.joinGuide, 1000, false) }),
    ...(result.firstActivityIdea === undefined ? {} : { firstActivityIdea: text(result.firstActivityIdea, 500, false) }) };
}

export async function requestTripDraftAi(endpoint: string, brief: CreationBrief, dayCount: number, candidateIds: string[], signal: AbortSignal): Promise<TripAiDraft | null> {
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7 || brief.locationUndecided || brief.purpose === 'GROUP') throw new Error('여행 일수와 장소 선택을 확인해 주세요.');
  const eligiblePlaceIds = publicIds(candidateIds), allowed = new Set(eligiblePlaceIds);
  const result = await ask(endpoint, 'TRIP_DRAFT', {
    prompt: text(brief.prompt, 600), region: text(brief.region, 80), dayCount, eligiblePlaceIds,
    conditions: { purpose: brief.purpose, topics: brief.topics?.slice(0, 16) ?? [], people: brief.people,
      transport: brief.transport, budgetPerPerson: brief.budgetPerPerson, walkingLimitMinutes: brief.walkingLimitMinutes,
      notes: text(brief.notes, 1500, false) },
  }, signal);
  if (!result) return null;
  if (!Array.isArray(result.days) || result.days.length !== dayCount) throw new Error('AI 일정의 DAY 수가 요청과 달라요.');
  const days = result.days.map((row: unknown, index: number) => {
    if (!isRecord(row) || row.day !== index + 1) throw new Error('AI 일정의 DAY 순서를 확인할 수 없어요.');
    return { day: index + 1, placeIds: readIds(row.placeIds, allowed, 10) };
  });
  const allIds = days.flatMap(day => day.placeIds);
  if (!allIds.length || allIds.length > 35 || new Set(allIds).size !== allIds.length) throw new Error('AI 일정의 장소 순서를 확인할 수 없어요.');
  return { title: text(result.title, 80), days };
}
