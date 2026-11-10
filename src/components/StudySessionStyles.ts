import { StyleSheet } from 'react-native';
import { colors, space, stroke } from '@/theme';

export const studySessionStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  content: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xxxl,
  },
  bottom: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: stroke.hair,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
