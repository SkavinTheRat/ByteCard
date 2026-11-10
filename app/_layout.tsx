import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
  useFonts as useMonoFonts,
} from '@expo-google-fonts/jetbrains-mono';
import { useSettingsStore } from '@/store/settingsStore';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [monoLoaded, monoError] = useMonoFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });
  const initialize = useSettingsStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const fontsReady = interLoaded && monoLoaded;
  const fontFailed = Boolean(interError || monoError);

  useEffect(() => {
    if (fontFailed) {
      console.warn('字体加载失败，继续使用系统字体');
    }
    if (fontsReady || fontFailed) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontFailed, fontsReady]);

  if (!(fontsReady || fontFailed)) {
    return <View style={styles.splash} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="study"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, backgroundColor: colors.bg },
});
