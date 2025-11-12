# WISDM Scanner Pro - Document Capture & AI Processing Platform

Enterprise-grade intelligent document processing system with AI-powered OCR, validation workflows, and automated export capabilities.

## Project info

**URL**: https://lovable.dev/projects/4a3fccc7-b53b-4e9a-95e8-3f418cc798d5

## Key Features

### 🎯 Core Capabilities
- **AI-Powered OCR**: Advanced text extraction with Google Gemini & OpenAI GPT-5
- **Multi-Language Support**: English, Spanish, French, German interfaces
- **Zonal Extraction**: Template-based field extraction with anchor positioning
- **Validation Workflows**: Queue-based document review and approval
- **Batch Processing**: Process hundreds of documents simultaneously
- **Export Integration**: Connect to ECMs (SharePoint, Documentum, FileB ound)

### 🚀 Advanced Features
- **Confidence Scoring Dashboard**: Visual indicators for low-confidence extractions
- **Duplicate Detection**: Prevent reprocessing of duplicate documents
- **Field-Level Validation Rules**: Custom business rules per document type
- **Exception Handling Queue**: Structured workflow for validation failures
- **Bulk Edit Mode**: Modify multiple document fields at once
- **Document Comparison**: Side-by-side before/after validation views
- **QA Metrics Tracking**: Monitor accuracy, processing times, error rates

### 🔔 Integration & Automation
- **Webhook Notifications**: Real-time alerts to Microsoft Teams, Slack, custom endpoints
- **Scheduled Batch Processing**: Automated document processing at specific times
- **Hot Folder Monitoring**: Auto-import from network folders
- **Email Import**: Process documents from email attachments
- **Scanner Auto-Import**: Direct integration with physical scanners
- **Fax Integration**: Receive and process faxed documents (Twilio)

### 🛡️ Enterprise Security
- **Multi-Tenant Architecture**: Isolated data per customer
- **Role-Based Access Control**: System Admin, Tenant Admin, User roles
- **MFA Support**: Two-factor authentication
- **Audit Logging**: Complete activity trail
- **Row-Level Security**: PostgreSQL RLS policies
- **Data Encryption**: At rest and in transit

### 📊 Monitoring & Administration
- **Rate Limit Monitoring**: Proactive warnings before limits reached
- **Enhanced Error Logging**: Granular error tracking with stack traces
- **Database Backup Strategy**: Automated PITR + manual exports
- **Health Monitoring**: Edge function and database status
- **Usage Tracking**: Cost tracking per tenant with budget alerts

## 📚 Documentation

### User Guides
- **[Getting Started](SCANNER_SYNC_SETUP.md)** - Quick setup guide
- **[Petition Processing](PETITION_PROCESSING_GUIDE.md)** - Voter registration workflow
- **[Scanner Auto-Import](SCANNER_AUTO_IMPORT_GUIDE.md)** - Physical scanner setup

### Administrator Guides
- **[System Administration](SYSTEM_ADMINISTRATION_GUIDE.md)** - Complete admin reference
- **[Database Backup](DATABASE_BACKUP_GUIDE.md)** - Backup & recovery procedures
- **[Security Guide](SECURITY_GUIDE.md)** - Security architecture & best practices
- **[API Documentation](API_DOCUMENTATION.md)** - REST API reference

### Advanced Configuration
- **[Advanced AI](ADVANCED_AI_GUIDE.md)** - ML features & confidence scoring
- **[Feature Enhancements](FEATURE_ENHANCEMENTS.md)** - Latest capabilities
- **[Release Notes](RELEASE_NOTES.md)** - Version history & changes

## 🔧 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- Vite build system
- TanStack Query for data fetching
- i18next for internationalization

**Backend:**
- Lovable Cloud (Supabase)
- PostgreSQL database with RLS
- Edge Functions (Deno runtime)
- Lovable AI integration
- Storage buckets for documents

**Integrations:**
- Twilio (Fax API)
- Microsoft Teams (Webhooks)
- SharePoint, Documentum, FileBound (ECM exports)
- Google Gemini & OpenAI (AI processing)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4a3fccc7-b53b-4e9a-95e8-3f418cc798d5) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/4a3fccc7-b53b-4e9a-95e8-3f418cc798d5) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## 🚨 System Administration

### Monitoring & Health Checks

**Monitor Key Systems:**
- Edge Functions: Check logs in Lovable Cloud UI
- Database: Query `pg_stat_activity` for active connections
- Job Queue: Monitor `jobs` table for pending/failed jobs
- Webhooks: Review `webhook_logs` for delivery status

**Rate Limit Warnings:**
Users see automatic warnings when approaching rate limits:
- 80% threshold: Warning displayed
- 100% threshold: Critical alert with toast notification

**Error Logging:**
All edge functions now include enhanced error tracking:
- Request-level validation
- Per-operation error handling
- Detailed logging with prefixes (e.g., `[Webhook]`)
- Stack traces for debugging

### Backup & Recovery

**Automatic Backups:**
- Point-in-Time Recovery: Last 7 days
- Daily snapshots: 30 day retention
- Weekly backups: 90 day retention

**Manual Backups:**
```bash
# Full database export
supabase db dump -f backup-$(date +%Y%m%d).sql

# Compress and store
gzip backup-$(date +%Y%m%d).sql
```

**Emergency Recovery:**
See `DATABASE_BACKUP_GUIDE.md` for complete procedures including:
- PITR restoration steps
- Table-specific restore procedures
- Data validation queries
- Disaster recovery plan

### Security Checklist

**Daily:**
- [ ] Monitor failed login attempts
- [ ] Review webhook delivery failures
- [ ] Check unusual database activity

**Weekly:**
- [ ] Review audit logs
- [ ] Verify backup completion
- [ ] Check rate limit violations

**Monthly:**
- [ ] Test backup restoration
- [ ] Review access permissions
- [ ] Update security policies

**Quarterly:**
- [ ] Full disaster recovery drill
- [ ] Security vulnerability scan
- [ ] Compliance review

## 📞 Support

**Documentation:**
- System Admin: `SYSTEM_ADMINISTRATION_GUIDE.md`
- Backups: `DATABASE_BACKUP_GUIDE.md`
- Security: `SECURITY_GUIDE.md`
- API: `API_DOCUMENTATION.md`

**Lovable Cloud Support:**
- Email: support@lovable.dev
- Dashboard: Access through project settings
- Emergency: 24/7 for critical issues

---

**Version:** 2.0  
**Last Updated:** 2025-01-12  
**License:** Enterprise
