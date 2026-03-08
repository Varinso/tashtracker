
-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Leaders can create projects" ON public.projects;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Anyone can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
