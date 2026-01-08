-- =====================================================
-- Security Fix: Tighten permissive RLS policies
-- =====================================================

-- 1. SERVICE_HEALTH TABLE - Restrict to service role only
DROP POLICY IF EXISTS "Service health insert for system" ON public.service_health;
DROP POLICY IF EXISTS "Service health update for system" ON public.service_health;

CREATE POLICY "Service role can insert health" ON public.service_health
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update health" ON public.service_health
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. JOBS TABLE - Fix the overly permissive "System can update jobs" policy
DROP POLICY IF EXISTS "System can update jobs" ON public.jobs;

CREATE POLICY "Service role can update jobs" ON public.jobs
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. TOS_VERSIONS TABLE - Fix the "Authenticated users can view ToS versions" policy 
-- This is intentionally public for login flows, but should be authenticated-only
DROP POLICY IF EXISTS "Authenticated users can view ToS versions" ON public.tos_versions;

CREATE POLICY "Authenticated users can view ToS versions" ON public.tos_versions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. FIELD_CHANGES TABLE - Fix "System can insert field changes"
DROP POLICY IF EXISTS "System can insert field changes" ON public.field_changes;

CREATE POLICY "Users can insert field changes for their documents" ON public.field_changes
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM documents d
      JOIN batches b ON d.batch_id = b.id
      JOIN projects p ON b.project_id = p.id
      WHERE d.id = field_changes.document_id
      AND (
        d.uploaded_by = auth.uid() OR
        b.assigned_to = auth.uid() OR
        b.created_by = auth.uid() OR
        has_customer(auth.uid(), p.customer_id)
      )
    )
  );

-- 5. DUPLICATE_DETECTIONS TABLE - Fix "System can insert duplicate detections"
DROP POLICY IF EXISTS "System can insert duplicate detections" ON public.duplicate_detections;

CREATE POLICY "Service role can insert duplicate detections" ON public.duplicate_detections
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 6. JOB_METRICS TABLE - Fix "System can insert metrics"
DROP POLICY IF EXISTS "System can insert metrics" ON public.job_metrics;

CREATE POLICY "Service role can insert metrics" ON public.job_metrics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 7. VALIDATION_ANALYTICS TABLE - Fix "System can insert analytics"
DROP POLICY IF EXISTS "System can insert analytics" ON public.validation_analytics;

CREATE POLICY "Service role can insert analytics" ON public.validation_analytics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 8. REPORTING_SNAPSHOTS TABLE - Fix "System can insert snapshots"
DROP POLICY IF EXISTS "System can insert snapshots" ON public.reporting_snapshots;

CREATE POLICY "Service role can insert snapshots" ON public.reporting_snapshots
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 9. AUDIT_TRAIL TABLE - Fix "System can insert audit logs"
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_trail;

CREATE POLICY "Service role can insert audit logs" ON public.audit_trail
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 10. FAX_LOGS TABLE - Fix "System can insert fax logs"
DROP POLICY IF EXISTS "System can insert fax logs" ON public.fax_logs;

CREATE POLICY "Service role can insert fax logs" ON public.fax_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 11. SECURITY_SCAN_NOTIFICATIONS TABLE - Fix "System can insert security notifications"
DROP POLICY IF EXISTS "System can insert security notifications" ON public.security_scan_notifications;

CREATE POLICY "Service role can insert security notifications" ON public.security_scan_notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');