import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Database, Server, CheckCircle2, AlertCircle, Download } from "lucide-react";
import lucidDocsLogo from "@/assets/luciddocs-logo.png";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

export default function SecurityCompliance() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const generatePDF = async () => {
    try {
      toast({
        title: "Generating PDF...",
        description: "Please wait while we create your document.",
      });

      // Load html2canvas from CDN at runtime to avoid type/bundler issues
      const ensureHtml2Canvas = () =>
        new Promise<any>((resolve, reject) => {
          const w = window as any;
          if (w.html2canvas) return resolve(w.html2canvas);
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
          script.onload = () => resolve(w.html2canvas);
          script.onerror = reject;
          document.body.appendChild(script);
        });

      const html2canvas = await ensureHtml2Canvas();
      const element = document.getElementById("pdf-content") || document.body;

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: (element as HTMLElement).scrollWidth,
        windowHeight: (element as HTMLElement).scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("WISDM-Security-Compliance-Standards.pdf");

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

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = "WISDM-Security-Compliance-Standards";
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };
  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 no-print">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div id="pdf-content" className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src={lucidDocsLogo} alt="LucidDocs AI" className="h-12 w-auto" />
              <div>
                <h1 className="text-4xl font-bold">LucidDocs AI</h1>
                <p className="text-lg text-muted-foreground">Security Compliance & Standards</p>
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
                Print to PDF
              </Button>
              <Button onClick={generatePDF} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
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