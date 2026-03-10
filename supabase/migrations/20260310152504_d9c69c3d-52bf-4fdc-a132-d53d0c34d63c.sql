
DROP POLICY "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Project members can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (is_project_member(auth.uid(), project_id));
