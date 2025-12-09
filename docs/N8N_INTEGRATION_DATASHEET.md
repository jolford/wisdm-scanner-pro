# n8n Integration Datasheet for WISDMCapture

## Executive Summary

n8n is an open-source workflow automation platform that extends WISDMCapture's capabilities through the Model Context Protocol (MCP) connector. This integration enables custom automation workflows, external system integrations, and advanced scripting capabilities without modifying core application code.

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WISDMCapture                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Frontend  │  │  Supabase   │  │    Edge Functions       │  │
│  │   (React)   │  │  Database   │  │  (Document Processing)  │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
└─────────┼────────────────┼─────────────────────┼─────────────────┘
          │                │                     │
          ▼                ▼                     ▼
    ┌─────────────────────────────────────────────────┐
    │              MCP Connector Layer                 │
    │         (Model Context Protocol)                 │
    └─────────────────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────┐
    │                 n8n Instance                     │
    │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
    │  │Workflows│  │ Nodes   │  │ 400+ Integrations│ │
    │  └─────────┘  └─────────┘  └─────────────────────┘  │
    └─────────────────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────┐
    │           External Systems & APIs                │
    │  ERP │ CRM │ Email │ Storage │ Custom APIs      │
    └─────────────────────────────────────────────────┘
```

---

## Deployment Options

| Option | Monthly Cost | Setup Complexity | Maintenance |
|--------|-------------|------------------|-------------|
| **n8n Cloud** | $20-50 | None | Managed |
| **Azure App Service** | ~$13-26 | Medium | Self-managed |
| **Azure Container Instances** | ~$5-15 | Medium | Self-managed |
| **On-premise Docker** | Hardware only | Low | Self-managed |

---

## Integration Capabilities

### 1. Document Processing Automation

| Capability | Description | Trigger |
|------------|-------------|---------|
| **Post-OCR Routing** | Route documents to external systems after extraction | Webhook on batch completion |
| **Validation Escalation** | Notify stakeholders when documents fail validation | Webhook on validation failure |
| **Auto-Classification** | Trigger external ML models for document classification | Webhook on document upload |
| **Data Enrichment** | Augment extracted data with external lookups | Workflow action |

### 2. External System Integrations

| Category | Supported Systems | Use Cases |
|----------|-------------------|-----------|
| **ERP** | SAP, Oracle, NetSuite, QuickBooks | Invoice sync, PO matching |
| **CRM** | Salesforce, HubSpot, Dynamics 365 | Customer data lookup |
| **ECM** | SharePoint, Box, Google Drive, Dropbox | Document archival |
| **Email** | Gmail, Outlook, SMTP | Notifications, alerts |
| **Databases** | MySQL, PostgreSQL, MongoDB, SQL Server | Data sync |
| **Custom APIs** | Any REST/GraphQL/SOAP endpoint | Custom integrations |

### 3. Advanced Scripting

n8n Code Nodes support:
- **JavaScript** (full Node.js environment)
- **Python** (via Code node)
- **Custom HTTP requests**
- **Data transformation & mapping**

---

## Workflow Trigger Types

### Available in WISDMCapture

| Trigger Event | Webhook Payload | Use Case |
|---------------|-----------------|----------|
| `batch.completed` | Batch ID, document count, status | Export to ERP |
| `batch.exported` | Batch ID, export destination | Archive confirmation |
| `document.validated` | Document ID, extracted fields | Data sync |
| `document.failed` | Document ID, error details | Exception handling |
| `document.pii_detected` | Document ID, PII regions | Compliance alerts |

### n8n Trigger Nodes

| Node | Description |
|------|-------------|
| **Webhook** | Receive HTTP requests from WISDMCapture |
| **Schedule** | Time-based workflow execution |
| **Cron** | Complex scheduling patterns |
| **Polling** | Monitor external systems for changes |

---

## Sample Workflow Architectures

### Workflow 1: Invoice Processing Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  WISDMCapture │───▶│    n8n       │───▶│  QuickBooks  │
│  Batch Done   │    │  Transform   │    │  Create Bill │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  SharePoint  │
                    │  Archive PDF │
                    └──────────────┘
```

**Workflow Steps:**
1. WISDMCapture webhook triggers on batch completion
2. n8n retrieves batch documents via API
3. Transform extracted data to QuickBooks format
4. Create vendor bill in QuickBooks
5. Archive original PDF to SharePoint
6. Update WISDMCapture batch status

### Workflow 2: Exception Handling

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Validation  │───▶│    n8n       │───▶│    Slack     │
│   Failed     │    │  Check Rules │    │   Alert      │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Jira       │
                    │ Create Issue │
                    └──────────────┘
```

### Workflow 3: Data Enrichment

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Document    │───▶│    n8n       │───▶│  Salesforce  │
│  Uploaded    │    │  Extract Vendor│   │  Lookup      │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ WISDMCapture │
                    │ Update Metadata│
                    └──────────────┘
```

