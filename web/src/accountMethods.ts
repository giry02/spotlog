import type { AccountProvider } from './socialAccountService.ts';

/** Shared ordering for both login and signup; EMAIL opens its own form. */
export const ACCOUNT_METHODS = ['KAKAO', 'NAVER', 'GOOGLE', 'APPLE', 'EMAIL'] as const satisfies readonly AccountProvider[];
export const accountProviderName = (provider: AccountProvider): string => ({
  KAKAO: '카카오', NAVER: '네이버', GOOGLE: 'Google', APPLE: 'Apple', EMAIL: '이메일',
})[provider];
