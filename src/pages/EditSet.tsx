import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Sparkles, Upload, Download, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CardType } from '@/types/flashcard';
import { exportToCSV, parseCSV } from '@/lib/csvUtils';

interface CardInput {
  id: string;
  front: string;
  back: string;
  card_type: CardType;
  isNew?: boolean;
}

const EditSet = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState<CardInput[]>([]);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    loadSet();
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, [setId]);

  const loadSet = async () => {
    try {
      const { data: setData } = await supabase
        .from('sets')
        .select('*')
        .eq('id', setId)
        .single();

      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', setId)
        .order('order_index');

      if (setData) {
        setTitle(setData.title);
        setDescription(setData.description || '');
      }

      if (cardsData && cardsData.length > 0) {
        setCards(cardsData.map(c => ({
          id: c.id,
          front: c.front,
          back: c.back,
          card_type: c.card_type as CardType,
          isNew: false
        })));
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to load set', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addCard = () => {
    setCards([...cards, { 
      id: crypto.randomUUID(), 
      front: '', 
      back: '', 
      card_type: 'term',
      isNew: true 
    }]);
  };

  const removeCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(c => c.id !== id));
    }
  };

  const updateCard = (id: string, field: keyof CardInput, value: string | CardType) => {
    setCards(prevCards => {
      const updatedCards = prevCards.map(c => c.id === id ? { ...c, [field]: value } : c);
      
      if (field === 'front' && typeof value === 'string') {
        const card = updatedCards.find(c => c.id === id);
        if (debounceTimers.current[id]) {
          clearTimeout(debounceTimers.current[id]);
        }
        
        if (value.trim() && card && !card.back.trim()) {
          debounceTimers.current[id] = setTimeout(() => {
            setCards(currentCards => {
              const index = currentCards.findIndex(c => c.id === id);
              if (index !== -1) {
                generateDefinition(index);
              }
              return currentCards;
            });
          }, 1500);
        }
      }
      
      return updatedCards;
    });
  };

  const generateDefinition = async (index: number) => {
    setCards(prevCards => {
      const card = prevCards[index];
      if (!card?.front.trim()) {
        toast({ title: 'Please enter a term or question first', variant: 'destructive' });
        return prevCards;
      }

      setGeneratingIndex(index);
      
      supabase.functions.invoke('generate-definition', {
        body: { text: card.front, type: card.card_type }
      }).then(({ data, error }) => {
        if (error) {
          console.error(error);
          toast({ title: 'Failed to generate definition', variant: 'destructive' });
        } else {
          setCards(currentCards => 
            currentCards.map(c => c.id === card.id ? { ...c, back: data.definition } : c)
          );
        }
        setGeneratingIndex(null);
      });

      return prevCards;
    });
  };

  const handleImportText = () => {
    if (!importText.trim()) {
      toast({ title: 'Please paste some text', variant: 'destructive' });
      return;
    }
    const imported = parseCSV(importText);
    setCards(imported.map(c => ({ ...c, id: crypto.randomUUID(), isNew: true })));
    toast({ title: `Imported ${imported.length} cards` });
    setImportDialogOpen(false);
    setImportText('');
  };

  const handleExportText = () => {
    const text = cards
      .filter(c => c.front.trim() && c.back.trim())
      .map(c => `${c.front},${c.back}`)
      .join('\n');
    setExportText(text);
    setExportDialogOpen(true);
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText);
    toast({ title: 'Copied to clipboard' });
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
      // Update set info
      const { error: setError } = await supabase
        .from('sets')
        .update({ title, description })
        .eq('id', setId);

      if (setError) throw setError;

      // Delete cards that were removed
      const existingCardIds = cards.filter(c => !c.isNew).map(c => c.id);
      await supabase
        .from('cards')
        .delete()
        .eq('set_id', setId)
        .not('id', 'in', `(${existingCardIds.join(',')})`);

      // Update existing cards and insert new ones
      for (let i = 0; i < validCards.length; i++) {
        const card = validCards[i];
        if (card.isNew) {
          await supabase
            .from('cards')
            .insert({
              set_id: setId,
              front: card.front,
              back: card.back,
              card_type: card.card_type,
              order_index: i
            });
        } else {
          await supabase
            .from('cards')
            .update({
              front: card.front,
              back: card.back,
              card_type: card.card_type,
              order_index: i
            })
            .eq('id', card.id);
        }
      }

      toast({ title: 'Set updated successfully!' });
      navigate('/');
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to update set', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading...
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
          <h1 className="text-3xl font-bold">Edit Flashcard Set</h1>
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
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import Text
            </Button>
            <Button onClick={handleExportText} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Text
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
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button onClick={() => navigate('/')} variant="outline">
              Cancel
            </Button>
          </div>
        </div>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Cards</DialogTitle>
              <DialogDescription>
                Paste your cards below. Each line should be: word,definition
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="love,a feeling of affection&#10;happy,feeling joy"
              className="min-h-[200px]"
            />
            <div className="flex gap-2">
              <Button onClick={handleImportText} className="flex-1">Import</Button>
              <Button onClick={() => setImportDialogOpen(false)} variant="outline">Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Cards</DialogTitle>
              <DialogDescription>
                Copy the text below to save your cards
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={exportText}
              readOnly
              className="min-h-[200px]"
            />
            <div className="flex gap-2">
              <Button onClick={handleCopyExport} className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
              <Button onClick={() => setExportDialogOpen(false)} variant="outline">Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EditSet;
