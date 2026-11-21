import type { CreationBrief, CreationGroupDraft, CreationPlan } from './creationPlanner.ts';

/** Editable values only. Save confirmations, model requests and pending operations are never retained. */
export interface CreationLocalDraft {
  phase: 'INPUT' | 'DRAFT';
  prompt: string;
  brief: CreationBrief;
  plan: CreationPlan | null;
  groupDraft?: CreationGroupDraft;
}
export interface CreationDraftMemoryRecord {
  draft: CreationLocalDraft;
  requestId: string;
  target: 'PERSONAL' | 'TOGETHER';
}
const validActor = (actor: string) => typeof actor === 'string' && actor.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(actor);
const validScope = (scope: string) => typeof scope === 'string' && Boolean(scope.trim()) && scope.length <= 1000 && !/[\u0000-\u001f\u007f]/u.test(scope);
function cloneRecord(value: CreationDraftMemoryRecord): CreationDraftMemoryRecord {
  return structuredClone({
    draft: { phase: value.draft.phase, prompt: value.draft.prompt, brief: value.draft.brief, plan: value.draft.plan,
      ...(value.draft.groupDraft ? { groupDraft: value.draft.groupDraft } : {}) },
    requestId: value.requestId, target: value.target,
  });
}

/** Page memory, scoped to the active actor. Empty actor means guest, never the member namespace. */
export function createCreationDraftMemory(maxEntries = 12) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 100) throw new Error('작성 중인 초안의 보관 수를 확인해 주세요.');
  let activeActor: string | undefined;
  const values = new Map<string, CreationDraftMemoryRecord>();
  const matches = (actor: string, scope: string) => validActor(actor) && validScope(scope) && activeActor === actor;
  return {
    activate(actor: string): void {
      if (!validActor(actor)) throw new Error('초안을 작성할 계정을 확인해 주세요.');
      if (activeActor !== actor) { values.clear(); activeActor = actor; }
    },
    read(actor: string, scope: string): CreationDraftMemoryRecord | undefined {
      if (!matches(actor, scope)) return undefined;
      const value = values.get(scope);
      if (!value) return undefined;
      values.delete(scope); values.set(scope, value);
      return cloneRecord(value);
    },
    write(actor: string, scope: string, value: CreationDraftMemoryRecord): boolean {
      if (!matches(actor, scope) || !value || !['PERSONAL','TOGETHER'].includes(value.target)
        || typeof value.requestId !== 'string' || !value.requestId || value.requestId.length > 160
        || !value.draft || !['INPUT','DRAFT'].includes(value.draft.phase) || typeof value.draft.prompt !== 'string'
        || value.draft.prompt.length > 1000 || !value.draft.brief) return false;
      let copy: CreationDraftMemoryRecord;
      try {
        if (JSON.stringify(value.draft).length > 120000) return false;
        copy = cloneRecord(value);
      } catch { return false; }
      values.delete(scope); values.set(scope, copy);
      if (values.size > maxEntries) values.delete(values.keys().next().value!);
      return true;
    },
    remove(actor: string, scope: string): boolean { return matches(actor, scope) ? values.delete(scope) : false; },
  };
}

export const pageCreationDraftMemory = createCreationDraftMemory();
