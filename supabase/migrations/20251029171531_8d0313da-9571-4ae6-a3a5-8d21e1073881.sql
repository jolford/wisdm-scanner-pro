-- Allow project creators to update projects when no customer is assigned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'projects' 
      AND policyname = 'Project creators can update projects without customer'
  ) THEN
    CREATE POLICY "Project creators can update projects without customer"
    ON public.projects
    FOR UPDATE
    USING (customer_id IS NULL AND created_by = auth.uid())
    WITH CHECK (customer_id IS NULL AND created_by = auth.uid());
  END IF;
END $$;