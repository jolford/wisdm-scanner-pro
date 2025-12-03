-- SSO/SAML Configuration
CREATE TABLE public.sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('azure_ad', 'okta', 'onelogin', 'custom_saml')),
  provider_name TEXT NOT NULL,
  entity_id TEXT,
  sso_url TEXT,
  certificate TEXT,
  metadata_url TEXT,
  attribute_mapping JSONB DEFAULT '{"email": "email", "name": "name", "groups": "groups"}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  enforce_sso BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- SCIM Configuration
CREATE TABLE public.scim_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  scim_token_hash TEXT NOT NULL,
  scim_token_prefix TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_provision_users BOOLEAN DEFAULT true,
  auto_deactivate_users BOOLEAN DEFAULT true,
  default_role app_role DEFAULT 'user',
  group_mappings JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(customer_id)
);

-- SCIM Sync Logs
CREATE TABLE public.scim_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scim_config_id UUID REFERENCES public.scim_configs(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document Retention Policies
CREATE TABLE public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  retention_days INTEGER NOT NULL DEFAULT 365,
  applies_to_projects UUID[],
  applies_to_document_types TEXT[],
  auto_purge BOOLEAN DEFAULT false,
  archive_before_purge BOOLEAN DEFAULT true,
  archive_location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Document Purge Logs (chain of custody)
CREATE TABLE public.document_purge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  policy_id UUID REFERENCES public.retention_policies(id),
  document_id UUID NOT NULL,
  document_name TEXT,
  project_id UUID,
  batch_id UUID,
  purge_reason TEXT NOT NULL,
  archived_location TEXT,
  purged_by UUID REFERENCES auth.users(id),
  purged_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Enhanced SLA Configurations
CREATE TABLE public.sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  processing_time_target_minutes INTEGER DEFAULT 60,
  validation_time_target_minutes INTEGER DEFAULT 120,
  export_time_target_minutes INTEGER DEFAULT 30,
  uptime_target_percentage DECIMAL(5,2) DEFAULT 99.9,
  alert_on_breach BOOLEAN DEFAULT true,
  alert_recipients TEXT[],
  escalation_after_minutes INTEGER DEFAULT 30,
  escalation_recipients TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- SLA Breach Tracking
CREATE TABLE public.sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  sla_config_id UUID REFERENCES public.sla_configs(id),
  breach_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  target_value INTEGER,
  actual_value INTEGER,
  breach_details JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sso_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scim_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scim_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_purge_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_breaches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for SSO configs (admin only)
CREATE POLICY "Tenant admins can manage SSO configs"
ON public.sso_configs FOR ALL
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));

-- RLS Policies for SCIM configs (admin only)
CREATE POLICY "Tenant admins can manage SCIM configs"
ON public.scim_configs FOR ALL
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));

CREATE POLICY "Tenant admins can view SCIM logs"
ON public.scim_sync_logs FOR SELECT
USING (
  is_system_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.scim_configs sc 
    WHERE sc.id = scim_config_id 
    AND is_tenant_admin(auth.uid(), sc.customer_id)
  )
);

-- RLS Policies for retention policies
CREATE POLICY "Tenant admins can manage retention policies"
ON public.retention_policies FOR ALL
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));

-- RLS Policies for purge logs
CREATE POLICY "Tenant admins can view purge logs"
ON public.document_purge_logs FOR SELECT
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));

-- RLS Policies for SLA configs
CREATE POLICY "Tenant admins can manage SLA configs"
ON public.sla_configs FOR ALL
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));

-- RLS Policies for SLA breaches
CREATE POLICY "Users can view SLA breaches for their customers"
ON public.sla_breaches FOR SELECT
USING (is_system_admin(auth.uid()) OR has_customer(auth.uid(), customer_id));

CREATE POLICY "Tenant admins can update SLA breaches"
ON public.sla_breaches FOR UPDATE
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));

-- Indexes for performance
CREATE INDEX idx_sso_configs_customer ON public.sso_configs(customer_id);
CREATE INDEX idx_scim_configs_customer ON public.scim_configs(customer_id);
CREATE INDEX idx_retention_policies_customer ON public.retention_policies(customer_id);
CREATE INDEX idx_document_purge_logs_customer ON public.document_purge_logs(customer_id);
CREATE INDEX idx_document_purge_logs_purged_at ON public.document_purge_logs(purged_at);
CREATE INDEX idx_sla_breaches_customer ON public.sla_breaches(customer_id);
CREATE INDEX idx_sla_breaches_created ON public.sla_breaches(created_at);