-- Create workflow versions table for tracking history
CREATE TABLE public.workflow_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  workflow_nodes JSONB DEFAULT '[]'::jsonb,
  workflow_edges JSONB DEFAULT '[]'::jsonb,
  trigger_events TEXT[],
  is_active BOOLEAN DEFAULT true,
  change_type TEXT NOT NULL, -- 'created', 'updated', 'activated', 'deactivated'
  change_summary TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workflow_id, version_number)
);

-- Enable RLS
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "System admins can manage all workflow versions"
  ON public.workflow_versions FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their workflow versions"
  ON public.workflow_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workflows w
    JOIN projects p ON p.id = w.project_id
    WHERE w.id = workflow_versions.workflow_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workflows w
    JOIN projects p ON p.id = w.project_id
    WHERE w.id = workflow_versions.workflow_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  ));

CREATE POLICY "Users can view workflow versions for their projects"
  ON public.workflow_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workflows w
    JOIN projects p ON p.id = w.project_id
    WHERE w.id = workflow_versions.workflow_id
    AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
  ));

-- Create function to snapshot workflow changes
CREATE OR REPLACE FUNCTION public.create_workflow_version_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _version_number INTEGER;
  _change_type TEXT;
  _change_summary TEXT;
BEGIN
  -- Determine version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO _version_number
  FROM public.workflow_versions
  WHERE workflow_id = NEW.id;

  -- Determine change type and summary
  IF TG_OP = 'INSERT' THEN
    _change_type := 'created';
    _change_summary := 'Workflow created';
  ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    _change_type := CASE WHEN NEW.is_active THEN 'activated' ELSE 'deactivated' END;
    _change_summary := CASE WHEN NEW.is_active THEN 'Workflow activated' ELSE 'Workflow deactivated' END;
  ELSIF OLD.workflow_nodes::text IS DISTINCT FROM NEW.workflow_nodes::text 
        OR OLD.workflow_edges::text IS DISTINCT FROM NEW.workflow_edges::text THEN
    _change_type := 'updated';
    _change_summary := 'Workflow nodes/edges modified';
  ELSIF OLD.name IS DISTINCT FROM NEW.name OR OLD.description IS DISTINCT FROM NEW.description THEN
    _change_type := 'updated';
    _change_summary := 'Workflow metadata updated';
  ELSE
    _change_type := 'updated';
    _change_summary := 'Workflow configuration changed';
  END IF;

  -- Create version snapshot
  INSERT INTO public.workflow_versions (
    workflow_id,
    version_number,
    name,
    description,
    workflow_nodes,
    workflow_edges,
    trigger_events,
    is_active,
    change_type,
    change_summary,
    changed_by
  ) VALUES (
    NEW.id,
    _version_number,
    NEW.name,
    NEW.description,
    NEW.workflow_nodes,
    NEW.workflow_edges,
    NEW.trigger_events,
    NEW.is_active,
    _change_type,
    _change_summary,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- Create trigger for workflow versioning
CREATE TRIGGER workflow_version_trigger
  AFTER INSERT OR UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workflow_version_snapshot();

-- Create index for faster queries
CREATE INDEX idx_workflow_versions_workflow_id ON public.workflow_versions(workflow_id);
CREATE INDEX idx_workflow_versions_changed_at ON public.workflow_versions(changed_at DESC);