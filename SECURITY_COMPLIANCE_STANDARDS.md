# Security Compliance & Standards Documentation

**Document Version:** 1.0  
**Last Updated:** October 30, 2025  
**Organization:** WisdM Document Management System

---

## Executive Summary

This document provides a comprehensive overview of the security compliance measures, standards, and best practices implemented across our document management system. Our platform employs defense-in-depth security architecture with multiple layers of protection at the database, application, and infrastructure levels.

---

## 1. Database Security

### 1.1 Row-Level Security (RLS)

**Implementation Status:** ✅ Fully Implemented

Our PostgreSQL database enforces Row-Level Security on all sensitive tables, ensuring data access is controlled at the database level rather than relying on application logic.

**Key Features:**
- RLS enabled on all user-facing tables
- Policies enforce user-specific data access
- Admin and system admin roles verified via secure functions
- No data leakage between tenants or users

**Example Policies:**
```sql
-- User-specific data access
CREATE POLICY "Users can view own data"
ON public.documents
FOR SELECT
USING (auth.uid() = uploaded_by);

-- Admin access with JWT verification
CREATE POLICY "Admins view all"
ON public.documents
FOR ALL
USING (is_admin_enhanced());
```

### 1.2 Security Definer Functions

**Implementation Status:** ✅ Fully Implemented

All authorization checks utilize `SECURITY DEFINER` functions to prevent infinite recursion and ensure consistent security enforcement.

**Key Functions:**
- `is_admin_jwt()` - Verifies admin role from JWT claims
- `is_admin_enhanced()` - Combined JWT + database role check
- `has_role(user_id, role)` - Checks user roles without RLS recursion
- `is_system_admin(user_id)` - Verifies system administrator status
- `is_tenant_admin(user_id, customer_id)` - Verifies tenant-level admin access
- `has_customer(user_id, customer_id)` - Verifies user-tenant association

### 1.3 Role-Based Access Control (RBAC)

**Implementation Status:** ✅ Fully Implemented

Roles are stored in a dedicated `user_roles` table (NOT on user profiles) to prevent privilege escalation attacks.

**Role Hierarchy:**
1. **system_admin** - Platform administrators with full access
2. **admin** - Tenant administrators with customer-scoped access
3. **user** - Standard users with limited permissions

**Security Measures:**
- Roles stored separately from user profiles
- Admin assignment requires existing admin privileges
- System admin role can only be granted by other system admins
- Self-privilege escalation prevented
- JWT-based role verification for stateless auth

### 1.4 Database Encryption

**Implementation Status:** ✅ Managed by Supabase

- **At-Rest Encryption:** AES-256 encryption for all stored data
- **In-Transit Encryption:** TLS 1.3 for all database connections
- **Backup Encryption:** All backups encrypted with separate keys

### 1.5 Sensitive Data Handling

**Implementation Status:** ✅ Implemented

- API credentials masked in project metadata for non-admin users
- Passwords never stored in plaintext
- Personal identifiable information (PII) redacted in logs
- Document content protected by RLS policies

---

## 2. Application Security

### 2.1 Authentication

**Implementation Status:** ✅ Fully Implemented

**Methods Supported:**
- Email/password authentication with secure password policies
- Multi-Factor Authentication (MFA/TOTP) available
- Google OAuth integration
- Session management via JWT tokens

**Security Features:**
- Password hashing using bcrypt
- Rate limiting on authentication endpoints
- Account lockout after failed attempts
- Email verification for new accounts
- Secure password reset flow

### 2.2 Authorization Architecture

**Implementation Status:** ✅ Defense-in-Depth

Our authorization uses a three-layer approach:

**Layer 1: Database RLS (Primary Defense)**
```sql
CREATE POLICY "admins_all_access"
ON sensitive_table
FOR ALL
USING (is_admin_enhanced())
WITH CHECK (is_admin_enhanced());
```

**Layer 2: Edge Functions (Secondary Check)**
```typescript
const auth = await verifyAuth(req, { requireAdmin: true });
if (auth instanceof Response) return auth;
```

**Layer 3: Client UI (UX Only - Never Trusted)**
```typescript
const { isAdmin } = useAuth();
{isAdmin && <AdminPanel />}  // Display only
```

