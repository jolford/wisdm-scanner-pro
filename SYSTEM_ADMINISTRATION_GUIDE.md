# WISDM Scanner Pro - System Administration Guide

## Table of Contents
1. [System Monitoring & Health](#system-monitoring--health)
2. [Rate Limiting & Performance](#rate-limiting--performance)
3. [Error Handling & Logging](#error-handling--logging)
4. [Database Backup & Recovery](#database-backup--recovery)
5. [Edge Functions Management](#edge-functions-management)
6. [Security & Compliance](#security--compliance)

---

## System Monitoring & Health

### Overview
WISDM Scanner Pro includes comprehensive monitoring capabilities to ensure system reliability and performance.

### Key Monitoring Areas

#### 1. Edge Function Health
Monitor the status of all serverless functions:

**Production Functions:**
- `send-webhook` - Webhook delivery system
- `ocr-scan` - Document OCR processing
- `job-processor` - Background job queue
- `process-hot-folders` - Hot folder monitoring
- `process-email-imports` - Email import processing
- `process-scanner-imports` - Scanner auto-import

**Check Function Logs:**
```javascript
// Access via Lovable Cloud UI
// Navigate to: Cloud → Edge Functions → [Function Name] → Logs
```

#### 2. Database Performance
Monitor database queries and connection health:

**Key Metrics:**
- Active connections
- Query execution time
- Table sizes
- Index usage
- Lock contention

**Check Database Stats:**
```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### 3. Job Queue Monitoring
Track background job processing:

**Active Jobs:**
```sql
SELECT 
  job_type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type, status;
```

**Failed Jobs:**
```sql
SELECT 
  id,
  job_type,
  error_message,
  attempts,
  created_at,
  updated_at
FROM jobs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

---

## Rate Limiting & Performance

### Rate Limit Warning System

WISDM includes a proactive rate limit monitoring system that alerts users before limits are reached.

#### How It Works

The `RateLimitWarning` component automatically:
1. Checks tenant limits every 30 seconds
2. Monitors three metrics:
   - **Concurrent jobs** (jobs running simultaneously)
   - **Jobs per minute** (throughput rate)
   - **Jobs per hour** (hourly quota)
3. Shows warning at **80% threshold**
4. Displays critical alert at **100% (rate limit reached)**

#### Configuring Tenant Limits

Set custom rate limits per customer:

```sql
-- View current limits
SELECT 
  customer_id,
  max_concurrent_jobs,
  max_jobs_per_minute,
  max_jobs_per_hour
FROM tenant_limits;

-- Set limits for a customer
INSERT INTO tenant_limits (
  customer_id,
  max_concurrent_jobs,
  max_jobs_per_minute,
  max_jobs_per_hour
) VALUES (
  'customer-uuid',
  10,   -- Max 10 concurrent jobs
  30,   -- Max 30 jobs per minute
  500   -- Max 500 jobs per hour
)
ON CONFLICT (customer_id) 
DO UPDATE SET
  max_concurrent_jobs = EXCLUDED.max_concurrent_jobs,
  max_jobs_per_minute = EXCLUDED.max_jobs_per_minute,
  max_jobs_per_hour = EXCLUDED.max_jobs_per_hour;
```

#### User Experience

**Warning State (80-99%):**
```
⚠️ Approaching Rate Limit
8/10 concurrent jobs, 24/30 jobs/minute. 
Consider spacing out job submissions to avoid rate limiting.
```

**Critical State (100%+):**
```
🚫 Rate Limit Reached
10/10 concurrent jobs. 
New jobs may be delayed or rejected until current jobs complete.
```

#### Best Practices

1. **Monitor usage patterns** - Identify peak processing times
2. **Set realistic limits** - Based on customer tier/license
3. **Implement graceful degradation** - Queue jobs when limits reached
4. **Provide user feedback** - Show clear rate limit status
5. **Adjust limits proactively** - Before customers experience issues

---

## Error Handling & Logging

### Enhanced Error Tracking

All edge functions now include granular error handling with detailed logging.

#### Error Handling Features

**1. Request-Level Error Handling**
- Validates request payloads before processing
- Returns specific error messages for missing/invalid data
- Logs all errors with stack traces

**2. Per-Webhook Error Tracking**
- Individual webhook failures don't block others
- Failed webhook count tracked separately
- Automatic retry with exponential backoff

**3. Database Operation Safety**
- Try-catch blocks around all database queries
- Graceful degradation on non-critical failures
- Detailed error messages for troubleshooting

#### Example: Webhook Error Logging

```typescript
// Enhanced logging in send-webhook function
console.log(`[Webhook] Triggering for customer ${customer_id}, event: ${event_type}`);
console.log(`[Webhook] Sending to ${webhook.url}...`);
console.error(`[Webhook] Failed to send to ${webhook.url}:`, error);
console.log(`[Webhook] Completed: ${sentCount} sent, ${failedCount} failed`);
```

#### Monitoring Webhook Delivery

**Check Recent Deliveries:**
```sql
SELECT 
  wl.created_at,
  wc.name as webhook_name,
  wc.url,
  wl.event_type,
  wl.response_status,
  wl.attempt_number,
  wl.error_message
FROM webhook_logs wl
JOIN webhook_configs wc ON wc.id = wl.webhook_config_id
WHERE wl.created_at > NOW() - INTERVAL '24 hours'
ORDER BY wl.created_at DESC
LIMIT 100;
```

**Identify Problem Webhooks:**
```sql
SELECT 
  wc.name,
  wc.url,
  COUNT(*) as failure_count,
  MAX(wl.created_at) as last_failure,
  wl.error_message
FROM webhook_logs wl
JOIN webhook_configs wc ON wc.id = wl.webhook_config_id
WHERE wl.delivered_at IS NULL
  AND wl.created_at > NOW() - INTERVAL '7 days'
GROUP BY wc.name, wc.url, wl.error_message
ORDER BY failure_count DESC;
```

#### Error Log Analysis

**Access Edge Function Logs:**
1. Navigate to **Lovable Cloud** → **Edge Functions**
2. Select the function (e.g., `send-webhook`)
3. Click **Logs** tab
4. Filter by severity: `Error`, `Warning`, `Info`

**Common Error Patterns:**

| Error Type | Cause | Solution |
|------------|-------|----------|
| `Invalid request payload` | Missing required fields | Validate input before calling |
| `Failed to fetch webhook configs` | Database connection issue | Check database status |
| `Webhook delivery failed: HTTP 500` | Target endpoint error | Contact webhook receiver |
| `Service configuration error` | Missing environment variable | Check secrets configuration |

---

## Database Backup & Recovery

### Comprehensive Backup Strategy

WISDM implements a multi-layered backup approach for maximum data protection.

#### Automated Backups (Lovable Cloud)

**Built-in Protection:**
- ✅ **Point-in-Time Recovery (PITR)**: Last 7 days
- ✅ **Daily Snapshots**: Retained for 30 days  
- ✅ **Weekly Backups**: Retained for 90 days

**No configuration needed** - these backups are automatic.

#### Manual Export Backups

**When to Use:**
- Before major updates or migrations
- For compliance/audit requirements
- To create offline copies
- Before bulk data operations

**Full Database Export:**
```bash
# Using Supabase CLI
supabase db dump -f backup-$(date +%Y%m%d).sql

# Compress for storage
gzip backup-$(date +%Y%m%d).sql
```

**Table-Specific Exports:**
Via Lovable Cloud UI:
1. Navigate to **Cloud** → **Database** → **Tables**
2. Select table to export
3. Click **Export** button
4. Choose format: CSV or SQL
5. Save securely

#### Critical Tables for Backup

**Priority 1 - Core Data:**
- `documents` - All processed documents
- `batches` - Batch processing records
- `projects` - Project configurations
- `customers` - Customer/tenant data

**Priority 2 - Configuration:**
- `extraction_fields` - Field definitions
- `validation_rules` - Validation configs
- `webhook_configs` - Webhook endpoints
- `zone_definitions` - Zonal extraction templates

**Priority 3 - Audit & Compliance:**
- `audit_logs` - Audit trail records
- `field_changes` - Document field history
- `license_usage` - License consumption logs

#### Backup Schedule Recommendations

**Development:**
- Manual exports: Weekly
- Test restores: Monthly

**Production:**
- Manual exports: Daily (automated)
- Critical data: Before major updates
- Test restores: Quarterly
- Full system backup: Before schema migrations

#### Point-in-Time Recovery (PITR)

**When to Use:**
- Accidental data deletion
- Incorrect bulk operations
- Application errors affecting data
- Rollback after failed migration

**How to Restore:**
1. Contact Lovable support or access Supabase dashboard
2. Navigate to **Database** → **Backups**
3. Select **Point-in-Time Recovery**
4. Choose target timestamp (within last 7 days)
5. Confirm restoration

⚠️ **Warning:** PITR restores entire database. All changes after timestamp will be lost.

#### Emergency Recovery

**Scenario: Complete Database Loss**

**Recovery Steps:**
1. **Stop all processing** - Disable edge functions
2. **Assess damage** - Identify affected data
3. **Notify users** - Communicate downtime
4. **Initiate restore** - Use most recent backup
5. **Verify integrity** - Run validation queries
6. **Resume operations** - Re-enable gradually
7. **Post-mortem** - Document and improve

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 1 hour

#### Data Validation After Restore

```sql
-- Check document counts
SELECT COUNT(*) as total_documents FROM documents;

-- Verify relationships
SELECT COUNT(*) FROM documents WHERE batch_id IS NOT NULL;
SELECT COUNT(*) FROM batches WHERE project_id IS NOT NULL;

-- Check for orphaned records
SELECT COUNT(*) FROM documents d 
WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.id = d.batch_id);

-- Verify user data
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM user_roles;

-- Check audit trail continuity
SELECT MIN(created_at), MAX(created_at) FROM audit_logs;
```

#### Automated Backup Script

```bash
#!/bin/bash
# /scripts/daily-backup.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/wisdm-scanner"
PROJECT_ID="your-project-id"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export database
supabase db dump \
  --project-ref "$PROJECT_ID" \
  -f "$BACKUP_DIR/backup-$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/backup-$DATE.sql"

# Upload to cloud storage (example: AWS S3)
aws s3 cp "$BACKUP_DIR/backup-$DATE.sql.gz" \
  "s3://your-backup-bucket/wisdm-scanner/$DATE/"

# Clean up old local backups (keep 7 days)
find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +7 -delete

# Log completion
echo "$(date): Backup completed successfully" >> "$BACKUP_DIR/backup.log"
```

**Setup Cron Job:**
```bash
# Run daily at 2 AM
0 2 * * * /path/to/scripts/daily-backup.sh
```

---

## Edge Functions Management

### Deployment & Monitoring

#### Automatic Deployment
All edge functions deploy automatically when code changes are pushed.

**Verify Deployment:**
1. Check function version in logs
2. Test with sample request
3. Monitor error rates

#### Manual Testing

**Test Webhook Function:**
```javascript
// Via Lovable Cloud UI or curl
curl -X POST https://your-project.supabase.co/functions/v1/send-webhook \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test-customer-id",
    "event_type": "test.webhook",
    "payload": {
      "message": "Test notification"
    }
  }'
```

#### Performance Optimization

**Cold Start Times:**
- Typical: 50-200ms
- With large dependencies: 500-1000ms
- Optimize by minimizing imports

**Execution Time Monitoring:**
```sql
-- Average execution time by function
SELECT 
  function_name,
  AVG(execution_time_ms) as avg_time_ms,
  MAX(execution_time_ms) as max_time_ms,
  COUNT(*) as invocations
FROM function_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY function_name;
```

---

## Security & Compliance

### Access Control

**System Admin Functions:**
- Create/modify projects
- Configure rate limits
- View all customer data
- Manage webhooks
- Access backup/restore

**Tenant Admin Functions:**
- Manage own projects
- View own customer data
- Configure webhooks for own tenant
- Manage users within tenant

**Regular User Functions:**
- Process documents
- Validate batches
- Export to configured systems
- View own documents

### Compliance Requirements

**GDPR/Privacy:**
- Backup files contain personal data
- Implement data retention policies
- Provide mechanisms for data deletion
- Encrypt all backups

**Audit Requirements:**
- Log all backup/restore operations
- Maintain chain of custody
- Regular security audits
- Compliance reports for regulators

### Security Checklist

**Daily:**
- [ ] Monitor failed login attempts
- [ ] Review webhook delivery failures
- [ ] Check for unusual database activity

**Weekly:**
- [ ] Review audit logs
- [ ] Verify backup completion
- [ ] Check rate limit violations
- [ ] Monitor error rates

**Monthly:**
- [ ] Test backup restoration
- [ ] Review access permissions
- [ ] Update security policies
- [ ] Audit user accounts

**Quarterly:**
- [ ] Full disaster recovery drill
- [ ] Security vulnerability scan
- [ ] Compliance documentation review
- [ ] Third-party security audit

---

## Troubleshooting Common Issues

### Issue: Webhook Deliveries Failing

**Symptoms:**
- Webhook logs show errors
- Events not reaching target system
- Retry attempts exhausted

**Diagnosis:**
```sql
SELECT 
  wc.name,
  wc.url,
  wl.error_message,
  wl.response_status,
  COUNT(*) as failure_count
FROM webhook_logs wl
JOIN webhook_configs wc ON wc.id = wl.webhook_config_id
WHERE wl.delivered_at IS NULL
  AND wl.created_at > NOW() - INTERVAL '24 hours'
GROUP BY wc.name, wc.url, wl.error_message, wl.response_status;
```

**Solutions:**
1. Check webhook endpoint is accessible
2. Verify authentication credentials
3. Review error messages in logs
4. Test webhook URL manually
5. Check retry configuration

### Issue: Rate Limits Being Hit

**Symptoms:**
- Jobs stuck in pending state
- Rate limit warnings showing
- Slow document processing

**Diagnosis:**
```sql
SELECT 
  customer_id,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute') as last_minute,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour
FROM jobs
GROUP BY customer_id;
```

**Solutions:**
1. Increase tenant limits if appropriate
2. Optimize job processing efficiency
3. Implement job batching
4. Schedule large imports during off-peak hours
5. Add more processing capacity

### Issue: Database Performance Degradation

**Symptoms:**
- Slow query execution
- Timeouts in application
- High CPU usage

**Diagnosis:**
```sql
-- Check slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- Queries taking > 1 second
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check table bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Solutions:**
1. Add missing indexes
2. Vacuum large tables
3. Archive old data
4. Optimize frequent queries
5. Increase database instance size

---

## Support & Resources

### Documentation
- **Full Backup Guide**: `DATABASE_BACKUP_GUIDE.md`
- **Security Guide**: `SECURITY_GUIDE.md`
- **API Documentation**: `API_DOCUMENTATION.md`
- **Advanced AI Guide**: `ADVANCED_AI_GUIDE.md`

### Getting Help

**In-App Support:**
- Help Center: Click "?" icon in navigation
- API Docs: Navigate to `/api-docs`

**Lovable Cloud Support:**
- Email: support@lovable.dev
- Dashboard: Access through project settings
- Emergency: Available 24/7 for critical issues

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-01-12 | Initial system administration guide | System Administrator |

---

**Last Updated:** 2025-01-12  
**Review Frequency:** Quarterly  
**Next Review:** 2025-04-12
