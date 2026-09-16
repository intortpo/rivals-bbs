import { PRESENT_CONTINUOUS_BANK, getRandomGrammarQuestions, evaluateAnswer, shuffleQuestionOptions } from '../src/shared/grammar.js';

console.log('🧪 Running Present Continuous Grammar Engine Tests...');

// 1. Question bank integrity
if (PRESENT_CONTINUOUS_BANK.length < 20) {
  console.error(`❌ Expected at least 20 questions, got ${PRESENT_CONTINUOUS_BANK.length}`);
  process.exit(1);
}
console.log(`✓ Question bank contains ${PRESENT_CONTINUOUS_BANK.length} curated questions`);

// 2. Validate every question has 4 options, valid correctIndex, and explanation
const staticDistribution = [0, 0, 0, 0];
for (const q of PRESENT_CONTINUOUS_BANK) {
  if (!q.id || !q.prompt || !q.explanation) {
    console.error(`❌ Invalid question format: ${JSON.stringify(q)}`);
    process.exit(1);
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    console.error(`❌ Question ${q.id} must have exactly 4 options`);
    process.exit(1);
  }
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
    console.error(`❌ Question ${q.id} has out-of-bounds correctIndex`);
    process.exit(1);
  }
  staticDistribution[q.correctIndex]++;
}
console.log('✓ All questions have valid options, correct indexes, and explanations');

// 3. Verify static question bank answer distribution is balanced across choices A, B, C, D
console.log(`📊 Static Bank Answer Distribution: A(0)=${staticDistribution[0]}, B(1)=${staticDistribution[1]}, C(2)=${staticDistribution[2]}, D(3)=${staticDistribution[3]}`);
for (let i = 0; i < 4; i++) {
  if (staticDistribution[i] === 0) {
    console.error(`❌ Static bank has 0 questions with choice index ${i}`);
    process.exit(1);
  }
  const ratio = staticDistribution[i] / PRESENT_CONTINUOUS_BANK.length;
  if (ratio > 0.40) {
    console.error(`❌ Static bank choice index ${i} dominates with ${(ratio * 100).toFixed(1)}% of questions`);
    process.exit(1);
  }
}
console.log('✓ Static question bank has balanced answer distribution (no choice exceeds 40%)');

// 4. Test random sampler uniqueness and runtime option shuffling
const sample2 = getRandomGrammarQuestions(2);
if (sample2.length !== 2 || sample2[0].id === sample2[1].id) {
  console.error('❌ getRandomGrammarQuestions(2) failed to return 2 unique questions');
  process.exit(1);
}
console.log(`✓ Sampled 2 unique questions: "${sample2[0].prompt}" & "${sample2[1].prompt}"`);

// 5. Test runtime Fisher-Yates option shuffling distribution across 200 random samples
const sampledDistribution = [0, 0, 0, 0];
const sampleRuns = 200;
for (let i = 0; i < sampleRuns; i++) {
  const [sampledQ] = getRandomGrammarQuestions(1);
  sampledDistribution[sampledQ.correctIndex]++;
  
  // Verify the shuffled question still evaluates correctly with its own correctIndex
  const evalSelf = evaluateAnswer(sampledQ, sampledQ.correctIndex);
  if (!evalSelf.isCorrect) {
    console.error(`❌ Shuffled question ${sampledQ.id} failed self-evaluation at correctIndex ${sampledQ.correctIndex}`);
    process.exit(1);
  }
  
  // Verify wrong index fails
  const wrongIdx = (sampledQ.correctIndex + 1) % 4;
  const evalWrong = evaluateAnswer(sampledQ, wrongIdx);
  if (evalWrong.isCorrect) {
    console.error(`❌ Shuffled question ${sampledQ.id} incorrectly passed at wrong index ${wrongIdx}`);
    process.exit(1);
  }
}
console.log(`📊 Runtime Sampled Distribution (N=${sampleRuns}): A(0)=${sampledDistribution[0]}, B(1)=${sampledDistribution[1]}, C(2)=${sampledDistribution[2]}, D(3)=${sampledDistribution[3]}`);
for (let i = 0; i < 4; i++) {
  if (sampledDistribution[i] === 0) {
    console.error(`❌ Choice index ${i} was never selected in ${sampleRuns} randomized samples`);
    process.exit(1);
  }
}
console.log('✓ Runtime option shuffling produces dynamic distribution across all choices (A, B, C, D)');

// 6. Test polymorphic answer evaluation (by string ID and by GrammarQuestion object)
const q1 = PRESENT_CONTINUOUS_BANK[0];
// By string ID:
const correctResById = evaluateAnswer(q1.id, q1.correctIndex);
if (!correctResById.isCorrect) {
  console.error('❌ evaluateAnswer failed on string ID with correct index');
  process.exit(1);
}
const wrongResById = evaluateAnswer(q1.id, (q1.correctIndex + 1) % 4);
if (wrongResById.isCorrect || !wrongResById.explanation) {
  console.error('❌ evaluateAnswer failed on string ID with incorrect index');
  process.exit(1);
}

// By GrammarQuestion object:
const shuffledQ1 = shuffleQuestionOptions(q1);
const correctResByObj = evaluateAnswer(shuffledQ1, shuffledQ1.correctIndex);
if (!correctResByObj.isCorrect) {
  console.error('❌ evaluateAnswer failed on GrammarQuestion object with correct index');
  process.exit(1);
}
const wrongResByObj = evaluateAnswer(shuffledQ1, (shuffledQ1.correctIndex + 1) % 4);
if (wrongResByObj.isCorrect || !wrongResByObj.explanation) {
  console.error('❌ evaluateAnswer failed on GrammarQuestion object with incorrect index');
  process.exit(1);
}
console.log('✓ Evaluation correctly validates both string questionId and dynamic GrammarQuestion objects');

console.log('🎉 ALL GRAMMAR ENGINE TESTS PASSED CLEANLY!\n');
