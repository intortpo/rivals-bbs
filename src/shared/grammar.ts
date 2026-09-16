/**
 * Present Continuous Grammar Engine
 * Rule: Subject + [am / is / are] + [verb]-ing
 * Used for actions occurring right now, temporary situations, and ongoing processes.
 */

export interface GrammarQuestion {
  id: string;
  prompt: string;
  highlightVerb?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: 'auxiliary' | 'spelling' | 'negative' | 'question' | 'context';
}

export const PRESENT_CONTINUOUS_BANK: GrammarQuestion[] = [
  // 1. Auxiliary Verb Selection (am / is / are)
  {
    id: 'pc-aux-1',
    prompt: 'I ___ (reload) my assault rifle right now!',
    options: ['is reloading', 'are reloading', 'am reloading', 'reloading'],
    correctIndex: 2,
    explanation: 'With subject "I", use "am" + verb-ing ("am reloading").',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-2',
    prompt: 'Look! The enemy sniper ___ (aim) from the rooftop!',
    options: ['is aiming', 'are aiming', 'aims', 'am aiming'],
    correctIndex: 0,
    explanation: 'With singular subject "The enemy sniper", use "is" + verb-ing ("is aiming").',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-3',
    prompt: 'They ___ (run) toward the central fountain plaza.',
    options: ['is running', 'runs', 'am running', 'are running'],
    correctIndex: 3,
    explanation: 'With subject "They", use "are" + verb-ing ("are running").',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-4',
    prompt: 'We ___ (take) cover behind the yellow bus.',
    options: ['is taking', 'are taking', 'am taking', 'taking'],
    correctIndex: 1,
    explanation: 'With plural subject "We", use "are" + verb-ing ("are taking").',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-5',
    prompt: 'Listen! The alarm ___ (ring) across the city.',
    options: ['are ringing', 'am ringing', 'is ringing', 'rings'],
    correctIndex: 2,
    explanation: 'Singular subject "The alarm" requires "is" + verb-ing.',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-6',
    prompt: 'You ___ (stand) right in the line of fire!',
    options: ['is standing', 'am standing', 'standing', 'are standing'],
    correctIndex: 3,
    explanation: 'Subject "You" always pairs with "are" in present continuous.',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-7',
    prompt: 'The helicopter ___ (hover) above the tall building.',
    options: ['are hovering', 'is hovering', 'hovering', 'am hovering'],
    correctIndex: 1,
    explanation: 'Singular noun "The helicopter" takes "is" + verb-ing.',
    category: 'auxiliary'
  },
  {
    id: 'pc-aux-8',
    prompt: 'Both players ___ (fight) for the control point.',
    options: ['are fighting', 'is fighting', 'fighting', 'am fighting'],
    correctIndex: 0,
    explanation: 'Plural subject "Both players" takes "are" + verb-ing.',
    category: 'auxiliary'
  },

  // 2. Spelling Rules: Drop -e, Double Consonant, -ie to -y
  {
    id: 'pc-spell-1',
    prompt: 'The champion is ___ (slide) under the barrier.',
    options: ['slideing', 'slidding', 'slides', 'sliding'],
    correctIndex: 3,
    explanation: 'Verbs ending in silent "-e" drop the "e" before adding "-ing" (slide -> sliding).',
    category: 'spelling'
  },
  {
    id: 'pc-spell-2',
    prompt: 'The scout is ___ (run) as fast as possible.',
    options: ['runing', 'running', 'runned', 'runs'],
    correctIndex: 1,
    explanation: 'One-syllable verbs with consonant-vowel-consonant double the last letter (run -> running).',
    category: 'spelling'
  },
  {
    id: 'pc-spell-3',
    prompt: 'She is ___ (make) a new tactical plan.',
    options: ['makeing', 'makking', 'making', 'makes'],
    correctIndex: 2,
    explanation: 'Drop the final silent "-e": make -> making.',
    category: 'spelling'
  },
  {
    id: 'pc-spell-4',
    prompt: 'He is ___ (stop) to pick up more ammo.',
    options: ['stopping', 'stoping', 'stoppping', 'stops'],
    correctIndex: 0,
    explanation: 'Short vowel before single consonant doubles the consonant (stop -> stopping).',
    category: 'spelling'
  },
  {
    id: 'pc-spell-5',
    prompt: 'The cat is ___ (lie) down in the shade.',
    options: ['lieing', 'lying', 'laying', 'liing'],
    correctIndex: 1,
    explanation: 'Verbs ending in "-ie" change "-ie" to "-y" + "-ing" (lie -> lying).',
    category: 'spelling'
  },
  {
    id: 'pc-spell-6',
    prompt: 'They are ___ (begin) the final round.',
    options: ['begining', 'beging', 'begins', 'beginning'],
    correctIndex: 3,
    explanation: 'Two-syllable verb with stress on the second syllable doubles the final consonant (begin -> beginning).',
    category: 'spelling'
  },
  {
    id: 'pc-spell-7',
    prompt: 'I am ___ (write) instructions in team chat.',
    options: ['writeing', 'writting', 'writing', 'writes'],
    correctIndex: 2,
    explanation: 'Drop the silent "-e" before adding "-ing" (write -> writing).',
    category: 'spelling'
  },

  // 3. Negatives (am not / is not / are not)
  {
    id: 'pc-neg-1',
    prompt: 'Careful! He ___ (not look) at the radar.',
    options: ['is not looking', 'are not looking', 'not looking', 'does not looking'],
    correctIndex: 0,
    explanation: 'Negative present continuous for singular subject is "is not" + verb-ing.',
    category: 'negative'
  },
  {
    id: 'pc-neg-2',
    prompt: 'We ___ (not retreat) from this match!',
    options: ['is not retreating', 'are not retreating', 'not retreating', 'am not retreating'],
    correctIndex: 1,
    explanation: 'Negative form with "We" is "are not" + verb-ing.',
    category: 'negative'
  },
  {
    id: 'pc-neg-3',
    prompt: 'I ___ (not waste) any shotgun shells.',
    options: ['is not wasting', 'are not wasting', 'not wasting', 'am not wasting'],
    correctIndex: 3,
    explanation: 'Negative form with "I" is "am not" + verb-ing.',
    category: 'negative'
  },
  {
    id: 'pc-neg-4',
    prompt: 'The drones ___ (not patrol) Sector B right now.',
    options: ['is not patrolling', 'do not patrolling', 'are not patrolling', 'not patrolling'],
    correctIndex: 2,
    explanation: 'Plural subject "The drones" takes "are not" + verb-ing.',
    category: 'negative'
  },

  // 4. Questions & Interrogatives
  {
    id: 'pc-q-1',
    prompt: '___ you ___ (watch) the north street?',
    options: ['Is / watching', 'Are / watching', 'Do / watching', 'Are / watch'],
    correctIndex: 1,
    explanation: 'Question form with "you": "Are" + subject + verb-ing.',
    category: 'question'
  },
  {
    id: 'pc-q-2',
    prompt: 'What ___ the team leader ___ (do) over there?',
    options: ['is / doing', 'are / doing', 'does / doing', 'is / do'],
    correctIndex: 0,
    explanation: 'Singular subject "the team leader" requires "is" in question form.',
    category: 'question'
  },
  {
    id: 'pc-q-3',
    prompt: 'Where ___ they ___ (hide) right now?',
    options: ['is / hiding', 'do / hiding', 'are / hiding', 'are / hide'],
    correctIndex: 2,
    explanation: 'Plural subject "they" takes "are" + subject + verb-ing ("are they hiding").',
    category: 'question'
  },
  {
    id: 'pc-q-4',
    prompt: '___ your jump pad ___ (charge) up?',
    options: ['Are / charging', 'Does / charging', 'Is / chargeing', 'Is / charging'],
    correctIndex: 3,
    explanation: 'Singular noun "your jump pad" requires "Is" + verb-ing ("charging").',
    category: 'question'
  },

  // 5. Contextual & Everyday Usage
  {
    id: 'pc-ctx-1',
    prompt: 'At the moment, our squad ___ (win) the battle!',
    options: ['is winning', 'are winning', 'winning', 'wins'],
    correctIndex: 0,
    explanation: 'Singular collective noun "our squad" takes "is winning". Note double "n" in winning.',
    category: 'context'
  },
  {
    id: 'pc-ctx-2',
    prompt: 'Look outside! It ___ (rain) heavily on the cartoon city.',
    options: ['are raining', 'is raining', 'raining', 'rains'],
    correctIndex: 1,
    explanation: 'With impersonal "It", use "is raining".',
    category: 'context'
  },
  {
    id: 'pc-ctx-3',
    prompt: 'The students ___ (study) English grammar while playing.',
    options: ['is studying', 'studying', 'are studying', 'studies'],
    correctIndex: 2,
    explanation: 'Plural subject "The students" takes "are studying".',
    category: 'context'
  },
  {
    id: 'pc-ctx-4',
    prompt: 'Hurry! The match clock ___ (count) down fast!',
    options: ['is counting', 'are counting', 'am counting', 'counts'],
    correctIndex: 0,
    explanation: '"The match clock" is singular: "is counting".',
    category: 'context'
  }
];

