
CREATE OR REPLACE FUNCTION public.create_project(_name TEXT, _description TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id UUID;
BEGIN
  INSERT INTO public.projects (name, description, created_by)
  VALUES (_name, _description, auth.uid())
  RETURNING id INTO _project_id;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_project_id, auth.uid(), 'leader');

  RETURN _project_id;
END;
$$;
