# WISDM Scanner Pro - Application Cheat Sheet

## What is it?

**WISDM Scanner Pro** is a professional document scanning and OCR (Optical Character Recognition) system designed for high-volume document processing with validation workflows.

## Key Features

### Document Processing
- **Multi-format support**: Images (JPG, PNG) and PDFs
- **Physical scanner integration**: Direct scanning from hardware devices
- **Intelligent OCR**: Extracts text and metadata from documents
- **Batch processing**: Handle multiple documents efficiently

### Workflow Management
- **Project-based organization**: Organize documents by projects
- **Queue system**: Scan → Validation → Validated → Export
- **Batch tracking**: Monitor progress and document counts
- **Validation screens**: Review and correct extracted data

### Business Features
- **License management**: Document-based licensing system
- **Customer management**: Multi-tenant support
- **User roles**: Admin and user-level access control
- **Usage tracking**: Monitor document consumption

### Export Options
- CSV, JSON, XML, TXT formats
- PDF generation
- Image exports
- Automated batch exports

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **React Router** - Client-side routing
- **React Query** - Server state management

### Backend (Lovable Cloud)
- **Supabase** - PostgreSQL database
- **Edge Functions** - Serverless computing
- **Row Level Security (RLS)** - Database-level permissions
- **Real-time subscriptions** - Live data updates

### Key Libraries
- **pdf.js** - PDF text extraction
- **React Hook Form + Zod** - Form validation
- **jsPDF** - PDF generation
- **Lucide React** - Icon system

## How Was It Developed?

This application was developed using **Lovable** (https://lovable.dev), an AI-powered full-stack development platform.

### Development Approach
1. **AI-Assisted**: Built through natural language conversations with AI
2. **Rapid Iteration**: Features developed and refined quickly
3. **Full-Stack**: Frontend and backend created together
4. **Modern Stack**: Latest web technologies automatically configured

### Lovable Cloud Integration
- **Zero Configuration**: Backend automatically provisioned
- **Managed Database**: PostgreSQL with automatic migrations
- **Built-in Auth**: User authentication out of the box
- **Edge Functions**: Serverless functions for OCR and PDF generation

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Frontend (React/Vite)             │
│  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │   Public   │  │  Admin   │  │  Auth   │ │
│  │   Portal   │  │Dashboard │  │ System  │ │
│  └────────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────┐
│        Lovable Cloud (Supabase)             │
│  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │ PostgreSQL │  │   Edge   │  │  Auth   │ │
│  │  Database  │  │Functions │  │ Service │ │
│  └────────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────┘
```

## Database Schema

### Core Tables
- **projects** - Document processing projects
- **batches** - Groups of documents
- **documents** - Individual scanned documents
- **document_classes** - Document type definitions

### Business Tables
- **customers** - Customer organizations
- **licenses** - Document processing licenses
- **license_usage** - Usage tracking
- **user_customers** - User-customer relationships

### System Tables
- **profiles** - User profiles
- **user_roles** - Role-based access control

## Edge Functions

1. **ocr-scan** - Performs OCR on uploaded images
2. **generate-batch-pdf** - Creates PDF exports of batches
3. **auto-export-batch** - Automated batch export processing

## Security Features

- **Row Level Security (RLS)**: Database-level access control
- **Role-based permissions**: Admin vs User access
- **Secure authentication**: Supabase Auth integration
- **License validation**: Automatic capacity checking
- **Audit trails**: Usage tracking and logging

## Deployment

- **Hosting**: Azure Static Web Apps (configured in workflows)
- **CI/CD**: GitHub Actions automatic deployment
- **Environment**: Production-ready with environment variables
- **Scaling**: Automatically scales with demand

## Key Differentiators

✅ **Professional-grade** document processing
✅ **Multi-tenant** architecture ready
✅ **License-based** business model
✅ **Real-time** validation workflows
✅ **Automated** export capabilities
✅ **Scalable** cloud infrastructure

---

**Developed with**: Lovable.dev
**Stack**: React + TypeScript + Supabase
**Deployment**: Azure Static Web Apps
