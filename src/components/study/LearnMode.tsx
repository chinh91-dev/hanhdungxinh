import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/types/flashcard';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LearnModeProps {
  cards: Card[];
  setId: string;
}

const LearnMode = ({ cards, setId }: LearnModeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    const { data } = await supabase
      .from('study_sessions')
      .insert({ set_id: setId, mode: 'learn' })
      .select()
      .single();
    if (data) setSessionId(data.id);
  };

  const checkAnswer = () => {
    const correct = fuzzyMatch(userAnswer.trim().toLowerCase(), cards[currentIndex].back.toLowerCase());
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
    if (currentIndex === cards.length - 1) {
      // End session
      const accuracy = (correctCount / cards.length) * 100;
      if (sessionId) {
        await supabase
          .from('study_sessions')
          .update({
            ended_at: new Date().toISOString(),
            cards_studied: cards.length,
            correct_count: correctCount,
            accuracy
          })
          .eq('id', sessionId);
      }
    }

    setCurrentIndex(currentIndex + 1);
    setUserAnswer('');
    setShowResult(false);
  };

  if (currentIndex >= cards.length) {
    const accuracy = Math.round((correctCount / cards.length) * 100);
    return (
      <div className="text-center space-y-4 p-8">
        <h2 className="text-3xl font-bold">Session Complete!</h2>
        <p className="text-xl">
          Score: {correctCount}/{cards.length} ({accuracy}%)
        </p>
        <Button onClick={() => window.location.reload()}>Study Again</Button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Question {currentIndex + 1} of {cards.length}
      </div>

      <div className="bg-card border rounded-lg p-8">
        <div className="text-sm uppercase text-muted-foreground mb-2">
          {currentCard.card_type === 'term' ? 'Term' : 'Question'}
        </div>
        <p className="text-2xl font-semibold mb-6">{currentCard.front}</p>

        {!showResult ? (
          <div className="space-y-4">
            <Input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
              placeholder="Type your answer..."
              autoFocus
            />
            <Button onClick={checkAnswer} disabled={!userAnswer.trim()}>
              Check Answer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
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
            <div>
              <p className="text-sm text-muted-foreground">Correct answer:</p>
              <p className="text-lg font-medium">{currentCard.back}</p>
            </div>
            <Button onClick={handleNext}>
              {currentIndex === cards.length - 1 ? 'Finish' : 'Next Card'}
            </Button>
          </div>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Current Score: {correctCount}/{currentIndex + (showResult ? 1 : 0)}
      </div>
    </div>
  );
};

export default LearnMode;