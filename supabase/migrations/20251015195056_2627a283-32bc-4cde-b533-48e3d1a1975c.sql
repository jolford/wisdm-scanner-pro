-- Add customer_id to projects table for tenant isolation
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- Add customer_id to batches table for direct customer reference
ALTER TABLE public.batches 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- Update existing records to set customer_id (for now, allow NULL for existing data)
-- Admins should manually assign customers to existing projects

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_projects_customer 
  ON public.projects(customer_id);

CREATE INDEX IF NOT EXISTS idx_batches_customer 
  ON public.batches(customer_id);

-- Fix RLS policies for tenant-based isolation

-- 1. FIX: User profiles - restrict to own profile or admins only
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile or admins can view all"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. FIX: Customers - restrict to assigned customers only
DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;

CREATE POLICY "Users can view their assigned customers"
  ON public.customers FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_customer(auth.uid(), id)
  );

CREATE POLICY "Admins can manage customers"
  ON public.customers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. FIX: Projects - restrict to customers user has access to
DROP POLICY IF EXISTS "Anyone can view active projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

CREATE POLICY "Users can view projects for their customers"
  ON public.projects FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (customer_id IS NOT NULL AND has_customer(auth.uid(), customer_id))
    OR (customer_id IS NULL AND is_active = true) -- Legacy projects without customer
  );

CREATE POLICY "Admins can manage projects"
  ON public.projects FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. FIX: Documents - verify project access through customer
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON public.documents;

CREATE POLICY "Users can view documents in their customer projects"
  ON public.documents FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      uploaded_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = documents.project_id
        AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
      )
    )
  );

CREATE POLICY "Users can create documents in their customer projects"
  ON public.documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can update their own documents in customer projects"
  ON public.documents FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = documents.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = documents.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (uploaded_by = auth.uid());

-- 5. FIX: Batches - restrict to customer projects
DROP POLICY IF EXISTS "Users can view batches in their projects" ON public.batches;
DROP POLICY IF EXISTS "Users can create batches" ON public.batches;
DROP POLICY IF EXISTS "Users can update their batches" ON public.batches;
DROP POLICY IF EXISTS "Admins can manage all batches" ON public.batches;

CREATE POLICY "Users can view batches for their customer projects"
  ON public.batches FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = batches.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can create batches in their customer projects"
  ON public.batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can update their batches"
  ON public.batches FOR UPDATE
  USING (
    created_by = auth.uid() 
    OR assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can manage batches"
  ON public.batches FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. FIX: Document classes - restrict to customer projects
DROP POLICY IF EXISTS "Users can view document classes" ON public.document_classes;
DROP POLICY IF EXISTS "Admins can manage document classes" ON public.document_classes;

CREATE POLICY "Users can view document classes for their customer projects"
  ON public.document_classes FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      is_active = true
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = document_classes.project_id
        AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
      )
    )
  );

CREATE POLICY "Admins can manage document classes"
  ON public.document_classes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. FIX: Licenses - already has customer_id
DROP POLICY IF EXISTS "Users can view their own licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can manage all licenses" ON public.licenses;

CREATE POLICY "Users can view licenses for their assigned customers"
  ON public.licenses FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_customer(auth.uid(), customer_id)
  );

CREATE POLICY "Admins can manage licenses"
  ON public.licenses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 8. FIX: License usage - users can only view their own usage
DROP POLICY IF EXISTS "System can insert license usage via RPC" ON public.license_usage;
DROP POLICY IF EXISTS "Users can view their own license usage" ON public.license_usage;
DROP POLICY IF EXISTS "Admins can view all license usage" ON public.license_usage;
DROP POLICY IF EXISTS "Admins can update license usage" ON public.license_usage;
DROP POLICY IF EXISTS "Admins can delete license usage" ON public.license_usage;

CREATE POLICY "Users can view their own license usage"
  ON public.license_usage FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
  );

CREATE POLICY "System can insert license usage for user's documents"
  ON public.license_usage FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage license usage"
  ON public.license_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 9. Add indexes for performance on tenant isolation queries
CREATE INDEX IF NOT EXISTS idx_documents_project_customer 
  ON public.documents(project_id, uploaded_by);

CREATE INDEX IF NOT EXISTS idx_batches_project 
  ON public.batches(project_id);

CREATE INDEX IF NOT EXISTS idx_user_customers_user 
  ON public.user_customers(user_id, customer_id);

COMMENT ON POLICY "Users can view documents in their customer projects" ON public.documents 
  IS 'Ensures users can only access documents in projects belonging to their assigned customers';

COMMENT ON POLICY "Users can view projects for their customers" ON public.projects 
  IS 'Enforces tenant isolation - users can only see projects for customers they are assigned to';