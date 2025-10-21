import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Shield, AlertTriangle, Database } from "lucide-react";

export default function ComplianceHub() {
  const navigate = useNavigate();

  const documents = [
    {
      title: "Privacy Policy",
      description: "How we collect, use, and protect personal information",
      icon: Shield,
      path: "/privacy-policy",
    },
    {
      title: "Terms of Service",
      description: "Legal terms governing use of the platform",
      icon: FileText,
      path: "/terms-of-service",
    },
    {
      title: "Data Processing Agreement",
      description: "GDPR-compliant data processing terms",
      icon: Database,
      path: "/data-processing-agreement",
    },
    {
      title: "Cookie Policy",
      description: "Information about cookies and tracking",
      icon: FileText,
      path: "/cookie-policy",
    },
    {
      title: "Security Policy",
      description: "Information security controls and procedures",
      icon: Shield,
      path: "/security-policy",
    },
    {
      title: "Incident Response Plan",
      description: "Security incident response procedures",
      icon: AlertTriangle,
      path: "/incident-response",
    },
    {
      title: "Business Continuity Plan",
      description: "Disaster recovery and continuity procedures",
      icon: Database,
      path: "/business-continuity",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Compliance Documentation</h1>
          <p className="text-lg text-muted-foreground">
            Comprehensive security, privacy, and operational documentation to support SOC 2 readiness and regulatory
            compliance.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {documents.map((doc) => {
            const Icon = doc.icon;
            return (
              <Card
                key={doc.path}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(doc.path)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-4">SOC 2 Compliance Overview</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">What is SOC 2?</h3>
              <p className="text-muted-foreground">
                SOC 2 (Service Organization Control 2) is an auditing framework that ensures service providers securely
                manage customer data. It focuses on five Trust Service Criteria: Security, Availability, Processing
                Integrity, Confidentiality, and Privacy.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Our Compliance Status</h3>
              <p className="text-muted-foreground mb-4">
                WISDM Scanner Pro has implemented comprehensive security controls aligned with SOC 2 requirements. While
                formal certification requires an independent audit, our platform includes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Row Level Security (RLS) policies on all database tables</li>
                <li>Role-based access control (RBAC) with least privilege</li>
                <li>End-to-end encryption for data in transit and at rest</li>
                <li>Comprehensive audit logging and monitoring</li>
                <li>Incident response and disaster recovery procedures</li>
                <li>Regular security assessments and updates</li>
                <li>Employee security awareness training</li>
                <li>Vendor management and assessment processes</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Path to Certification</h3>
              <p className="text-muted-foreground mb-4">
                To achieve formal SOC 2 certification, organizations typically:
              </p>
              <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
                <li>Implement required security controls (completed for WISDM)</li>
                <li>Document policies and procedures (available in this hub)</li>
                <li>Operate controls for 3-12 months (observation period)</li>
                <li>Engage an independent auditor to assess controls</li>
                <li>Receive SOC 2 Type I (point in time) or Type II (over time) report</li>
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Customer Benefits</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Confidence in data security and privacy practices</li>
                <li>Transparent documentation of security controls</li>
                <li>Regular security assessments and updates</li>
                <li>Incident response capabilities to protect your data</li>
                <li>Business continuity planning ensures service availability</li>
              </ul>
            </div>

            <div className="bg-muted p-6 rounded-lg mt-6">
              <p className="text-sm font-semibold mb-2">Need More Information?</p>
              <p className="text-sm text-muted-foreground mb-4">
                For questions about our security practices, compliance status, or to request specific documentation for
                your procurement process, please contact us.
              </p>
              <Button variant="outline" onClick={() => (window.location.href = "mailto:support@westint.com")}>
                Contact Security Team
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
