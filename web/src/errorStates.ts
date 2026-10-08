import { ServiceError } from './serviceRequest.ts';

export const errorCodes = [400, 401, 402, 403, 404, 429, 500, 502, 503, 504] as const;
export type ErrorCode = typeof errorCodes[number];
export type ErrorKind = ErrorCode | 'network';
export const errorTypes: Record<ErrorKind, string> = { 400: 'validation', 401: 'session', 402: 'conditions', 403: 'forbidden', 404: 'missing', 429: 'limit', 500: 'server', 502: 'gateway', 503: 'unavailable', 504: 'timeout', network: 'network' };
export type RecoveryAction = 'back' | 'login' | 'home' | 'retry';
export interface ErrorCopy {
  label: string;
  title: string;
  description: string;
  action: RecoveryAction;
}

/** Customer-safe copy only. Never render an API response, stack or customer request. */
export const errorCopy: Record<ErrorKind, ErrorCopy> = {
  400: { label: '요청 확인', title: '요청을 확인해 주세요', description: '주소나 요청 정보가 올바르지 않아요. 이전 화면에서 내용을 확인해 주세요.', action: 'back' },
  401: { label: '로그인 필요', title: '로그인이 필요해요', description: '로그인하지 않았거나 로그인이 만료됐어요. 로그인한 뒤 다시 이용해 주세요.', action: 'login' },
  402: { label: '이용 조건 확인', title: '이용 조건을 확인해 주세요', description: '이 기능을 이용하기 위한 조건 확인이 필요해요. 이전 화면의 이용 안내를 확인해 주세요.', action: 'back' },
  403: { label: '접근 제한', title: '접근할 수 없는 페이지예요', description: '이 계정으로 이용할 수 없는 페이지예요. 공개 화면으로 이동하거나 이전 화면으로 돌아가 주세요.', action: 'home' },
  404: { label: '페이지 없음', title: '페이지를 찾을 수 없어요', description: '주소가 바뀌었거나 더 이상 볼 수 없는 페이지예요. 홈에서 여행을 다시 찾아보세요.', action: 'home' },
  429: { label: '요청 제한', title: '잠시 후 다시 시도해 주세요', description: '짧은 시간에 요청이 많이 들어왔어요. 잠시 기다린 뒤 다시 이용해 주세요.', action: 'back' },
  500: { label: '처리 오류', title: '잠시 문제가 생겼어요', description: '화면을 정상적으로 처리하지 못했어요. 다시 시도하거나 홈으로 이동해 주세요.', action: 'retry' },
  502: { label: '연결 응답 오류', title: '연결된 서비스의 응답을 받지 못했어요', description: '필요한 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', action: 'retry' },
  503: { label: '서비스 이용 불가', title: '서비스를 잠시 이용할 수 없어요', description: '현재 서비스를 이용하기 어려워요. 잠시 후 다시 시도해 주세요.', action: 'retry' },
  504: { label: '응답 시간 초과', title: '응답이 늦어지고 있어요', description: '정보를 불러오는 데 시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.', action: 'retry' },
  network: { label: '연결 확인', title: '인터넷 연결을 확인해 주세요', description: '서비스에 연결하지 못했어요. Wi-Fi나 모바일 데이터 연결을 확인한 뒤 다시 시도해 주세요.', action: 'retry' },
};

export function isErrorKind(value: unknown): value is ErrorKind {
  return value === 'network' || errorCodes.some(code => code === value);
}

export function errorKindForType(type: string | null): ErrorKind {
  return [...errorCodes, 'network' as const].find(kind => errorTypes[kind] === type) ?? 404;
}

export function errorKindForFailure(error: unknown): ErrorKind {
  if (error instanceof ServiceError) {
    if (isErrorKind(error.status)) return error.status;
    if (error.status === 0) return 503; // Unconfigured integration is not proof of offline.
    return error.status >= 400 && error.status < 500 ? 400 : 500;
  }
  return error instanceof TypeError ? 'network' : 500;
}

/** Malformed URL escapes must produce 400 rather than crashing the app. */
export function readErrorRoute(hash: string): { screen: string; error?: ErrorKind } {
  let screen: string;
  try { screen = decodeURIComponent(hash.replace(/^#/, '')) || 'home'; }
  catch { return { screen: '', error: 400 }; }
  if (!screen.startsWith('error-')) return { screen };
  const value = screen.slice('error-'.length);
  const named = [...errorCodes, 'network' as const].find(kind => errorTypes[kind] === value);
  if (named !== undefined) return { screen, error: named };
  if (value === 'network') return { screen, error: 'network' };
  const code = Number(value);
  return { screen, error: /^\d{3}$/.test(value) && isErrorKind(code) ? code : 404 };
}