---

## Technical Requirements

### n8n Instance Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 1 vCPU | 2 vCPU |
| **Memory** | 1 GB | 2-4 GB |
| **Storage** | 10 GB | 50 GB (with execution logs) |
| **Network** | HTTPS access | Static IP recommended |

### MCP Connector Requirements

1. n8n instance must be accessible via HTTPS
2. MCP access enabled in n8n settings (requires admin)
3. Workflows must have "Available in MCP" enabled
4. Network connectivity between Lovable and n8n instance

---

## Security Considerations

### Authentication

| Layer | Method |
|-------|--------|
| **MCP Connection** | OAuth / API Key |
| **n8n to WISDMCapture** | API Key (X-API-Key header) |
| **n8n to External Systems** | Per-integration credentials |

### Data Flow

```
WISDMCapture ──[HTTPS/TLS]──▶ n8n ──[HTTPS/TLS]──▶ External Systems
     │                           │
     │  Webhook payloads         │  Credentials stored in
     │  contain document IDs     │  n8n credential vault
     │  (not document content)   │
```

### Best Practices

1. **Credential Storage**: Use n8n's built-in credential vault
2. **Webhook Security**: Implement webhook signature verification
3. **Data Minimization**: Pass document IDs, not full content
4. **Audit Logging**: Enable n8n execution logging
5. **Network Isolation**: Use VNet/private endpoints where possible

---

## API Reference

### WISDMCapture Webhook Events

#### batch.completed

```json
{
  "event_type": "batch.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "batch_id": "uuid",
  "batch_name": "January Invoices",
  "project_id": "uuid",
  "project_name": "AP Processing",
  "customer_id": "uuid",
  "documents_processed": 25,
  "documents_validated": 23,
  "documents_failed": 2,
  "metadata": {}
}
```

#### document.validated

```json
{
  "event_type": "document.validated",
  "timestamp": "2024-01-15T10:30:00Z",
  "document_id": "uuid",
  "document_name": "invoice_001.pdf",
  "batch_id": "uuid",
  "confidence_score": 0.95,
  "extracted_fields": {
    "vendor_name": "Acme Corp",
    "invoice_number": "INV-2024-001",
    "amount": "1,500.00"
  }
}
```

### WISDMCapture REST API (for n8n HTTP nodes)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api-v1-projects` | GET | List projects |
| `/api-v1-batches` | GET | List batches |
| `/api-v1-documents` | GET | List documents |
| `/api-v1-retrieve` | GET | Get document details |

**Authentication Header:**
```
X-API-Key: your_api_key_here
```

---

## Implementation Checklist

### Phase 1: Setup (Day 1)

- [ ] Choose deployment option (Cloud vs Self-hosted)
- [ ] Deploy n8n instance
- [ ] Enable MCP access in n8n settings
- [ ] Connect n8n MCP to Lovable project

### Phase 2: Basic Integration (Days 2-3)

- [ ] Create first webhook workflow
- [ ] Configure WISDMCapture webhook to trigger n8n
- [ ] Test end-to-end workflow execution
- [ ] Implement error handling

### Phase 3: Production Workflows (Days 4-7)

- [ ] Build production workflows (invoice sync, alerts, etc.)
- [ ] Configure external system credentials
- [ ] Implement retry logic and error notifications
- [ ] Document workflow purposes and triggers

### Phase 4: Monitoring & Maintenance

- [ ] Set up execution monitoring
- [ ] Configure alerting for failed workflows
- [ ] Establish backup procedures
- [ ] Create runbook for common issues

---

## Support Resources

| Resource | URL |
|----------|-----|
| n8n Documentation | https://docs.n8n.io |
| n8n Community Forum | https://community.n8n.io |
| n8n Workflow Templates | https://n8n.io/workflows |
| WISDMCapture API Docs | /api-docs (in-app) |
| MCP Integration Guide | https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/ |

---

## Appendix: Comparison with Windows Agent

| Feature | n8n Integration | Windows Agent |
|---------|-----------------|---------------|
| **Deployment** | Cloud or self-hosted | On-premise Windows |
| **Scripting** | JavaScript, Python (in n8n) | PowerShell, VBScript, Python, Batch |
| **External Integrations** | 400+ pre-built nodes | Custom scripts only |
| **Visual Builder** | Yes (drag-and-drop) | No (code only) |
| **Local File Access** | No (cloud-based) | Yes (full local access) |
| **Scanner Integration** | No | Yes (TWAIN/local hardware) |
| **Offline Capability** | No | Yes |
| **Best For** | Cloud integrations, SaaS connections | Local automation, hardware access |

**Recommendation:** Use n8n for cloud/SaaS integrations and Windows Agent for local automation requiring file system or hardware access. Both can be used together.

---

*Document Version: 1.0*  
*Last Updated: December 2024*
