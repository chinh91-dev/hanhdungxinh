import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, TrendingUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { FlashcardSet } from '@/types/flashcard';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSets: 0, totalCards: 0, studiedToday: 0 });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadSets();
    loadStats();
  }, []);

  const loadSets = async () => {
    try {
      const { data } = await supabase
        .from('sets')
        .select('*')
        .order('updated_at', { ascending: false });
      if (data) setSets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: setsData } = await supabase.from('sets').select('id, card_count');
      const totalCards = setsData?.reduce((sum, set) => sum + set.card_count, 0) || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: sessionsData } = await supabase
        .from('study_sessions')
        .select('cards_studied')
        .gte('started_at', today.toISOString());
      const studiedToday = sessionsData?.reduce((sum, s) => sum + s.cards_studied, 0) || 0;

      setStats({
        totalSets: setsData?.length || 0,
        totalCards,
        studiedToday
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteClick = (setId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSetToDelete(setId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!setToDelete) return;

    try {
      // Delete associated cards first
      await supabase.from('cards').delete().eq('set_id', setToDelete);
      
      // Delete the set
      const { error } = await supabase.from('sets').delete().eq('id', setToDelete);
      
      if (error) throw error;

      toast.success('Set deleted successfully');
      loadSets();
      loadStats();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete set');
    } finally {
      setDeleteDialogOpen(false);
      setSetToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            StudySpark
          </h1>
          <p className="text-muted-foreground">Your personal flashcard study companion</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sets</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSets}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCards}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Studied Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.studiedToday}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Your Sets</h2>
          <Button onClick={() => navigate('/create')} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            New Set
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : sets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sets yet</h3>
              <p className="text-muted-foreground mb-4">Create your first flashcard set to get started</p>
              <Button onClick={() => navigate('/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Set
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map((set) => (
              <Card key={set.id} className="cursor-pointer hover:shadow-lg transition-shadow group relative" onClick={() => navigate(`/study/${set.id}`)}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => handleDeleteClick(set.id, e)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <CardHeader>
                  <CardTitle className="line-clamp-1">{set.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {set.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{set.card_count} cards</span>
                    <span>Updated {formatDistanceToNow(new Date(set.updated_at), { addSuffix: true })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Set?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this flashcard set and all its cards. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Index;
