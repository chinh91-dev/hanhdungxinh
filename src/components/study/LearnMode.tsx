import { useState, useEffect, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/types/flashcard';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LearnModeProps {
  cards: Card[];
  setId: string;
}

interface ExtendedCard extends Card {
  questionMode: 'typing' | 'mcq';
}

const LearnMode = memo(({ cards, setId }: LearnModeProps) => {
  const [studyCards, setStudyCards] = useState<ExtendedCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mcqOptions, setMcqOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Create extended cards: each card appears twice (once for typing, once for MCQ)
    const extended: ExtendedCard[] = [];
    cards.forEach(card => {
      extended.push({ ...card, questionMode: 'typing' });
      if (cards.length >= 4) { // Only add MCQ if we have enough cards
        extended.push({ ...card, questionMode: 'mcq' });
      }
    });
    // Shuffle the cards
    const shuffled = extended.sort(() => Math.random() - 0.5);
    setStudyCards(shuffled);
    
    startSession();
    if (shuffled.length > 0) {
      prepareQuestion(0, shuffled);
    }
  }, [cards]);

  useEffect(() => {
    if (showResult && isCorrect) {
      const timer = setTimeout(() => {
        setIsTransitioning(true);
        setTimeout(() => {
          handleNext();
          setIsTransitioning(false);
        }, 300);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showResult, isCorrect]);

  useEffect(() => {
    // Focus input when not showing result
    if (!showResult) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [showResult, inputKey]);

  const startSession = async () => {
    const { data } = await supabase
      .from('study_sessions')
      .insert({ set_id: setId, mode: 'learn' })
      .select()
      .single();
    if (data) setSessionId(data.id);
  };

  const generateMCQOptions = (correctAnswer: string, currentCardId: string): string[] => {
    const wrongAnswers = cards
      .filter(c => c.id !== currentCardId && c.front !== correctAnswer)
      .map(c => c.front)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const options = [...wrongAnswers, correctAnswer]
      .sort(() => Math.random() - 0.5);
    
    return options;
  };

  const prepareQuestion = (index: number, cardsToUse: ExtendedCard[] = studyCards) => {
    const card = cardsToUse[index];
    if (card.questionMode === 'mcq') {
      setMcqOptions(generateMCQOptions(card.front, card.id));
    } else {
      setMcqOptions([]);
    }
  };

  const checkAnswer = () => {
    if (showResult) return;
    const correct = fuzzyMatch(userAnswer.trim().toLowerCase(), studyCards[currentIndex].front.toLowerCase());
    setIsCorrect(correct);
    setShowResult(true);
    if (correct) setCorrectCount(correctCount + 1);
  };

  const handleMCQAnswer = (option: string) => {
    if (showResult) return;
    setSelectedOption(option);
    const correct = option === studyCards[currentIndex].front;
    setIsCorrect(correct);
    setShowResult(true);
    if (correct) setCorrectCount(correctCount + 1);
  };

  const fuzzyMatch = (answer: string, target: string): boolean => {
    if (answer === target) return true;
    const similarity = calculateSimilarity(answer, target);
    return similarity > 0.8;
  };

  const calculateSimilarity = (s1: string, s2: string): number => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (s1: string, s2: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[s2.length][s1.length];
  };

  const handleNext = async () => {
    if (currentIndex === studyCards.length - 1) {
      // End session
      const accuracy = (correctCount / studyCards.length) * 100;
      if (sessionId) {
        await supabase
          .from('study_sessions')
          .update({
            ended_at: new Date().toISOString(),
            cards_studied: studyCards.length,
            correct_count: correctCount,
            accuracy
          })
          .eq('id', sessionId);
      }
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setUserAnswer('');
    setSelectedOption(null);
    setShowResult(false);
    setInputKey(prev => prev + 1);
    
    if (nextIndex < studyCards.length) {
      prepareQuestion(nextIndex);
    }
  };

  if (studyCards.length === 0) {
    return <div className="text-center p-8">Loading...</div>;
  }

  if (currentIndex >= studyCards.length) {
    const accuracy = Math.round((correctCount / studyCards.length) * 100);
    return (
      <div className="text-center space-y-4 p-8">
        <h2 className="text-3xl font-bold">Session Complete!</h2>
        <p className="text-xl">
          Score: {correctCount}/{studyCards.length} ({accuracy}%)
        </p>
        <Button onClick={() => window.location.reload()}>Study Again</Button>
      </div>
    );
  }

  const currentCard = studyCards[currentIndex];

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Question {currentIndex + 1} of {studyCards.length}
      </div>

      <div className={`bg-card border rounded-lg p-8 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        <div className="text-sm uppercase text-muted-foreground mb-2">
          {currentCard.card_type === 'term' ? 'Definition' : 'Answer'}
        </div>
        <p className="text-2xl font-semibold mb-6">{currentCard.back}</p>

        {!showResult ? (
          <div className="space-y-4">
            {currentCard.questionMode === 'typing' ? (
              <>
                <Input
                  ref={inputRef}
                  key={inputKey}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && userAnswer.trim() && checkAnswer()}
                  placeholder="Type your answer..."
                  autoFocus
                />
                <Button onClick={checkAnswer} disabled={!userAnswer.trim()}>
                  Check Answer
                </Button>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {mcqOptions.map((option, index) => (
                  <Button
                    key={index}
                    onClick={() => handleMCQAnswer(option)}
                    variant="outline"
                    className="h-auto py-4 px-6 text-left justify-start whitespace-normal"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {currentCard.questionMode === 'typing' && userAnswer && (
              <div className="p-3 border rounded">
                <p className="text-sm text-muted-foreground">Your typed answer:</p>
                <p className="text-lg font-medium">{userAnswer}</p>
              </div>
            )}
            
            {currentCard.questionMode === 'mcq' && mcqOptions.length > 0 && (
              <div className="grid grid-cols-1 gap-3">
                {mcqOptions.map((option, index) => {
                  const isSelected = option === selectedOption;
                  const isCorrectOption = option === currentCard.front;
                  
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      disabled
                      className={`h-auto py-4 px-6 text-left justify-start whitespace-normal ${
                        isSelected && isCorrect
                          ? 'bg-green-100 dark:bg-green-900 border-green-600'
                          : isSelected && !isCorrect
                          ? 'bg-red-100 dark:bg-red-900 border-red-600'
                          : isCorrectOption
                          ? 'bg-green-100 dark:bg-green-900 border-green-600'
                          : ''
                      }`}
                    >
                      {option}
                      {isSelected && isCorrect && <Check className="ml-2 h-4 w-4 inline" />}
                      {isSelected && !isCorrect && <X className="ml-2 h-4 w-4 inline" />}
                      {!isSelected && isCorrectOption && <Check className="ml-2 h-4 w-4 inline" />}
                    </Button>
                  );
                })}
              </div>
            )}
            
            <div className={`flex items-center gap-2 p-4 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
              {isCorrect ? (
                <>
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-600 dark:text-green-400">Correct!</span>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="font-semibold text-red-600 dark:text-red-400">Incorrect</span>
                </>
              )}
            </div>
            
            {!isCorrect && (
              <div>
                <p className="text-sm text-muted-foreground">Correct answer:</p>
                <p className="text-lg font-medium">{currentCard.front}</p>
              </div>
            )}
            
            <Button onClick={handleNext}>
              {currentIndex === studyCards.length - 1 ? 'Finish' : 'Next Card'}
            </Button>
          </div>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Current Score: {correctCount}/{currentIndex + (showResult ? 1 : 0)}
      </div>
    </div>
  );
});

LearnMode.displayName = 'LearnMode';

export default LearnMode;