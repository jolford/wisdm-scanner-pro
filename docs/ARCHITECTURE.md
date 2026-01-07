# WISDM Scanner Pro - System Architecture

## Overview

WISDM Scanner Pro is an enterprise-grade document capture and AI processing platform built on modern, scalable cloud infrastructure.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Web App    │  │  Mobile PWA  │  │ Scanner App  │  │   REST API   │    │
│  │   (React)    │  │   (React)    │  │  (Electron)  │  │   Clients    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     │
                              HTTPS/WSS
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                          API GATEWAY LAYER                                  │
├────────────────────────────────────┼────────────────────────────────────────┤
│                    ┌───────────────┴───────────────┐                        │
│                    │     Edge Functions (Deno)      │                        │
│                    │  ┌─────────────────────────┐  │                        │
│                    │  │ • Authentication        │  │                        │
│                    │  │ • Rate Limiting         │  │                        │
│                    │  │ • Request Validation    │  │                        │
│                    │  │ • CORS Handling         │  │                        │
│                    │  └─────────────────────────┘  │                        │
│                    └───────────────────────────────┘                        │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                        PROCESSING LAYER                                     │
├────────────────────────────────────┼────────────────────────────────────────┤
│  ┌─────────────────┐  ┌────────────┴─────────────┐  ┌─────────────────┐    │
│  │  OCR Engine     │  │   Business Logic         │  │  AI Services    │    │
│  │  ┌───────────┐  │  │  ┌────────────────────┐  │  │  ┌───────────┐  │    │
│  │  │ Gemini AI │  │  │  │ • Job Queue        │  │  │  │ GPT-5     │  │    │
│  │  │ Vision    │  │  │  │ • Validation       │  │  │  │ Gemini    │  │    │
│  │  │ GPT-5     │  │  │  │ • Field Extraction │  │  │  │ Pro/Flash │  │    │
│  │  │ Multi-LLM │  │  │  │ • Export Handlers  │  │  │  └───────────┘  │    │
│  │  └───────────┘  │  │  └────────────────────┘  │  │                 │    │
│  └─────────────────┘  └──────────────────────────┘  └─────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                          DATA LAYER                                         │
├────────────────────────────────────┼────────────────────────────────────────┤
│  ┌─────────────────┐  ┌────────────┴─────────────┐  ┌─────────────────┐    │
│  │   PostgreSQL    │  │     Object Storage       │  │   Real-time     │    │
│  │  ┌───────────┐  │  │  ┌────────────────────┐  │  │  ┌───────────┐  │    │
│  │  │ Documents │  │  │  │ • Document Files   │  │  │  │ WebSocket │  │    │
│  │  │ Batches   │  │  │  │ • Processed Images │  │  │  │ Channels  │  │    │
│  │  │ Projects  │  │  │  │ • Export Archives  │  │  │  │ Live Sync │  │    │
│  │  │ Audit Log │  │  │  │ • Signature Refs   │  │  │  └───────────┘  │    │
│  │  │ Users     │  │  │  └────────────────────┘  │  │                 │    │
│  │  └───────────┘  │  └──────────────────────────┘  └─────────────────┘    │
│  │  Row-Level      │                                                        │
│  │  Security (RLS) │                                                        │
│  └─────────────────┘                                                        │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                       INTEGRATION LAYER                                     │
├────────────────────────────────────┼────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───┴───────┐  ┌───────────┐  ┌───────────┐ │
│  │ FileBound │  │ SharePoint│  │  ResWare  │  │Documentum │  │  DocMgt   │ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘ │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │  Webhooks │  │   SCIM    │  │    SSO    │  │  Hot Folder│ │   Email   │ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Client Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Application | React 18, TypeScript, Vite | Primary user interface |
| Mobile PWA | React PWA, Service Workers | Offline-capable mobile access |
| Scanner App | Electron, Node.js | Desktop scanner integration |
| REST API | OpenAPI 3.0 | Third-party integrations |

### API Gateway Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Edge Functions | Deno Runtime | Serverless API endpoints |
| Authentication | JWT, Supabase Auth | Identity management |
| Rate Limiting | Token bucket algorithm | DoS protection |
| CORS | Configurable origins | Cross-origin security |

### Processing Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| OCR Engine | Google Gemini, OpenAI GPT-5 | Document text extraction |
| Validation | Custom rule engine | Field-level validation |
| Job Queue | PostgreSQL-backed | Async processing |
| Export Handlers | ECM-specific adapters | Document delivery |

### Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Primary data store |
| Object Storage | S3-compatible | File storage |
| Real-time | WebSocket channels | Live updates |
| Row-Level Security | PostgreSQL RLS | Data isolation |

## Scalability

### Horizontal Scaling
- Stateless edge functions auto-scale based on demand
- Database connection pooling via PgBouncer
- CDN distribution for static assets

### Performance Targets
- API response time: < 200ms (p95)
- OCR processing: < 10s per page
- Concurrent users: 10,000+
- Document throughput: 100,000+/day

## High Availability

- Multi-region database replication
- Automatic failover
- 99.9% uptime SLA
- Point-in-time recovery (30 days)

## Disaster Recovery

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | < 1 hour |
| RTO (Recovery Time Objective) | < 4 hours |
| Backup Frequency | Continuous WAL + Daily snapshots |
| Backup Retention | 30 days |
