-- Add DELETE policy for error_logs table to allow admins to delete

-- Allow system admins to delete error logs
CREATE POLICY "System admins can delete error logs"
ON public.error_logs
FOR DELETE
TO authenticated
USING (is_system_admin(auth.uid()));

-- Allow tenant admins to delete error logs from their tenant users
CREATE POLICY "Tenant admins can delete error logs from their tenant"
ON public.error_logs
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM user_customers
  WHERE user_customers.user_id = error_logs.user_id
    AND is_tenant_admin(auth.uid(), user_customers.customer_id)
));