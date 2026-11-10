import promptData from './cardPrompt.json';

export const CARD_SYSTEM_PROMPT = promptData.systemPrompt;

export type CardPromptInput = {
  deckName: string;
  topicName: string;
  point: string;
  type: 'single' | 'multi' | 'fill' | 'judge';
  difficulty: 1 | 2 | 3;
  existingStems: string[];
  examples: unknown[];
};

export function buildCardGenerationPrompt(input: CardPromptInput): string {
  const stems = input.existingStems.length
    ? input.existingStems
        .slice(0, 20)
        .map((item, index) => `${index + 1}. ${item}`)
        .join('\n')
    : '（无）';
  return promptData.userTemplate
    .replace('{{deckName}}', input.deckName)
    .replace('{{topicName}}', input.topicName)
    .replace('{{point}}', input.point)
    .replace('{{type}}', input.type)
    .replace('{{difficulty}}', String(input.difficulty))
    .replace('{{existingStems}}', stems)
    .replace('{{examples}}', JSON.stringify(input.examples, null, 2));
}
