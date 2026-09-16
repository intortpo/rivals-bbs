import { PRESENT_CONTINUOUS_BANK, getRandomGrammarQuestions, evaluateAnswer } from '../src/shared/grammar.js';

console.log('🧪 Running Present Continuous Grammar Engine Tests...');

// 1. Question bank integrity
if (PRESENT_CONTINUOUS_BANK.length < 20) {
  console.error(`❌ Expected at least 20 questions, got ${PRESENT_CONTINUOUS_BANK.length}`);
  process.exit(1);
}
console.log(`✓ Question bank contains ${PRESENT_CONTINUOUS_BANK.length} curated questions`);

// 2. Validate every question has 4 options, valid correctIndex, and explanation
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
}
console.log('✓ All questions have valid options, correct indexes, and explanations');

// 3. Test random sampler
const sample2 = getRandomGrammarQuestions(2);
if (sample2.length !== 2 || sample2[0].id === sample2[1].id) {
  console.error('❌ getRandomGrammarQuestions(2) failed to return 2 unique questions');
  process.exit(1);
}
console.log(`✓ Sampled 2 unique questions: "${sample2[0].prompt}" & "${sample2[1].prompt}"`);

// 4. Test answer evaluation
const q1 = PRESENT_CONTINUOUS_BANK[0];
const correctRes = evaluateAnswer(q1.id, q1.correctIndex);
if (!correctRes.isCorrect) {
  console.error('❌ evaluateAnswer failed on correct index');
  process.exit(1);
}

const wrongRes = evaluateAnswer(q1.id, (q1.correctIndex + 1) % 4);
if (wrongRes.isCorrect || !wrongRes.explanation) {
  console.error('❌ evaluateAnswer failed on incorrect index');
  process.exit(1);
}
console.log('✓ Evaluation correctly validates correct/incorrect answers with explanations');

console.log('🎉 ALL GRAMMAR ENGINE TESTS PASSED CLEANLY!\n');
