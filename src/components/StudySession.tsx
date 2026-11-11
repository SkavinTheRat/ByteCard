import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCardDef, type RawAnswer } from '@/cards';
import type { Card, Deck } from '@/types';
import { zh } from '@/i18n/zh';
import { useSessionStore } from '@/store/sessionStore';
import { colors, space } from '@/theme';
import { formatUserAnswer } from '@/utils/formatUserAnswer';
import { useSingleOptionOrder } from '@/hooks/useSingleOptionOrder';
import { AnswerPanel } from './AnswerPanel';
import { EndSessionSheet } from './EndSessionSheet';
import { KnowledgeCard } from './KnowledgeCard';
import { PrimaryButton } from './PrimaryButton';
import { StudyHeader } from './StudyHeader';
import { UnsupportedCard } from './UnsupportedCard';
import { studySessionStyles as styles } from './StudySessionStyles';

type StudySessionProps = {
  deck: Deck;
  onFinish: () => void;
  onExit: () => void;
};

export function StudySession({ deck, onFinish, onExit }: StudySessionProps) {
  const insets = useSafeAreaInsets();
  const queue = useSessionStore((state) => state.queue);
  const index = useSessionStore((state) => state.index);
  const phase = useSessionStore((state) => state.phase);
  const draft = useSessionStore((state) => state.draft);
  const result = useSessionStore((state) => state.result);
  const doneCount = useSessionStore((state) => state.doneCount);
  const setDraft = useSessionStore((state) => state.setDraft);
  const submit = useSessionStore((state) => state.submit);
  const next = useSessionStore((state) => state.next);
  const endSession = useSessionStore((state) => state.end);
  const [closeOpen, setCloseOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [animating, setAnimating] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const cardX = useSharedValue(0);
  const cardY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const currentCard = queue[index];
  const {
    order: singleOrder,
    displayCard: orderedCard,
    originalIndexForDisplay,
  } = useSingleOptionOrder(currentCard);

  useEffect(() => {
    if (phase !== 'revealed') {
      return;
    }
    setElapsedMs(Date.now() - useSessionStore.getState().startedAt);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 220);
    return () => clearTimeout(timer);
  }, [phase]);

  const advance = useCallback(() => {
    if (index + 1 >= queue.length) {
      endSession();
      onFinish();
    } else {
      next();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
    cardX.value = 0;
    cardY.value = 0;
    cardOpacity.value = 1;
    setAnimating(false);
  }, [cardOpacity, cardX, cardY, endSession, index, next, onFinish, queue.length]);

  function moveNext() {
    if (animating || phase !== 'revealed') {
      return;
    }
    setAnimating(true);
    if (result?.isCorrect) {
      cardY.value = withTiming(-12, { duration: 260 });
      cardOpacity.value = withTiming(0, { duration: 260 }, (finished) => {
        if (finished) {
          runOnJS(advance)();
        }
});
      return;
    }
    cardX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 60 }),
    );
    cardOpacity.value = withDelay(
      180,
      withTiming(0, { duration: 140 }, (finished) => {
        if (finished) {
          runOnJS(advance)();
        }
      }),
    );
  }

  function requestClose() {
    if (doneCount > 0) {
      setCloseOpen(true);
    } else {
      endSession();
      onExit();
    }
  }

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardX.value }, { translateY: cardY.value }],
  }));

  if (!currentCard) {
    return null;
  }
  const originalCard = currentCard;
  const displayCard: Card = orderedCard ?? originalCard;
  const definition = getCardDef(originalCard.type);
  const isLast = index + 1 >= queue.length;

  function submitFromDisplay(raw: RawAnswer) {
    if (originalCard.type === 'single' && singleOrder && raw.kind === 'index') {
      const originalIndex = originalIndexForDisplay(raw.value);
      if (originalIndex === undefined) {
        return;
      }
      void submit({ kind: 'index', value: originalIndex });
      return;
    }
    void submit(raw);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.headerWrap}>
          <StudyHeader
            deck={deck}
            position={index + 1}
            total={queue.length}
            onClose={requestClose}
          />
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={animatedCardStyle}>
            <KnowledgeCard
              accent={deck.accent}
              card={displayCard}
              deckCode={deck.code}
              position={index + 1}
              total={queue.length}
            />
          </Animated.View>
          {definition ? (
            <definition.AnswerView
              card={displayCard}
              phase={phase}
              draft={draft}
              result={result}
              onDraftChange={setDraft}
              onSubmit={submitFromDisplay}
              onInputFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 180);
              }}
            />
          ) : (
            <UnsupportedCard
              card={currentCard}
            onSkip={() => {
              if (isLast) {
                endSession();
                onFinish();
              } else {
                next();
              }
            }}
            />
          )}
          {phase === 'revealed' && result ? (
            <AnswerPanel
              card={currentCard}
              elapsedMs={elapsedMs}
              explain={currentCard.explain}
              result={result}
              tags={currentCard.tags}
              userAnswer={formatUserAnswer(displayCard, draft)}
            />
          ) : null}
        </ScrollView>
        {phase === 'revealed' ? (
          <View
            style={[
              styles.bottom,
              { paddingBottom: Math.max(insets.bottom, space.lg) },
            ]}
          >
            <PrimaryButton
              label={isLast ? zh.study.finish : zh.study.next}
              onPress={moveNext}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <EndSessionSheet
        doneCount={doneCount}
        visible={closeOpen}
        onEnd={() => {
          setCloseOpen(false);
          endSession();
          onFinish();
        }}
        onKeepLearning={() => setCloseOpen(false)}
      />
    </SafeAreaView>
  );
}
