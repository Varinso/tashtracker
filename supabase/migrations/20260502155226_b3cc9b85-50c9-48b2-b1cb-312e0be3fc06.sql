
-- 1. discord_webhooks: only leaders can view (URLs are sensitive)
DROP POLICY IF EXISTS "Project members can view webhooks" ON public.discord_webhooks;
CREATE POLICY "Leaders can view webhooks"
ON public.discord_webhooks
FOR SELECT
TO authenticated
USING (public.is_project_leader(auth.uid(), project_id));

-- 2. project_members UPDATE policy: scope to authenticated only
DROP POLICY IF EXISTS "Leaders can update members" ON public.project_members;
CREATE POLICY "Leaders can update members"
ON public.project_members
FOR UPDATE
TO authenticated
USING (public.is_project_leader(auth.uid(), project_id))
WITH CHECK (public.is_project_leader(auth.uid(), project_id));

-- 3. profiles: restrict broad SELECT to self + project co-members
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Users can view own and co-member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid()
      AND pm2.user_id = profiles.id
  )
);

-- 4. notifications: prevent notifying users outside the project
DROP POLICY IF EXISTS "Project members can insert notifications" ON public.notifications;
CREATE POLICY "Project members can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_project_member(auth.uid(), project_id)
  AND public.is_project_member(user_id, project_id)
);

-- 5. project-files storage: make private and enforce membership-based access
UPDATE storage.buckets SET public = false WHERE id = 'project-files';

-- Drop any existing project-files policies (safe if they don't exist)
DROP POLICY IF EXISTS "Project files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update their project files" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders or leaders can delete project files" ON storage.objects;

-- Path layout: {userId}/{projectId}/{filename}
CREATE POLICY "Project members can view project files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files'
  AND public.is_project_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Project members can upload project files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.is_project_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Uploaders can update their project files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Uploaders or leaders can delete project files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_project_leader(auth.uid(), ((storage.foldername(name))[2])::uuid)
  )
);
