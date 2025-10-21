import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function SecurityPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Information Security Policy</h1>
        <p className="text-muted-foreground mb-8">Effective Date: January 1, 2025 | Version 1.1</p>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-3">1. Purpose and Scope</h2>
            <p className="mb-4">
              This Information Security Policy establishes the framework for protecting WISDM Scanner Pro's information
              assets, including customer data, business information, and system infrastructure.
            </p>
            <p>
              <strong>Scope:</strong> This policy applies to all employees, contractors, vendors, and third parties who
              access or process company or customer data.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">2. Security Governance</h2>
            <h3 className="text-xl font-semibold mb-2">2.1 Security Organization</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Security oversight is provided by the Chief Technology Officer (CTO)</li>
              <li>Security incidents are managed through a dedicated incident response team</li>
              <li>Security policies are reviewed and updated annually</li>
              <li>All employees receive security awareness training upon hire and annually</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">2.2 Roles and Responsibilities</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>System Administrators:</strong> Implement and maintain security controls
              </li>
              <li>
                <strong>Development Team:</strong> Follow secure coding practices and conduct code reviews
              </li>
              <li>
                <strong>All Users:</strong> Comply with security policies and report incidents
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">3. Access Control Policy</h2>
            <h3 className="text-xl font-semibold mb-2">3.1 Authentication</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>All users must authenticate using unique credentials</li>
              <li>Passwords must meet complexity requirements (minimum 12 characters)</li>
              <li>Multi-factor authentication (MFA) is required for administrative access</li>
              <li>Sessions timeout after 30 minutes of inactivity</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">3.2 Authorization</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Access is granted based on the principle of least privilege</li>
              <li>Role-Based Access Control (RBAC) is enforced throughout the system</li>
              <li>Administrative privileges are limited to authorized personnel</li>
              <li>User access is reviewed quarterly</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">3.3 Account Management</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>User accounts are provisioned based on approved access requests</li>
              <li>Inactive accounts are disabled after 90 days</li>
              <li>Terminated user accounts are disabled immediately</li>
              <li>Access rights are reviewed during role changes</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">4. Data Protection</h2>
            <h3 className="text-xl font-semibold mb-2">4.1 Data Classification</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Confidential:</strong> Customer data, PII, authentication credentials
              </li>
              <li>
                <strong>Internal:</strong> Business operations data, internal communications
              </li>
              <li>
                <strong>Public:</strong> Marketing materials, public documentation
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">4.2 Encryption</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Data at rest is encrypted using AES-256</li>
              <li>Data in transit is protected using TLS 1.3</li>
              <li>Encryption keys are managed securely and rotated annually</li>
              <li>Database connections use encrypted channels</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">4.3 Data Retention and Disposal</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Customer data is retained per contractual agreements</li>
              <li>Backup data is retained for 90 days</li>
              <li>Data disposal follows secure deletion procedures</li>
              <li>Audit logs are retained for 1 year minimum</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">5. System Security</h2>
            <h3 className="text-xl font-semibold mb-2">5.1 Infrastructure Security</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Production systems are hosted on secure cloud infrastructure (Lovable Cloud/Supabase)</li>
              <li>Network segmentation separates production and development environments</li>
              <li>Firewalls and security groups restrict unauthorized access</li>
              <li>Intrusion detection systems monitor for suspicious activity</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">5.2 Application Security</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Row Level Security (RLS) policies protect database access</li>
              <li>Input validation prevents injection attacks</li>
              <li>Security headers protect against common web vulnerabilities</li>
              <li>Error messages do not expose sensitive information</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">5.3 Vulnerability Management</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Dependencies are scanned for known vulnerabilities</li>
              <li>Security patches are applied within 30 days of release</li>
              <li>Critical vulnerabilities are addressed within 7 days</li>
              <li>Penetration testing is conducted annually</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">6. Monitoring and Logging</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>System access and activities are logged continuously</li>
              <li>Security logs are reviewed daily for anomalies</li>
              <li>Failed authentication attempts trigger alerts</li>
              <li>Logs are protected from unauthorized modification</li>
              <li>Log data is retained for 1 year for forensic analysis</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">7. Secure Development</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Security is incorporated throughout the software development lifecycle</li>
              <li>Code reviews include security assessment</li>
              <li>Sensitive data is never hardcoded in source code</li>
              <li>Third-party dependencies are vetted before use</li>
              <li>Security testing is performed before production deployment</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">8. Third-Party Security</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Vendors undergo security assessment before engagement</li>
              <li>Data Processing Agreements are executed with all processors</li>
              <li>Vendor access is limited to necessary systems</li>
              <li>Third-party security is reviewed annually</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">9. Security Awareness Training</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All personnel complete security training within 30 days of hire</li>
              <li>Annual refresher training is mandatory</li>
              <li>Training covers: phishing, password security, data handling, incident reporting</li>
              <li>Training completion is tracked and documented</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">10. Policy Compliance</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Security compliance is monitored continuously</li>
              <li>Policy violations are investigated and remediated</li>
              <li>Disciplinary action may result from non-compliance</li>
              <li>This policy is reviewed and updated annually</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">11. Contact Information</h2>
            <p>
              For questions regarding this policy, contact:
              <br />
              Security Team: support@westint.com
              <br />
              Privacy Officer: support@westint.com
            </p>
          </div>

          <div className="bg-muted p-6 rounded-lg mt-8">
            <p className="text-sm font-semibold mb-2">Legal Notice:</p>
            <p className="text-sm">
              This security policy template should be reviewed and customized by your legal and security teams to ensure
              it meets your specific organizational and regulatory requirements.
            </p>
          </div>
        </section>
      </Card>
    </div>
  );
}
