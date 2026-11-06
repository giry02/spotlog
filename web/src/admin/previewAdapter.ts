import type { AdminAdapter, AdminCommand, AdminCommandResult, AdminPageResult, AdminSession, AdminState } from './types.ts';
import { AdminError, executeAdminCommand } from './domain.ts';
import { assertAdminState, listAdminResource, type AdminStorage } from './repository.ts';
import { makeAdminSeed, REVIEW_SESSION } from './seed.ts';

/** Public example screen only. This key never shares the local operating/review stores. */
export const ADMIN_PREVIEW_STORAGE_KEY = 'spotlog.admin.preview.v1';

function previewSessionStorage(): AdminStorage | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage; }
  catch { return null; }
}

/**
 * An isolated example workspace, never a substitute for the service administrator.
 * Only the explicit preview entry imports this adapter. No API, customer projection,
 * review bridge or cross-window event is read or written here.
 */
export function createPreviewAdminAdapter(storage?: AdminStorage | null, assetBase = '/'): AdminAdapter {
  if (!/^\/(?!\/)(?:[A-Za-z0-9._~-]+\/)*$/.test(assetBase) || assetBase.split('/').some(part => part === '.' || part === '..')) {
    throw new AdminError('VALIDATION', '미리보기 파일 경로를 확인해 주세요.');
  }
  let backing = storage === undefined ? previewSessionStorage() : storage;
  let memory: string | null = null;

  const raw = () => {
    if (backing) {
      try { return backing.getItem(ADMIN_PREVIEW_STORAGE_KEY); }
      catch { backing = null; }
    }
    return memory;
  };
  const persist = (state: AdminState) => {
    const serialized = JSON.stringify(state);
    if (backing) {
      try { backing.setItem(ADMIN_PREVIEW_STORAGE_KEY, serialized); }
      catch { backing = null; }
    }
    // If browser storage is blocked, changes survive only in this open workspace.
    memory = serialized;
  };
  const read = (): AdminState => {
    const serialized = raw();
    let state: unknown;
    if (serialized === null) {
      // Only the bundled placeholder is base-relative; licensed photos and credits
      // keep their exact URLs and metadata under project-path static hosting.
      state = JSON.parse(JSON.stringify(makeAdminSeed(), (_key, value: unknown) => value === '/admin-review.svg' ? assetBase + 'admin-review.svg' : value));
    }
    else {
      try { state = JSON.parse(serialized); }
      catch { throw new AdminError('STORAGE', '저장된 미리보기 자료를 읽지 못했어요. 기존 자료를 보존했어요.'); }
    }
    assertAdminState(state);
    if (serialized === null) persist(state);
    else memory = serialized;
    return state;
  };

  return {
    mode: 'LOCAL',
    async session(): Promise<AdminSession> { return { ...REVIEW_SESSION }; },
    async load() { return structuredClone(read()); },
    async query(request) { return listAdminResource(read(), request) as AdminPageResult<never>; },
    async execute(command: AdminCommand, actor: AdminSession): Promise<AdminCommandResult> {
      const current = read();
      if (!current.ops.operators.some(operator => operator.operatorId === actor.operatorId && operator.active)) {
        throw new AdminError('403', '미리보기 작업자를 다시 선택해 주세요.');
      }
      const result = executeAdminCommand(current, command, actor);
      assertAdminState(result.state);
      if (!result.replayed) persist(result.state);
      return result;
    },
  };
}
