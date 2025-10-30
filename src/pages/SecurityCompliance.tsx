import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Database, Server, CheckCircle2, AlertCircle, Download } from "lucide-react";
import wisdmLogo from "@/assets/wisdm-logo.png";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

export default function SecurityCompliance() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const generatePDF = () => {
    try {
      toast({
        title: "Generating PDF...",
        description: "Please wait while we create your document.",
      });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      let yPos = margin;

      // Colors matching the design
      const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
      const textColor: [number, number, number] = [0, 0, 0];
      const mutedColor: [number, number, number] = [107, 114, 128];
      const lightBg: [number, number, number] = [249, 250, 251];

      // Helper functions
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      const addWrappedText = (text: string, fontSize: number, isBold: boolean = false, color: [number, number, number] = textColor) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          checkPageBreak(fontSize / 2 + 2);
          doc.text(line, margin, yPos);
          yPos += fontSize / 2 + 2;
        });
      };

      const addCard = (title: string, icon: string, content: () => void) => {
        checkPageBreak(25);
        
        // Card background
        doc.setFillColor(...lightBg);
        doc.rect(margin, yPos - 5, maxWidth, 10, 'F');
        
        // Title with icon
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text(`${icon} ${title}`, margin + 5, yPos);
        yPos += 10;
        
        content();
      };

      // Header with logo
      const logoImg = new Image();
      logoImg.src = wisdmLogo;
      doc.addImage(logoImg, "PNG", margin, yPos, 40, 13);
      yPos += 18;

      // Main Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textColor);
      doc.text("Security Compliance & Standards", margin, yPos);
      yPos += 8;

      // Subtitle
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...mutedColor);
      addWrappedText("Comprehensive overview of security compliance measures, standards, and best practices implemented across our document management system.", 9, false, mutedColor);
      yPos += 5;

      // Version badge
      doc.setFontSize(8);
      doc.setTextColor(...primaryColor);
      doc.text("Version 1.0", margin, yPos);
      doc.setTextColor(...mutedColor);
      doc.text("| Last Updated: October 30, 2025", margin + 25, yPos);
      yPos += 12;

      // Executive Summary Card
      addCard("Executive Summary", "🛡️", () => {
        addWrappedText("This document provides a comprehensive overview of the security compliance measures, standards, and best practices implemented across our document management system. Our platform employs defense-in-depth security architecture with multiple layers of protection at the database, application, and infrastructure levels.", 10, false, mutedColor);
        yPos += 8;
      });

      // Database Security Card
      addCard("Database Security", "💾", () => {
        // Row-Level Security
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Row-Level Security (RLS)", margin + 5, yPos);
        yPos += 6;
        
        addWrappedText("PostgreSQL database enforces Row-Level Security on all sensitive tables, ensuring data access is controlled at the database level rather than relying on application logic.", 9, false, mutedColor);
        
        // Code block
        doc.setFillColor(240, 240, 240);
        doc.rect(margin + 5, yPos, maxWidth - 10, 15, 'F');
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        doc.setTextColor(...textColor);
        doc.text('CREATE POLICY "Users can view own data"', margin + 7, yPos + 4);
        doc.text('ON public.documents FOR SELECT', margin + 7, yPos + 8);
        doc.text('USING (auth.uid() = uploaded_by);', margin + 7, yPos + 12);
        yPos += 20;
        
        // Security Definer Functions
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Security Definer Functions", margin + 5, yPos);
        yPos += 6;
        
        addWrappedText("All authorization checks utilize SECURITY DEFINER functions to prevent infinite recursion and ensure consistent security enforcement.", 9, false, mutedColor);
        yPos += 5;
        
        doc.setFontSize(8);
        doc.text("• is_admin_jwt() - Verifies admin role from JWT claims", margin + 7, yPos);
        yPos += 4;
        doc.text("• is_admin_enhanced() - Combined JWT + database role check", margin + 7, yPos);
        yPos += 4;
        doc.text("• has_role(user_id, role) - Checks user roles without RLS recursion", margin + 7, yPos);
        yPos += 4;
        doc.text("• is_system_admin(user_id) - Verifies system administrator status", margin + 7, yPos);
        yPos += 8;
        
        // RBAC
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Role-Based Access Control (RBAC)", margin + 5, yPos);
        yPos += 6;
        
        addWrappedText("Roles are stored in a dedicated user_roles table (NOT on user profiles) to prevent privilege escalation attacks.", 9, false, mutedColor);
        yPos += 5;
        
        doc.setFontSize(8);
        doc.text("• system_admin: Platform administrators with full access", margin + 7, yPos);
        yPos += 4;
        doc.text("• admin: Tenant administrators with customer-scoped access", margin + 7, yPos);
        yPos += 4;
        doc.text("• user: Standard users with limited permissions", margin + 7, yPos);
        yPos += 8;
      });

      // Application Security Card
      addCard("Application Security", "🔒", () => {
        // Defense-in-Depth
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Defense-in-Depth Authorization", margin + 5, yPos);
        yPos += 6;
        
        addWrappedText("Three-layer authorization approach ensures comprehensive security:", 9, false, mutedColor);
        yPos += 4;
        
        doc.setFontSize(8);
        doc.text("• Layer 1: Database RLS (Primary Defense) - Enforces security at database level", margin + 7, yPos);
        yPos += 4;
        doc.text("• Layer 2: Edge Functions (Secondary Check) - Verifies authentication on every request", margin + 7, yPos);
        yPos += 4;
        doc.text("• Layer 3: Client UI (UX Only) - Display logic only, never trusted for security", margin + 7, yPos);
        yPos += 8;
        
        // Authentication Methods
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Authentication Methods", margin + 5, yPos);
        yPos += 6;
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("• Email/password authentication with secure password policies", margin + 7, yPos);
        yPos += 4;
        doc.text("• Multi-Factor Authentication (MFA/TOTP) available", margin + 7, yPos);
        yPos += 4;
        doc.text("• Google OAuth integration", margin + 7, yPos);
        yPos += 4;
        doc.text("• Session management via JWT tokens", margin + 7, yPos);
        yPos += 4;
        doc.text("• Password hashing using bcrypt", margin + 7, yPos);
        yPos += 4;
        doc.text("• Rate limiting on authentication endpoints", margin + 7, yPos);
        yPos += 8;
        
        // Input Validation
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Input Validation", margin + 5, yPos);
        yPos += 6;
        
        addWrappedText("Client-side validation with Zod schemas and TypeScript, server-side validation in all edge functions, and SQL injection prevention via parameterized queries.", 9, false, mutedColor);
        yPos += 8;
      });

      // Infrastructure Security Card
      addCard("Infrastructure Security", "🖥️", () => {
        // Encryption
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Encryption", margin + 5, yPos);
        yPos += 6;
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("• AES-256 encryption for all stored data", margin + 7, yPos);
        yPos += 4;
        doc.text("• TLS 1.3 for all database connections", margin + 7, yPos);
        yPos += 4;
        doc.text("• All backups encrypted with separate keys", margin + 7, yPos);
        yPos += 4;
        doc.text("• API keys stored as encrypted secrets", margin + 7, yPos);
        yPos += 8;
        
        // Storage Security
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Storage Security", margin + 5, yPos);
        yPos += 6;
        
        addWrappedText("All storage buckets are private by default with RLS policies ensuring users can only access their own files.", 9, false, mutedColor);
        yPos += 8;
        
        // Network Security
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text("✓ Network Security", margin + 5, yPos);
        yPos += 6;
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("• TLS 1.3 encryption for all connections", margin + 7, yPos);
        yPos += 4;
        doc.text("• HTTPS-only enforcement", margin + 7, yPos);
        yPos += 4;
        doc.text("• CORS policies configured", margin + 7, yPos);
        yPos += 4;
        doc.text("• Rate limiting on all endpoints", margin + 7, yPos);
        yPos += 4;
        doc.text("• DDoS protection at infrastructure level", margin + 7, yPos);
        yPos += 8;
      });

      // Compliance Standards
      checkPageBreak(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text("📋 Compliance Standards", margin, yPos);
      yPos += 10;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textColor);
      doc.text("✓ SOC 2 Readiness", margin + 5, yPos);
      yPos += 6;
      
      addWrappedText("Implements Security (CC6), Availability (A1), Confidentiality (C1), and Privacy (P1) criteria.", 9, false, mutedColor);
      yPos += 6;
      
      doc.text("✓ GDPR Compliance", margin + 5, yPos);
      yPos += 6;
      
      addWrappedText("Full data subject rights implementation including access, erasure, rectification, data processing agreement, cookie consent.", 9, false, mutedColor);
      yPos += 10;

      // Audit & Monitoring
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text("📊 Audit & Monitoring", margin, yPos);
      yPos += 10;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textColor);
      doc.text("✓ Comprehensive Audit Logging", margin + 5, yPos);
      yPos += 6;
      
      addWrappedText("90-day retention: user authentication, admin actions, document access, field changes, exports, configuration changes.", 9, false, mutedColor);
      yPos += 6;
      
      doc.text("✓ Error Logging", margin + 5, yPos);
      yPos += 6;
      
      addWrappedText("All errors logged with PII sanitization and automatic redaction.", 9, false, mutedColor);
      yPos += 10;

      // Business Continuity
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text("⚡ Business Continuity", margin, yPos);
      yPos += 10;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...mutedColor);
      doc.text("Backup: Continuous point-in-time recovery, 7-day standard / 30-day critical retention", margin + 5, yPos);
      yPos += 5;
      doc.text("Recovery: RTO < 4 hours, RPO < 15 minutes", margin + 5, yPos);
      yPos += 15;

      // Contact Information
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text("📧 Security Contact Information", margin, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textColor);
      doc.text("Security Team: support@westint.com", margin + 5, yPos);
      yPos += 5;
      doc.text("Incident Reporting: support@westint.com", margin + 5, yPos);
      yPos += 5;
      doc.text("Response Time: < 24 hours for critical issues", margin + 5, yPos);
      yPos += 8;
      
      doc.setFontSize(8);
      doc.setTextColor(...mutedColor);
      addWrappedText("For security vulnerabilities, please report responsibly to support@westint.com. Do not disclose publicly until we have had a chance to address the issue.", 8, false, mutedColor);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(...mutedColor);
      doc.text("Document Classification: Internal Use | Review Frequency: Quarterly", pageWidth / 2, pageHeight - 10, { align: "center" });

      // Save PDF
      doc.save("WISDM-Security-Compliance-Standards.pdf");

      toast({
        title: "PDF Generated",
        description: "Your document has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-12 w-auto" />
              <h1 className="text-4xl font-bold">Security Compliance & Standards</h1>
            </div>
            <Button onClick={generatePDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
          <p className="text-lg text-muted-foreground">
            Comprehensive overview of security compliance measures, standards, and best practices implemented across our document management system.
          </p>
          <div className="flex gap-2 mt-4">
            <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">Version 1.0</span>
            <span className="text-sm bg-muted px-3 py-1 rounded-full">Last Updated: October 30, 2025</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Executive Summary */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Executive Summary
            </h2>
            <p className="text-muted-foreground">
              This document provides a comprehensive overview of the security compliance measures, standards, and best practices implemented across our document management system. Our platform employs defense-in-depth security architecture with multiple layers of protection at the database, application, and infrastructure levels.
            </p>
          </Card>

          {/* Database Security */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Database Security
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Row-Level Security (RLS)</h3>
                </div>
                <p className="text-muted-foreground mb-3">
                  PostgreSQL database enforces Row-Level Security on all sensitive tables, ensuring data access is controlled at the database level rather than relying on application logic.
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm font-mono">
                    CREATE POLICY "Users can view own data"<br/>
                    ON public.documents FOR SELECT<br/>
                    USING (auth.uid() = uploaded_by);
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Security Definer Functions</h3>
                </div>
                <p className="text-muted-foreground">
                  All authorization checks utilize SECURITY DEFINER functions to prevent infinite recursion and ensure consistent security enforcement.
                </p>
                <ul className="list-disc pl-6 mt-2 text-sm text-muted-foreground space-y-1">
                  <li>is_admin_jwt() - Verifies admin role from JWT claims</li>
                  <li>is_admin_enhanced() - Combined JWT + database role check</li>
                  <li>has_role(user_id, role) - Checks user roles without RLS recursion</li>
                  <li>is_system_admin(user_id) - Verifies system administrator status</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Role-Based Access Control (RBAC)</h3>
                </div>
                <p className="text-muted-foreground mb-2">
                  Roles are stored in a dedicated user_roles table (NOT on user profiles) to prevent privilege escalation attacks.
                </p>
                <div className="grid gap-2 mt-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">system_admin:</span>
                    <span className="text-muted-foreground">Platform administrators with full access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">admin:</span>
                    <span className="text-muted-foreground">Tenant administrators with customer-scoped access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">user:</span>
                    <span className="text-muted-foreground">Standard users with limited permissions</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Application Security */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Lock className="h-6 w-6 text-primary" />
              Application Security
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Defense-in-Depth Authorization</h3>
                </div>
                <p className="text-muted-foreground mb-3">
                  Three-layer authorization approach ensures comprehensive security:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Layer 1:</span>
                    <span className="text-muted-foreground">Database RLS (Primary Defense) - Enforces security at database level</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Layer 2:</span>
                    <span className="text-muted-foreground">Edge Functions (Secondary Check) - Verifies authentication on every request</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Layer 3:</span>
                    <span className="text-muted-foreground">Client UI (UX Only) - Display logic only, never trusted for security</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Authentication Methods</h3>
                </div>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>Email/password authentication with secure password policies</li>
                  <li>Multi-Factor Authentication (MFA/TOTP) available</li>
                  <li>Google OAuth integration</li>
                  <li>Session management via JWT tokens</li>
                  <li>Password hashing using bcrypt</li>
                  <li>Rate limiting on authentication endpoints</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Input Validation</h3>
                </div>
                <p className="text-muted-foreground">
                  Client-side validation with Zod schemas and TypeScript, server-side validation in all edge functions, and SQL injection prevention via parameterized queries.
                </p>
              </div>
            </div>
          </Card>

          {/* Infrastructure Security */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Server className="h-6 w-6 text-primary" />
              Infrastructure Security
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Encryption</h3>
                </div>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>AES-256 encryption for all stored data</li>
                  <li>TLS 1.3 for all database connections</li>
                  <li>All backups encrypted with separate keys</li>
                  <li>API keys stored as encrypted secrets</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Storage Security</h3>
                </div>
                <p className="text-muted-foreground mb-2">
                  Private storage buckets with RLS policies ensuring users can only access their own files.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Network Security</h3>
                </div>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>All traffic encrypted via TLS 1.3</li>
                  <li>HTTPS-only access enforced</li>
                  <li>CORS policies configured</li>
                  <li>Rate limiting on public endpoints</li>
                  <li>DDoS protection at infrastructure level</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Compliance Standards */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Compliance Standards</h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">SOC 2 Readiness</h3>
                </div>
                <p className="text-muted-foreground mb-3">
                  System implements the following SOC 2 Trust Services Criteria:
                </p>
                <div className="grid gap-2">
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold">Security (CC6):</span>
                      <span className="text-muted-foreground ml-1">Access controls, system monitoring, change management</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold">Availability (A1):</span>
                      <span className="text-muted-foreground ml-1">Monitoring, backup/recovery, incident response</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold">Confidentiality (C1):</span>
                      <span className="text-muted-foreground ml-1">Data classification, encryption, secure disposal</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold">Privacy (P1):</span>
                      <span className="text-muted-foreground ml-1">Personal information handling, data retention, user consent</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">GDPR Compliance</h3>
                </div>
                <p className="text-muted-foreground mb-2">
                  Full implementation of data subject rights and GDPR requirements:
                </p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>Right to access (data export functionality)</li>
                  <li>Right to erasure (account deletion)</li>
                  <li>Right to rectification (profile updates)</li>
                  <li>Data processing agreement for customers</li>
                  <li>Cookie policy with consent management</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Audit & Monitoring */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Audit & Monitoring</h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Comprehensive Audit Logging</h3>
                </div>
                <p className="text-muted-foreground mb-2">
                  All critical events are logged with 90-day retention:
                </p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>User authentication (login, logout, failed attempts)</li>
                  <li>Admin actions (role changes, user deletion)</li>
                  <li>Document access and modifications</li>
                  <li>Field changes with before/after values</li>
                  <li>Export operations</li>
                  <li>System configuration changes</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Error Logging</h3>
                </div>
                <p className="text-muted-foreground">
                  All errors logged to database with sensitive data sanitization. PII automatically redacted from logs.
                </p>
              </div>
            </div>
          </Card>

          {/* Business Continuity */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Business Continuity</h2>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold mb-1">Backup Frequency</p>
                  <p className="text-muted-foreground">Continuous (point-in-time recovery)</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Retention</p>
                  <p className="text-muted-foreground">7 days standard, 30 days critical</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Recovery Time (RTO)</p>
                  <p className="text-muted-foreground">&lt; 4 hours</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Recovery Point (RPO)</p>
                  <p className="text-muted-foreground">&lt; 15 minutes</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Contact */}
          <Card className="p-6 bg-muted">
            <h3 className="text-lg font-semibold mb-2">Security Contact Information</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Security Team:</span> support@westint.com</p>
              <p><span className="font-semibold">Incident Reporting:</span> support@westint.com</p>
              <p><span className="font-semibold">Response Time:</span> &lt; 24 hours for critical issues</p>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                For security vulnerabilities, please report responsibly to support@westint.com. Do not disclose publicly until we have had a chance to address the issue.
              </p>
            </div>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>Document Classification: Internal Use</p>
            <p>Review Frequency: Quarterly | Next Review: January 30, 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}