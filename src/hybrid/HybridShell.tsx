import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ActivityIndicator, Alert, BackHandler, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { parseWebToNativeMessage, type NativeToWebMessage, type NotificationPreferences } from '../../shared/hybridBridge';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const notificationPreferencesKey = 'spotlog.native.notification.preferences.v1';
const defaultNotificationPreferences: NotificationPreferences = { enabled: false, viewMilestone: 100 };

async function prepareCreatorNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('creator-milestones', {
    name: '창작자 성과 알림',
    description: '내 여행기의 조회수 목표 달성과 창작 성과를 알려드립니다.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#FF6245',
    sound: 'default',
  });
}

async function readNativeNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(notificationPreferencesKey);
    if (!stored) return defaultNotificationPreferences;
    const value = JSON.parse(stored) as Partial<NotificationPreferences>;
    if (typeof value.enabled !== 'boolean' || typeof value.viewMilestone !== 'number' || !Number.isFinite(value.viewMilestone) || value.viewMilestone <= 0) return defaultNotificationPreferences;
    return { enabled: value.enabled, viewMilestone: value.viewMilestone };
  } catch {
    return defaultNotificationPreferences;
  }
}

const defaultWebUrl = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
})!;

const webUrl = process.env.EXPO_PUBLIC_SPOTLOG_WEB_URL?.trim() || defaultWebUrl;

function isEntryDocument(url: string) {
  try {
    const actual = new URL(url), expected = new URL(webUrl);
    actual.hash = ''; expected.hash = '';
    return actual.href === expected.href;
  } catch {
    return false;
  }
}

