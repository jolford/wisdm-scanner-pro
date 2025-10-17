import { Link } from "react-router-dom";
import { Download } from "lucide-react";
const APP_VERSION = '1.0';

const downloadPresentation = () => {
  const content = `WISDM SCANNER PRO - SALES PRESENTATION

© 2025 Western Integrated Systems
Enterprise Document Processing Platform

EXECUTIVE SUMMARY
================
WISDM Scanner Pro is an enterprise-grade document processing platform that transforms manual, error-prone document workflows into automated, AI-powered operations.

CORE VALUE PROPOSITION
======================
Problems We Solve:
- Manual data entry is slow, expensive, and error-prone
- Document processing bottlenecks slow business operations
- Integration with existing systems is complex and costly
- Compliance and audit trails are difficult to maintain

Our Solution:
All-in-one platform for document capture, processing, validation, and export with AI-powered automation and enterprise integrations.

KEY FEATURES
============
1. Multi-Channel Capture
   - Physical scanner integration (TWAIN/WIA)
   - Drag-and-drop file upload
   - Mobile capture via web interface
   - Batch processing capabilities

2. AI-Powered Processing
   - OCR with 95%+ accuracy
   - Automatic data extraction
   - Barcode/QR code recognition
   - Document classification

3. Intelligent Validation
   - Real-time validation feedback
   - Manual correction interface
   - Batch validation tools
   - Quality assurance workflows

4. Enterprise Export
   - FileBound integration
   - Generic ECM export
   - Customizable metadata mapping
   - Automated export rules

5. Administrative Control
   - User & role management
   - License management
   - Project organization
   - Cost tracking & analytics

TECHNICAL ARCHITECTURE
======================
Frontend: React, TypeScript, Vite, Tailwind CSS
Backend: Lovable Cloud/Supabase (PostgreSQL, Auth, Storage)
AI/Processing: Lovable AI Gateway (Gemini/GPT models)
Processing: PDF.js, TIFF support, barcode detection

REVENUE MODEL
=============
License Fees: $50-500/user/month
AI Processing: $0.10-0.50/page
Setup Fees: $5,000-50,000
Annual Support: 15-20% of license fees

TARGET MARKETS
==============
- Healthcare (patient records, medical forms)
- Legal (case files, contracts)
- Financial Services (loan docs, applications)
- Insurance (claims, policies)
- Government (permits, forms)

COMPETITIVE ADVANTAGES
======================
- Modern cloud-native architecture
- AI-powered automation
- Transparent usage-based pricing
- Flexible deployment options
- Real-time cost visibility

SECURITY & COMPLIANCE
======================
- End-to-end encryption
- SOC 2 Type II ready
- HIPAA compliance capable
- GDPR compliant
- Role-based access control
- Comprehensive audit logging

IMPLEMENTATION TIMELINE
========================
Week 1-2: Initial setup, user training
Week 3-4: Document testing, workflow configuration
Ongoing: Optimization and scaling

For more information, contact:
Western Integrated Systems
sales@wisdmscanpro.com`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'WISDM-Scanner-Pro-Sales-Presentation.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p>© 2025 Western Integrated Systems. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/help" className="hover:underline">Help Center</Link>
            <Link to="/api-docs" className="hover:underline">API Docs</Link>
            <button 
              onClick={downloadPresentation}
              className="text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Sales Presentation
            </button>
          </div>
          <p className="text-xs">Version {APP_VERSION}</p>
        </div>
      </div>
    </footer>
  );
};
