import promptData from '../../src/ai/cardPrompt.json' with { type: 'json' };

export const CARD_SYSTEM_PROMPT = promptData.systemPrompt;

function numbered(items, limit) {
  if (!Array.isArray(items) || items.length === 0) return '（无）';
  return items
    .slice(0, limit)
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');
}

export function buildCardGenerationPrompt(input) {
  return promptData.userTemplate
    .replace('{{deckName}}', input.deckName)
    .replace('{{topicName}}', input.topicName)
    .replace('{{point}}', input.point)
    .replace('{{type}}', input.type)
    .replace('{{difficulty}}', String(input.difficulty))
    .replace('{{existingStems}}', numbered(input.existingStems, 20))
    .replace('{{examples}}', JSON.stringify(input.examples ?? [], null, 2));
}
