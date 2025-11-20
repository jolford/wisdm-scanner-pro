-- Fix email credentials exposure by restricting visibility to admins only
-- Drop the overly permissive policy that allows all project users to view email credentials

DROP POLICY IF EXISTS "Users can view email configs for their projects" ON public.email_import_configs;

-- Note: Admin-level policies remain in place:
-- - "System admins can manage all email configs"
-- - "Tenant admins can manage their email configs" 
-- These policies properly restrict email config access to administrators only