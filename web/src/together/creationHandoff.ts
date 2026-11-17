import { snapshotCreationPreview, type CreationPreviewDraft } from './creationPreview.ts';

type CreationPlannerRoute = 'together-plan' | 'together-plan-trip' | 'together-plan-group';
type Pending = { route: CreationPlannerRoute; expiresAt: number; draft: CreationPreviewDraft };
let pending: Pending | null = null;

export function isCreationPlannerRoute(value: unknown): value is CreationPlannerRoute {
  return value === 'together-plan' || value === 'together-plan-trip' || value === 'together-plan-group';
}

/** Guest's explicit save→login handoff stays in this page, for five minutes. */
export function holdCreationHandoff(route: string, draft: CreationPreviewDraft, at = Date.now()) {
  if (!isCreationPlannerRoute(route)) return false;
  if (route === 'together-plan-group' && draft.brief.purpose !== 'GROUP') return false;
  pending = { route, expiresAt: at + 5 * 60_000, draft: snapshotCreationPreview(draft.brief, draft.plan, draft.groupDraft) };
  return true;
}

/** Host calls this even when TogetherApp has unmounted. Leaving discards the handoff. */
export function retainCreationHandoff(route?: string, at = Date.now()) {
  if (pending && (pending.route !== route || pending.expiresAt <= at)) pending = null;
}

/** Pure initial render read, including React's repeated development render. */
export function peekCreationHandoff(accountId: string, route: string, at = Date.now()): CreationPreviewDraft | undefined {
  if (!accountId || !pending || pending.route !== route || pending.expiresAt <= at) return undefined;
  return snapshotCreationPreview(pending.draft.brief, pending.draft.plan, pending.draft.groupDraft);
}

/** First authenticated visitor consumes it once; login itself never creates an object. */
export function takeCreationHandoff(accountId: string, route: string, at = Date.now()): CreationPreviewDraft | undefined {
  retainCreationHandoff(route, at);
  if (!accountId || !pending) return undefined;
  const result = pending.draft;
  pending = null;
  return result;
}
