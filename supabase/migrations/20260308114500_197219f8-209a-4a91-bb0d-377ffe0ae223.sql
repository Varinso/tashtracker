
-- Add FK from project_members.user_id to profiles.id
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from task_assignments.user_id to profiles.id  
ALTER TABLE public.task_assignments
  ADD CONSTRAINT task_assignments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from comments.user_id to profiles.id
ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from activity_log.user_id to profiles.id
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from files.uploaded_by to profiles.id
ALTER TABLE public.files
  ADD CONSTRAINT files_uploaded_by_profiles_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from meetings.created_by to profiles.id
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
