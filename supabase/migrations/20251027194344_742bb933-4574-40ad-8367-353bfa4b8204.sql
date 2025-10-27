-- Create audit_trail table for comprehensive tracking
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id),
  action_type TEXT NOT NULL, -- 'view', 'edit', 'delete', 'export', 'validate', 'scan', 'upload', 'download', 'approve', 'reject'
  entity_type TEXT NOT NULL, -- 'document', 'batch', 'project', 'user', 'license', 'settings'
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for common queries
CREATE INDEX idx_audit_trail_user_id ON public.audit_trail(user_id);
CREATE INDEX idx_audit_trail_customer_id ON public.audit_trail(customer_id);
CREATE INDEX idx_audit_trail_entity ON public.audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_action ON public.audit_trail(action_type, created_at DESC);
CREATE INDEX idx_audit_trail_created_at ON public.audit_trail(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- System admins can view all audit logs
CREATE POLICY "System admins can view all audit logs"
  ON public.audit_trail
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- Tenant admins can view their customer audit logs
CREATE POLICY "Tenant admins can view their audit logs"
  ON public.audit_trail
  FOR SELECT
  USING (
    customer_id IS NOT NULL 
    AND is_tenant_admin(auth.uid(), customer_id)
  );

-- Users can view their own actions
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_trail
  FOR SELECT
  USING (user_id = auth.uid());

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON public.audit_trail
  FOR INSERT
  WITH CHECK (true);

-- Create barcode_types table for barcode configuration
CREATE TABLE IF NOT EXISTS public.barcode_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode_format TEXT NOT NULL, -- 'code39', 'code128', 'qr', 'datamatrix', 'ean13', 'upca'
  action TEXT NOT NULL, -- 'separate', 'index', 'classify', 'route'
  pattern TEXT, -- Optional regex pattern to match
  document_class_id UUID REFERENCES public.document_classes(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on barcode_types
ALTER TABLE public.barcode_types ENABLE ROW LEVEL SECURITY;

-- System admins can manage all barcode types
CREATE POLICY "System admins can manage all barcode types"
  ON public.barcode_types
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Tenant admins can manage their barcode types
CREATE POLICY "Tenant admins can manage their barcode types"
  ON public.barcode_types
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = barcode_types.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = barcode_types.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

-- Users can view barcode types for their projects
CREATE POLICY "Users can view barcode types"
  ON public.barcode_types
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = barcode_types.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

-- Add indexes
CREATE INDEX idx_barcode_types_project ON public.barcode_types(project_id);
CREATE INDEX idx_barcode_types_format ON public.barcode_types(barcode_format);

-- Create reporting_snapshots table for dashboard metrics
CREATE TABLE IF NOT EXISTS public.reporting_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id),
  snapshot_date DATE NOT NULL,
  snapshot_hour INTEGER,
  metric_type TEXT NOT NULL, -- 'throughput', 'accuracy', 'processing_time', 'user_activity', 'error_rate'
  metric_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reporting_snapshots ENABLE ROW LEVEL SECURITY;

-- System admins can view all snapshots
CREATE POLICY "System admins can view all snapshots"
  ON public.reporting_snapshots
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- Tenant admins can view their snapshots
CREATE POLICY "Tenant admins can view their snapshots"
  ON public.reporting_snapshots
  FOR SELECT
  USING (
    customer_id IS NOT NULL 
    AND is_tenant_admin(auth.uid(), customer_id)
  );

-- Users can view their customer snapshots
CREATE POLICY "Users can view their snapshots"
  ON public.reporting_snapshots
  FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

-- System can insert snapshots
CREATE POLICY "System can insert snapshots"
  ON public.reporting_snapshots
  FOR INSERT
  WITH CHECK (true);

-- Add indexes for reporting queries
CREATE INDEX idx_snapshots_customer_date ON public.reporting_snapshots(customer_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_metric_type ON public.reporting_snapshots(metric_type, snapshot_date DESC);