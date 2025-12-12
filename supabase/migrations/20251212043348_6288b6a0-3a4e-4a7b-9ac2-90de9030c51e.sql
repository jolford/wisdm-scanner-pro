-- Enable the pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Create voter registry table for fast lookups
CREATE TABLE public.voter_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Core voter fields
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  address TEXT,
  city TEXT,
  zip TEXT,
  
  -- Optional additional fields
  county TEXT,
  state TEXT,
  voter_id TEXT,
  registration_date DATE,
  party_affiliation TEXT,
  precinct TEXT,
  
  -- Metadata
  source_file TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for fast lookups
CREATE INDEX idx_voter_registry_customer ON public.voter_registry(customer_id);
CREATE INDEX idx_voter_registry_project ON public.voter_registry(project_id);
CREATE INDEX idx_voter_registry_name_normalized ON public.voter_registry(name_normalized);
CREATE INDEX idx_voter_registry_name_trgm ON public.voter_registry USING gin (name_normalized extensions.gin_trgm_ops);
CREATE INDEX idx_voter_registry_zip ON public.voter_registry(zip);
CREATE INDEX idx_voter_registry_city ON public.voter_registry(lower(city));

-- Enable RLS
ALTER TABLE public.voter_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "System admins can manage all voter registries"
ON public.voter_registry FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their voter registries"
ON public.voter_registry FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id))
WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

CREATE POLICY "Users can view voter registries for their customer"
ON public.voter_registry FOR SELECT
USING (has_customer(auth.uid(), customer_id));

-- Create updated_at trigger
CREATE TRIGGER update_voter_registry_updated_at
BEFORE UPDATE ON public.voter_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();