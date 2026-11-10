import { StyleSheet } from 'react-native';
import { colors, radius, space, type } from '@/theme';

export const meStyles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xxxl,
    gap: space.md,
  },
  title: { ...type.title, color: colors.text },
  description: { ...type.small, color: colors.textDim },
  group: {
    ...type.micro,
    color: colors.textMute,
    letterSpacing: 1.2,
    marginTop: space.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  error: { ...type.caption, color: colors.danger },
});
