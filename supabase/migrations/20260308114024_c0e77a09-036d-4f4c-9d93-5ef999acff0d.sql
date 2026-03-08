
-- Fix projects: SELECT, UPDATE, DELETE were all RESTRICTIVE, need PERMISSIVE
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Leaders can update projects" ON public.projects;
DROP POLICY IF EXISTS "Leaders can delete projects" ON public.projects;

CREATE POLICY "Members can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Leaders can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_project_leader(auth.uid(), id));

CREATE POLICY "Leaders can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), id));

-- Fix project_members: all were RESTRICTIVE
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Leaders can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Leaders can remove members" ON public.project_members;

CREATE POLICY "Members can view project members" ON public.project_members
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Leaders can manage members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_leader(auth.uid(), project_id) OR auth.uid() = user_id);

CREATE POLICY "Leaders can remove members" ON public.project_members
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id) OR auth.uid() = user_id);

-- Fix tasks: all were RESTRICTIVE
DROP POLICY IF EXISTS "Project members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Leaders can delete tasks" ON public.tasks;

CREATE POLICY "Project members can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND auth.uid() = created_by);

CREATE POLICY "Project members can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Leaders can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id));

-- Fix task_assignments
DROP POLICY IF EXISTS "Project members can view assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Project members can manage assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Project members can remove assignments" ON public.task_assignments;

CREATE POLICY "Project members can view assignments" ON public.task_assignments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_assignments.task_id AND public.is_project_member(auth.uid(), t.project_id)));

CREATE POLICY "Project members can manage assignments" ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_assignments.task_id AND public.is_project_member(auth.uid(), t.project_id)));

CREATE POLICY "Project members can remove assignments" ON public.task_assignments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_assignments.task_id AND public.is_project_member(auth.uid(), t.project_id)));

-- Fix comments
DROP POLICY IF EXISTS "Project members can view comments" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Project members can view comments" ON public.comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = comments.task_id AND public.is_project_member(auth.uid(), t.project_id)));

CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = comments.task_id AND public.is_project_member(auth.uid(), t.project_id)));

CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Fix files
DROP POLICY IF EXISTS "Project members can view files" ON public.files;
DROP POLICY IF EXISTS "Project members can upload files" ON public.files;
DROP POLICY IF EXISTS "Uploaders can update files" ON public.files;
DROP POLICY IF EXISTS "Leaders can delete files" ON public.files;

CREATE POLICY "Project members can view files" ON public.files
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can upload files" ON public.files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by AND public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Uploaders can update files" ON public.files
  FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Leaders can delete files" ON public.files
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id) OR auth.uid() = uploaded_by);

-- Fix meetings
DROP POLICY IF EXISTS "Project members can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Project members can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Creators can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Leaders can delete meetings" ON public.meetings;

CREATE POLICY "Project members can view meetings" ON public.meetings
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can create meetings" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Creators can update meetings" ON public.meetings
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Leaders can delete meetings" ON public.meetings
  FOR DELETE TO authenticated
  USING (public.is_project_leader(auth.uid(), project_id));

-- Fix activity_log
DROP POLICY IF EXISTS "Project members can view activity" ON public.activity_log;
DROP POLICY IF EXISTS "System can insert activity" ON public.activity_log;

CREATE POLICY "Project members can view activity" ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "System can insert activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- Fix user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
