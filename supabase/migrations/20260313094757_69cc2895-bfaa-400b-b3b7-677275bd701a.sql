CREATE TABLE IF NOT EXISTS public.task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  task_id uuid NOT NULL,
  shared_by uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT task_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT task_links_shared_by_profiles_fkey FOREIGN KEY (shared_by) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_links_project_id_idx ON public.task_links(project_id);
CREATE INDEX IF NOT EXISTS task_links_task_id_idx ON public.task_links(task_id);
CREATE INDEX IF NOT EXISTS task_links_shared_by_idx ON public.task_links(shared_by);

ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view task links" ON public.task_links;
DROP POLICY IF EXISTS "Project members can insert task links" ON public.task_links;
DROP POLICY IF EXISTS "Sharers can update task links" ON public.task_links;
DROP POLICY IF EXISTS "Sharers or leaders can delete task links" ON public.task_links;

CREATE POLICY "Project members can view task links" ON public.task_links
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can insert task links" ON public.task_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = shared_by AND public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Sharers can update task links" ON public.task_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = shared_by);

CREATE POLICY "Sharers or leaders can delete task links" ON public.task_links
  FOR DELETE TO authenticated
  USING (auth.uid() = shared_by OR public.is_project_leader(auth.uid(), project_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_links;