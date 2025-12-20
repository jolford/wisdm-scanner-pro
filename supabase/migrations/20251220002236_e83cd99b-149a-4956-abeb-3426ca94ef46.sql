
-- ===========================================
-- 1. ADD updated_at TRIGGERS (IDEMPOTENT)
-- ===========================================

-- Drop and recreate all triggers to ensure consistency
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
DROP TRIGGER IF EXISTS update_barcode_types_updated_at ON public.barcode_types;
DROP TRIGGER IF EXISTS update_batch_auto_rules_updated_at ON public.batch_auto_rules;
DROP TRIGGER IF EXISTS update_batch_templates_updated_at ON public.batch_templates;
DROP TRIGGER IF EXISTS update_batches_updated_at ON public.batches;
DROP TRIGGER IF EXISTS update_custom_scripts_updated_at ON public.custom_scripts;
DROP TRIGGER IF EXISTS update_customer_testimonials_updated_at ON public.customer_testimonials;
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
DROP TRIGGER IF EXISTS update_document_classes_updated_at ON public.document_classes;
DROP TRIGGER IF EXISTS update_document_comments_updated_at ON public.document_comments;
DROP TRIGGER IF EXISTS update_document_exceptions_updated_at ON public.document_exceptions;
DROP TRIGGER IF EXISTS update_email_import_configs_updated_at ON public.email_import_configs;
DROP TRIGGER IF EXISTS update_fax_import_configs_updated_at ON public.fax_import_configs;
DROP TRIGGER IF EXISTS update_field_learning_data_updated_at ON public.field_learning_data;
DROP TRIGGER IF EXISTS update_fraud_detections_updated_at ON public.fraud_detections;
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
DROP TRIGGER IF EXISTS update_licenses_updated_at ON public.licenses;
DROP TRIGGER IF EXISTS update_ml_document_templates_updated_at ON public.ml_document_templates;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
DROP TRIGGER IF EXISTS update_release_notes_updated_at ON public.release_notes;
DROP TRIGGER IF EXISTS update_retention_policies_updated_at ON public.retention_policies;
DROP TRIGGER IF EXISTS update_routing_config_updated_at ON public.routing_config;
DROP TRIGGER IF EXISTS update_scanner_import_configs_updated_at ON public.scanner_import_configs;
DROP TRIGGER IF EXISTS update_scheduled_exports_updated_at ON public.scheduled_exports;
DROP TRIGGER IF EXISTS update_scim_configs_updated_at ON public.scim_configs;
DROP TRIGGER IF EXISTS update_script_agents_updated_at ON public.script_agents;
DROP TRIGGER IF EXISTS update_script_jobs_updated_at ON public.script_jobs;
DROP TRIGGER IF EXISTS update_script_templates_updated_at ON public.script_templates;
DROP TRIGGER IF EXISTS update_signature_references_updated_at ON public.signature_references;
DROP TRIGGER IF EXISTS update_sla_configs_updated_at ON public.sla_configs;
DROP TRIGGER IF EXISTS update_sso_configs_updated_at ON public.sso_configs;
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
DROP TRIGGER IF EXISTS update_tenant_limits_updated_at ON public.tenant_limits;
DROP TRIGGER IF EXISTS update_tenant_usage_updated_at ON public.tenant_usage;
DROP TRIGGER IF EXISTS update_user_dashboard_widgets_updated_at ON public.user_dashboard_widgets;
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
DROP TRIGGER IF EXISTS update_validation_analytics_updated_at ON public.validation_analytics;
DROP TRIGGER IF EXISTS update_validation_rules_updated_at ON public.validation_rules;
DROP TRIGGER IF EXISTS update_voter_registry_updated_at ON public.voter_registry;
DROP TRIGGER IF EXISTS update_webhook_configs_updated_at ON public.webhook_configs;
DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
DROP TRIGGER IF EXISTS update_zone_templates_updated_at ON public.zone_templates;

