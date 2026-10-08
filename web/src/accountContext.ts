import { createContext, useContext } from 'react';
import type { SocialAccountAdapter, SocialSession } from './socialAccountService';
import type { ErrorKind } from './errorStates';

export type AccountView = 'login' | 'signup';
export interface AccountContextValue {
  adapter: SocialAccountAdapter;
  session: SocialSession;
  status: 'CHECKING' | 'READY' | 'ERROR';
  failureKind?: ErrorKind | null;
  updateSession: (session: SocialSession) => void;
  refresh: () => void;
  openAccount: (view?: AccountView, reason?: string) => void;
  requireMember: (reason: string) => boolean;
}
export const AccountContext = createContext<AccountContextValue | null>(null);
export const useAccount = () => useContext(AccountContext);
