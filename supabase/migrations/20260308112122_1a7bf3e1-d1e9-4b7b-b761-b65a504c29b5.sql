
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'leader', 'member');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Assign member role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project members
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Project RLS: members can see their projects
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid())
);
CREATE POLICY "Leaders can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Leaders can update projects" ON public.projects FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
);
CREATE POLICY "Leaders can delete projects" ON public.projects FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
);

-- Project members RLS
CREATE POLICY "Members can view project members" ON public.project_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid())
);
CREATE POLICY "Leaders can manage members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'leader'))
  OR auth.uid() = user_id
);
CREATE POLICY "Leaders can remove members" ON public.project_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'leader'))
  OR auth.uid() = user_id
);

-- Task status enum
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  phase TEXT,
  deadline TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Project members can view tasks" ON public.tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid())
);
CREATE POLICY "Project members can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid()) AND auth.uid() = created_by
);
CREATE POLICY "Project members can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid())
);
CREATE POLICY "Leaders can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
);

-- Task assignments
CREATE TABLE public.task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can view assignments" ON public.task_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_members pm ON pm.project_id = t.project_id WHERE t.id = task_assignments.task_id AND pm.user_id = auth.uid())
);
CREATE POLICY "Project members can manage assignments" ON public.task_assignments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_members pm ON pm.project_id = t.project_id WHERE t.id = task_assignments.task_id AND pm.user_id = auth.uid())
);
CREATE POLICY "Project members can remove assignments" ON public.task_assignments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_members pm ON pm.project_id = t.project_id WHERE t.id = task_assignments.task_id AND pm.user_id = auth.uid())
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Project members can view comments" ON public.comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_members pm ON pm.project_id = t.project_id WHERE t.id = comments.task_id AND pm.user_id = auth.uid())
);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_members pm ON pm.project_id = t.project_id WHERE t.id = comments.task_id AND pm.user_id = auth.uid())
);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Files/documents
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  description TEXT,
  version INT NOT NULL DEFAULT 1,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can view files" ON public.files FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = files.project_id AND user_id = auth.uid())
);
CREATE POLICY "Project members can upload files" ON public.files FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = uploaded_by AND EXISTS (SELECT 1 FROM public.project_members WHERE project_id = files.project_id AND user_id = auth.uid())
);
CREATE POLICY "Uploaders can update files" ON public.files FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by);
CREATE POLICY "Leaders can delete files" ON public.files FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = files.project_id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
  OR auth.uid() = uploaded_by
);

-- Meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Project members can view meetings" ON public.meetings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = meetings.project_id AND user_id = auth.uid())
);
CREATE POLICY "Project members can create meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.project_members WHERE project_id = meetings.project_id AND user_id = auth.uid())
);
CREATE POLICY "Creators can update meetings" ON public.meetings FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Leaders can delete meetings" ON public.meetings FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = meetings.project_id AND user_id = auth.uid() AND role IN ('admin', 'leader'))
);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can view activity" ON public.activity_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_members WHERE project_id = activity_log.project_id AND user_id = auth.uid())
);
CREATE POLICY "System can insert activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
);

-- Storage bucket for project documents
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);
CREATE POLICY "Project members can view files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-files');
CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');
CREATE POLICY "Users can update own uploads" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indexes
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX idx_task_assignments_task ON public.task_assignments(task_id);
CREATE INDEX idx_comments_task ON public.comments(task_id);
CREATE INDEX idx_files_project ON public.files(project_id);
CREATE INDEX idx_files_tags ON public.files USING GIN(tags);
CREATE INDEX idx_activity_log_project ON public.activity_log(project_id);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at);
