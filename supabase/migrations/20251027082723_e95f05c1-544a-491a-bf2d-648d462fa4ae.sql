-- Create flashcard sets table
CREATE TABLE IF NOT EXISTS public.sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  card_count INTEGER NOT NULL DEFAULT 0
);

-- Create cards table
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'term' CHECK (card_type IN ('term', 'question')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create card progress table for spaced repetition
CREATE TABLE IF NOT EXISTS public.card_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed TIMESTAMPTZ,
  UNIQUE(card_id)
);

-- Create study sessions table for analytics
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('flashcards', 'learn', 'spaced')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  cards_studied INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  accuracy FLOAT
);

-- Enable Row Level Security (but allow all operations since no auth)
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for anonymous access
CREATE POLICY "Allow all operations on sets" ON public.sets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on cards" ON public.cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on card_progress" ON public.card_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on study_sessions" ON public.study_sessions FOR ALL USING (true) WITH CHECK (true);

-- Create function to update card_count
CREATE OR REPLACE FUNCTION update_set_card_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.sets
  SET card_count = (SELECT COUNT(*) FROM public.cards WHERE set_id = COALESCE(NEW.set_id, OLD.set_id))
  WHERE id = COALESCE(NEW.set_id, OLD.set_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update card_count
CREATE TRIGGER trigger_update_card_count
AFTER INSERT OR DELETE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION update_set_card_count();

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sets updated_at
CREATE TRIGGER trigger_sets_updated_at
BEFORE UPDATE ON public.sets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_cards_set_id ON public.cards(set_id);
CREATE INDEX idx_card_progress_next_review ON public.card_progress(next_review);
CREATE INDEX idx_study_sessions_set_id ON public.study_sessions(set_id);