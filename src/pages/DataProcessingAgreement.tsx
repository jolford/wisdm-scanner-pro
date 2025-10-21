import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DataProcessingAgreement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="p-8">
          <h1 className="text-4xl font-bold mb-2">Data Processing Agreement (DPA)</h1>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Introduction and Definitions</h2>
              <p className="text-muted-foreground mb-3">
                This Data Processing Agreement ("DPA") forms part of the agreement between Western Integrated Systems
                ("Processor," "we," or "us") and the customer ("Controller," "you," or "Customer") for the provision of
                document processing services.
              </p>

              <h3 className="text-xl font-semibold mb-2">Definitions</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Controller:</strong> The entity that determines the purposes and means of processing Personal
                  Data
                </li>
                <li>
                  <strong>Processor:</strong> Western Integrated Systems, which processes Personal Data on behalf of the
                  Controller
                </li>
                <li>
                  <strong>Personal Data:</strong> Any information relating to an identified or identifiable natural
                  person contained in processed documents
                </li>
                <li>
                  <strong>Processing:</strong> Any operation performed on Personal Data, including scanning, OCR,
                  storage, validation, and export
                </li>
                <li>
                  <strong>Sub-processor:</strong> Third-party service providers engaged by the Processor to assist in
                  data processing
                </li>
                <li>
                  <strong>Data Subject:</strong> An identified or identifiable natural person whose Personal Data is
                  processed
                </li>
                <li>
                  <strong>GDPR:</strong> General Data Protection Regulation (EU) 2016/679
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Scope and Applicability</h2>
              <p className="text-muted-foreground mb-3">
                This DPA applies to all processing of Personal Data by the Processor on behalf of the Controller in
                connection with:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Document scanning and upload services</li>
                <li>OCR and text extraction from documents</li>
                <li>Metadata indexing and validation workflows</li>
                <li>Document storage and retrieval</li>
                <li>Export to customer-designated systems</li>
                <li>Analytics and reporting features</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. Processor Obligations</h2>
              <p className="text-muted-foreground mb-3">The Processor shall:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Process Personal Data only on documented instructions from the Controller</li>
                <li>Ensure personnel processing Personal Data are bound by confidentiality obligations</li>
                <li>Implement appropriate technical and organizational security measures (see Section 6)</li>
                <li>Engage Sub-processors only with prior written authorization from the Controller</li>
                <li>Assist the Controller in responding to Data Subject rights requests</li>
                <li>Assist the Controller with data protection impact assessments when required</li>
                <li>Delete or return Personal Data at the end of the service relationship</li>
                <li>Make available information necessary to demonstrate compliance</li>
                <li>Notify the Controller without undue delay of any Personal Data breach</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Controller Obligations</h2>
              <p className="text-muted-foreground mb-3">The Controller warrants that:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>It has a lawful basis for processing the Personal Data</li>
                <li>It has provided appropriate notices to Data Subjects</li>
                <li>It has obtained necessary consents where required</li>
                <li>It has the right to transfer Personal Data to the Processor</li>
                <li>Processing instructions comply with applicable data protection laws</li>
                <li>It will promptly notify the Processor of any errors or requests from Data Subjects</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Nature and Purpose of Processing</h2>

              <h3 className="text-xl font-semibold mb-2">Subject Matter</h3>
              <p className="text-muted-foreground">
                Document processing, OCR, indexing, validation, and export services
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">Duration</h3>
              <p className="text-muted-foreground">
                Duration of the service agreement plus any retention period required by law or agreed upon
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">Purpose of Processing</h3>
              <p className="text-muted-foreground">
                To provide document processing services as specified in the main service agreement
              </p>

              <h3 className="text-xl font-semibold mb-2 mt-4">Types of Personal Data</h3>
              <p className="text-muted-foreground mb-2">Depending on documents processed, may include:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Names and contact information</li>
                <li>Identification numbers (SSN, tax ID, passport)</li>
                <li>Financial information (account numbers, transaction data)</li>
                <li>Health information (medical records, insurance data)</li>
                <li>Employment information</li>
                <li>Legal documents and contracts</li>
                <li>Any other information contained in uploaded documents</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Categories of Data Subjects</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Customers and clients</li>
                <li>Employees and contractors</li>
                <li>Patients and healthcare recipients</li>
                <li>Citizens and residents</li>
                <li>Vendors and suppliers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Security Measures</h2>
              <p className="text-muted-foreground mb-3">
                The Processor implements the following technical and organizational measures:
              </p>

              <h3 className="text-xl font-semibold mb-2">Technical Measures</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Encryption:</strong> TLS 1.3 for data in transit, AES-256 for data at rest
                </li>
                <li>
                  <strong>Access Control:</strong> Role-based access control (RBAC) and multi-factor authentication
                </li>
                <li>
                  <strong>Network Security:</strong> Firewalls, intrusion detection systems, and DDoS protection
                </li>
                <li>
                  <strong>Data Segregation:</strong> Logical separation of customer data in multi-tenant architecture
                </li>
                <li>
                  <strong>Monitoring:</strong> 24/7 security monitoring and automated threat detection
                </li>
                <li>
                  <strong>Backups:</strong> Regular encrypted backups with off-site storage
                </li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Organizational Measures</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Confidentiality:</strong> Staff training and confidentiality agreements
                </li>
                <li>
                  <strong>Access Management:</strong> Principle of least privilege, regular access reviews
                </li>
                <li>
                  <strong>Incident Response:</strong> Documented breach notification procedures
                </li>
                <li>
                  <strong>Vendor Management:</strong> Security assessments of Sub-processors
                </li>
                <li>
                  <strong>Security Testing:</strong> Regular penetration testing and vulnerability scans
                </li>
                <li>
                  <strong>Certifications:</strong> [List relevant certifications: SOC 2, ISO 27001, etc.]
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Sub-processors</h2>
              <p className="text-muted-foreground mb-3">
                The Controller authorizes the Processor to engage the following Sub-processors:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Sub-processor</th>
                      <th className="text-left p-2 font-semibold">Service</th>
                      <th className="text-left p-2 font-semibold">Location</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="p-2">Supabase (PostgreSQL)</td>
                      <td className="p-2">Database hosting and authentication</td>
                      <td className="p-2">USA</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Cloud Storage Provider</td>
                      <td className="p-2">Document storage</td>
                      <td className="p-2">USA / EU (configurable)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">OCR Service Provider</td>
                      <td className="p-2">Text extraction services</td>
                      <td className="p-2">[Location]</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-muted-foreground mt-4">
                The Processor will notify the Controller of any intended changes to Sub-processors at least 30 days in
                advance. The Controller may object within 15 days on reasonable data protection grounds.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Data Subject Rights</h2>
              <p className="text-muted-foreground mb-3">
                The Processor shall assist the Controller in fulfilling Data Subject rights requests:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Right of Access:</strong> Provide copies of Personal Data
                </li>
                <li>
                  <strong>Right to Rectification:</strong> Correct inaccurate data
                </li>
                <li>
                  <strong>Right to Erasure:</strong> Delete data ("right to be forgotten")
                </li>
                <li>
                  <strong>Right to Restriction:</strong> Limit processing activities
                </li>
                <li>
                  <strong>Right to Data Portability:</strong> Export data in structured format
                </li>
                <li>
                  <strong>Right to Object:</strong> Cease certain processing activities
                </li>
              </ul>
              <p className="text-muted-foreground mt-3">
                The Processor will respond to Controller requests within 5 business days. The Controller is responsible
                for verifying Data Subject identity and validity of requests.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Data Breach Notification</h2>
              <p className="text-muted-foreground mb-3">In the event of a Personal Data breach, the Processor shall:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Notify the Controller without undue delay (within 48 hours of discovery)</li>
                <li>
                  Provide details including nature of breach, categories of data affected, and number of Data Subjects
                </li>
                <li>Describe likely consequences and measures taken or proposed to mitigate</li>
                <li>Cooperate with the Controller's investigation and notification obligations</li>
                <li>Document the breach and remediation steps taken</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. International Data Transfers</h2>
              <p className="text-muted-foreground mb-3">
                If Personal Data is transferred outside the EEA, the Processor ensures adequate safeguards through:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>EU Standard Contractual Clauses (SCCs)</li>
                <li>Adequacy decisions by the European Commission</li>
                <li>Binding Corporate Rules where applicable</li>
                <li>Other legally recognized transfer mechanisms</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Current processing locations: [List all countries where data may be processed]
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Audits and Compliance</h2>
              <p className="text-muted-foreground">
                The Controller may audit the Processor's compliance with this DPA, subject to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Reasonable prior written notice (minimum 30 days)</li>
                <li>Audit conducted during business hours to minimize disruption</li>
                <li>Confidentiality obligations for auditors</li>
                <li>Maximum of one audit per year unless required by law or suspected breach</li>
                <li>Controller bears reasonable costs of audit</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Data Retention and Deletion</h2>
              <p className="text-muted-foreground mb-3">Upon termination or expiration of services:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>The Processor will delete or return all Personal Data within 30 days</li>
                <li>The Controller may request export of data before deletion</li>
                <li>The Processor may retain copies required by law with continued confidentiality protection</li>
                <li>Deletion will be certified in writing upon Controller request</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                During the service period, data retention follows project-specific settings configured by the
                Controller.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">13. Liability and Indemnification</h2>
              <p className="text-muted-foreground">
                Each party's liability under this DPA shall be subject to the limitations and exclusions in the main
                service agreement, except for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Breaches of data protection laws</li>
                <li>Gross negligence or willful misconduct</li>
                <li>Regulatory fines imposed due to party's breach</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">14. Term and Termination</h2>
              <p className="text-muted-foreground">
                This DPA remains in effect for the duration of the service agreement and any period during which the
                Processor processes Personal Data on behalf of the Controller. Either party may terminate if the other
                materially breaches this DPA and fails to remedy within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">15. Governing Law</h2>
              <p className="text-muted-foreground">
                This DPA is governed by [Jurisdiction] law. In case of conflict between this DPA and the main service
                agreement, this DPA shall prevail on data protection matters.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">16. Contact Information</h2>
              <p className="text-muted-foreground mb-3">Data Protection Officer:</p>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold">Western Integrated Systems</p>
                <p className="text-muted-foreground">DPO Email: dpo@wisdm.com</p>
                <p className="text-muted-foreground">Privacy Email: support@westint.com</p>
                <p className="text-muted-foreground">Address: [Your Business Address]</p>
              </div>
            </section>

            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>IMPORTANT LEGAL NOTICE:</strong> This is a template Data Processing Agreement. This document
                MUST be reviewed and customized by qualified legal counsel before use. DPAs have significant legal and
                regulatory implications under GDPR, CCPA, and other data protection laws. Ensure all technical and
                organizational measures accurately reflect your actual practices. Enterprise customers typically require
                negotiated, signed DPAs.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DataProcessingAgreement;
