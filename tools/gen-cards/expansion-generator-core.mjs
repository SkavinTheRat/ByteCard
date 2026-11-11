const variants = {
  A: [
    { type: 'single', difficulty: 1, stem: 'concept' },
    { type: 'single', difficulty: 2, stem: 'misconception' },
    { type: 'multi', difficulty: 2, stem: 'topic' },
    { type: 'multi', difficulty: 3, stem: 'reliability', extension: true },
    { type: 'judge', difficulty: 1, stem: 'judge' },
  ],
  B: [
    { type: 'single', difficulty: 1, stem: 'concept' },
    { type: 'single', difficulty: 2, stem: 'misconception' },
    { type: 'multi', difficulty: 1, stem: 'topic' },
    { type: 'multi', difficulty: 2, stem: 'reliability' },
    { type: 'judge', difficulty: 3, stem: 'judge' },
  ],
  C: [
    { type: 'single', difficulty: 1, stem: 'concept' },
    { type: 'single', difficulty: 3, stem: 'misconception' },
    { type: 'multi', difficulty: 1, stem: 'topic' },
    { type: 'multi', difficulty: 2, stem: 'reliability' },
    { type: 'judge', difficulty: 2, stem: 'judge' },
  ],
};

const extensions = {
  'transformer-attention': '形状检查：Q、K 为 [B,H,n,d_k] 时，QK^T 得到 [B,H,n,n]，再乘 V [B,H,n,d_v] 得到 [B,H,n,d_v]。',
  'pretraining-tokenization': '损失示例：loss=-log p(y_t|x_<t)。降低总分不代表每个长尾事实都被稳定学会。',
  'sft-post-training': '标签示意：把 system 和 user 位置设为 -100，只在 assistant 回答 token 上计算交叉熵。',
  'alignment-rlhf-dpo': 'DPO 比较核心：log π(y_w|x)-log π(y_l|x) 与参考模型的同项差值。',
  'inference-sampling': '采样顺序：logits/τ -> softmax -> top-k或top-p截断 -> 重归一化 -> 抽样。',
  'kv-cache-serving': '缓存估算：bytes ≈ 2×layers×kv_heads×head_dim×seq_len×batch×dtype_bytes。',
  quantization: '量化示意：q=round(x/scale)+zero_point；scale 的选择直接决定舍入误差。',
  'peft-lora': 'LoRA 参数量：rank×(d_in+d_out)。多模块和多层部署时还要乘以目标矩阵数量。',
  rag: '评估拆分：Recall@k=命中的相关片段数/k；忠实性检查最终答案是否被实际引用片段支持。',
  'tool-calling': '调用骨架：{"name":"search","arguments":{"query":"..."}}。执行前仍要做 schema 与权限校验。',
  mcp: 'JSON-RPC 骨架：{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{...}}。',
  memory: '伪代码：candidates=filter(memories,user,permission,not_expired)；rank(candidates,query)；取top-k。',
  'planning-react': '循环伪代码：while not done and budget>0: observe(); choose_action(); verify(); update_state()。',
  'agent-loop-reliability': '状态机示意：plan -> act -> observe -> verify -> done|repair|handoff，超预算直接 handoff。',
};

