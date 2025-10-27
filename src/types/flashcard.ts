export type CardType = 'term' | 'question';

export interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  card_count: number;
}

export interface Card {
  id: string;
  set_id: string;
  front: string;
  back: string;
  card_type: CardType;
  order_index: number;
  created_at: string;
}

export interface CardProgress {
  id: string;
  card_id: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
}

export interface StudySession {
  id: string;
  set_id: string;
  mode: 'flashcards' | 'learn' | 'spaced';
  started_at: string;
  ended_at: string | null;
  cards_studied: number;
  correct_count: number;
  accuracy: number | null;
}