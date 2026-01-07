# WISDM Scanner Pro - Security Posture

## Executive Summary

WISDM Scanner Pro implements defense-in-depth security architecture with multiple layers of protection, comprehensive audit capabilities, and strict data isolation for multi-tenant deployments.

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PERIMETER SECURITY                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    WAF      │  │ DDoS Shield │  │    CDN      │         │
│  │  (Cloudflare)│  │             │  │  (TLS 1.3) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION SECURITY                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    JWT      │  │ Rate Limit  │  │   Input     │         │
│  │   Auth      │  │  (Adaptive) │  │ Validation  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      DATA SECURITY                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    RLS      │  │ Encryption  │  │   Audit     │         │
│  │ (Postgres)  │  │ (AES-256)   │  │   Trail     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Authentication

### Supported Methods

| Method | Description | Enterprise |
|--------|-------------|:----------:|
| Email/Password | Standard credential authentication | ✅ |
| MFA (TOTP) | Time-based one-time passwords | ✅ |
| Google OAuth | Federated identity via Google | ✅ |
| SAML 2.0 SSO | Enterprise identity providers (Okta, Azure AD, etc.) | ✅ |
| SCIM 2.0 | Automated user provisioning/deprovisioning | ✅ |

### Password Policy

- Minimum 12 characters
- Complexity requirements (upper, lower, number, special)
- Password history (last 10)
- Automatic lockout after 5 failed attempts
- Progressive lockout with exponential backoff:
  - 1st lockout: 1 minute
  - 2nd lockout: 5 minutes
  - 3rd lockout: 15 minutes
  - 4th+ lockout: 1 hour

### Session Management

- JWT tokens with 1-hour expiry
- Refresh tokens with 7-day expiry
- Concurrent session limits
- Session invalidation on password change
- Secure cookie settings (HttpOnly, Secure, SameSite)

## Authorization

### Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────┐
│                      ROLE HIERARCHY                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌──────────────┐                        │
│                    │   Platform   │                        │
│                    │    Admin     │                        │
│                    └──────┬───────┘                        │
│                           │                                 │
│            ┌──────────────┼──────────────┐                 │
│            │              │              │                 │
│     ┌──────┴─────┐ ┌──────┴─────┐ ┌──────┴─────┐          │
│     │  Customer  │ │  Customer  │ │  Customer  │          │
│     │   Admin    │ │   Admin    │ │   Admin    │          │
│     └──────┬─────┘ └──────┬─────┘ └──────┬─────┘          │
│            │              │              │                 │
│      ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐          │
│      │           │  │           │  │           │          │
│    ┌─┴─┐ ┌───┐ ┌─┴─┐ ┌───┐ ┌─┴─┐ ┌───┐ ┌───┐            │
│    │QA │ │Op │ │QA │ │Op │ │QA │ │Op │ │Usr│            │
│    └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission | User | Operator | QA | Admin | Platform Admin |
|------------|:----:|:--------:|:--:|:-----:|:--------------:|
| View own documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all documents | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit documents | ❌ | ✅ | ✅ | ✅ | ✅ |
| Validate documents | ❌ | ❌ | ✅ | ✅ | ✅ |
| Export batches | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configure projects | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage customers | ❌ | ❌ | ❌ | ❌ | ✅ |
| Access audit logs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage billing | ❌ | ❌ | ❌ | ✅ | ✅ |

## Data Isolation

### Row-Level Security (RLS)

Every table is protected by PostgreSQL Row-Level Security policies:

```sql
-- Example: Documents visible only to customer members
CREATE POLICY "documents_customer_isolation" ON documents
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.customer_id = (
        SELECT customer_id FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );
```

### Tenant Isolation Model

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Shared Application Layer                │   │
│  │  (Stateless Edge Functions, CDN, Load Balancer)     │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    LOGICAL ISOLATION                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   Customer A  │  │   Customer B  │  │   Customer C  │   │
│  │  ┌─────────┐  │  │  ┌─────────┐  │  │  ┌─────────┐  │   │
│  │  │ Data    │  │  │  │ Data    │  │  │  │ Data    │  │   │
│  │  │ (RLS)   │  │  │  │ (RLS)   │  │  │  │ (RLS)   │  │   │
│  │  └─────────┘  │  │  └─────────┘  │  │  └─────────┘  │   │
│  │  ┌─────────┐  │  │  ┌─────────┐  │  │  ┌─────────┐  │   │
│  │  │ Storage │  │  │  │ Storage │  │  │  │ Storage │  │   │
│  │  │ (Prefix)│  │  │  │ (Prefix)│  │  │  │ (Prefix)│  │   │
│  │  └─────────┘  │  │  └─────────┘  │  │  └─────────┘  │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Isolation Guarantees

