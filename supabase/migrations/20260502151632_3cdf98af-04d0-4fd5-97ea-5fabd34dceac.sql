ALTER TABLE public.project_members
ADD COLUMN IF NOT EXISTS designation text;

ALTER TABLE public.project_members
ADD COLUMN IF NOT EXISTS task_permissions jsonb NOT NULL DEFAULT '{
  "create_tasks": false,
  "edit_tasks": false,
  "change_task_status": true,
  "delete_tasks": false,
  "assign_tasks": false
}'::jsonb;

UPDATE public.project_members
SET task_permissions = CASE
  WHEN role IN ('admin', 'leader') THEN jsonb_build_object(
    'create_tasks', true,
    'edit_tasks', true,
    'change_task_status', true,
    'delete_tasks', true,
    'assign_tasks', true
  )
  ELSE jsonb_build_object(
    'create_tasks', false,
    'edit_tasks', false,
    'change_task_status', true,
    'delete_tasks', false,
    'assign_tasks', false
  )
END
WHERE task_permissions IS NULL
   OR task_permissions = '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.has_project_task_permission(
  _user_id uuid,
  _project_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
      AND (
        pm.role IN ('admin', 'leader')
        OR COALESCE((pm.task_permissions ->> _permission)::boolean, false)
      )
  )
$$;

DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Leaders can delete tasks" ON public.tasks;

CREATE POLICY "Project members can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(auth.uid(), project_id)
    AND auth.uid() = created_by
    AND public.has_project_task_permission(auth.uid(), project_id, 'create_tasks')
  );

CREATE POLICY "Project members can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    AND (
      public.has_project_task_permission(auth.uid(), project_id, 'edit_tasks')
      OR public.has_project_task_permission(auth.uid(), project_id, 'change_task_status')
    )
  );

CREATE POLICY "Leaders can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.has_project_task_permission(auth.uid(), project_id, 'delete_tasks'));

DROP POLICY IF EXISTS "Project members can manage assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Project members can remove assignments" ON public.task_assignments;

CREATE POLICY "Project members can manage assignments" ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_assignments.task_id
        AND public.has_project_task_permission(auth.uid(), t.project_id, 'assign_tasks')
    )
  );

CREATE POLICY "Project members can remove assignments" ON public.task_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_assignments.task_id
        AND public.has_project_task_permission(auth.uid(), t.project_id, 'assign_tasks')
    )
  );