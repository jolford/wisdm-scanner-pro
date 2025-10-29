-- Create signature_references table to store reference signatures
CREATE TABLE public.signature_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- e.g., 'voter', 'employee', 'customer'
  entity_id TEXT NOT NULL, -- The identifier (e.g., voter ID, employee number)
  entity_name TEXT, -- Optional display name
  signature_image_url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE public.signature_references ENABLE ROW LEVEL SECURITY;

-- System admins can manage all signatures
CREATE POLICY "System admins can manage all signature references"
ON public.signature_references
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Tenant admins can manage their signature references
CREATE POLICY "Tenant admins can manage their signature references"
ON public.signature_references
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = signature_references.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = signature_references.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- Users can view signature references for their projects
CREATE POLICY "Users can view signature references for their projects"
ON public.signature_references
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = signature_references.project_id
    AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_signature_references_updated_at
BEFORE UPDATE ON public.signature_references
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_signature_references_lookup 
ON public.signature_references(project_id, entity_type, entity_id) 
WHERE is_active = true;