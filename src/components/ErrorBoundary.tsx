import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { zh } from '@/i18n/zh';
import { colors, radius, space, stroke, type } from '@/theme';

type Props = { children: ReactNode };
type State = { error: Error | null; reloadHint: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloadHint: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, reloadHint: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('未捕获的界面错误', error, info.componentStack);
  }

  private restart = (): void => {
    try {
      DevSettings.reload();
    } catch {
      this.setState({ reloadHint: true });
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.title}>{zh.errors.title}</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.restart}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{zh.errors.restart}</Text>
          </Pressable>
          {this.state.reloadHint ? (
            <Text style={styles.message}>{zh.errors.manualRestart}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.lg,
  },
  title: { ...type.title, color: colors.text },
  message: { ...type.micro, color: colors.textMute },
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hair,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  buttonText: { ...type.small, color: colors.primary },
});