### 2.3 Edge Function Security

**Implementation Status:** ✅ Implemented with Shared Helpers

All edge functions use standardized authentication helpers:

**Features:**
- JWT token verification on every request
- Admin role verification when required
- CORS handling for cross-origin requests
- Automatic error responses for unauthorized access
- Service role key usage only in secure contexts

**Example Implementation:**
```typescript
import { verifyAuth, handleCors } from '../_shared/auth-helpers.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = await verifyAuth(req, { requireAdmin: true });
  if (auth instanceof Response) return auth;
  
  // Perform authorized operation
});
```

### 2.4 Input Validation

**Implementation Status:** ✅ Implemented

**Client-Side Validation:**
- Zod schema validation for all forms
- Type-safe input handling with TypeScript
- Length limits and character restrictions
- Email format validation
- XSS prevention through React's built-in escaping

**Server-Side Validation:**
- All edge function inputs validated
- SQL injection prevented via parameterized queries
- File upload validation (type, size, content)
- URL encoding for external API calls

**Example:**
```typescript
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().max(100),
  email: z.string().email().max(255),
  message: z.string().trim().max(1000)
});
```

### 2.5 Error Handling

**Implementation Status:** ✅ Implemented

**Security-Safe Error Messages:**
- Internal error details never exposed to users
- Generic error messages for authentication failures
- Detailed errors logged server-side only
- Stack traces hidden in production
- Error logging to database for admin review

**Implementation:**
```typescript
// User sees: "An error occurred. Please try again."
// Server logs: Full stack trace and context
```

### 2.6 Sensitive Data Protection

**Implementation Status:** ✅ Implemented

- No console logging of passwords, tokens, or PII
- Credentials sanitized from error messages
- API keys stored as encrypted secrets
- Document content protected by RLS
- Query parameters sanitized in URLs

---

## 3. Infrastructure Security

### 3.1 Secrets Management

**Implementation Status:** ✅ Fully Implemented

**Features:**
- Encrypted storage for API keys and credentials
- Secrets never exposed in client-side code
- Environment variable isolation
- User-provided secrets via secure form input
- Automatic secret rotation support

**Managed Secrets:**
- `LOVABLE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- Custom user secrets (e.g., external API keys)

### 3.2 Storage Security

**Implementation Status:** ✅ Implemented

**Buckets:**
- `documents` - Private bucket with RLS policies
- `scanner-import` - Private bucket for automated imports

**Security Policies:**
```sql
-- Users can only upload to their own folder
CREATE POLICY "Users upload own files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can only view their own files
CREATE POLICY "Users view own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3.3 Network Security

**Implementation Status:** ✅ Managed by Platform

- All traffic encrypted via TLS 1.3
- HTTPS-only access enforced
- CORS policies configured for API endpoints
- Rate limiting on public endpoints
- DDoS protection at infrastructure level

---

## 4. Compliance Standards

### 4.1 SOC 2 Readiness

**Implementation Status:** 🔄 In Progress

Our system implements the following SOC 2 Trust Services Criteria:

**Security (CC6):**
- ✅ Logical and physical access controls
- ✅ System operations monitoring
- ✅ Change management procedures
- ✅ Risk mitigation strategies

**Availability (A1):**
- ✅ System monitoring and alerting
- ✅ Backup and recovery procedures
- ✅ Incident response planning

**Confidentiality (C1):**
- ✅ Data classification
- ✅ Encryption at rest and in transit
- ✅ Secure disposal procedures

**Processing Integrity (PI1):**
- ✅ Data validation and verification
- ✅ Error handling and logging
- ✅ Quality assurance processes

**Privacy (P1):**
- ✅ Personal information handling
- ✅ Data retention policies
- ✅ User consent management

### 4.2 GDPR Compliance

**Implementation Status:** ✅ Implemented

**Data Subject Rights:**
- ✅ Right to access (data export functionality)
- ✅ Right to erasure (account deletion)
- ✅ Right to rectification (profile updates)
- ✅ Right to data portability (export formats)
- ✅ Right to object (opt-out mechanisms)

**Key Features:**
- Privacy policy and terms of service available
- Data processing agreement for customers
- Cookie policy with consent management
- Audit trail for data access and modifications
- Data retention policies enforced

