import { registerCard } from './registry';
import { singleDefinition } from './types/single/definition';
import { multiDefinition } from './types/multi/definition';
import { fillDefinition } from './types/fill/definition';

registerCard(singleDefinition);
registerCard(multiDefinition);
registerCard(fillDefinition);

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
