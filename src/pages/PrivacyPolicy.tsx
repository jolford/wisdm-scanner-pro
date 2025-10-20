import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="p-8">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                Western Integrated Systems ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our document processing and OCR services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold mb-2">Personal Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Name and contact information (email address, phone number)</li>
                <li>Account credentials and authentication data</li>
                <li>Company name and business information</li>
                <li>Payment and billing information</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Document Data</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Documents uploaded for processing</li>
                <li>Extracted text and metadata from documents</li>
                <li>Document processing history and validation records</li>
                <li>Custom fields and indexing data</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Technical Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>IP address and device information</li>
                <li>Browser type and operating system</li>
                <li>Usage data and analytics</li>
                <li>Log files and error reports</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Service Delivery:</strong> Process documents, perform OCR, and provide validation tools</li>
                <li><strong>Account Management:</strong> Create and maintain your user account</li>
                <li><strong>Communication:</strong> Send service updates, technical notices, and support messages</li>
                <li><strong>Improvement:</strong> Analyze usage patterns to enhance our services</li>
                <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security incidents</li>
                <li><strong>Legal Compliance:</strong> Meet regulatory requirements and legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Data Storage and Security</h2>
              <p className="text-muted-foreground mb-3">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Encryption in transit (TLS/SSL) and at rest</li>
                <li>Secure cloud storage with access controls</li>
                <li>Regular security audits and monitoring</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as necessary to provide our services and comply with legal obligations:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>Documents:</strong> Configurable retention periods per project settings</li>
                <li><strong>Metadata:</strong> May be retained for analytics and service improvement</li>
                <li><strong>Legal Requirements:</strong> Some data may be retained longer to comply with regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground mb-3">
                We do not sell your personal information. We may share data with:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Service Providers:</strong> Third-party vendors who assist in service delivery (cloud hosting, payment processing)</li>
                <li><strong>Legal Requirements:</strong> When required by law, subpoena, or legal process</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>Consent:</strong> When you explicitly authorize disclosure</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Your Rights</h2>
              <p className="text-muted-foreground mb-3">
                Depending on your jurisdiction, you may have the following rights:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Access:</strong> Request copies of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your data ("right to be forgotten")</li>
                <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
                <li><strong>Objection:</strong> Object to certain types of processing</li>
                <li><strong>Restriction:</strong> Request limited processing of your data</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                To exercise these rights, contact us at privacy@wisdm.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies to enhance user experience and analyze usage. See our <a href="/cookie-policy" className="text-primary underline">Cookie Policy</a> for details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. International Data Transfers</h2>
              <p className="text-muted-foreground">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including standard contractual clauses and data processing agreements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our services are not directed to individuals under 18 years of age. We do not knowingly collect personal information from children.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy periodically. We will notify you of material changes via email or through our service. Your continued use after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Contact Us</h2>
              <p className="text-muted-foreground">
                For questions about this Privacy Policy or our data practices:
              </p>
              <div className="mt-3 p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold">Western Integrated Systems</p>
                <p className="text-muted-foreground">Email: privacy@wisdm.com</p>
                <p className="text-muted-foreground">Address: [Your Business Address]</p>
              </div>
            </section>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong>Legal Notice:</strong> This is a template Privacy Policy. Consult with legal counsel to ensure compliance with applicable laws in your jurisdiction (GDPR, CCPA, etc.) and customize based on your specific business practices.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