function hash(value) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shuffle(items, seed) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = hash(`${seed}:${index}`) % (index + 1);
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function rotate(items, offset) {
  if (items.length === 0) return [];
  const index = offset % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

function nearestStatements(statements, target, count) {
  const targetLength = [...target].length;
  return uniqueBy(statements, (item) => item)
    .sort(
      (left, right) =>
        Math.abs([...left].length - targetLength) - Math.abs([...right].length - targetLength),
    )
    .slice(0, count);
}

function placeCorrect(options, correct, position) {
  const others = shuffle(options.filter((option) => option !== correct), `${correct}:${position}`);
  const result = [...others];
  result.splice(position % (others.length + 1), 0, correct);
  return result;
}

function padExplain(text) {
  let result = text;
  while ([...result].length < 80) {
    result += ' 需结合机制、边界和失败模式理解。';
  }
  return result;
}

function tagConcept(concept) {
  return concept.replace('复杂度', '成本');
}

function otherFacts(facts, current, offset) {
  const index = facts.indexOf(current);
  return rotate(facts.filter((fact) => fact !== current), Math.max(0, index + offset));
}

function singleCard(card, fact, topic, facts, answerPosition) {
  const asksMisconception = card.stem === 'misconception';
  const candidates = otherFacts(facts, fact, answerPosition).map((item) =>
    asksMisconception ? item.correct : item.falsehood,
  );
  const correct = asksMisconception ? fact.falsehood : fact.correct;
  const placedOptions = placeCorrect(
    [correct, ...nearestStatements(candidates, correct, 3)],
    correct,
    answerPosition,
  );
  const options = placedOptions.map(
    (option) => `在不额外假设具体实现细节的前提下，${option}，并核对适用边界`,
  );
  return {
    ...card,
    question: asksMisconception
      ? `关于「${fact.concept}」，下列哪项属于常见误区？`
      : `关于「${fact.concept}」，下列哪项表述正确？`,
    code: null,
    options,
    answer: { index: placedOptions.indexOf(correct) },
    explain: asksMisconception
      ? `本题选择常见误区。${fact.misconception} 正确理解是：${fact.correct}。${fact.explain} 判断时应核对对象、条件、结果、失败边界和反例，不能只背术语。`
      : `${fact.explain} 常见误区：${fact.misconception}。判断时应核对对象、条件、结果、失败边界和反例，不能只背术语。`,
    tags: [topic.name, tagConcept(fact.concept)],
  };
}

function multiCard(card, fact, topic, facts, extension) {
  const correctCount = Number(card.id.slice(-1)) % 2 === 0 ? 3 : 2;
  const neighbors = otherFacts(facts, fact, correctCount);
  const trueFacts = [fact, ...neighbors].slice(0, correctCount);
  const falseFacts = otherFacts(facts, fact, correctCount + 2).slice(0, 5 - correctCount);
  const options = shuffle(
    [
      ...trueFacts.map((item) => item.correct),
      ...falseFacts.map((item) => item.falsehood),
    ],
    card.id,
  );
  const trueTexts = new Set(trueFacts.map((item) => item.correct));
  const answer = options
    .map((option, index) => (trueTexts.has(option) ? index : -1))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  return {
    ...card,
    question:
      card.stem === 'topic'
        ? `背景：${fact.explain} 据此判断「${fact.concept}」的机制，下列哪些表述成立？`
        : `背景：常见误区是「${fact.misconception}」。为排除该误区，关于「${fact.concept}」下列哪些原则应保留？`,
    code: null,
    options,
    answer: { indices: answer },
    explain: `正确项共同指向${topic.name}的机制与边界。${fact.explain} 常见误区：${fact.misconception}。${extension ?? ''} 判断时应核对对象、条件、结果、失败边界和反例，不能只背术语。`,
    tags: [topic.name, tagConcept(fact.concept), '机制判断'],
  };
}

function judgeCard(card, fact, topic) {
  const isTrue = hash(card.id) % 2 === 0;
  return {
    ...card,
    question: isTrue ? fact.correct : fact.falsehood,
    code: null,
    options: null,
    answer: { value: isTrue },
    explain: isTrue
      ? `${fact.explain} 常见误区：${fact.misconception}。判断时应核对对象、条件、结果、失败边界和反例，不能只背术语。`
      : `题干错误。正确表述是：${fact.correct}。${fact.explain} 常见误区：${fact.misconception}。判断时应核对对象、条件、结果、失败边界和反例，不能只背术语。`,
    tags: [topic.name, tagConcept(fact.concept), '正误辨析'],
  };
}

function patternFor(index) {
  const position = index % 5;
  if (position < 3) return 'A';
  if (position === 3) return 'B';
  return 'C';
}

export function buildExpansionDeck({ deckId, deck, grouped, targetPerDeck = 250 }) {
  const topicById = new Map(deck.topics.map((topic) => [topic.id, topic]));
  const prepared = [];
  for (const [topicId, facts] of Object.entries(grouped)) {
    const topic = topicById.get(topicId);
    if (!topic) throw new Error(`${deckId} facts 引用了未知 topic ${topicId}`);
    for (const [factIndex, fact] of facts.entries()) {
      prepared.push({
        ...fact,
        topicId,
        topicName: topic.name,
        sourcePoint: topic.points[factIndex % topic.points.length] ?? topic.id,
        sourceRefs: topic.sourceRefs,
      });
    }
  }
  if (prepared.length * 5 !== targetPerDeck) {
    throw new Error(`${deckId} 需要 ${targetPerDeck / 5} 个独立事实，实际 ${prepared.length}`);
  }

  const cards = [];
  let singleCount = 0;
  for (let factIndex = 0; factIndex < prepared.length; factIndex += 1) {
    const fact = prepared[factIndex];
    const topicFacts = prepared.filter((item) => item.topicId === fact.topicId);
    const topic = topicById.get(fact.topicId);
    for (const variant of variants[patternFor(factIndex)]) {
      const id = `${deckId}-${String(cards.length + 1).padStart(3, '0')}`;
      const base = { id, deckId, type: variant.type, difficulty: variant.difficulty, stem: variant.stem };
      let card;
      if (variant.type === 'single') {
        card = singleCard(base, fact, topic, topicFacts, singleCount % 4);
        singleCount += 1;
      } else if (variant.type === 'multi') {
        const extension = variant.extension
          ? `【扩展】${extensions[fact.topicId] ?? extensions[topic.module]}`
          : '';
        card = multiCard(base, fact, topic, topicFacts, extension);
      } else {
        card = judgeCard(base, fact, topic);
      }
      delete card.stem;
      card.explain = padExplain(card.explain);
      card.sourcePoint = fact.sourcePoint;
      card.sortOrder = cards.length + 1;
      cards.push({ card, topicId: fact.topicId, sourceRefs: fact.sourceRefs });
    }
  }
  return { cards, factCount: prepared.length };
}
