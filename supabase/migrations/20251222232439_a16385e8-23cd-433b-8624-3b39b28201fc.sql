-- Fix RLS policy for security_scan_notifications - need DELETE policy for admins
CREATE POLICY "Admins can delete security notifications"
  ON public.security_scan_notifications
  FOR DELETE
  USING (public.is_admin_enhanced());