### 4.3 ISO 27001 Alignment

**Implementation Status:** 🔄 Partial Implementation

**Implemented Controls:**
- A.9: Access control policies and procedures
- A.10: Cryptographic controls (encryption)
- A.12: Operations security (logging, monitoring)
- A.14: System acquisition and development security
- A.16: Incident management procedures
- A.18: Compliance with legal requirements

---

## 5. Audit & Monitoring

### 5.1 Audit Logging

**Implementation Status:** ✅ Implemented

**Logged Events:**
- User authentication (login, logout, failed attempts)
- Admin actions (role changes, user deletion)
- Document access and modifications
- Field changes with before/after values
- Export operations
- System configuration changes

**Log Retention:** 90 days (configurable)

**Implementation:**
```sql
-- Automatic audit trail
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  changes,
  ip_address,
  user_agent
) VALUES (...);
```

### 5.2 Error Logging

**Implementation Status:** ✅ Implemented

**Features:**
- All errors logged to `error_logs` table
- Sensitive data sanitized before logging
- Stack traces captured for debugging
- Error aggregation and alerting
- PII automatically redacted from logs

**Sanitization:**
```typescript
// Removes emails, SSNs, credit cards, phone numbers
sanitizeErrorMessage(message: string): string
```

### 5.3 System Monitoring

**Implementation Status:** ✅ Implemented

**Monitored Metrics:**
- Authentication success/failure rates
- API endpoint response times
- Database query performance
- Storage usage per tenant
- Edge function execution times
- Job queue processing status

---

## 6. Business Continuity & Disaster Recovery

### 6.1 Backup Strategy

**Implementation Status:** ✅ Managed by Platform

- **Frequency:** Continuous (point-in-time recovery)
- **Retention:** 7 days standard, 30 days for critical data
- **Recovery Time Objective (RTO):** < 4 hours
- **Recovery Point Objective (RPO):** < 15 minutes

### 6.2 Incident Response

**Implementation Status:** ✅ Documented

**Procedures Available:**
- Incident detection and classification
- Escalation paths and contact lists
- Communication protocols
- Containment and remediation steps
- Post-incident review process

**Documentation:** See `/incident-response` page for full procedures

---

## 7. Secure Development Practices

### 7.1 Code Security

**Implementation Status:** ✅ Implemented

**Practices:**
- TypeScript for type safety
- ESLint for code quality
- No hardcoded credentials or secrets
- Security-focused code reviews
- Dependency vulnerability scanning

### 7.2 Dependency Management

**Implementation Status:** ✅ Automated

- Regular dependency updates
- Known vulnerability scanning
- Version pinning for stability
- Security patches prioritized
- Lock file verification

### 7.3 Testing

**Implementation Status:** 🔄 Partial Implementation

**Implemented:**
- RLS policy testing procedures
- Edge function authorization testing
- Input validation testing

**Planned:**
- Automated security testing
- Penetration testing
- Load testing

---

## 8. Third-Party Security

### 8.1 Integration Security

**Implementation Status:** ✅ Implemented

**External Integrations:**
- SharePoint (OAuth2 authentication)
- Documentum (encrypted credential storage)
- FileBound (secure API key management)
- Email import (IMAP over TLS)
- Scanner integration (VPN recommended)

**Security Measures:**
- All credentials encrypted at rest
- API keys masked for non-admin users
- Connection testing before storage
- Timeout and retry logic
- Error handling without credential exposure

### 8.2 Vendor Security

**Primary Vendor: Supabase (Backend Infrastructure)**

**Security Certifications:**
- SOC 2 Type II certified
- ISO 27001 certified
- GDPR compliant
- HIPAA eligible (with BAA)

---

## 9. User Security Features

### 9.1 Multi-Factor Authentication (MFA)

**Implementation Status:** ✅ Available

- TOTP-based authentication
- QR code enrollment
- Backup codes for recovery
- Optional enforcement per user
- Admin can disable MFA for account recovery

### 9.2 Permission Management

**Implementation Status:** ✅ Implemented

