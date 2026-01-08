import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BusinessContinuity() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Business Continuity & Disaster Recovery Plan</h1>
        <p className="text-muted-foreground mb-8">Effective Date: January 1, 2025 | Version 1.0</p>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-3">1. Purpose and Scope</h2>
            <p className="mb-4">
              This Business Continuity and Disaster Recovery Plan ensures AxiomIQ Capture Pro can maintain or rapidly
              resume critical business operations following a disruption, including natural disasters, cyberattacks,
              equipment failures, or other incidents.
            </p>
            <p>
              <strong>Objectives:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Recovery Time Objective (RTO): 4 hours for critical systems</li>
              <li>Recovery Point Objective (RPO): 1 hour maximum data loss</li>
              <li>Minimize financial and reputational impact</li>
              <li>Ensure customer data protection and service availability</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">2. Critical Business Functions</h2>
            <h3 className="text-xl font-semibold mb-2">2.1 Priority 1 - Critical (RTO: 4 hours)</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Document Processing:</strong> Core OCR and document scanning functionality
              </li>
              <li>
                <strong>User Authentication:</strong> Secure access to the system
              </li>
              <li>
                <strong>Database Operations:</strong> Customer data access and storage
              </li>
              <li>
                <strong>API Services:</strong> Integration endpoints for customers
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">2.2 Priority 2 - Important (RTO: 24 hours)</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Batch Processing:</strong> Multi-document processing workflows
              </li>
              <li>
                <strong>Export Functions:</strong> Data export to external systems
              </li>
              <li>
                <strong>Administrative Tools:</strong> User and project management
              </li>
              <li>
                <strong>Reporting:</strong> Analytics and cost tracking
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">2.3 Priority 3 - Standard (RTO: 72 hours)</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Documentation:</strong> Help and support materials
              </li>
              <li>
                <strong>Marketing Pages:</strong> Public-facing content
              </li>
              <li>
                <strong>Non-critical Features:</strong> Enhancement features
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">3. Infrastructure and Architecture</h2>
            <h3 className="text-xl font-semibold mb-2">3.1 Production Environment</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Hosting:</strong> Lovable Cloud (Supabase infrastructure)
              </li>
              <li>
                <strong>Database:</strong> PostgreSQL with automated backups
              </li>
              <li>
                <strong>File Storage:</strong> Distributed storage with redundancy
              </li>
              <li>
                <strong>Geographic Distribution:</strong> Multi-region availability
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">3.2 High Availability Features</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Database replication across availability zones</li>
              <li>Automatic failover for database instances</li>
              <li>Load balancing distributes traffic</li>
              <li>CDN provides content delivery redundancy</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">4. Backup Strategy</h2>
            <h3 className="text-xl font-semibold mb-2">4.1 Database Backups</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Frequency:</strong> Continuous replication + hourly snapshots
              </li>
              <li>
                <strong>Retention:</strong> 30 days for point-in-time recovery
              </li>
              <li>
                <strong>Storage:</strong> Encrypted backups in separate availability zone
              </li>
              <li>
                <strong>Testing:</strong> Monthly restoration tests validate backup integrity
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">4.2 File Storage Backups</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Frequency:</strong> Real-time replication to multiple locations
              </li>
              <li>
                <strong>Retention:</strong> Active files maintained indefinitely; deleted files retained 90 days
              </li>
              <li>
                <strong>Versioning:</strong> File versions preserved for recovery
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">4.3 Application Code</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Version Control:</strong> Git repository with GitHub
              </li>
              <li>
                <strong>Deployment History:</strong> All deployments tagged and recoverable
              </li>
              <li>
                <strong>Infrastructure as Code:</strong> Configuration versioned
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">5. Disaster Scenarios and Response</h2>

            <h3 className="text-xl font-semibold mb-2">Scenario 1: Complete System Outage</h3>
            <p className="mb-2">
              <strong>Causes:</strong> Cloud provider outage, DDoS attack, catastrophic failure
            </p>
            <p className="mb-2">
              <strong>Response Procedures:</strong>
            </p>
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              <li>Activate Disaster Recovery Team</li>
              <li>Assess extent and expected duration of outage</li>
              <li>Communicate status to customers via status page</li>
              <li>If provider outage exceeds 4 hours, initiate failover to backup region</li>
              <li>Restore service from most recent backups</li>
              <li>Verify data integrity and system functionality</li>
              <li>Resume normal operations and monitor closely</li>
            </ol>

            <h3 className="text-xl font-semibold mb-2">Scenario 2: Database Corruption or Loss</h3>
            <p className="mb-2">
              <strong>Causes:</strong> Software bug, malicious attack, hardware failure
            </p>
            <p className="mb-2">
              <strong>Response Procedures:</strong>
            </p>
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              <li>Immediately stop write operations to prevent further corruption</li>
              <li>Identify last known good state</li>
              <li>Restore database from point-in-time backup</li>
              <li>Replay transaction logs if available to minimize data loss</li>
              <li>Validate data integrity before resuming operations</li>
              <li>Investigate root cause and implement preventive measures</li>
            </ol>

            <h3 className="text-xl font-semibold mb-2">Scenario 3: Ransomware Attack</h3>
            <p className="mb-2">
              <strong>Causes:</strong> Malware infection, compromised credentials
            </p>
            <p className="mb-2">
              <strong>Response Procedures:</strong>
            </p>
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              <li>Immediately isolate affected systems</li>
              <li>Activate Incident Response Plan</li>
              <li>DO NOT pay ransom</li>
              <li>Assess extent of encryption and data loss</li>
              <li>Restore from clean backups verified to be pre-infection</li>
              <li>Reset all credentials and access tokens</li>
              <li>Conduct forensic analysis to identify entry point</li>
              <li>Strengthen security controls to prevent recurrence</li>
            </ol>

            <h3 className="text-xl font-semibold mb-2">Scenario 4: Key Personnel Unavailability</h3>
            <p className="mb-2">
              <strong>Causes:</strong> Illness, departure, natural disaster
            </p>
            <p className="mb-2">
              <strong>Response Procedures:</strong>
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Refer to succession plan for critical roles</li>
              <li>Activate backup personnel or contractors</li>
              <li>Access documented procedures and credentials</li>
              <li>Brief replacement personnel on current priorities</li>
              <li>Continue operations with interim team</li>
            </ol>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">6. Recovery Procedures</h2>
            <h3 className="text-xl font-semibold mb-2">6.1 System Recovery Steps</h3>
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              <li>
                <strong>Assess Damage:</strong> Determine scope and severity of incident
              </li>
              <li>
                <strong>Secure Environment:</strong> Ensure threat is neutralized before recovery
              </li>
              <li>
                <strong>Restore Infrastructure:</strong> Rebuild or failover to backup systems
              </li>
              <li>
                <strong>Restore Data:</strong> Apply backups to restored infrastructure
              </li>
              <li>
                <strong>Validate Integrity:</strong> Verify data completeness and accuracy
              </li>
              <li>
                <strong>Test Functionality:</strong> Ensure all critical features operational
              </li>
              <li>
                <strong>Resume Service:</strong> Gradually restore customer access
              </li>
              <li>
                <strong>Monitor:</strong> Enhanced monitoring for 48 hours post-recovery
              </li>
            </ol>

            <h3 className="text-xl font-semibold mb-2">6.2 Data Recovery Validation</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Compare record counts before and after recovery</li>
              <li>Verify critical customer accounts can access data</li>
              <li>Test key workflows end-to-end</li>
              <li>Review error logs for anomalies</li>
              <li>Confirm backup timestamps match expected recovery point</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">7. Communication Plan</h2>
            <h3 className="text-xl font-semibold mb-2">7.1 Customer Communications</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Status Page:</strong> Real-time updates during outages
              </li>
              <li>
                <strong>Email Notifications:</strong> Sent to all affected customers
              </li>
              <li>
                <strong>Support Channel:</strong> Dedicated support for incident-related issues
              </li>
              <li>
                <strong>Post-Incident:</strong> Detailed report within 5 business days
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">7.2 Internal Communications</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Disaster Recovery Team activated immediately</li>
              <li>Hourly status updates during active recovery</li>
              <li>Executive briefings every 4 hours</li>
              <li>All-hands update once service restored</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">8. Disaster Recovery Team</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>DR Coordinator:</strong> Overall recovery coordination and decision-making
              </li>
              <li>
                <strong>Infrastructure Lead:</strong> System restoration and infrastructure recovery
              </li>
              <li>
                <strong>Database Administrator:</strong> Data recovery and validation
              </li>
              <li>
                <strong>Application Lead:</strong> Application functionality verification
              </li>
              <li>
                <strong>Communications Lead:</strong> Customer and stakeholder communications
              </li>
              <li>
                <strong>Security Lead:</strong> Security validation and threat assessment
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">9. Testing and Maintenance</h2>
            <h3 className="text-xl font-semibold mb-2">9.1 Regular Testing Schedule</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Monthly:</strong> Backup restoration test of random sample
              </li>
              <li>
                <strong>Quarterly:</strong> Tabletop exercise of disaster scenarios
              </li>
              <li>
                <strong>Annually:</strong> Full disaster recovery exercise
              </li>
              <li>
                <strong>Continuous:</strong> Automated backup validation
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">9.2 Plan Maintenance</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Plan reviewed and updated annually</li>
              <li>Updates made after significant architecture changes</li>
              <li>Contact information verified quarterly</li>
              <li>Lessons learned from incidents incorporated</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">10. Dependencies and Contacts</h2>
            <h3 className="text-xl font-semibold mb-2">10.1 Critical Vendors</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Cloud Provider:</strong> Lovable Cloud/Supabase support
              </li>
              <li>
                <strong>DNS Provider:</strong> Domain management and failover
              </li>
              <li>
                <strong>AI Services:</strong> OCR and processing capabilities
              </li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">10.2 Emergency Contacts</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>DR Coordinator: Available 24/7</li>
              <li>Infrastructure Team: On-call rotation</li>
              <li>Executive Team: Emergency contact list</li>
              <li>Vendor Support: Escalation procedures documented</li>
            </ul>
          </div>

          <div className="bg-muted p-6 rounded-lg mt-8">
            <p className="text-sm font-semibold mb-2">For Disaster Recovery Activation:</p>
            <p className="text-sm">
              Contact DR Coordinator immediately: support@westint.com
              <br />
              Emergency Hotline: [Emergency Contact Number]
              <br />
              All team members must be familiar with this plan and their roles.
            </p>
          </div>
        </section>
      </Card>
    </div>
  );
}
