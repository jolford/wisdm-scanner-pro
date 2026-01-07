# WISDM Scanner Pro - Deployment Models

## Overview

WISDM Scanner Pro supports flexible deployment options to meet diverse enterprise requirements for security, compliance, and operational control.

## Deployment Options

### 1. Cloud (SaaS) - Default

```
┌─────────────────────────────────────────────────────────────┐
│                    WISDM Cloud Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web App   │  │  Database   │  │   Storage   │         │
│  │   (CDN)     │  │ (Postgres)  │  │    (S3)     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Edge     │  │     AI      │  │   Backups   │         │
│  │  Functions  │  │  Services   │  │   (Multi)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                       HTTPS/WSS
                            │
              ┌─────────────┴─────────────┐
              │     Customer Browsers     │
              │     & Scanner Agents      │
              └───────────────────────────┘
```

**Characteristics:**
- Fully managed infrastructure
- Automatic updates and patches
- Multi-tenant with data isolation
- Pay-as-you-go pricing
- No IT infrastructure required

**Best For:**
- Small to medium organizations
- Rapid deployment needs
- Minimal IT overhead preference
- Standard compliance requirements

---

### 2. Dedicated Cloud

```
┌─────────────────────────────────────────────────────────────┐
│              Customer's Dedicated Cloud Region              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Isolated VPC / Virtual Network            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Web App   │  │  Database   │  │   Storage   │ │   │
│  │  │   (CDN)     │  │ (Dedicated) │  │ (Dedicated) │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │    Edge     │  │     AI      │  │   Backups   │ │   │
│  │  │  Functions  │  │  Services   │  │  (Private)  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- Single-tenant infrastructure
- Customer-selected region
- Enhanced data sovereignty
- Custom network configuration
- Dedicated support channel

**Best For:**
- Financial services
- Healthcare organizations
- Government agencies
- Organizations with strict data residency requirements

---

### 3. On-Premises

```
┌─────────────────────────────────────────────────────────────┐
│                 Customer Data Center                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Customer Infrastructure                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  K8s/Docker │  │  PostgreSQL │  │  S3/MinIO   │ │   │
│  │  │   Cluster   │  │   Cluster   │  │   Storage   │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Load      │  │  Monitoring │  │   Backup    │ │   │
│  │  │  Balancer   │  │   (Prom)    │  │   System    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          AI Services (Choose One)                    │   │
│  │  ┌─────────────────┐  ┌──────────────────────────┐ │   │
│  │  │ Local LLM       │  │ Secure AI Gateway         │ │   │
│  │  │ (Ollama/vLLM)   │  │ (Outbound to Cloud AI)   │ │   │
│  │  └─────────────────┘  └──────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- Complete infrastructure control
- No data leaves premises
- Customer-managed updates
- Custom security policies
- Integration with existing systems

**Requirements:**
- Kubernetes 1.28+ or Docker Swarm
- PostgreSQL 15+
- S3-compatible storage
- 32GB+ RAM per node (recommended 3 nodes)
- GPU (optional, for local AI)

**Best For:**
- Air-gapped environments
- Maximum security requirements
- Existing data center investment
- Full operational control needs

---

### 4. Hybrid

```
┌─────────────────────────────────────────────────────────────┐
│                 Customer Data Center                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Document Processing Cluster               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  Scanner    │  │  Hot Folder │  │  Local      │ │   │
│  │  │  Agents     │  │  Monitors   │  │  Storage    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    Secure VPN/PrivateLink
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    WISDM Cloud Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   OCR/AI    │  │  Database   │  │    Web      │         │
│  │  Processing │  │  (Managed)  │  │    App      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- Local capture, cloud processing
- Reduced on-premises footprint
- Centralized management
- Flexible data residency
- Cost-optimized architecture

**Best For:**
- Organizations with local scanners
- Branch office deployments
- Gradual cloud migration
- Mixed compliance requirements

---

## Deployment Comparison

| Aspect | Cloud | Dedicated | On-Prem | Hybrid |
|--------|:-----:|:---------:|:-------:|:------:|
| Setup Time | Hours | Days | Weeks | Days |
| IT Staff Required | None | Minimal | Significant | Moderate |
| Data Sovereignty | Limited | High | Complete | Flexible |
| Customization | Low | Medium | High | Medium |
| Maintenance | Vendor | Shared | Customer | Shared |
| Cost Model | OpEx | OpEx | CapEx | Mixed |
| Scalability | Automatic | Manual | Manual | Hybrid |
| Updates | Automatic | Scheduled | Manual | Mixed |

## Infrastructure Requirements

### Cloud/Dedicated (Managed by WISDM)
- Internet connectivity
- Modern web browser
- Scanner agent (optional)

### On-Premises Minimum
| Component | Specification |
|-----------|---------------|
| Compute | 3x nodes, 8 cores, 32GB RAM each |
| Storage | 1TB SSD (expandable) |
| Network | 1Gbps internal, 100Mbps external |
| OS | Ubuntu 22.04 LTS / RHEL 9 |
| Container | Kubernetes 1.28+ / Docker 24+ |
| Database | PostgreSQL 15+ |

### On-Premises Recommended (Production)
| Component | Specification |
|-----------|---------------|
| Compute | 5x nodes, 16 cores, 64GB RAM each |
| Storage | 10TB NVMe (RAID-10) |
| Network | 10Gbps internal, 1Gbps external |
| Load Balancer | HAProxy / NGINX / F5 |
| Monitoring | Prometheus + Grafana |
| Logging | ELK Stack / Loki |
| Backup | Automated daily + continuous WAL |

## Support Matrix

| Deployment | Installation | Updates | Monitoring | Troubleshooting |
|------------|:------------:|:-------:|:----------:|:---------------:|
| Cloud | N/A | Automatic | Included | Included |
| Dedicated | WISDM | Scheduled | Included | Priority |
| On-Prem | Customer* | Customer* | Customer | Remote |
| Hybrid | Shared | Mixed | Shared | Shared |

*Professional services available for installation and updates

## Migration Paths

```
Cloud ──────────────────────► Dedicated
  │                              │
  │                              │
  ▼                              ▼
Hybrid ◄────────────────────► On-Prem
```

All deployment models support data migration between them. Contact WISDM Professional Services for migration planning.
