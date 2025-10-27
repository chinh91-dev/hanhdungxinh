import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardProgress } from '@/types/flashcard';
import { supabase } from '@/integrations/supabase/client';
import { calculateNextReview, Difficulty } from '@/lib/spacedRepetition';
import { format } from 'date-fns';

interface SpacedModeProps {
  cards: Card[];
  setId: string;
}

const SpacedMode = ({ cards, setId }: SpacedModeProps) => {
  const [dueCards, setDueCards] = useState<(Card & { progress: CardProgress })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    loadDueCards();
    startSession();
  }, []);

  const startSession = async () => {
    const { data } = await supabase
      .from('study_sessions')
      .insert({ set_id: setId, mode: 'spaced' })
      .select()
      .single();
    if (data) setSessionId(data.id);
  };

  const loadDueCards = async () => {
    try {
      // Get all cards with their progress
      const { data: cardsData } = await supabase
        .from('cards')
        .select('*, card_progress(*)')
        .eq('set_id', setId);

      if (!cardsData) return;

      const now = new Date();
      const due: (Card & { progress: CardProgress })[] = [];

      for (const card of cardsData) {
        let progress = card.card_progress[0];

        // If no progress exists, create it
        if (!progress) {
          const { data: newProgress } = await supabase
            .from('card_progress')
            .insert({ card_id: card.id })
            .select()
            .single();
          progress = newProgress;
        }

        // Check if due for review
        if (new Date(progress.next_review) <= now) {
          const cardData: Card = {
            id: card.id,
            set_id: card.set_id,
            front: card.front,
            back: card.back,
            card_type: card.card_type as 'term' | 'question',
            order_index: card.order_index,
            created_at: card.created_at
          };
          due.push({ ...cardData, progress });
        }
      }

      setDueCards(due);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDifficulty = async (difficulty: Difficulty) => {
    const current = dueCards[currentIndex];
    const result = calculateNextReview(
      current.progress.ease_factor,
      current.progress.interval,
      current.progress.repetitions,
      difficulty
    );

    await supabase
      .from('card_progress')
      .update({
        ease_factor: result.ease_factor,
        interval: result.interval,
        repetitions: result.repetitions,
        next_review: result.next_review.toISOString(),
        last_reviewed: new Date().toISOString()
      })
      .eq('id', current.progress.id);

    setReviewedCount(reviewedCount + 1);
    setShowAnswer(false);

    if (currentIndex === dueCards.length - 1) {
      // End session
      if (sessionId) {
        await supabase
          .from('study_sessions')
          .update({
            ended_at: new Date().toISOString(),
            cards_studied: dueCards.length,
            correct_count: 0
          })
          .eq('id', sessionId);
      }
    }

    setCurrentIndex(currentIndex + 1);
  };

  if (loading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  if (dueCards.length === 0) {
    // Find next review date
    const nextDate = cards.length > 0 ? new Date() : null;
    return (
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold">All caught up! 🎉</h2>
        <p className="text-muted-foreground">
          No cards due for review right now.
        </p>
        {nextDate && (
          <p className="text-sm">
            Come back later to continue learning.
          </p>
        )}
      </div>
    );
  }

  if (currentIndex >= dueCards.length) {
    return (
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold">Review Complete! 🎉</h2>
        <p className="text-muted-foreground">
          You reviewed {reviewedCount} cards.
        </p>
        <Button onClick={() => window.location.reload()}>Review Again</Button>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Card {currentIndex + 1} of {dueCards.length} due
      </div>

      <div className="bg-card border rounded-lg p-8">
        <div className="text-sm uppercase text-muted-foreground mb-2">
          {currentCard.card_type === 'term' ? 'Term' : 'Question'}
        </div>
        <p className="text-2xl font-semibold mb-6">{currentCard.front}</p>

        {showAnswer && (
          <div className="mb-6 p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Answer:</p>
            <p className="text-lg">{currentCard.back}</p>
          </div>
        )}

        {!showAnswer ? (
          <Button onClick={() => setShowAnswer(true)}>Show Answer</Button>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button onClick={() => handleDifficulty('again')} variant="destructive">
              Again
            </Button>
            <Button onClick={() => handleDifficulty('hard')} variant="secondary">
              Hard
            </Button>
            <Button onClick={() => handleDifficulty('good')} variant="default">
              Good
            </Button>
            <Button onClick={() => handleDifficulty('easy')} variant="outline">
              Easy
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>Ease Factor: {currentCard.progress.ease_factor.toFixed(2)}</p>
        <p>Interval: {currentCard.progress.interval} days</p>
        <p>Repetitions: {currentCard.progress.repetitions}</p>
        <p>Last Reviewed: {currentCard.progress.last_reviewed ? format(new Date(currentCard.progress.last_reviewed), 'PPp') : 'Never'}</p>
      </div>
    </div>
  );
};

export default SpacedMode;