-- Now create all triggers
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_barcode_types_updated_at BEFORE UPDATE ON public.barcode_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_batch_auto_rules_updated_at BEFORE UPDATE ON public.batch_auto_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_batch_templates_updated_at BEFORE UPDATE ON public.batch_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_custom_scripts_updated_at BEFORE UPDATE ON public.custom_scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_testimonials_updated_at BEFORE UPDATE ON public.customer_testimonials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_document_classes_updated_at BEFORE UPDATE ON public.document_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_document_comments_updated_at BEFORE UPDATE ON public.document_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_document_exceptions_updated_at BEFORE UPDATE ON public.document_exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_import_configs_updated_at BEFORE UPDATE ON public.email_import_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fax_import_configs_updated_at BEFORE UPDATE ON public.fax_import_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_field_learning_data_updated_at BEFORE UPDATE ON public.field_learning_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fraud_detections_updated_at BEFORE UPDATE ON public.fraud_detections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ml_document_templates_updated_at BEFORE UPDATE ON public.ml_document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_release_notes_updated_at BEFORE UPDATE ON public.release_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_retention_policies_updated_at BEFORE UPDATE ON public.retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_routing_config_updated_at BEFORE UPDATE ON public.routing_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scanner_import_configs_updated_at BEFORE UPDATE ON public.scanner_import_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scheduled_exports_updated_at BEFORE UPDATE ON public.scheduled_exports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scim_configs_updated_at BEFORE UPDATE ON public.scim_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_script_agents_updated_at BEFORE UPDATE ON public.script_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_script_jobs_updated_at BEFORE UPDATE ON public.script_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_script_templates_updated_at BEFORE UPDATE ON public.script_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_signature_references_updated_at BEFORE UPDATE ON public.signature_references FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sla_configs_updated_at BEFORE UPDATE ON public.sla_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sso_configs_updated_at BEFORE UPDATE ON public.sso_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenant_limits_updated_at BEFORE UPDATE ON public.tenant_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenant_usage_updated_at BEFORE UPDATE ON public.tenant_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_dashboard_widgets_updated_at BEFORE UPDATE ON public.user_dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_validation_analytics_updated_at BEFORE UPDATE ON public.validation_analytics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_validation_rules_updated_at BEFORE UPDATE ON public.validation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_voter_registry_updated_at BEFORE UPDATE ON public.voter_registry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_webhook_configs_updated_at BEFORE UPDATE ON public.webhook_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_zone_templates_updated_at BEFORE UPDATE ON public.zone_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 2. AUTO-RETRY STUCK JOBS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.retry_stuck_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  retried_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  WITH stuck_jobs AS (
    SELECT id, attempts, max_attempts
    FROM jobs
    WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '30 minutes'
    FOR UPDATE SKIP LOCKED
  ),
  retry_jobs AS (
    UPDATE jobs j
    SET 
      status = CASE 
        WHEN sj.attempts >= sj.max_attempts THEN 'failed'::job_status
        ELSE 'pending'::job_status
      END,
      attempts = sj.attempts + 1,
      started_at = NULL,
      error_message = CASE 
        WHEN sj.attempts >= sj.max_attempts THEN 'Job timed out after max retries'
        ELSE 'Auto-retried: job was stuck in processing'
      END,
      updated_at = NOW()
    FROM stuck_jobs sj
    WHERE j.id = sj.id
    RETURNING j.status
  )
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO retried_count, failed_count
  FROM retry_jobs;
  
  RETURN jsonb_build_object(
    'stuck_found', retried_count + failed_count,
    'retried', retried_count,
    'failed_permanently', failed_count,
    'executed_at', NOW()
  );
END;
$$;

-- ===========================================
-- 3. CLEANUP OLD AUDIT TRAIL FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_trail(retention_days INTEGER DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_trail
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deleted_count', deleted_count,
    'retention_days', retention_days,
    'executed_at', NOW()
  );
END;
$$;

-- ===========================================
-- 4. CLEANUP OLD ERROR LOGS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs(retention_days INTEGER DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.error_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deleted_count', deleted_count,
    'retention_days', retention_days,
    'executed_at', NOW()
  );
END;
$$;

-- ===========================================
-- 5. CLEANUP COMPLETED JOBS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.cleanup_completed_jobs(retention_days INTEGER DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.jobs
  WHERE status IN ('completed', 'failed')
  AND completed_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deleted_count', deleted_count,
    'retention_days', retention_days,
    'executed_at', NOW()
  );
END;
$$;

-- ===========================================
-- 6. SYSTEM HEALTH CHECK FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  health_status jsonb;
  pending_jobs INTEGER;
  processing_jobs INTEGER;
  stuck_jobs INTEGER;
  failed_jobs_24h INTEGER;
  expired_locks INTEGER;
  active_exports INTEGER;
  stalled_exports INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'processing'),
    COUNT(*) FILTER (WHERE status = 'processing' AND started_at < NOW() - INTERVAL '30 minutes'),
    COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours')
  INTO pending_jobs, processing_jobs, stuck_jobs, failed_jobs_24h
  FROM jobs;
  
  SELECT COUNT(*) INTO expired_locks FROM document_locks WHERE expires_at < NOW();
  
  SELECT 
    COUNT(*) FILTER (WHERE export_started_at IS NOT NULL AND exported_at IS NULL),
    COUNT(*) FILTER (WHERE export_started_at IS NOT NULL AND exported_at IS NULL AND export_started_at < NOW() - INTERVAL '1 hour')
  INTO active_exports, stalled_exports
  FROM batches;
  
  health_status := jsonb_build_object(
    'status', CASE 
      WHEN stuck_jobs > 5 OR stalled_exports > 0 THEN 'critical'
      WHEN stuck_jobs > 0 OR failed_jobs_24h > 10 OR expired_locks > 10 THEN 'warning'
      ELSE 'healthy'
    END,
    'jobs', jsonb_build_object('pending', pending_jobs, 'processing', processing_jobs, 'stuck', stuck_jobs, 'failed_24h', failed_jobs_24h),
    'locks', jsonb_build_object('expired', expired_locks),
    'exports', jsonb_build_object('active', active_exports, 'stalled', stalled_exports),
    'checked_at', NOW()
  );
  
  RETURN health_status;
END;
$$;

-- ===========================================
-- 7. MASTER MAINTENANCE FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.run_system_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  results jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.cleanup_expired_locks();
  PERFORM public.delete_expired_cache();
  results := results || jsonb_build_object('stuck_jobs', public.retry_stuck_jobs());
  results := results || jsonb_build_object('old_jobs', public.cleanup_completed_jobs(7));
  results := results || jsonb_build_object('error_logs', public.cleanup_old_error_logs(30));
  results := results || jsonb_build_object('audit_trail', public.cleanup_old_audit_trail(90));
  results := results || jsonb_build_object('health', public.get_system_health());
  results := results || jsonb_build_object('executed_at', NOW());
  RETURN results;
END;
$$;
