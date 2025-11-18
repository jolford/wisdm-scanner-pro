-- Security Hardening: Fix Critical Access Control Issues

-- 1. WEBHOOK SECRETS: Restrict to admins only (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "System admins can manage all webhook configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Tenant admins can manage their customer webhook configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Users can view webhook configs for their customer" ON public.webhook_configs;
DROP POLICY IF EXISTS "Admins can manage webhook configs" ON public.webhook_configs;

-- Only admins can access webhook secrets
CREATE POLICY "webhook_admin_access"
ON public.webhook_configs
FOR ALL
TO authenticated
USING (
  is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id)
)
WITH CHECK (
  is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id)
);

-- 2. EMAIL CREDENTIALS: Restrict to admins only
DROP POLICY IF EXISTS "System admins can manage all email configs" ON public.email_import_configs;
DROP POLICY IF EXISTS "Tenant admins can manage their customer email configs" ON public.email_import_configs;
DROP POLICY IF EXISTS "Users can view email configs for their customer" ON public.email_import_configs;
DROP POLICY IF EXISTS "Admins can manage email configs" ON public.email_import_configs;

-- Only admins can access email credentials
CREATE POLICY "email_admin_access"
ON public.email_import_configs
FOR ALL
TO authenticated
USING (
  is_system_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = email_import_configs.project_id 
    AND p.customer_id IS NOT NULL 
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
)
WITH CHECK (
  is_system_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = email_import_configs.project_id 
    AND p.customer_id IS NOT NULL 
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- 3. DOCUMENT ACCESS: Restrict to assigned users, creators, and admins
DROP POLICY IF EXISTS "Users can view documents in their customer projects" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own uploaded documents" ON public.documents;

-- Users can only view documents they uploaded, are assigned to, or have admin rights
CREATE POLICY "document_restricted_select"
ON public.documents
FOR SELECT
TO authenticated
USING (
  -- Uploader can view
  uploaded_by = auth.uid()
  -- System admins can view all
  OR is_system_admin(auth.uid())
  -- Tenant admins for their customer
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = documents.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
  -- Assigned batch users
  OR EXISTS (
    SELECT 1 FROM batches b
    WHERE b.id = documents.batch_id
    AND (b.assigned_to = auth.uid() OR b.created_by = auth.uid())
  )
);

-- 4. DOCUMENT UPDATES: Only assigned users and admins
DROP POLICY IF EXISTS "Users can update their own documents in customer projects" ON public.documents;
DROP POLICY IF EXISTS "Users can update assigned or owned documents" ON public.documents;

CREATE POLICY "document_restricted_update"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR is_system_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = documents.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
  OR EXISTS (
    SELECT 1 FROM batches b
    WHERE b.id = documents.batch_id
    AND (b.assigned_to = auth.uid() OR b.created_by = auth.uid())
  )
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR is_system_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = documents.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- 5. DOCUMENT DELETION: Only admins
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "Only admins can delete documents" ON public.documents;
DROP POLICY IF EXISTS "System admins can delete any documents" ON public.documents;

CREATE POLICY "document_admin_delete"
ON public.documents
FOR DELETE
TO authenticated
USING (
  is_system_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = documents.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- 6. CUSTOMER CONTACT INFO: Restrict phone/email to admins
DROP POLICY IF EXISTS "Users can view their assigned customers" ON public.customers;

CREATE POLICY "customer_restricted_view"
ON public.customers
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  OR is_tenant_admin(auth.uid(), id)
);

-- 7. Add redaction_audit_log table for compliance tracking
CREATE TABLE IF NOT EXISTS public.redaction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.redaction_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
CREATE POLICY "admins_view_redaction_audit"
ON public.redaction_audit_log
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM documents d
    JOIN projects p ON p.id = d.project_id
    WHERE d.id = redaction_audit_log.document_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- Users can insert their own audit entries
CREATE POLICY "users_log_redaction_views"
ON public.redaction_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 8. Add index for audit queries
CREATE INDEX IF NOT EXISTS idx_redaction_audit_document 
ON public.redaction_audit_log(document_id);

CREATE INDEX IF NOT EXISTS idx_redaction_audit_user_date 
ON public.redaction_audit_log(user_id, viewed_at DESC);