import { snapshotCreationPreview, type CreationPreviewDraft } from './creationPreview.ts';

export const TRIP_DRAFT_ROUTE = 'together-plan-trip-draft';
type CreationPlannerRoute = 'together-plan' | 'together-plan-trip' | 'together-plan-group' | typeof TRIP_DRAFT_ROUTE;

export function isTripCreationRoute(value: unknown): boolean {
  return value === 'together-plan-trip' || value === TRIP_DRAFT_ROUTE;
}
type Pending = { route: CreationPlannerRoute; expiresAt: number; draft: CreationPreviewDraft };
let pending: Pending | null = null;

export function isCreationPlannerRoute(value: unknown): value is CreationPlannerRoute {
  return value === 'together-plan' || value === 'together-plan-group' || value === 'together-plan-trip' || value === TRIP_DRAFT_ROUTE;
}

/** Guest's explicit save→login handoff stays in this page, for five minutes. */
export function holdCreationHandoff(route: string, draft: CreationPreviewDraft, at = Date.now()) {
  if (!isCreationPlannerRoute(route)) return false;
  if (route === 'together-plan-group' && draft.brief.purpose !== 'GROUP' || route === TRIP_DRAFT_ROUTE && draft.brief.purpose !== 'TRIP') return false;
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
