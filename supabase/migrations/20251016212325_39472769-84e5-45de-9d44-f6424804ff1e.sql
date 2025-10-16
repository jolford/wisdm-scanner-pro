-- Create helper function to check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  )
$$;

-- Create helper function to check if user is tenant admin for a specific customer
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.user_customers uc ON uc.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'
      AND uc.customer_id = _customer_id
  )
$$;

-- Update RLS policies to use system_admin for full access

-- Batches policies
DROP POLICY IF EXISTS "Admins can manage batches" ON public.batches;
CREATE POLICY "System admins can manage all batches"
ON public.batches
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their batches"
ON public.batches
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = batches.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = batches.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- Update batches view policy
DROP POLICY IF EXISTS "Users can view batches for their customer projects" ON public.batches;
CREATE POLICY "Users can view batches for their customer projects"
ON public.batches
FOR SELECT
USING (
  is_system_admin(auth.uid()) OR
  is_tenant_admin(auth.uid(), (SELECT customer_id FROM projects WHERE id = batches.project_id)) OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = batches.project_id
    AND ((p.customer_id IS NULL) OR has_customer(auth.uid(), p.customer_id))
  )
);

-- Customers policies
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "System admins can manage all customers"
ON public.customers
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view and update their customer"
ON public.customers
FOR SELECT
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), id) OR has_customer(auth.uid(), id));

CREATE POLICY "Tenant admins can update their customer"
ON public.customers
FOR UPDATE
USING (is_tenant_admin(auth.uid(), id))
WITH CHECK (is_tenant_admin(auth.uid(), id));

-- Projects policies
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
CREATE POLICY "System admins can manage all projects"
ON public.projects
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their projects"
ON public.projects
FOR ALL
USING (customer_id IS NOT NULL AND is_tenant_admin(auth.uid(), customer_id))
WITH CHECK (customer_id IS NOT NULL AND is_tenant_admin(auth.uid(), customer_id));

-- Document classes policies
DROP POLICY IF EXISTS "Admins can manage document classes" ON public.document_classes;
CREATE POLICY "System admins can manage all document classes"
ON public.document_classes
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their document classes"
ON public.document_classes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = document_classes.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = document_classes.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  )
);

-- Licenses policies
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.licenses;
CREATE POLICY "System admins can manage all licenses"
ON public.licenses
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their licenses"
ON public.licenses
FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id))
WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

-- Cost alerts policies
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.cost_alerts;
CREATE POLICY "System admins can manage all alerts"
ON public.cost_alerts
FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their alerts"
ON public.cost_alerts
FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id));

-- Update cost_alerts view policy
DROP POLICY IF EXISTS "Users can view their customer alerts" ON public.cost_alerts;
CREATE POLICY "Users can view their customer alerts"
ON public.cost_alerts
FOR SELECT
USING (
  is_system_admin(auth.uid()) OR
  is_tenant_admin(auth.uid(), customer_id) OR
  has_customer(auth.uid(), customer_id)
);

-- Tenant limits policies
DROP POLICY IF EXISTS "Admins can manage limits" ON public.tenant_limits;
CREATE POLICY "System admins can manage all limits"
ON public.tenant_limits
FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their limits"
ON public.tenant_limits
FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id));

-- Update tenant_limits view policy
DROP POLICY IF EXISTS "Users can view their customer limits" ON public.tenant_limits;
CREATE POLICY "Users can view their customer limits"
ON public.tenant_limits
FOR SELECT
USING (
  is_system_admin(auth.uid()) OR
  is_tenant_admin(auth.uid(), customer_id) OR
  has_customer(auth.uid(), customer_id)
);

-- Tenant usage policies
DROP POLICY IF EXISTS "Admins can manage usage" ON public.tenant_usage;
CREATE POLICY "System admins can manage all usage"
ON public.tenant_usage
FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their usage"
ON public.tenant_usage
FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id));

-- Update tenant_usage view policy
DROP POLICY IF EXISTS "Users can view their customer usage" ON public.tenant_usage;
CREATE POLICY "Users can view their customer usage"
ON public.tenant_usage
FOR SELECT
USING (
  is_system_admin(auth.uid()) OR
  is_tenant_admin(auth.uid(), customer_id) OR
  has_customer(auth.uid(), customer_id)
);

-- User roles policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "System admins can view all roles"
ON public.user_roles
FOR SELECT
USING (is_system_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "System admins can manage all roles"
ON public.user_roles
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their tenant users roles"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_customers uc1
    INNER JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = user_roles.user_id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
  )
);

CREATE POLICY "Tenant admins can manage their tenant users roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_customers uc1
    INNER JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = user_roles.user_id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
    AND user_roles.role != 'system_admin' -- Tenant admins cannot assign system_admin role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_customers uc1
    INNER JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = user_roles.user_id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
    AND user_roles.role != 'system_admin' -- Tenant admins cannot assign system_admin role
  )
);

-- User customers policies
DROP POLICY IF EXISTS "Admins can manage all customer relationships" ON public.user_customers;
CREATE POLICY "System admins can manage all customer relationships"
ON public.user_customers
FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their customer relationships"
ON public.user_customers
FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id));

-- User permissions policies
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "System admins can manage all permissions"
ON public.user_permissions
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their tenant users permissions"
ON public.user_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_customers uc1
    INNER JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = user_permissions.user_id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_customers uc1
    INNER JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = user_permissions.user_id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
  )
);

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON public.profiles;
CREATE POLICY "Users can view their own profile or admins can view all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR
  is_system_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM user_customers uc1
    INNER JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = profiles.id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
  )
);

-- Error logs policies
DROP POLICY IF EXISTS "Admins can view all error logs" ON public.error_logs;
CREATE POLICY "System admins can view all error logs"
ON public.error_logs
FOR SELECT
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their tenant error logs"
ON public.error_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_customers
    WHERE user_customers.user_id = error_logs.user_id
    AND is_tenant_admin(auth.uid(), user_customers.customer_id)
  )
);

-- Jobs policies
DROP POLICY IF EXISTS "Admins can manage all jobs" ON public.jobs;
CREATE POLICY "System admins can manage all jobs"
ON public.jobs
FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their jobs"
ON public.jobs
FOR ALL
USING (customer_id IS NOT NULL AND is_tenant_admin(auth.uid(), customer_id));

-- License usage policies
DROP POLICY IF EXISTS "Admins can manage license usage" ON public.license_usage;
CREATE POLICY "System admins can manage all license usage"
ON public.license_usage
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their license usage"
ON public.license_usage
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_usage.license_id
    AND is_tenant_admin(auth.uid(), l.customer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_usage.license_id
    AND is_tenant_admin(auth.uid(), l.customer_id)
  )
);