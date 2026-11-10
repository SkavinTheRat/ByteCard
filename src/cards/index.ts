import { registerCard } from './registry';
import { singleDefinition } from './types/single/definition';
import { multiDefinition } from './types/multi/definition';
import { fillDefinition } from './types/fill/definition';
import { judgeDefinition } from './types/judge/definition';

registerCard(singleDefinition);
registerCard(multiDefinition);
registerCard(fillDefinition);
registerCard(judgeDefinition);

export {
  draftToIndices,
  draftToText,
  getCardDef,
  isSupportedType,
  registerCard,
} from './registry';
export type {
  AnswerViewProps,
  CardDefinition,
  GradeResult,
  RawAnswer,
} from './registry';
