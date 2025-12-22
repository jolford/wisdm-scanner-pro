-- Add restrictive policies requiring authentication for profiles, customers, and sso_configs

-- Profiles: require authentication for all access
CREATE POLICY "profiles_require_auth"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Customers: require authentication for all access
CREATE POLICY "customers_require_auth"
ON public.customers
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- SSO Configs: require authentication for all access
CREATE POLICY "sso_configs_require_auth"
ON public.sso_configs
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);