import topicsData from '../../assets/data/topics.json';
import { getDeckTagAccuracy } from '@/db/statsRepository';

export type SyllabusTopic = {
  id: string;
  deckId: string;
  name: string;
  points: string[];
};

type TopicsFile = { version: number; topics: SyllabusTopic[] };

const topics = (topicsData as TopicsFile).topics;

export function listTopics(deckId?: string): SyllabusTopic[] {
  return deckId ? topics.filter((topic) => topic.deckId === deckId) : [...topics];
}

export function getTopic(topicId: string | undefined): SyllabusTopic | undefined {
  return topicId ? topics.find((topic) => topic.id === topicId) : undefined;
}

export async function findWeakestTopic(deckId: string): Promise<SyllabusTopic | undefined> {
  const candidates = listTopics(deckId);
  if (candidates.length === 0) {
    return undefined;
  }
  const tagStats = await getDeckTagAccuracy(deckId).catch(() => []);
  const scored = candidates.map((topic) => {
    const related = tagStats.filter((item) =>
      topic.points.some(
        (point) => point.includes(item.tag) || item.tag.includes(topic.name),
      ),
    );
    const done = related.reduce((sum, item) => sum + item.done, 0);
    const correct = related.reduce((sum, item) => sum + item.correct, 0);
    return {
      topic,
      done,
      accuracy: done > 0 ? correct / done : Number.POSITIVE_INFINITY,
    };
  });
  scored.sort((a, b) => a.accuracy - b.accuracy || b.done - a.done);
  return scored[0]?.topic ?? candidates[0];
}