/**
 * Shuffles the options of a grammar question using Fisher-Yates and updates correctIndex.
 */
export function shuffleQuestionOptions(q: GrammarQuestion): GrammarQuestion {
  const correctOptionText = q.options[q.correctIndex];
  const shuffledOptions = [...q.options];

  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffledOptions[i];
    shuffledOptions[i] = shuffledOptions[j];
    shuffledOptions[j] = temp;
  }

  const newCorrectIndex = shuffledOptions.indexOf(correctOptionText);

  return {
    ...q,
    options: shuffledOptions,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0
  };
}

/**
 * Returns a randomized set of N unique Present Continuous grammar questions
 * with unpredictably shuffled multiple-choice options.
 */
export function getRandomGrammarQuestions(count: number = 2): GrammarQuestion[] {
  const shuffled = [...PRESENT_CONTINUOUS_BANK].sort(() => Math.random() - 0.5);
  return shuffled
    .slice(0, Math.min(count, shuffled.length))
    .map((q) => shuffleQuestionOptions(q));
}

/**
 * Validates player answer and returns result with explanatory feedback.
 * Accepts either a question ID (string) or an active GrammarQuestion instance.
 */
export function evaluateAnswer(
  questionOrId: string | GrammarQuestion,
  selectedIndex: number
): {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
} {
  let targetQ: GrammarQuestion | undefined;

  if (typeof questionOrId === 'object' && questionOrId !== null) {
    targetQ = questionOrId;
  } else if (typeof questionOrId === 'string') {
    targetQ = PRESENT_CONTINUOUS_BANK.find((item) => item.id === questionOrId);
  }

  if (!targetQ) {
    return {
      isCorrect: false,
      correctIndex: 0,
      explanation: 'Question not found.'
    };
  }

  const isCorrect = selectedIndex === targetQ.correctIndex;
  return {
    isCorrect,
    correctIndex: targetQ.correctIndex,
    explanation: targetQ.explanation
  };
}
