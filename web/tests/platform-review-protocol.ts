export const PLATFORM_REVIEW_PROTOCOL = 'spotlog.platform-review.v1';
export const PLATFORM_REVIEW_ROLES = ['owner', 'member', 'applicant', 'guest'] as const;
export type PlatformReviewRole = typeof PLATFORM_REVIEW_ROLES[number];
export const isPlatformReviewRole = (value: unknown): value is PlatformReviewRole => typeof value === 'string' && (PLATFORM_REVIEW_ROLES as readonly string[]).includes(value);

/** A role selector for one same-origin fixture parent; no account, URL, storage or mutation commands. */
export function readPlatformReviewRoleMessage(event: Pick<MessageEvent, 'data' | 'origin' | 'source'>, origin: string, parent: MessageEventSource | null): PlatformReviewRole | null {
  if (!parent || event.source !== parent || event.origin !== origin || !event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return null;
  const value = event.data as Record<string, unknown>;
  return Object.keys(value).length === 3 && Object.keys(value).every(key => ['protocol', 'type', 'role'].includes(key))
    && value.protocol === PLATFORM_REVIEW_PROTOCOL && value.type === 'SET_ROLE' && isPlatformReviewRole(value.role) ? value.role : null;
}
