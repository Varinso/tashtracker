
CREATE TABLE public.discord_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  webhook_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  notify_tasks boolean NOT NULL DEFAULT true,
  notify_meetings boolean NOT NULL DEFAULT true,
  notify_files boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discord_webhooks_project_id ON public.discord_webhooks(project_id);

ALTER TABLE public.discord_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view webhooks"
  ON public.discord_webhooks FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Leaders can insert webhooks"
  ON public.discord_webhooks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_project_leader(auth.uid(), project_id));

CREATE POLICY "Leaders can update webhooks"
  ON public.discord_webhooks FOR UPDATE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id));

CREATE POLICY "Leaders can delete webhooks"
  ON public.discord_webhooks FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id));
