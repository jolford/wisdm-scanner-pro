-- Fix integration marketplace RLS policy - correct version
-- Drop the problematic policy that directly accesses auth.users
DROP POLICY IF EXISTS "Admins can manage installed integrations" ON installed_integrations;

-- Recreate with correct function signatures
CREATE POLICY "Admins can manage installed integrations" 
ON installed_integrations 
FOR ALL 
TO public
USING (
  is_system_admin(auth.uid()) 
  OR has_customer(auth.uid(), customer_id)
);

-- Remove duplicate view policy
DROP POLICY IF EXISTS "Users can view their customer's installed integrations" ON installed_integrations;