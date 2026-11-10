import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
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
import { ToastHost } from '@/components/ToastHost';
import { useReminderSync } from '@/hooks/useReminderSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  const ready = useSettingsStore((state) => state.ready);
  const onboarded = useSettingsStore((state) => state.onboarded);
  const initializationError = useSettingsStore((state) => state.error);
  const router = useRouter();
  const segments = useSegments();
  useReminderSync();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const fontsReady = interLoaded && monoLoaded;
  const fontFailed = Boolean(interError || monoError);

  useEffect(() => {
    if (fontFailed) {
      console.warn('字体加载失败，继续使用系统字体');
    }
    if ((fontsReady || fontFailed) && (ready || Boolean(initializationError))) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontFailed, fontsReady, initializationError, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const inOnboarding = segments[0] === 'onboarding';
    if (!onboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (onboarded && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [onboarded, ready, router, segments]);

  if (!(fontsReady || fontFailed)) {
    return <View style={styles.splash} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="onboarding"
              options={{ animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen
              name="study"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
          </Stack>
          <ToastHost />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, backgroundColor: colors.bg },
});
