-- Create scheduled exports table
CREATE TABLE public.scheduled_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  time_of_day TIME NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  is_active BOOLEAN NOT NULL DEFAULT true,
  export_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  destination_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.scheduled_exports ENABLE ROW LEVEL SECURITY;

-- System admins can manage all scheduled exports
CREATE POLICY "System admins can manage all scheduled exports"
ON public.scheduled_exports
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Tenant admins can manage their scheduled exports
CREATE POLICY "Tenant admins can manage their scheduled exports"
ON public.scheduled_exports
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = scheduled_exports.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = scheduled_exports.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- Users can view scheduled exports for their customer projects
CREATE POLICY "Users can view scheduled exports for their projects"
ON public.scheduled_exports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = scheduled_exports.project_id
    AND (
      p.customer_id IS NULL
      OR has_customer(auth.uid(), p.customer_id)
    )
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_scheduled_exports_updated_at
BEFORE UPDATE ON public.scheduled_exports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient querying of active schedules
CREATE INDEX idx_scheduled_exports_next_run 
ON public.scheduled_exports(next_run_at) 
WHERE is_active = true;