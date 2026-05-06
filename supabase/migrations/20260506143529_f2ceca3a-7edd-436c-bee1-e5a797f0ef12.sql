ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON public.tasks(is_archived);