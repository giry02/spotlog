export interface SharePayload {
  title: string;
  message: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  viewMilestone: number;
}

export const CURRENT_AREA_CONSENT_VERSION = '2026-11-20';
export interface NativeLocationCoordinates { latitude: number; longitude: number; accuracy: number }
export type NativeLocationErrorCode = 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'INACCURATE';
export interface NativeLocationRequest {
  requestId: string;
  sessionId: string;
  consentAccepted: true;
  consentVersion: string;
  purpose: 'GROUP_NEARBY';
}

export type WebToNativeMessage =
  | { type: 'READY' }
  | { type: 'NAVIGATION_STATE'; payload: { canGoBack: boolean } }
  | { type: 'SHARE'; payload: SharePayload }
  | { type: 'OPEN_EXTERNAL'; payload: { url: string } }
  | { type: 'CURRENT_LOCATION_REQUEST'; payload: NativeLocationRequest }
  | { type: 'CURRENT_LOCATION_CANCEL'; payload: { requestId: string; sessionId: string } }
  | { type: 'UPDATE_NOTIFICATION_PREFERENCES'; payload: NotificationPreferences }
  | { type: 'PREVIEW_CREATOR_NOTIFICATION'; payload: { viewMilestone: number } };

export type NativeToWebMessage =
  | { type: 'GO_BACK' }
  | { type: 'CURRENT_LOCATION_RESULT'; payload: { requestId: string; sessionId: string } & (
    { ok: true; coordinates: NativeLocationCoordinates } | { ok: false; code: NativeLocationErrorCode }
  ) }
  | { type: 'PREVIEW_NOTIFICATION_RESULT'; payload: { sent: boolean; reason?: 'permission' | 'unavailable' } }
  | {
    type: 'NOTIFICATION_STATUS';
    payload: {
      enabled: boolean;
      permission: 'granted' | 'denied' | 'undetermined';
    };
  };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isLocationToken = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(value);
const isLocationEnvelope = (value: Record<string, unknown>) => isLocationToken(value.requestId) && isLocationToken(value.sessionId);

export function parseWebToNativeMessage(value: string): WebToNativeMessage | null {
  try {
    const message: unknown = JSON.parse(value);
    if (!isRecord(message)) return null;
    if (message.type === 'READY') return { type: 'READY' };
    if (message.type === 'CURRENT_LOCATION_REQUEST' && isRecord(message.payload) && isLocationEnvelope(message.payload)
      && message.payload.consentAccepted === true && message.payload.consentVersion === CURRENT_AREA_CONSENT_VERSION && message.payload.purpose === 'GROUP_NEARBY') {
      return { type: 'CURRENT_LOCATION_REQUEST', payload: { requestId: message.payload.requestId as string, sessionId: message.payload.sessionId as string,
        consentAccepted: true, consentVersion: CURRENT_AREA_CONSENT_VERSION, purpose: 'GROUP_NEARBY' } };
    }
    if (message.type === 'CURRENT_LOCATION_CANCEL' && isRecord(message.payload) && isLocationEnvelope(message.payload)) {
      return { type: 'CURRENT_LOCATION_CANCEL', payload: { requestId: message.payload.requestId as string, sessionId: message.payload.sessionId as string } };
    }
    if (message.type === 'NAVIGATION_STATE' && isRecord(message.payload) && typeof message.payload.canGoBack === 'boolean') {
      return { type: 'NAVIGATION_STATE', payload: { canGoBack: message.payload.canGoBack } };
    }
    if (message.type === 'SHARE' && isRecord(message.payload) && typeof message.payload.title === 'string' && typeof message.payload.message === 'string') {
      return { type: 'SHARE', payload: { title: message.payload.title, message: message.payload.message } };
    }
    if (message.type === 'OPEN_EXTERNAL' && isRecord(message.payload) && typeof message.payload.url === 'string') {
      return { type: 'OPEN_EXTERNAL', payload: { url: message.payload.url } };
    }
    if (message.type === 'UPDATE_NOTIFICATION_PREFERENCES' && isRecord(message.payload) && typeof message.payload.enabled === 'boolean' && typeof message.payload.viewMilestone === 'number' && Number.isFinite(message.payload.viewMilestone) && message.payload.viewMilestone > 0) {
      return { type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: { enabled: message.payload.enabled, viewMilestone: message.payload.viewMilestone } };
    }
    if (message.type === 'PREVIEW_CREATOR_NOTIFICATION' && isRecord(message.payload) && typeof message.payload.viewMilestone === 'number' && Number.isFinite(message.payload.viewMilestone) && message.payload.viewMilestone > 0) {
      return { type: 'PREVIEW_CREATOR_NOTIFICATION', payload: { viewMilestone: message.payload.viewMilestone } };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseNativeToWebMessage(value: unknown): NativeToWebMessage | null {
  if (typeof value !== 'string') return null;
  try {
    const message: unknown = JSON.parse(value);
    if (!isRecord(message)) return null;
    if (message.type === 'GO_BACK') return { type: 'GO_BACK' };
    if (message.type === 'CURRENT_LOCATION_RESULT' && isRecord(message.payload) && isLocationEnvelope(message.payload)) {
      const { requestId, sessionId, ok, coordinates, code } = message.payload;
      if (ok === false && ['DENIED', 'UNAVAILABLE', 'TIMEOUT', 'INACCURATE'].includes(String(code))) {
        return { type: 'CURRENT_LOCATION_RESULT', payload: { requestId: requestId as string, sessionId: sessionId as string, ok, code: code as NativeLocationErrorCode } };
      }
      if (ok !== true || !isRecord(coordinates)) return null;
      const { latitude, longitude, accuracy } = coordinates;
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracy !== 'number'
        || ![latitude, longitude, accuracy].every(Number.isFinite) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0 || accuracy > 10000) return null;
      return { type: 'CURRENT_LOCATION_RESULT', payload: { requestId: requestId as string, sessionId: sessionId as string, ok, coordinates: { latitude, longitude, accuracy } } };
    }
    if (message.type === 'PREVIEW_NOTIFICATION_RESULT' && isRecord(message.payload)) {
      const { sent, reason } = message.payload;
      if (typeof sent !== 'boolean' || (reason !== undefined && reason !== 'permission' && reason !== 'unavailable')) return null;
      return { type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent, ...(reason ? { reason } : {}) } };
    }
    if (message.type !== 'NOTIFICATION_STATUS' || !isRecord(message.payload)) return null;
    const permission = message.payload.permission;
    if (typeof message.payload.enabled !== 'boolean' || !['granted', 'denied', 'undetermined'].includes(String(permission))) return null;
    return { type: 'NOTIFICATION_STATUS', payload: { enabled: message.payload.enabled, permission: permission as 'granted' | 'denied' | 'undetermined' } };
  } catch {
    return null;
  }
}
