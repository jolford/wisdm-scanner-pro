import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function IncidentResponse() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Incident Response Plan</h1>
        <p className="text-muted-foreground mb-8">Effective Date: January 1, 2025 | Version 1.0</p>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-3">1. Purpose and Scope</h2>
            <p className="mb-4">
              This Incident Response Plan establishes procedures for identifying, responding to, and recovering from
              security incidents that may affect WISDM Scanner Pro systems, data, or services.
            </p>
            <p>
              <strong>Scope:</strong> This plan covers all security incidents including data breaches, unauthorized
              access, malware infections, denial of service, and system compromises.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">2. Incident Response Team</h2>
            <h3 className="text-xl font-semibold mb-2">2.1 Team Structure</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Incident Response Manager:</strong> Coordinates response activities
              </li>
              <li>
                <strong>Technical Lead:</strong> Conducts technical investigation and remediation
              </li>
              <li>
                <strong>Communications Lead:</strong> Manages internal and external communications
              </li>
              <li>
                <strong>Legal Counsel:</strong> Provides legal guidance and regulatory compliance
              </li>
              <li>
                <strong>Customer Success:</strong> Manages customer communications and support
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">2.2 Contact Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Incident Response Hotline: support@westint.com</li>
              <li>Emergency Contact: Available 24/7 for critical incidents</li>
              <li>Escalation Path: Technical Lead → CTO → CEO</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">3. Incident Classification</h2>
            <h3 className="text-xl font-semibold mb-2">3.1 Severity Levels</h3>

            <div className="mb-4">
              <h4 className="font-semibold">Critical (P1)</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Confirmed data breach with PII exposure</li>
                <li>Complete system outage affecting all customers</li>
                <li>Active ransomware or destructive attack</li>
                <li>Unauthorized access to production systems</li>
                <li>
                  <strong>Response Time:</strong> Immediate (within 15 minutes)
                </li>
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold">High (P2)</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Suspected data breach requiring investigation</li>
                <li>Partial system outage affecting multiple customers</li>
                <li>Malware detection on critical systems</li>
                <li>Successful phishing attack against employees</li>
                <li>
                  <strong>Response Time:</strong> Within 1 hour
                </li>
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold">Medium (P3)</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Suspicious activity requiring monitoring</li>
                <li>Performance degradation</li>
                <li>Failed intrusion attempts</li>
                <li>Policy violations</li>
                <li>
                  <strong>Response Time:</strong> Within 4 hours
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold">Low (P4)</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Minor security events</li>
                <li>Configuration issues</li>
                <li>Informational alerts</li>
                <li>
                  <strong>Response Time:</strong> Within 24 hours
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">4. Incident Response Process</h2>

            <h3 className="text-xl font-semibold mb-2">Phase 1: Detection and Reporting</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Incidents may be detected through automated monitoring, user reports, or security tools</li>
              <li>Any employee discovering a potential incident must immediately report to support@westint.com</li>
              <li>Initial report should include: date/time, affected systems, description, reporter contact</li>
              <li>Incident Response Manager is notified and creates incident ticket</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">Phase 2: Triage and Assessment</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Verify the incident is legitimate (rule out false positives)</li>
              <li>Classify severity level based on impact and urgency</li>
              <li>Determine affected systems, data, and users</li>
              <li>Assemble appropriate response team based on severity</li>
              <li>Document initial findings and timeline</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">Phase 3: Containment</h3>
            <p className="mb-2">
              <strong>Short-term Containment:</strong>
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Isolate affected systems to prevent spread</li>
              <li>Disable compromised user accounts</li>
              <li>Block malicious IP addresses or domains</li>
              <li>Preserve evidence for forensic analysis</li>
              <li>Implement temporary workarounds to maintain operations</li>
            </ul>

            <p className="mb-2">
              <strong>Long-term Containment:</strong>
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Apply security patches and updates</li>
              <li>Implement additional monitoring</li>
              <li>Strengthen access controls</li>
              <li>Prepare clean systems for recovery</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">Phase 4: Eradication</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Remove malware, backdoors, or unauthorized access</li>
              <li>Close vulnerabilities that enabled the incident</li>
              <li>Reset compromised credentials</li>
              <li>Verify complete removal through scanning and monitoring</li>
              <li>Document all remediation actions</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">Phase 5: Recovery</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Restore systems from clean backups if necessary</li>
              <li>Verify system integrity before returning to production</li>
              <li>Gradually restore services while monitoring for reinfection</li>
              <li>Confirm normal operations with affected users</li>
              <li>Continue enhanced monitoring for 30 days</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">Phase 6: Post-Incident Review</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Conduct lessons learned meeting within 5 business days</li>
              <li>Document incident timeline, actions taken, and effectiveness</li>
              <li>Identify root cause and contributing factors</li>
              <li>Develop action items to prevent recurrence</li>
              <li>Update security controls, policies, or procedures</li>
              <li>Share findings with relevant stakeholders</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">5. Communication Plan</h2>
            <h3 className="text-xl font-semibold mb-2">5.1 Internal Communications</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Incident Response Team receives immediate notification</li>
              <li>Executive leadership briefed within 2 hours for P1/P2 incidents</li>
              <li>Regular status updates provided every 4 hours during active incidents</li>
              <li>All-hands notification for incidents affecting company operations</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">5.2 Customer Communications</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Customers affected by data breach notified within 72 hours</li>
              <li>Service disruptions communicated via status page</li>
              <li>Individual customer notifications for account compromises</li>
              <li>Post-incident summary provided to affected customers</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">5.3 Regulatory Notifications</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Data breach notifications filed per applicable regulations (GDPR, CCPA, etc.)</li>
              <li>Legal counsel involved in all regulatory communications</li>
              <li>Documentation prepared for regulatory inquiries</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">6. Evidence Collection and Preservation</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain chain of custody for all digital evidence</li>
              <li>Create forensic images before remediation when possible</li>
              <li>Preserve logs, memory dumps, and system snapshots</li>
              <li>Document all evidence collection activities</li>
              <li>Store evidence securely for potential legal proceedings</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">7. Data Breach Response</h2>
            <p className="mb-4">For incidents involving unauthorized access to or disclosure of personal data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Activate Data Breach Response Team immediately</li>
              <li>Assess scope: what data, how many records, sensitivity level</li>
              <li>Determine if notification is required under applicable laws</li>
              <li>Notify affected individuals within 72 hours (GDPR) or per local requirements</li>
              <li>File required regulatory notifications</li>
              <li>Offer credit monitoring or identity protection if appropriate</li>
              <li>Document all breach response activities</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">8. Business Continuity Integration</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Critical system outages activate Business Continuity Plan</li>
              <li>Backup systems and data are available for rapid recovery</li>
              <li>Alternative work arrangements available for extended outages</li>
              <li>Regular testing ensures incident response capabilities</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">9. Training and Testing</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Incident Response Team trained annually</li>
              <li>Tabletop exercises conducted quarterly</li>
              <li>Full incident simulation performed annually</li>
              <li>Plan updated based on exercise findings</li>
              <li>All employees trained on incident reporting</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">10. Plan Maintenance</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>This plan is reviewed and updated annually</li>
              <li>Updates made after significant incidents or exercises</li>
              <li>Contact information verified quarterly</li>
              <li>Version control maintained for all plan updates</li>
            </ul>
          </div>

          <div className="bg-muted p-6 rounded-lg mt-8">
            <p className="text-sm font-semibold mb-2">Emergency Contact:</p>
            <p className="text-sm">
              To report a security incident: support@westint.com
              <br />
              For critical incidents requiring immediate response, use the emergency escalation procedures outlined in
              your employee handbook.
            </p>
          </div>
        </section>
      </Card>
    </div>
  );
}