export function HybridShell() {
  const webViewRef = useRef<WebView>(null);
  const notificationQueue = useRef<Promise<void>>(Promise.resolve());
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [bridgeReady, setBridgeReady] = useState(false);
  const [webCanGoBack, setWebCanGoBack] = useState(false);
  const trustedOrigin = useMemo(() => {
    try {
      return new URL(webUrl).origin;
    } catch {
      return '';
    }
  }, []);

  const sendToWeb = useCallback((message: NativeToWebMessage) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (loadError || !webCanGoBack) return false;
      sendToWeb({ type: 'GO_BACK' });
      return true;
    });
    return () => subscription.remove();
  }, [loadError, sendToWeb, webCanGoBack]);

  const updateNotificationPreferences = useCallback(async (preferences: NotificationPreferences, showPermissionAlert = true) => {
    let permission: 'granted' | 'denied' | 'undetermined' = 'undetermined';
    if (preferences.enabled) {
      await prepareCreatorNotificationChannel();
      permission = (await Notifications.getPermissionsAsync()).status;
      if (permission !== 'granted') permission = (await Notifications.requestPermissionsAsync()).status;
    } else {
      // Turning the preference off must still work when the OS notification API is unavailable.
      try { permission = (await Notifications.getPermissionsAsync()).status; } catch { /* Keep the disabled preference. */ }
    }
    const enabled = preferences.enabled && permission === 'granted';
    await AsyncStorage.setItem(notificationPreferencesKey, JSON.stringify(preferences));
    sendToWeb({ type: 'NOTIFICATION_STATUS', payload: { enabled, permission } });
    if (showPermissionAlert && preferences.enabled && !enabled) Alert.alert('푸시 알림 권한이 필요해요', '기기 설정에서 Spotlog 알림을 허용하면 조회수 목표 달성 소식을 받을 수 있습니다.');
    return enabled;
  }, [sendToWeb]);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    const message = parseWebToNativeMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === 'READY') {
      setBridgeReady(true);
      try {
        const preferences = await readNativeNotificationPreferences();
        const permission = (await Notifications.getPermissionsAsync()).status;
        sendToWeb({ type: 'NOTIFICATION_STATUS', payload: { enabled: preferences.enabled && permission === 'granted', permission } });
      } catch {
        sendToWeb({ type: 'NOTIFICATION_STATUS', payload: { enabled: false, permission: 'undetermined' } });
      }
      return;
    }

    if (message.type === 'NAVIGATION_STATE') {
      setWebCanGoBack(message.payload.canGoBack);
      return;
    }

    if (message.type === 'SHARE') {
      try {
        await Share.share(
          { title: message.payload.title, message: message.payload.message },
          { dialogTitle: 'Spotlog 공유' },
        );
      } catch {
        Alert.alert('공유할 수 없어요', '잠시 후 다시 시도해 주세요.');
      }
      return;
    }

    if (message.type === 'UPDATE_NOTIFICATION_PREFERENCES' || message.type === 'PREVIEW_CREATOR_NOTIFICATION') {
      // Serialize permission prompts and writes so a later Off choice cannot be overwritten by an earlier On request.
      notificationQueue.current = notificationQueue.current.then(async () => {
        try {
          if (message.type === 'UPDATE_NOTIFICATION_PREFERENCES') {
            await updateNotificationPreferences(message.payload);
            return;
          }
          const enabled = await updateNotificationPreferences({ enabled: true, viewMilestone: message.payload.viewMilestone }, false);
          if (!enabled) {
            sendToWeb({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: false, reason: 'permission' } });
            return;
          }
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Spotlog 테스트 알림',
              body: `조회수 ${message.payload.viewMilestone.toLocaleString()}회 목표 알림이 이렇게 표시돼요. 실제 조회수 달성 알림은 아니에요.`,
              sound: 'default',
              data: { type: 'CREATOR_VIEW_MILESTONE_PREVIEW', viewMilestone: message.payload.viewMilestone },
            },
            trigger: null,
          });
          sendToWeb({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: true } });
        } catch {
          if (message.type === 'PREVIEW_CREATOR_NOTIFICATION') sendToWeb({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: false, reason: 'unavailable' } });
          else Alert.alert('알림 설정을 저장할 수 없어요', '잠시 후 다시 시도해 주세요.');
        }
      });
      await notificationQueue.current;
      return;
    }

    try {
      const target = new URL(message.payload.url);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported protocol');
      await Linking.openURL(target.toString());
    } catch {
      Alert.alert('링크를 열 수 없어요', '올바른 웹 주소인지 확인해 주세요.');
    }
  }, [sendToWeb, updateNotificationPreferences]);

  const handleNavigation = useCallback((request: WebViewNavigation) => {
    if (request.url === 'about:blank') return true;
    try {
      const target = new URL(request.url);
      if (trustedOrigin && target.origin === trustedOrigin) return true;
      if (['http:', 'https:'].includes(target.protocol)) {
        void Linking.openURL(target.toString()).catch(() => Alert.alert('링크를 열 수 없어요', '잠시 후 다시 시도해 주세요.'));
      }
    } catch {
      return false;
    }
    return false;
  }, [trustedOrigin]);

  const failLoading = useCallback((message: string) => {
    setWebCanGoBack(false);
    setBridgeReady(false);
    setLoadError(message);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: webUrl }}
        style={styles.webview}
        originWhitelist={['http://*', 'https://*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        setSupportMultipleWindows={false}
        onLoadStart={() => { setLoadError(''); setBridgeReady(false); setWebCanGoBack(false); }}
        onMessage={(event) => void handleMessage(event)}
        onShouldStartLoadWithRequest={handleNavigation}
        onError={(event) => failLoading(event.nativeEvent.description || '모바일웹을 불러오지 못했습니다.')}
        onHttpError={(event) => { if (isEntryDocument(event.nativeEvent.url)) failLoading(`HTTP ${event.nativeEvent.statusCode}`); }}
        onContentProcessDidTerminate={() => failLoading('화면 연결이 종료됐어요. 다시 연결해 주세요.')}
        onRenderProcessGone={() => failLoading('화면 연결이 종료됐어요. 다시 연결해 주세요.')}
        renderLoading={() => <View style={styles.loading}><ActivityIndicator color="#315CFD" /><Text style={styles.loadingText}>Spotlog 모바일웹을 여는 중</Text></View>}
      />

      {__DEV__ && bridgeReady && <View pointerEvents="none" style={styles.bridgeDot} />}

      {loadError && (
        <ScrollView style={styles.error} contentContainerStyle={styles.errorContent}>
          <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
          <Text style={styles.errorTitle}>모바일웹에 연결할 수 없어요</Text>
          <Text style={styles.errorCopy}>인터넷 연결을 확인하고 다시 연결해 주세요. 저장한 여행은 지워지지 않아요.</Text>
          {__DEV__ && <><View style={styles.urlBox}><Text style={styles.urlLabel}>개발용 웹 주소</Text><Text style={styles.url} selectable>{webUrl}</Text></View><Text style={styles.errorDetail}>{loadError}</Text></>}
          <Pressable onPress={() => { setLoadError(''); setBridgeReady(false); setWebCanGoBack(false); setReloadKey((value) => value + 1); }} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>다시 연결</Text></Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1, backgroundColor: '#F7F8FA' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F7F8FA' },
  loadingText: { color: '#667085', fontSize: 14, fontWeight: '700' },
  bridgeDot: { position: 'absolute', right: 8, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#14B88A' },
  error: { position: 'absolute', inset: 0, backgroundColor: '#F7F8FA' },
  errorContent: { flexGrow: 1, padding: 30, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF' },
  errorIconText: { color: '#315CFD', fontSize: 25, fontWeight: '900' },
  errorTitle: { marginTop: 18, color: '#101828', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  errorCopy: { marginTop: 8, color: '#667085', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  urlBox: { width: '100%', marginTop: 18, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF' },
  urlLabel: { color: '#98A2B3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  url: { marginTop: 4, color: '#315CFD', fontSize: 11, fontWeight: '700' },
  errorDetail: { marginTop: 9, color: '#98A2B3', fontSize: 9, textAlign: 'center' },
  retry: { marginTop: 20, minWidth: 150, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#315CFD' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
