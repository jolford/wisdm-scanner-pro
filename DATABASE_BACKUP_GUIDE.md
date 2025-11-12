# Database Backup & Restore Strategy

## Overview

This guide outlines the backup and restore procedures for the WISDM Scanner Pro application database. The system uses Lovable Cloud (Supabase) as the backend database provider.

## Backup Strategy

### Automated Backups (Lovable Cloud)

Lovable Cloud automatically provides:
- **Point-in-Time Recovery (PITR)**: Available for the last 7 days on all paid plans
- **Daily Snapshots**: Automatic daily backups retained for 30 days
- **Weekly Backups**: Retained for 90 days

These automated backups are managed by Lovable/Supabase and require no manual intervention.

### Manual Export Backups

For additional protection or migration purposes, you can create manual exports:

#### 1. Full Database Export

To export the entire database schema and data:

```bash
# Using Supabase CLI
supabase db dump -f backup-$(date +%Y%m%d).sql

# Or using pg_dump directly (requires database connection string)
pg_dump "postgresql://user:password@host:port/database" > backup.sql
```

#### 2. Table-Specific Exports

To export specific tables via the Lovable Cloud UI:

1. Navigate to **Lovable Cloud** → **Database** → **Tables**
2. Select the table you want to export
3. Click the **Export** button
4. Choose format: CSV or SQL
5. Save the exported file securely

#### 3. Critical Tables to Backup

Priority tables that should be included in manual backups:

**Core Data:**
- `documents` - All processed documents
- `batches` - Batch processing records
- `projects` - Project configurations
- `customers` - Customer/tenant data

**Configuration:**
- `extraction_fields` - Field definitions
- `validation_rules` - Validation configurations
- `webhook_configs` - Webhook endpoints
- `zone_definitions` - Zonal extraction templates

**User Management:**
- `profiles` - User profiles
- `user_roles` - Role assignments
- `user_permissions` - Permission settings
- `user_customers` - Customer associations

**Audit & Compliance:**
- `audit_logs` - Audit trail records
- `field_changes` - Document field history
- `license_usage` - License consumption logs

## Backup Schedule Recommendations

### Development Environment
- Manual exports: Weekly
- Test restores: Monthly

### Production Environment
- Manual exports: Daily (automated via cron)
- Critical data exports: Before major updates
- Test restores: Quarterly
- Full system backup: Before schema migrations

## Restore Procedures

### Point-in-Time Recovery (PITR)

To restore to a specific point in time using Lovable Cloud:

1. Contact Lovable support or access your Supabase project dashboard
2. Navigate to **Database** → **Backups**
3. Select **Point-in-Time Recovery**
4. Choose the target timestamp (within last 7 days)
5. Confirm restoration

⚠️ **Warning**: PITR will restore the entire database to the selected point. All changes after that point will be lost.

### Restoring from SQL Backup

#### Full Database Restore

```bash
# Using Supabase CLI
supabase db reset --db-url "postgresql://..."

# Using psql
psql "postgresql://user:password@host:port/database" < backup.sql
```

#### Selective Table Restore

```sql
-- 1. Create temporary table from backup
CREATE TABLE documents_backup AS TABLE documents WITH NO DATA;

-- 2. Import backup data
\copy documents_backup FROM 'documents_backup.csv' CSV HEADER;

-- 3. Verify data
SELECT COUNT(*) FROM documents_backup;

-- 4. Merge or replace
BEGIN;
DELETE FROM documents WHERE id IN (SELECT id FROM documents_backup);
INSERT INTO documents SELECT * FROM documents_backup;
COMMIT;

-- 5. Drop temporary table
DROP TABLE documents_backup;
```

### Emergency Recovery Steps

If database is corrupted or inaccessible:

1. **Stop all processing** - Disable edge functions and batch jobs
2. **Assess damage** - Identify affected tables and data
3. **Notify users** - Communicate expected downtime
4. **Initiate restore** - Use most recent backup
5. **Verify integrity** - Run data validation queries
6. **Resume operations** - Re-enable processing gradually
7. **Post-mortem** - Document incident and improve procedures

## Data Validation After Restore

Run these queries to verify data integrity:

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

## Backup Storage Guidelines

### Storage Locations

- **Primary Backups**: Lovable Cloud automated backups
- **Manual Backups**: Secure cloud storage (AWS S3, Google Cloud Storage)
- **Local Copies**: Encrypted external drives (for critical data only)

### Retention Policy

- **Daily backups**: 30 days
- **Weekly backups**: 90 days
- **Monthly backups**: 1 year
- **Annual backups**: 7 years (compliance requirement)

### Security Requirements

- Encrypt all backup files (AES-256)
- Store in multiple geographic locations
- Restrict access to authorized personnel only
- Audit access logs quarterly
- Test restoration procedures regularly

## Disaster Recovery Plan

### Recovery Time Objective (RTO)
- Target: 4 hours
- Critical systems: 1 hour

### Recovery Point Objective (RPO)
- Target: 1 hour
- Acceptable data loss: Maximum 24 hours

### Disaster Scenarios

#### Scenario 1: Single Table Corruption
- **Detection**: Monitoring alerts, user reports
- **Response**: Restore from latest PITR or table export
- **Estimated downtime**: 30 minutes

#### Scenario 2: Complete Database Loss
- **Detection**: Database unavailable, connection errors
- **Response**: Restore from most recent daily backup
- **Estimated downtime**: 2-4 hours

#### Scenario 3: Ransomware/Security Breach
- **Detection**: Unauthorized access, data encryption
- **Response**: Isolate system, restore from pre-breach backup
- **Estimated downtime**: 4-8 hours

## Monitoring & Alerts

Set up alerts for:
- Backup job failures
- Storage capacity warnings
- Unusual database activity
- Failed restoration tests

## Backup Automation Script

Example automation for daily backups:

```bash
#!/bin/bash
# daily-backup.sh

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

# Upload to cloud storage
aws s3 cp "$BACKUP_DIR/backup-$DATE.sql.gz" \
  "s3://your-backup-bucket/wisdm-scanner/$DATE/"

# Clean up old local backups (keep 7 days)
find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +7 -delete

# Log completion
echo "$(date): Backup completed successfully" >> "$BACKUP_DIR/backup.log"
```

## Testing Restore Procedures

### Monthly Restore Test

1. Select a random backup from the past week
2. Restore to a test environment
3. Verify data integrity
4. Test application functionality
5. Document results and issues
6. Update procedures as needed

### Quarterly Full Recovery Drill

1. Simulate complete database loss
2. Execute full recovery procedure
3. Measure recovery time
4. Verify all systems operational
5. Document lessons learned
6. Update disaster recovery plan

## Compliance Considerations

### GDPR/Privacy Requirements

- Backup files contain personal data - handle accordingly
- Implement data retention policies
- Provide mechanisms for data deletion requests
- Encrypt all backups containing personal information

### Audit Requirements

- Log all backup and restore operations
- Maintain chain of custody documentation
- Regular third-party security audits
- Compliance reports for regulators

## Contact & Escalation

### Backup Issues
- **Primary**: DevOps team
- **Escalation**: CTO
- **Emergency**: On-call rotation

### Lovable Cloud Support
- Email: support@lovable.dev
- Emergency: Available through project dashboard

## Version History

- **v1.0** (2025-01-12): Initial backup strategy documentation
- Future updates will be tracked here

---

**Last Updated**: 2025-01-12  
**Review Frequency**: Quarterly  
**Next Review**: 2025-04-12
