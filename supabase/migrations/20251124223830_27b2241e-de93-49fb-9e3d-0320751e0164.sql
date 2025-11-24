-- Create installed_integrations table to track which integrations are installed per customer
CREATE TABLE IF NOT EXISTS public.installed_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,
  integration_name TEXT NOT NULL,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  installed_by UUID REFERENCES auth.users(id),
  configuration JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(customer_id, integration_id)
);

-- Enable RLS
ALTER TABLE public.installed_integrations ENABLE ROW LEVEL SECURITY;

-- Policies for installed_integrations
CREATE POLICY "Users can view their customer's installed integrations"
  ON public.installed_integrations FOR SELECT
  USING (
    customer_id IN (
      SELECT customer_id FROM public.licenses
      WHERE id IN (
        SELECT license_id FROM public.license_usage WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage installed integrations"
  ON public.installed_integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Index for faster lookups
CREATE INDEX idx_installed_integrations_customer ON public.installed_integrations(customer_id);
CREATE INDEX idx_installed_integrations_integration_id ON public.installed_integrations(integration_id);