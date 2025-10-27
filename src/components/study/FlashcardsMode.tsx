import { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/types/flashcard';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';

interface FlashcardsModeProps {
  cards: Card[];
  setId: string;
}

const FlashcardsMode = memo(({ cards }: FlashcardsModeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyCards, setStudyCards] = useState(cards);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    setStudyCards(cards);
  }, [cards]);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % studyCards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + studyCards.length) % studyCards.length);
  };

  const handleShuffle = () => {
    const shuffled = [...studyCards].sort(() => Math.random() - 0.5);
    setStudyCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    if (Math.abs(distance) < minSwipeDistance) {
      // Small movement - treat as tap to flip
      setIsFlipped(!isFlipped);
    } else if (distance > 0) {
      // Swiped left - go to next card
      handleNext();
    } else {
      // Swiped right - go to previous card
      handlePrev();
    }
    
    setTouchStart(0);
    setTouchEnd(0);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setIsFlipped(!isFlipped);
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, currentIndex]);

  const currentCard = studyCards[currentIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {studyCards.length}
        </div>
        <Button onClick={handleShuffle} variant="outline" size="sm">
          <Shuffle className="mr-2 h-4 w-4" />
          Shuffle
        </Button>
      </div>

      <div className="relative h-96 perspective-1000">
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            // Only flip on click if not on mobile (no touch events)
            if (!('ontouchstart' in window)) {
              setIsFlipped(!isFlipped);
            }
          }}
          className={`w-full h-full transition-transform duration-500 cursor-pointer preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute w-full h-full backface-hidden bg-card border-2 border-primary rounded-lg p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xs uppercase text-muted-foreground mb-2">
                {currentCard.card_type === 'term' ? 'Term' : 'Question'}
              </div>
              <p className="text-2xl font-semibold">{currentCard.front}</p>
            </div>
          </div>

          <div
            className="absolute w-full h-full backface-hidden bg-secondary border-2 border-secondary-foreground rounded-lg p-8 flex items-center justify-center rotate-y-180"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <div className="text-center">
              <div className="text-xs uppercase text-muted-foreground mb-2">
                {currentCard.card_type === 'term' ? 'Definition' : 'Answer'}
              </div>
              <p className="text-xl">{currentCard.back}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Button onClick={handlePrev} variant="outline" size="icon">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button onClick={() => setIsFlipped(!isFlipped)} variant="secondary">
          {isFlipped ? 'Show Front' : 'Show Back'}
        </Button>
        <Button onClick={handleNext} variant="outline" size="icon">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Press <kbd className="px-2 py-1 bg-muted rounded">Space</kbd> to flip,{' '}
        <kbd className="px-2 py-1 bg-muted rounded">←</kbd>/<kbd className="px-2 py-1 bg-muted rounded">→</kbd> to navigate
      </p>
    </div>
  );
});

FlashcardsMode.displayName = 'FlashcardsMode';

export default FlashcardsMode;