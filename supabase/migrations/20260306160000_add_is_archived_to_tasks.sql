-- Add is_archived column to tasks table
ALTER TABLE public.tasks ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create index for archive filtering queries
CREATE INDEX idx_tasks_is_archived ON public.tasks(project_id, is_archived);

-- Update existing RLS policy to allow archiving tasks
-- The delete policy becomes an update policy for archive operations
DROP POLICY "Project members can delete tasks" ON public.tasks;

-- Leaders can archive tasks (set is_archived = true) 
CREATE POLICY "Leaders can archive tasks" ON public.tasks FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
);
