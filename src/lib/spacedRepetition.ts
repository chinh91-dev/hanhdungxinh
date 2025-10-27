export type Difficulty = 'again' | 'hard' | 'good' | 'easy';

export interface SpacedRepetitionResult {
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: Date;
}

export function calculateNextReview(
  currentEase: number,
  currentInterval: number,
  currentRepetitions: number,
  difficulty: Difficulty
): SpacedRepetitionResult {
  let ease = currentEase;
  let interval = currentInterval;
  let repetitions = currentRepetitions;

  switch (difficulty) {
    case 'again':
      interval = 1;
      repetitions = 0;
      ease = Math.max(1.3, ease - 0.2);
      break;
    case 'hard':
      interval = Math.round(interval * 1.2);
      repetitions += 1;
      ease = Math.max(1.3, ease - 0.15);
      break;
    case 'good':
      interval = Math.round(interval * ease);
      repetitions += 1;
      break;
    case 'easy':
      interval = Math.round(interval * ease * 1.3);
      repetitions += 1;
      ease = Math.min(2.5, ease + 0.15);
      break;
  }

  const next_review = new Date();
  next_review.setDate(next_review.getDate() + interval);

  return {
    ease_factor: ease,
    interval,
    repetitions,
    next_review
  };
}