-- Create routing configuration table
CREATE TABLE IF NOT EXISTS public.routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  high_confidence_threshold INTEGER DEFAULT 90,
  medium_confidence_threshold INTEGER DEFAULT 70,
  auto_validate_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.routing_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routing_config
CREATE POLICY "Users can view their customer's routing config"
  ON public.routing_config FOR SELECT
  USING (
    is_system_admin(auth.uid()) OR
    has_customer(auth.uid(), customer_id)
  );

CREATE POLICY "Admins can manage routing config"
  ON public.routing_config FOR ALL
  USING (
    is_system_admin(auth.uid()) OR
    is_tenant_admin(auth.uid(), customer_id)
  );

-- Create index for faster lookups
CREATE INDEX idx_routing_config_customer ON public.routing_config(customer_id);

-- Add trigger for updated_at
CREATE TRIGGER update_routing_config_updated_at
  BEFORE UPDATE ON public.routing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();