**Granular Permissions:**
- `can_scan` - Upload and scan documents
- `can_validate` - Review and approve documents
- `can_export` - Export to external systems
- `can_delete` - Delete documents and batches

**Default:** All permissions granted to new users (configurable)

### 9.3 Document Locking

**Implementation Status:** ✅ Implemented

- Concurrent editing prevention
- Automatic lock expiration (15 minutes)
- Visual lock indicators
- Force unlock capability for admins

---

## 10. Cost & Usage Security

### 10.1 Tenant Budgets

**Implementation Status:** ✅ Implemented

**Features:**
- Monthly budget limits per customer
- Automatic alerts at 80% threshold
- Critical alerts when exceeded
- Budget tracking and reporting
- AI cost calculation per job

### 10.2 Rate Limiting

**Implementation Status:** ✅ Implemented

**Limits:**
- Max concurrent jobs per tenant
- Max jobs per minute per tenant
- Max jobs per hour per tenant
- Fair-share job scheduling
- Priority-based queue processing

**Implementation:**
```sql
-- Prevents abuse and ensures fair resource allocation
SELECT check_tenant_rate_limit(customer_id, 'ocr_document');
```

---

## 11. Security Checklist for New Features

When implementing new features, the following security checklist is enforced:

- [ ] **Database Tables:**
  - [ ] RLS enabled on all new tables
  - [ ] Admin policies using `is_admin_enhanced()`
  - [ ] User-specific policies for data isolation
  - [ ] Foreign keys properly constrained

- [ ] **Edge Functions:**
  - [ ] `verifyAuth()` called at function entry
  - [ ] Admin check when required
  - [ ] Input validation on all parameters
  - [ ] Error messages sanitized
  - [ ] No credentials in logs

- [ ] **Client Code:**
  - [ ] No security decisions made client-side
  - [ ] Input validation with Zod schemas
  - [ ] No console logging of sensitive data
  - [ ] Proper error handling with safe messages

- [ ] **Storage:**
  - [ ] RLS policies on new buckets
  - [ ] User-specific folder structure
  - [ ] File type validation
  - [ ] Size limits enforced

- [ ] **Testing:**
  - [ ] Tested with non-admin users
  - [ ] Tested with users from different tenants
  - [ ] Tested edge cases and error paths
  - [ ] Verified audit logging

---

## 12. Known Security Considerations

### 12.1 Non-Critical Warnings

The following items are architectural considerations, not vulnerabilities:

1. **Extension in Public Schema**
   - PostgreSQL extensions must reside in public schema
   - No security impact
   - Standard PostgreSQL behavior

2. **Leaked Password Protection**
   - Optional Supabase Auth feature
   - Can be enabled if required
   - Not applicable for non-password auth methods

### 12.2 Recommended Enhancements

**Short-term (Next 30 days):**
- Enable leaked password protection
- Implement automated security testing
- Add API rate limiting per user

**Medium-term (Next 90 days):**
- Complete SOC 2 Type II audit
- Implement SIEM integration
- Add anomaly detection for user behavior

**Long-term (Next 180 days):**
- Achieve ISO 27001 certification
- Implement advanced threat protection
- Add ML-based fraud detection

---

## 13. Security Contact Information

**Security Team Email:** security@wisdm.com  
**Incident Reporting:** incident@wisdm.com  
**Response Time:** < 24 hours for critical issues

**For Security Vulnerabilities:**
Please report security vulnerabilities responsibly to security@wisdm.com. Do not disclose publicly until we have had a chance to address the issue.

---

## 14. Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Oct 30, 2025 | Initial comprehensive security documentation | System Administrator |

---

## 15. Conclusion

Our document management system implements industry-standard security practices across all layers of the application. We employ a defense-in-depth strategy with security enforced at the database, application, and infrastructure levels.

Key security principles:
- **Database is the bouncer** - RLS policies are the primary defense
- **Edge functions verify** - Secondary authorization checks
- **Client code is UX only** - Never trusted for security decisions
- **Secrets are encrypted** - All credentials protected at rest
- **Audit everything** - Comprehensive logging for accountability

For questions or concerns about our security practices, please contact our security team.

---

**Document Classification:** Internal Use  
**Review Frequency:** Quarterly  
**Next Review Date:** January 30, 2026