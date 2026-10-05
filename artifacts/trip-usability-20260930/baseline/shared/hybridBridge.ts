export interface SharePayload {
  title: string;
  message: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  viewMilestone: number;
}

export type WebToNativeMessage =
  | { type: 'READY' }
  | { type: 'NAVIGATION_STATE'; payload: { canGoBack: boolean } }
  | { type: 'SHARE'; payload: SharePayload }
  | { type: 'OPEN_EXTERNAL'; payload: { url: string } }
  | { type: 'UPDATE_NOTIFICATION_PREFERENCES'; payload: NotificationPreferences }
  | { type: 'PREVIEW_CREATOR_NOTIFICATION'; payload: { viewMilestone: number } };

export type NativeToWebMessage =
  | { type: 'GO_BACK' }
  | {
    type: 'NOTIFICATION_STATUS';
    payload: {
      enabled: boolean;
      permission: 'granted' | 'denied' | 'undetermined';
    };
  };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function parseWebToNativeMessage(value: string): WebToNativeMessage | null {
  try {
    const message: unknown = JSON.parse(value);
    if (!isRecord(message)) return null;
    if (message.type === 'READY') return { type: 'READY' };
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
    if (message.type !== 'NOTIFICATION_STATUS' || !isRecord(message.payload)) return null;
    const permission = message.payload.permission;
    if (typeof message.payload.enabled !== 'boolean' || !['granted', 'denied', 'undetermined'].includes(String(permission))) return null;
    return { type: 'NOTIFICATION_STATUS', payload: { enabled: message.payload.enabled, permission: permission as 'granted' | 'denied' | 'undetermined' } };
  } catch {
    return null;
  }
}
