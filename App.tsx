import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SpotlogProvider } from './src/context/SpotlogContext';
import { RootTabs } from './src/navigation/RootTabs';

export default function App() {
  return (
    <SafeAreaProvider>
      <SpotlogProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootTabs />
        </NavigationContainer>
      </SpotlogProvider>
    </SafeAreaProvider>
  );
}
