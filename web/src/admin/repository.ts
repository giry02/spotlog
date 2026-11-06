import type { AdminAdapter, AdminCommand, AdminCommandResult, AdminPageResult, AdminQuery, AdminSession, AdminState } from './types';
import { executeAdminCommand, AdminError, checkContent } from './domain.ts';
import { matchesAdminDto } from './contractGuard.ts';
import { migrateAdminMasters } from './migration.ts';
import { matchesPlaceFilters } from './selectors.ts';
import { pullReviewAdminProjection, syncReviewPublicProjection } from '../reviewServiceBridge.ts';
const REVIEW_SESSION: AdminSession = { operatorId: 'operator-admin', name: '내부 관리자', role: 'ADMIN' };

export const ADMIN_STORAGE_KEY = 'spotlog.admin.review.v1';
export interface AdminStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
function privateJournalHasContent(journal: AdminState['ops']['journals'][number]): boolean {
  return journal.ownerVisibility !== 'PUBLIC' && !!(journal.original || journal.english || journal.summary || journal.cards.length || journal.days?.length || journal.cover || journal.tags?.length);
}
export function assertAdminState(value: unknown): asserts value is AdminState {
  const state = value as Partial<AdminState> | null;
  if (!state || !matchesAdminDto('AdminState', state) || !Number.isInteger(state.revision) || state.revision! < 1) throw new AdminError('INVALID_RESPONSE', '관리자 자료 형식이 맞지 않아요. 원본을 덮어쓰지 않고 중단했어요.');
  for (const place of state.places!) {
    if (!Number.isInteger(place.revision) || place.revision < 1) throw new AdminError('INVALID_RESPONSE', '장소 버전을 확인해 주세요.');
    checkContent(place.draft); if (place.published) checkContent(place.published);
  }
  if (state.metrics && (!Object.values(state.metrics).filter(value => typeof value === 'number').every(value => Number.isInteger(value) && value >= 0) || state.metrics.observedAt !== null && !Number.isFinite(Date.parse(state.metrics.observedAt)))) throw new AdminError('INVALID_RESPONSE','서버 집계 값과 기준 시각을 확인해 주세요.');
  if (state.ops!.journals.some(privateJournalHasContent) || state.ops!.comments.some(c => state.ops!.journals.some(j => j.journalId === c.journalId && j.ownerVisibility !== 'PUBLIC') && (c.original || c.english))) throw new AdminError('PRIVATE_DATA', '기본 관리자 조회에 비공개 원문이 포함됐어요. 서버 응답을 수정한 뒤 다시 연결해 주세요.');
}
const RESOURCE_NAMES = new Set(['places','audit','ai.indices','ai.jobs','ai.policies','ai.fixtures','ai.results','ai.requests','ai.feedback','ops.exposures','ops.curatedTrips','ops.journals','ops.comments','ops.reports','ops.members','ops.inquiries','ops.operators','ops.references','ops.templates','ops.notifications','ops.connections','ops.supplyJobs','ops.trash','ops.mediaCleanup']);
const RESOURCE_DTOS: Record<string,string> = { places:'AdminPlace',audit:'AuditEvent','ai.indices':'AiIndexVersion','ai.jobs':'AiIndexJob','ai.policies':'AiPolicy','ai.fixtures':'AiTestFixture','ai.results':'AiTestResult','ai.requests':'AiRequestSummary','ai.feedback':'AiFeedback','ops.exposures':'ExposureEntry','ops.curatedTrips':'CuratedTrip','ops.journals':'PublicJournal','ops.comments':'PublicComment','ops.reports':'OpsReport','ops.members':'OpsMember','ops.inquiries':'OpsInquiry','ops.operators':'OpsOperator','ops.references':'OpsReference','ops.templates':'OpsNotificationTemplate','ops.notifications':'OpsNotification','ops.connections':'OpsConnection','ops.supplyJobs':'OpsSupplyJob','ops.trash':'OpsTrash','ops.mediaCleanup':'OpsMediaCleanup' };
RESOURCE_NAMES.add('regions');
RESOURCE_DTOS.regions = 'AdminRegion';
export function assertAdminPage(request: AdminQuery, result: AdminPageResult) {
  assertQuery(request);
  if (!matchesAdminDto('AdminPageResult',result) || !Number.isInteger(result.total) || result.total < 0 || result.page !== (request.page ?? 1) || result.pageSize !== (request.pageSize ?? 20) || !Number.isInteger(result.revision) || result.revision < 1 || result.items.length > result.pageSize || !result.items.every(item => matchesAdminDto(RESOURCE_DTOS[request.resource],item))) throw new AdminError('INVALID_RESPONSE','관리자 목록 응답 형식을 확인해 주세요.');
  if (request.resource === 'ops.journals' && result.items.some(item => privateJournalHasContent(item as AdminState['ops']['journals'][number]))) throw new AdminError('PRIVATE_DATA','비공개 원문이 목록에 포함됐어요. 서버 응답을 확인해 주세요.');
}
function assertQuery(request: AdminQuery) {
  if (!RESOURCE_NAMES.has(request.resource) || !Number.isInteger(request.page ?? 1) || (request.page ?? 1) < 1 || !Number.isInteger(request.pageSize ?? 20) || (request.pageSize ?? 20) < 1 || (request.pageSize ?? 20) > 100) throw new AdminError('VALIDATION', '관리자 목록과 페이지 범위를 확인해 주세요.');
}
export function listAdminResource(state: AdminState, request: AdminQuery): AdminPageResult {
  assertQuery(request);
  const resources: Record<string, unknown[]> = { places: state.places, regions: state.regions ?? [], audit: state.audit };
  const [namespace, key] = request.resource.split('.');
  if (namespace === 'ops' || namespace === 'ai') {
    const namespaceValue = state[namespace] as unknown as Record<string, unknown>;
    if (Array.isArray(namespaceValue[key])) resources[request.resource] = namespaceValue[key] as unknown[];
  }
  if (!resources[request.resource]) throw new AdminError('VALIDATION', '지원하지 않는 목록이에요.');
  const text = request.query?.trim().toLocaleLowerCase() ?? '';
  const items = resources[request.resource].filter(item => {
    const record = item as Record<string, unknown>, content = record.draft as Record<string, unknown> | undefined;
    if (text && !JSON.stringify(item).toLocaleLowerCase().includes(text)) return false;
    if (request.resource === 'places') return matchesPlaceFilters(item as AdminState['places'][number], state, request.filters);
    return Object.entries(request.filters ?? {}).every(([key, value]) => !value || String(content?.[key] ?? record[key] ?? '') === value);
  });
  const page = Math.max(1, request.page ?? 1), pageSize = Math.min(100, Math.max(1, request.pageSize ?? 20));
  return { items: structuredClone(items.slice((page - 1) * pageSize, page * pageSize)), total: items.length, page, pageSize, revision: state.revision };
}
export function createLocalAdminAdapter(storage: AdminStorage, seed: () => AdminState): AdminAdapter {
  const persist = (state: AdminState) => {
    try { storage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state)); }
    catch { throw new AdminError('STORAGE', '관리자 검수 자료를 저장하지 못했어요. 입력을 유지했으니 저장 공간을 확인해 주세요.'); }
  };
  const read = () => {
    let raw: string | null;
    try { raw = storage.getItem(ADMIN_STORAGE_KEY); } catch { throw new AdminError('STORAGE', '이 브라우저에서 관리자 검수 자료를 읽을 수 없어요.'); }
    const baseline = seed();
    let value: unknown;
    try { value = raw === null ? baseline : JSON.parse(raw); } catch { throw new AdminError('STORAGE', '저장된 관리자 검수 자료를 읽지 못했어요. 기존 자료를 보존했어요.'); }
    assertAdminState(value);
    const migrated = migrateAdminMasters(value, baseline);
    const incoming = pullReviewAdminProjection(storage);
    incoming.publicJournals.push(...baseline.ops.journals.filter(journal => journal.sourceKind === 'PUBLIC_SAMPLE'));
    incoming.comments.push(...baseline.ops.comments.filter(comment => comment.sourceKind === 'PUBLIC_SAMPLE'));
    let received = false;
    const mergeNew = <T,>(target: T[], records: T[], id: (item: T) => string) => {
      const ids = new Set(target.map(id));
      for (const item of records) if (!ids.has(id(item))) { target.push(structuredClone(item)); ids.add(id(item)); received = true; }
    };
    // An incoming receipt cannot undo an existing moderator decision or owner visibility.
    mergeNew(migrated.ops.reports, incoming.reports, item => item.reportId);
    mergeNew(migrated.ops.journals, incoming.publicJournals, item => item.journalId);
    mergeNew(migrated.ops.comments, incoming.comments, item => item.commentId);
    mergeNew(migrated.ops.curatedTrips, baseline.ops.curatedTrips.filter(trip => trip.sourceKind === 'PUBLIC_SAMPLE'), item => item.curatedTripId);
    for (const projection of incoming.publicJournals) {
      const journal = migrated.ops.journals.find(item => item.journalId === projection.journalId);
      if (!journal || journal.ownerVisibility !== 'PUBLIC' || journal.moderation !== 'VISIBLE' || projection.revision <= journal.revision) continue;
      // Customer reactions can update public sample aggregates, never moderator
      // decisions, original writing, translations or owner visibility.
      let changed = false;
      if (projection.reactionBreakdown?.source === 'SAMPLE' && JSON.stringify(projection.reactionBreakdown) !== JSON.stringify(journal.reactionBreakdown)) {
        journal.reactionBreakdown = structuredClone(projection.reactionBreakdown);
        if (projection.metrics?.source === 'SAMPLE') journal.metrics = structuredClone(projection.metrics);
        changed = true;
      }
      for (const projectedCard of projection.cards) {
        const card = journal.cards.find(item => item.cardId === projectedCard.cardId);
        if (card && projectedCard.likeUsers !== undefined && JSON.stringify(projectedCard.likeUsers) !== JSON.stringify(card.likeUsers)) {
          card.likeUsers = structuredClone(projectedCard.likeUsers); card.likes = projectedCard.likes; changed = true;
        }
      }
      if (changed) { journal.revision = Math.max(journal.revision + 1, projection.revision); received = true; }
    }
    for (const journal of incoming.publicJournals) if (journal.authorName && !migrated.ops.members.some(member => member.memberId === journal.authorId)) {
      migrated.ops.members.push({ memberId: journal.authorId, revision: 1, name: journal.authorName, publicIntroduction: '', icon: '👤', avatarUrl: journal.authorAvatar, grade: null, sourceKind: 'PUBLIC_SAMPLE', state: 'ACTIVE', warnings: [], publicActivity: { journals: null, followers: null, copies: null, views: null, source: 'SAMPLE' }, notificationOptOut: false });
      received = true;
    }
    if (received) migrated.revision++;
    assertAdminState(migrated);
    if (raw === null || JSON.stringify(migrated) !== raw) persist(migrated);
    syncReviewPublicProjection(migrated, storage);
    return migrated;
  };
  return { mode: 'LOCAL', async session() { return REVIEW_SESSION; }, async load() { return structuredClone(read()); }, async query(request) { return listAdminResource(read(), request) as AdminPageResult<never>; },
    async execute(command, session) {
      const result = executeAdminCommand(read(), command, session);
      if (!result.replayed) persist(result.state);
      try { syncReviewPublicProjection(result.state, storage); }
      catch { result.message += ' · 관리자 저장 완료, 고객 검수 화면 동기화 실패. 새로 조회하여 재시도해 주세요.'; }
      return result;
    } };
}

