import type { SharePayload, WebToNativeMessage } from '../../shared/hybridBridge';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

export const isNativeShell = () => Boolean(window.ReactNativeWebView);

const postToNative = (message: WebToNativeMessage) => {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
};

export function notifyReady() {
  if (isNativeShell()) postToNative({ type: 'READY' });
}

export function openExternal(url: string) {
  if (isNativeShell()) {
    postToNative({ type: 'OPEN_EXTERNAL', payload: { url } });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function shareContent(payload: SharePayload) {
  if (isNativeShell()) {
    postToNative({ type: 'SHARE', payload });
    return 'native' as const;
  }

  if (navigator.share) {
    await navigator.share({ title: payload.title, text: payload.message });
    return 'web' as const;
  }

  await navigator.clipboard.writeText(payload.message);
  return 'clipboard' as const;
}