- **Database**: Row-Level Security on all tables
- **Storage**: Customer-prefixed bucket paths with RLS policies
- **API**: Customer ID validated on every request
- **Logging**: Customer context in all audit entries
- **Backups**: Customer-isolated point-in-time recovery

## Audit Trail

### Captured Events

| Category | Events |
|----------|--------|
| Authentication | Login, logout, failed attempts, MFA events, password changes |
| Authorization | Permission changes, role assignments, access denials |
| Documents | Create, read, update, delete, export, validation |
| Administration | User management, settings changes, API key operations |
| System | Configuration changes, integration events, errors |

### Audit Record Structure

```json
{
  "id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "user_id": "uuid",
  "customer_id": "uuid",
  "action_type": "document.update",
  "entity_type": "document",
  "entity_id": "uuid",
  "old_values": { "status": "pending" },
  "new_values": { "status": "validated" },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "success": true,
  "metadata": {
    "session_id": "uuid",
    "request_id": "uuid"
  }
}
```

### Retention & Access

- Audit logs retained for 7 years
- Immutable (append-only)
- Searchable via admin interface
- Exportable for compliance reporting

## Encryption

### Data at Rest

| Component | Encryption |
|-----------|------------|
| Database | AES-256 (Transparent Data Encryption) |
| Object Storage | AES-256 (Server-Side Encryption) |
| Backups | AES-256 (Customer-managed keys available) |
| Secrets | AES-256-GCM (Vault-based) |

### Data in Transit

| Connection | Protocol |
|------------|----------|
| Browser → CDN | TLS 1.3 |
| CDN → Origin | TLS 1.3 |
| Internal Services | mTLS |
| Database | TLS 1.3 + Certificate Pinning |

### Key Management

- HSM-backed key storage
- Automatic key rotation (90 days)
- Customer-managed keys (BYOK) available for Enterprise
- Separate keys per customer for dedicated deployments

## Compliance

### Certifications & Standards

| Standard | Status |
|----------|--------|
| SOC 2 Type II | ✅ Compliant |
| ISO 27001 | ✅ Certified |
| GDPR | ✅ Compliant |
| HIPAA | ✅ BAA Available |
| CCPA | ✅ Compliant |
| FedRAMP | 🔄 In Progress |

### Data Residency

| Region | Availability |
|--------|:------------:|
| United States | ✅ |
| European Union | ✅ |
| United Kingdom | ✅ |
| Canada | ✅ |
| Australia | 🔄 Coming Soon |

## Security Operations

### Vulnerability Management

- Automated dependency scanning (Snyk)
- Weekly penetration testing (internal)
- Annual third-party penetration testing
- Bug bounty program
- SBOM (Software Bill of Materials) available

### Incident Response

| Severity | Response Time | Resolution Target |
|----------|:-------------:|:-----------------:|
| Critical (P1) | 15 minutes | 4 hours |
| High (P2) | 1 hour | 24 hours |
| Medium (P3) | 4 hours | 72 hours |
| Low (P4) | 24 hours | 7 days |

### Monitoring & Alerting

- 24/7 SOC monitoring
- Real-time threat detection
- Anomaly detection (ML-based)
- Automated incident escalation
- Customer notification within 72 hours for breaches

## Security Checklist for Customers

### Pre-Deployment

- [ ] Configure SSO integration
- [ ] Set up SCIM provisioning
- [ ] Define role-based access policies
- [ ] Configure IP allowlisting (if required)
- [ ] Review and accept DPA

### Ongoing

- [ ] Regular access reviews (quarterly recommended)
- [ ] Monitor audit logs for anomalies
- [ ] Keep scanner agents updated
- [ ] Review API key usage
- [ ] Test backup restoration

## Contact

**Security Team**: security@wisdm.io  
**Bug Bounty**: hackerone.com/wisdm  
**Compliance Requests**: compliance@wisdm.io
