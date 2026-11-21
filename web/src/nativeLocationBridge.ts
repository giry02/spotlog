import { CURRENT_AREA_CONSENT_VERSION, parseNativeToWebMessage, type NativeLocationCoordinates, type NativeLocationErrorCode } from '../../shared/hybridBridge.ts';

declare global {
  interface Window {
    /** Set only in the trusted shell's main document; not persisted between documents. */
    __SPOTLOG_LOCATION_BRIDGE__?: { version: 1; sessionId: string };
  }
}

const capability = () => typeof window !== 'undefined' && window === window.top && typeof window.ReactNativeWebView?.postMessage === 'function'
  && window.__SPOTLOG_LOCATION_BRIDGE__?.version === 1 && /^[a-zA-Z0-9_-]{16,100}$/.test(window.__SPOTLOG_LOCATION_BRIDGE__.sessionId)
  ? window.__SPOTLOG_LOCATION_BRIDGE__ : undefined;
export const isNativeCurrentLocationAvailable = () => Boolean(capability());

export class NativeCurrentLocationError extends Error {
  readonly code: NativeLocationErrorCode;
  constructor(code: NativeLocationErrorCode) { super('기기 위치를 확인하지 못했어요.'); this.name = 'NativeCurrentLocationError'; this.code = code; }
}

/** A response is accepted only for this main document, session and request. It is never stored. */
export function requestNativeCurrentPosition(options: { signal: AbortSignal; consent: { accepted: true; version: string; purpose: 'GROUP_NEARBY' } }): Promise<NativeLocationCoordinates> {
  const bridge = capability();
  if (!bridge || options.consent.accepted !== true || options.consent.version !== CURRENT_AREA_CONSENT_VERSION || options.consent.purpose !== 'GROUP_NEARBY') return Promise.reject(new NativeCurrentLocationError('UNAVAILABLE'));
  const requestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `location_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    let settled = false, posted = false;
    const cleanup = () => {
      clearTimeout(timer); options.signal.removeEventListener('abort', abort);
      window.removeEventListener('message', receive); document.removeEventListener('message', receive);
    };
    const cancelNative = () => {
      if (posted && capability()?.sessionId === bridge.sessionId) {
        try { window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CURRENT_LOCATION_CANCEL', payload: { requestId, sessionId: bridge.sessionId } })); } catch { /* The old document may already be gone. */ }
      }
    };
    const finish = (error?: unknown, value?: NativeLocationCoordinates) => {
      if (settled) return; settled = true; cleanup();
      if (error) { cancelNative(); reject(error); } else resolve(value!);
    };
    const abort = () => finish(new DOMException('요청을 취소했어요.', 'AbortError'));
    const receive = (event: Event) => {
      const received = event as MessageEvent;
      if ((received.origin && received.origin !== window.location.origin) || (received.source && received.source !== window)) return;
      const message = parseNativeToWebMessage(received.data);
      if (message?.type !== 'CURRENT_LOCATION_RESULT' || message.payload.requestId !== requestId || message.payload.sessionId !== bridge.sessionId
        || capability()?.sessionId !== bridge.sessionId) return;
      if (message.payload.ok) finish(undefined, message.payload.coordinates);
      else finish(new NativeCurrentLocationError(message.payload.code));
    };
    const timer = setTimeout(() => finish(new NativeCurrentLocationError('TIMEOUT')), 20000);
    if (options.signal.aborted) { abort(); return; }
    options.signal.addEventListener('abort', abort, { once: true });
    window.addEventListener('message', receive); document.addEventListener('message', receive);
    try {
      posted = true;
      window.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'CURRENT_LOCATION_REQUEST', payload: { requestId, sessionId: bridge.sessionId,
        consentAccepted: true, consentVersion: options.consent.version, purpose: options.consent.purpose } }));
    } catch { finish(new NativeCurrentLocationError('UNAVAILABLE')); }
  });
}
