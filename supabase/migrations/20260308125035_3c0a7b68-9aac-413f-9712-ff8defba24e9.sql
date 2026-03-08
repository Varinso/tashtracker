CREATE POLICY "Leaders can update members"
ON public.project_members
FOR UPDATE
USING (is_project_leader(auth.uid(), project_id))
WITH CHECK (is_project_leader(auth.uid(), project_id));