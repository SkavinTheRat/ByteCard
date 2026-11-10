import { StyleSheet, Text, View } from 'react-native';
import { memo } from 'react';
import type { Card } from '@/types';
import { zh } from '@/i18n/zh';
import { colors, fonts, radius, space, stroke, type } from '@/theme';

type KnowledgeCardProps = {
  card: Card;
  deckCode: string;
  accent: string;
  position: number;
  total: number;
  badge?: string;
};

export const KnowledgeCard = memo(function KnowledgeCard({
  card,
  deckCode,
  accent,
  position,
  total,
  badge,
}: KnowledgeCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.titleBar}>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={[styles.deckCode, { color: accent }]}>{deckCode}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.progress}>
          {zh.study.progress(position, total)}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.question}>{card.question}</Text>
        {card.code ? (
          <View style={styles.codeBlock}>
            <View style={styles.codeRail} />
            <Text selectable style={styles.code}>
              {card.code}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  titleBar: {
    minHeight: 34,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dots: { flexDirection: 'row', gap: 5, width: 34 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.textMute,
  },
  deckCode: { ...type.micro, flex: 1 },
  badge: {
    borderWidth: stroke.hair,
    borderColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  badgeText: { ...type.micro, color: colors.warning },
  progress: { ...type.micro, color: colors.textMute },
  body: { padding: space.lg, paddingVertical: space.xl, gap: space.md },
  question: { ...type.card, color: colors.text },
  codeBlock: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: space.md,
    paddingLeft: space.lg,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  codeRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primary,
  },
  code: {
    ...type.small,
    color: colors.textDim,
    fontFamily: fonts.mono,
  },
});