async function adminFetch<T>(path: string, init?: RequestInit, onAccessDenied?: () => void): Promise<T> {
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/admin/v1' + path, { ...init, credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...init?.headers } });
    if (response.status === 401 || response.status === 403) {
      onAccessDenied?.();
      throw new AdminError(String(response.status), response.status === 401 ? '관리자 인증이 만료됐어요. 다시 연결해 주세요. 입력은 유지했어요.' : '관리자 접근 권한을 확인해 주세요. 입력은 유지했어요.');
    }
    const text = await response.text();
    if (!response.ok) {
      let body: unknown = null;
      try { body = text ? JSON.parse(text) : null; } catch { /* Hosts and proxies can return HTML for an HTTP failure. */ }
      const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
      const fallback = response.status === 404 ? '관리자 서버 연결 주소를 찾지 못했어요. 서버 주소와 연결 설정을 확인해 주세요.' : response.status >= 500 ? '관리자 서버가 일시적으로 응답하지 못하고 있어요. 잠시 후 다시 시도해 주세요. 입력은 유지했어요.' : response.status === 409 ? '자료가 변경됐어요. 새 자료를 확인해 주세요.' : '관리자 요청을 처리하지 못했어요. 연결 상태와 입력을 확인해 주세요.';
      throw new AdminError(typeof error?.code === 'string' && error.code.trim() ? error.code : String(response.status), typeof error?.message === 'string' && error.message.trim() ? error.message : fallback);
    }
    try { return (text ? JSON.parse(text) : null) as T; } catch { throw new AdminError('INVALID_RESPONSE', '관리자 자료를 읽지 못했어요. 서버 연결 주소와 응답을 확인해 주세요. 입력은 유지했어요.'); }
  } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw new AdminError('TIMEOUT', '관리자 서버 응답이 지연돼요. 입력을 유지했어요.'); if (error instanceof TypeError) throw new AdminError('NETWORK', '관리자 서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요. 입력은 유지했어요.'); throw error; }
  finally { window.clearTimeout(timer); }
}
export function createApiAdminAdapter(onAccessDenied?: () => void): AdminAdapter {
  return { mode: 'API', async session() { const value = await adminFetch<AdminSession>('/me', undefined, onAccessDenied); if (!matchesAdminDto('AdminSession',value) || !value.operatorId || !value.name) { onAccessDenied?.(); throw new AdminError('403', '관리자 세션 응답을 확인해 주세요.'); } return value; },
    async load() { const value = await adminFetch<AdminState>('/snapshot', undefined, onAccessDenied); assertAdminState(value); return value; },
    async query(query) { assertQuery(query); const params = new URLSearchParams({ page: String(query.page ?? 1), pageSize: String(query.pageSize ?? 20), query: query.query ?? '' }); for (const [key, value] of Object.entries(query.filters ?? {})) params.set('filter.' + key, value); const result = await adminFetch<AdminPageResult<never>>('/resources/' + encodeURIComponent(query.resource) + '?' + params, undefined, onAccessDenied); assertAdminPage(query,result); return result; },
    async execute(command: AdminCommand, _session: AdminSession) { if (!matchesAdminDto('AdminCommand',command)) throw new AdminError('VALIDATION','관리자 요청 형식을 확인해 주세요.'); const result = await adminFetch<AdminCommandResult>('/commands', { method: 'POST', body: JSON.stringify(command) }, onAccessDenied); if (!matchesAdminDto('AdminCommandResult',result)) throw new AdminError('INVALID_RESPONSE','관리자 처리 결과 형식을 확인해 주세요.'); assertAdminState(result.state); return result; } };
}
