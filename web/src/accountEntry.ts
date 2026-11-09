import type { AccountEntry, AccountView } from './accountContext';

export type AccountAdapterMode = 'SERVICE' | 'REVIEW' | 'UNCONNECTED';

/** An explicit endpoint never falls back to a review identity. */
export function selectAccountAdapterMode({ endpoint, development, reviewMode }: { endpoint: string; development: boolean; reviewMode?: string }): AccountAdapterMode {
  if (endpoint) return 'SERVICE';
  return development || reviewMode === '1' ? 'REVIEW' : 'UNCONNECTED';
}

/** Only review-login entries receive the public pair; service passwords stay empty. */
export function initialEmailLoginCredentials({ initialView, initialEntry, reviewAccount, memberEmail }: {
  initialView: AccountView;
  initialEntry?: AccountEntry;
  reviewAccount?: { email: string; password: string };
  memberEmail?: string | null;
}): { email: string; password: string } {
  if (initialEntry === 'reset') return { email: memberEmail ?? '', password: '' };
  if (initialView !== 'login' || (initialEntry && initialEntry !== 'email')) return { email: '', password: '' };
  return { email: reviewAccount?.email ?? '', password: reviewAccount?.password ?? '' };
}
