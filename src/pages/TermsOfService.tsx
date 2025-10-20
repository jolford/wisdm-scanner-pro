import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="p-8">
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using the Western Integrated Systems document processing platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground mb-3">
                Western Integrated Systems provides document processing, OCR (Optical Character Recognition), validation, and export services including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Document scanning and upload capabilities</li>
                <li>Automated text extraction and metadata indexing</li>
                <li>Validation and quality control workflows</li>
                <li>Export to various formats and document management systems</li>
                <li>Batch processing and project management</li>
                <li>User and permission management</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. User Accounts and Registration</h2>
              <h3 className="text-xl font-semibold mb-2">Account Creation</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>You must provide accurate, current, and complete information during registration</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
                <li>You must be at least 18 years old to create an account</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Account Responsibilities</h3>
              <p className="text-muted-foreground">
                You are responsible for all activities that occur under your account. We reserve the right to suspend or terminate accounts that violate these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Acceptable Use Policy</h2>
              <p className="text-muted-foreground mb-3">You agree NOT to use the Service to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Process documents you do not have rights to process</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Reverse engineer, decompile, or disassemble the Service</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Intellectual Property Rights</h2>
              <h3 className="text-xl font-semibold mb-2">Our IP</h3>
              <p className="text-muted-foreground">
                The Service, including all software, designs, text, graphics, and other content, is owned by Western Integrated Systems and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">Your Content</h3>
              <p className="text-muted-foreground">
                You retain ownership of documents you upload. By using the Service, you grant us a limited license to process, store, and display your content solely to provide the Service. We do not claim ownership of your documents.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Payment and Billing</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Fees are charged according to your selected subscription plan or usage</li>
                <li>All fees are non-refundable unless otherwise stated</li>
                <li>We may change pricing with 30 days' notice to active customers</li>
                <li>You authorize us to charge your payment method for all fees incurred</li>
                <li>Failure to pay may result in service suspension or termination</li>
                <li>You are responsible for all taxes associated with your use of the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Service Level and Availability</h2>
              <p className="text-muted-foreground">
                We strive to provide reliable service but cannot guarantee uninterrupted access. We reserve the right to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Perform scheduled maintenance (with advance notice when possible)</li>
                <li>Modify or discontinue features with notice</li>
                <li>Impose usage limits to ensure fair access for all users</li>
                <li>Suspend service for security or legal reasons</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Data Processing and Privacy</h2>
              <p className="text-muted-foreground">
                Our collection and use of your data is governed by our <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>. For business customers handling third-party data, a separate <a href="/data-processing-agreement" className="text-primary underline">Data Processing Agreement</a> applies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND</li>
                <li>WE ARE NOT LIABLE FOR ERRORS IN OCR OUTPUT OR EXTRACTED DATA</li>
                <li>WE ARE NOT RESPONSIBLE FOR LOSS OF DATA, BUSINESS, OR PROFITS</li>
                <li>OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID IN THE PAST 12 MONTHS</li>
                <li>WE ARE NOT LIABLE FOR INDIRECT, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                You are responsible for verifying the accuracy of all extracted data before use in critical applications.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold harmless Western Integrated Systems from any claims, damages, losses, or expenses arising from:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Your violation of these Terms</li>
                <li>Your violation of any applicable laws</li>
                <li>Your infringement of third-party rights</li>
                <li>Documents you process that violate copyright or privacy laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Termination</h2>
              <h3 className="text-xl font-semibold mb-2">By You</h3>
              <p className="text-muted-foreground">
                You may terminate your account at any time through account settings or by contacting support.
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">By Us</h3>
              <p className="text-muted-foreground">
                We may suspend or terminate your account immediately if you violate these Terms, fail to pay fees, or engage in prohibited activities. Upon termination, your access will cease, and we may delete your data according to our retention policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Dispute Resolution</h2>
              <h3 className="text-xl font-semibold mb-2">Governing Law</h3>
              <p className="text-muted-foreground">
                These Terms are governed by the laws of [Your State/Country], without regard to conflict of law principles.
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">Arbitration</h3>
              <p className="text-muted-foreground">
                Any disputes shall be resolved through binding arbitration in accordance with [Arbitration Rules], except that either party may seek injunctive relief in court for IP violations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">13. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may modify these Terms at any time. Material changes will be notified via email or service announcement. Continued use after changes constitutes acceptance. If you disagree with changes, you must stop using the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">14. Miscellaneous</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Entire Agreement:</strong> These Terms constitute the entire agreement between you and us</li>
                <li><strong>Severability:</strong> If any provision is found invalid, the remaining provisions remain in effect</li>
                <li><strong>No Waiver:</strong> Our failure to enforce any provision does not waive our right to do so later</li>
                <li><strong>Assignment:</strong> You may not assign these Terms without our consent</li>
                <li><strong>Force Majeure:</strong> We are not liable for delays due to circumstances beyond our control</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">15. Contact Information</h2>
              <p className="text-muted-foreground mb-3">
                For questions about these Terms:
              </p>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold">Western Integrated Systems</p>
                <p className="text-muted-foreground">Email: legal@wisdm.com</p>
                <p className="text-muted-foreground">Address: [Your Business Address]</p>
              </div>
            </section>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong>Legal Notice:</strong> This is a template Terms of Service. Consult with legal counsel to ensure compliance with applicable laws and customize based on your specific business model, jurisdiction, and risk tolerance.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;
