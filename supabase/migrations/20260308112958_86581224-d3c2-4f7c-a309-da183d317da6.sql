
-- Drop broken policies
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Leaders can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Leaders can remove members" ON public.project_members;
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Leaders can update projects" ON public.projects;
DROP POLICY IF EXISTS "Leaders can delete projects" ON public.projects;

-- Security definer function to check project membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id)
$$;

CREATE OR REPLACE FUNCTION public.is_project_leader(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id AND role IN ('admin', 'leader'))
$$;

-- Fix project_members policies using security definer functions
CREATE POLICY "Members can view project members" ON public.project_members
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Leaders can manage members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_leader(auth.uid(), project_id) OR auth.uid() = user_id);

CREATE POLICY "Leaders can remove members" ON public.project_members
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id) OR auth.uid() = user_id);

-- Fix projects policies (were referencing project_members.id instead of projects.id)
CREATE POLICY "Members can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Leaders can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_project_leader(auth.uid(), id));

CREATE POLICY "Leaders can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), id));
