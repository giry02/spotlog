export interface SharePayload {
  title: string;
  message: string;
}

export type WebToNativeMessage =
  | { type: 'READY' }
  | { type: 'SHARE'; payload: SharePayload }
  | { type: 'OPEN_EXTERNAL'; payload: { url: string } };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function parseWebToNativeMessage(value: string): WebToNativeMessage | null {
  try {
    const message: unknown = JSON.parse(value);
    if (!isRecord(message)) return null;
    if (message.type === 'READY') return { type: 'READY' };
    if (message.type === 'SHARE' && isRecord(message.payload) && typeof message.payload.title === 'string' && typeof message.payload.message === 'string') {
      return { type: 'SHARE', payload: { title: message.payload.title, message: message.payload.message } };
    }
    if (message.type === 'OPEN_EXTERNAL' && isRecord(message.payload) && typeof message.payload.url === 'string') {
      return { type: 'OPEN_EXTERNAL', payload: { url: message.payload.url } };
    }
    return null;
  } catch {
    return null;
  }
}
