import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { parseWebToNativeMessage } from '../../shared/hybridBridge';

const defaultWebUrl = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
})!;

const webUrl = process.env.EXPO_PUBLIC_SPOTLOG_WEB_URL?.trim() || defaultWebUrl;

export function HybridShell() {
  const webViewRef = useRef<WebView>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [bridgeReady, setBridgeReady] = useState(false);
  const trustedOrigin = useMemo(() => {
    try {
      return new URL(webUrl).origin;
    } catch {
      return '';
    }
  }, []);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    const message = parseWebToNativeMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === 'READY') {
      setBridgeReady(true);
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

    try {
      const target = new URL(message.payload.url);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported protocol');
      await Linking.openURL(target.toString());
    } catch {
      Alert.alert('링크를 열 수 없어요', '올바른 웹 주소인지 확인해 주세요.');
    }
  }, []);

  const handleNavigation = useCallback((request: WebViewNavigation) => {
    if (request.url === 'about:blank') return true;
    try {
      const target = new URL(request.url);
      if (trustedOrigin && target.origin === trustedOrigin) return true;
      if (['http:', 'https:'].includes(target.protocol)) void Linking.openURL(target.toString());
    } catch {
      return false;
    }
    return false;
  }, [trustedOrigin]);

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
        onLoadStart={() => { setLoadError(''); setBridgeReady(false); }}
        onMessage={(event) => void handleMessage(event)}
        onShouldStartLoadWithRequest={handleNavigation}
        onError={(event) => setLoadError(event.nativeEvent.description || '모바일웹을 불러오지 못했습니다.')}
        renderLoading={() => <View style={styles.loading}><ActivityIndicator color="#315CFD" /><Text style={styles.loadingText}>Spotlog 모바일웹을 여는 중</Text></View>}
      />

      {bridgeReady && <View pointerEvents="none" style={styles.bridgeDot} />}

      {loadError && (
        <View style={styles.error}>
          <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
          <Text style={styles.errorTitle}>모바일웹에 연결할 수 없어요</Text>
          <Text style={styles.errorCopy}>먼저 `npm run web`으로 웹 서버를 실행해 주세요. 실제 기기에서는 컴퓨터의 LAN 주소를 환경 변수로 지정해야 합니다.</Text>
          <View style={styles.urlBox}><Text style={styles.urlLabel}>현재 웹 주소</Text><Text style={styles.url} selectable>{webUrl}</Text></View>
          <Text style={styles.errorDetail}>{loadError}</Text>
          <Pressable onPress={() => setReloadKey((value) => value + 1)} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>다시 연결</Text></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1, backgroundColor: '#F7F8FA' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F7F8FA' },
  loadingText: { color: '#667085', fontSize: 12, fontWeight: '700' },
  bridgeDot: { position: 'absolute', right: 8, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#14B88A' },
  error: { position: 'absolute', inset: 0, padding: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  errorIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF' },
  errorIconText: { color: '#315CFD', fontSize: 25, fontWeight: '900' },
  errorTitle: { marginTop: 18, color: '#101828', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  errorCopy: { marginTop: 8, color: '#667085', fontSize: 12, lineHeight: 19, textAlign: 'center' },
  urlBox: { width: '100%', marginTop: 18, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF' },
  urlLabel: { color: '#98A2B3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  url: { marginTop: 4, color: '#315CFD', fontSize: 11, fontWeight: '700' },
  errorDetail: { marginTop: 9, color: '#98A2B3', fontSize: 9, textAlign: 'center' },
  retry: { marginTop: 20, minWidth: 150, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#315CFD' },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
