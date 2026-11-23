import { createContext, useContext } from 'react';
import type { SocialAccountAdapter, SocialAccountUser, SocialSession } from './socialAccountService';
import type { ErrorKind } from './errorStates';

export type AccountView = 'login' | 'signup' | 'manage';
export type AccountEntry = 'email' | 'reset' | 'logout' | 'delete';
export interface AccountContinuation {
  onSignedIn: (user: SocialAccountUser) => void;
  onCancel?: () => void;
}
export interface AccountContextValue {
  adapter: SocialAccountAdapter;
  session: SocialSession;
  status: 'CHECKING' | 'READY' | 'ERROR';
  failureKind?: ErrorKind | null;
  updateSession: (session: SocialSession) => void;
  refresh: () => void;
  openAccount: (view?: AccountView, reason?: string, entry?: AccountEntry, continuation?: AccountContinuation) => void;
  requireMember: (reason: string) => boolean;
}
export const AccountContext = createContext<AccountContextValue | null>(null);
export const useAccount = () => useContext(AccountContext);
