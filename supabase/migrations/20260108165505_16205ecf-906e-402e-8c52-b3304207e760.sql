-- =====================================================
-- Security Fix: Final batch of permissive RLS policies
-- =====================================================

-- 1. ADDRESS_VALIDATIONS - Fix "System can insert address validations"
DROP POLICY IF EXISTS "System can insert address validations" ON public.address_validations;
CREATE POLICY "Service role can insert address validations" ON public.address_validations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 2. API_KEY_USAGE - Fix "System can insert API key usage"
DROP POLICY IF EXISTS "System can insert API key usage" ON public.api_key_usage;
CREATE POLICY "Service role can insert API key usage" ON public.api_key_usage
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 3. DETECTED_FIELDS - Fix "System can insert detected fields"
DROP POLICY IF EXISTS "System can insert detected fields" ON public.detected_fields;
CREATE POLICY "Service role can insert detected fields" ON public.detected_fields
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 4. DOCUMENT_CACHE - Fix "System can manage cache"
DROP POLICY IF EXISTS "System can manage cache" ON public.document_cache;
CREATE POLICY "Service role can manage cache" ON public.document_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. EXTRACTION_CONFIDENCE - Fix "System can insert confidence scores"
DROP POLICY IF EXISTS "System can insert confidence scores" ON public.extraction_confidence;
CREATE POLICY "Service role can insert confidence scores" ON public.extraction_confidence
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 6. FRAUD_DETECTIONS - Fix "System can create fraud detections"
DROP POLICY IF EXISTS "System can create fraud detections" ON public.fraud_detections;
CREATE POLICY "Service role can create fraud detections" ON public.fraud_detections
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 7. SCRIPT_EXECUTION_LOGS - Fix "System can insert execution logs"
DROP POLICY IF EXISTS "System can insert execution logs" ON public.script_execution_logs;
CREATE POLICY "Service role can insert execution logs" ON public.script_execution_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 8. SIGNATURE_COMPARISONS - Fix "System can insert signature comparisons"
DROP POLICY IF EXISTS "System can insert signature comparisons" ON public.signature_comparisons;
CREATE POLICY "Service role can insert signature comparisons" ON public.signature_comparisons
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 9. WEBHOOK_LOGS - Fix "System can insert webhook logs"
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Service role can insert webhook logs" ON public.webhook_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');