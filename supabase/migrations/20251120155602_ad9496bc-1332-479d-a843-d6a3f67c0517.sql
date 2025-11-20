-- Fix webhook secrets exposure by removing overly permissive RLS policy
-- This policy allowed all users in a customer to view webhook secrets

DROP POLICY IF EXISTS "Users can view their customer webhook configs" ON public.webhook_configs;

-- Note: Admin-level policies remain in place:
-- - "System admins can manage all webhook configs" 
-- - "Tenant admins can manage their webhook configs"
-- These policies properly restrict webhook access to administrators only