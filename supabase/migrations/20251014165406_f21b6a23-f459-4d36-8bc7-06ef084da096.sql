-- Fix the RLS policy for viewing batches
DROP POLICY IF EXISTS "Users can view batches in their projects" ON public.batches;

CREATE POLICY "Users can view batches in their projects"
  ON public.batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = batches.project_id AND projects.is_active = true
    )
  );