import { parseNativeToWebMessage, type NotificationPreferences, type SharePayload, type WebToNativeMessage } from '../../shared/hybridBridge';

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

export function notifyNavigationState(canGoBack: boolean) {
  if (isNativeShell()) postToNative({ type: 'NAVIGATION_STATE', payload: { canGoBack } });
}

export function updateNotificationPreferences(preferences: NotificationPreferences) {
  if (isNativeShell()) postToNative({ type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: preferences });
}

export function previewCreatorNotification(viewMilestone: number) {
  if (!isNativeShell()) return false;
  postToNative({ type: 'PREVIEW_CREATOR_NOTIFICATION', payload: { viewMilestone } });
  return true;
}

export function subscribeNotificationStatus(callback: (status: { enabled: boolean; permission: 'granted' | 'denied' | 'undetermined' }) => void) {
  const handleMessage = (event: Event) => {
    const message = parseNativeToWebMessage((event as MessageEvent).data);
    if (message?.type === 'NOTIFICATION_STATUS') callback(message.payload);
  };
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
  return () => {
    window.removeEventListener('message', handleMessage);
    document.removeEventListener('message', handleMessage);
  };
}

export function subscribeNavigationCommands(onBack: () => void) {
  const handleMessage = (event: Event) => {
    const message = parseNativeToWebMessage((event as MessageEvent).data);
    if (message?.type === 'GO_BACK') onBack();
  };
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
  return () => {
    window.removeEventListener('message', handleMessage);
    document.removeEventListener('message', handleMessage);
  };
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
