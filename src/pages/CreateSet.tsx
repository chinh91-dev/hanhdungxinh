import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Sparkles, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CardType } from '@/types/flashcard';
import { exportToCSV, parseCSV } from '@/lib/csvUtils';

interface CardInput {
  id: string;
  front: string;
  back: string;
  card_type: CardType;
}

const CreateSet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState<CardInput[]>([
    { id: crypto.randomUUID(), front: '', back: '', card_type: 'term' }
  ]);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const addCard = () => {
    setCards([...cards, { id: crypto.randomUUID(), front: '', back: '', card_type: 'term' }]);
  };

  const removeCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(c => c.id !== id));
    }
  };

  const updateCard = (id: string, field: keyof CardInput, value: string | CardType) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const generateDefinition = async (index: number) => {
    const card = cards[index];
    if (!card.front.trim()) {
      toast({ title: 'Please enter a term or question first', variant: 'destructive' });
      return;
    }

    setGeneratingIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke('generate-definition', {
        body: { text: card.front, type: card.card_type }
      });

      if (error) throw error;

      updateCard(card.id, 'back', data.definition);
      toast({ title: 'Definition generated!' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to generate definition', variant: 'destructive' });
    } finally {
      setGeneratingIndex(null);
    }
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const imported = parseCSV(text);
      setCards(imported.map(c => ({ ...c, id: crypto.randomUUID() })));
      toast({ title: `Imported ${imported.length} cards` });
    };
    input.click();
  };

  const handleExportCSV = () => {
    exportToCSV(cards.map((c, i) => ({ ...c, set_id: '', order_index: i, created_at: '' })), title || 'untitled');
    toast({ title: 'Exported to CSV' });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Please enter a title', variant: 'destructive' });
      return;
    }

    const validCards = cards.filter(c => c.front.trim() && c.back.trim());
    if (validCards.length === 0) {
      toast({ title: 'Please add at least one complete card', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data: set, error: setError } = await supabase
        .from('sets')
        .insert({ title, description })
        .select()
        .single();

      if (setError) throw setError;

      const { error: cardsError } = await supabase
        .from('cards')
        .insert(validCards.map((c, i) => ({
          set_id: set.id,
          front: c.front,
          back: c.back,
          card_type: c.card_type,
          order_index: i
        })));

      if (cardsError) throw cardsError;

      toast({ title: 'Set created successfully!' });
      navigate('/');
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to create set', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Create Flashcard Set</h1>
        </div>

        <div className="space-y-6 bg-card p-6 rounded-lg border">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Biology Chapter 3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this set..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleImportCSV} variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="space-y-4">
            <Label>Cards</Label>
            {cards.map((card, index) => (
              <div key={card.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Card {index + 1}</span>
                  <div className="flex gap-2">
                    <select
                      value={card.card_type}
                      onChange={(e) => updateCard(card.id, 'card_type', e.target.value as CardType)}
                      className="text-sm border rounded px-2 py-1 bg-background"
                    >
                      <option value="term">Term</option>
                      <option value="question">Question</option>
                    </select>
                    {cards.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCard(card.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    value={card.front}
                    onChange={(e) => updateCard(card.id, 'front', e.target.value)}
                    placeholder={card.card_type === 'term' ? 'Enter term...' : 'Enter question...'}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      value={card.back}
                      onChange={(e) => updateCard(card.id, 'back', e.target.value)}
                      placeholder={card.card_type === 'term' ? 'Enter definition...' : 'Enter answer...'}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => generateDefinition(index)}
                      disabled={generatingIndex === index || !card.front.trim()}
                      variant="secondary"
                      size="icon"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                  {generatingIndex === index && (
                    <p className="text-xs text-muted-foreground">Generating...</p>
                  )}
                </div>
              </div>
            ))}

            <Button onClick={addCard} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? 'Saving...' : 'Create Set'}
            </Button>
            <Button onClick={() => navigate('/')} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSet;