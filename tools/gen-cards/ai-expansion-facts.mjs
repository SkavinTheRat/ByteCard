import { llmBasicFacts } from './ai-expansion-facts-llm-basic.mjs';
import { llmAdvancedFacts } from './ai-expansion-facts-llm-advanced.mjs';
import { agentBasicFacts } from './ai-expansion-facts-agent-basic.mjs';
import { agentAdvancedFacts } from './ai-expansion-facts-agent-advanced.mjs';

export const expansionFacts = {
  'llm-basic': llmBasicFacts,
  'llm-advanced': llmAdvancedFacts,
  'agent-basic': agentBasicFacts,
  'agent-advanced': agentAdvancedFacts,
};
