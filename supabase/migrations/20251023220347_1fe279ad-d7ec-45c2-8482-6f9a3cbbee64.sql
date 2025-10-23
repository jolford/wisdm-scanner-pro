-- Create a storage bucket for scanner auto-import
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scanner-import',
  'scanner-import',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/tiff', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for scanner-import bucket
CREATE POLICY "Authenticated users can upload to scanner-import"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scanner-import');

CREATE POLICY "Authenticated users can view scanner-import"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'scanner-import');

CREATE POLICY "System can manage scanner-import files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'scanner-import');

-- Create table to track auto-import configurations
CREATE TABLE IF NOT EXISTS public.scanner_import_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  watch_folder TEXT NOT NULL, -- Path within scanner-import bucket to watch
  auto_create_batch BOOLEAN DEFAULT true,
  batch_name_template TEXT DEFAULT 'Auto-Import {date}',
  is_active BOOLEAN DEFAULT true,
  last_check_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on scanner_import_configs
ALTER TABLE public.scanner_import_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for scanner_import_configs
CREATE POLICY "System admins can manage all import configs"
ON public.scanner_import_configs
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their import configs"
ON public.scanner_import_configs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = scanner_import_configs.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = scanner_import_configs.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

CREATE POLICY "Users can view import configs for their projects"
ON public.scanner_import_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = scanner_import_configs.project_id
    AND ((p.customer_id IS NULL) OR has_customer(auth.uid(), p.customer_id))
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_scanner_import_configs_updated_at
  BEFORE UPDATE ON public.scanner_import_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track import history
CREATE TABLE IF NOT EXISTS public.scanner_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.scanner_import_configs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  batch_id UUID REFERENCES public.batches(id),
  document_id UUID REFERENCES public.documents(id),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on scanner_import_logs
ALTER TABLE public.scanner_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view all import logs"
ON public.scanner_import_logs
FOR SELECT
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their import logs"
ON public.scanner_import_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.scanner_import_configs c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = scanner_import_logs.config_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);