import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HybridShell } from './src/hybrid/HybridShell';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <HybridShell />
    </SafeAreaProvider>
  );
}
