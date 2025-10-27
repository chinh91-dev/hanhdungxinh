import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/types/flashcard';
import FlashcardsMode from '@/components/study/FlashcardsMode';
import LearnMode from '@/components/study/LearnMode';
import SpacedMode from '@/components/study/SpacedMode';
import TestMode from '@/components/study/TestMode';

const StudyMode = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [setTitle, setSetTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, [setId]);

  const loadCards = async () => {
    try {
      const { data: set } = await supabase
        .from('sets')
        .select('title')
        .eq('id', setId)
        .single();

      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', setId)
        .order('order_index');

      if (set) setSetTitle(set.title);
      if (cardsData) setCards(cardsData as Card[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Memoize study mode components to prevent unnecessary re-renders
  const studyModes = useMemo(() => ({
    flashcards: <FlashcardsMode cards={cards} setId={setId!} />,
    learn: <LearnMode cards={cards} setId={setId!} />,
    test: <TestMode cards={cards} setId={setId!} />,
    spaced: <SpacedMode cards={cards} setId={setId!} />,
  }), [cards, setId]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No cards in this set</p>
          <Button onClick={() => navigate('/')}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{setTitle}</h1>
        </div>

        <Tabs defaultValue="flashcards" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="learn">Learn</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="spaced">Spaced Rep</TabsTrigger>
          </TabsList>

          <TabsContent value="flashcards" className="mt-6">
            {studyModes.flashcards}
          </TabsContent>

          <TabsContent value="learn" className="mt-6">
            {studyModes.learn}
          </TabsContent>

          <TabsContent value="test" className="mt-6">
            {studyModes.test}
          </TabsContent>

          <TabsContent value="spaced" className="mt-6">
            {studyModes.spaced}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudyMode;