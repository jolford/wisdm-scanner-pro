import jsPDF from 'jspdf';

export function generateN8nDatasheetPDF(): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addTitle = (text: string, size: number = 18) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += size * 0.5;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 8;
  };

  const addText = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 5;
  };

  const addBullet = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('•', margin + 5, y);
    const lines = doc.splitTextToSize(text, contentWidth - 15);
    doc.text(lines, margin + 12, y);
    y += lines.length * 5;
  };

  const addSpace = (space: number = 5) => {
    y += space;
  };

  const checkPageBreak = (needed: number = 30) => {
    if (y > doc.internal.pageSize.getHeight() - needed) {
      doc.addPage();
      y = 20;
    }
  };

  const addTable = (headers: string[], rows: string[][]) => {
    const colWidth = contentWidth / headers.length;
    
    // Header
    doc.setFillColor(41, 128, 185);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, margin + i * colWidth + 2, y);
    });
    y += 6;
    doc.setTextColor(0, 0, 0);

    // Rows
    doc.setFont('helvetica', 'normal');
    rows.forEach((row, rowIndex) => {
      checkPageBreak(15);
      if (rowIndex % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 4, contentWidth, 7, 'F');
      }
      row.forEach((cell, i) => {
        const cellText = doc.splitTextToSize(cell, colWidth - 4);
        doc.text(cellText[0] || '', margin + i * colWidth + 2, y);
      });
      y += 7;
    });
    addSpace(5);
  };

  // Title Page
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, pageWidth, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('n8n Integration Datasheet', margin, 35);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('WISDMCapture Technical Documentation', margin, 48);
  doc.setTextColor(0, 0, 0);
  y = 75;

  // Executive Summary
  addSubtitle('Executive Summary');
  addText('n8n is an open-source workflow automation platform that extends WISDMCapture\'s capabilities through the Model Context Protocol (MCP) connector. This integration enables custom automation workflows, external system integrations, and advanced scripting capabilities without modifying core application code.');
  addSpace(10);

  // Deployment Options
  checkPageBreak(50);
  addSubtitle('Deployment Options');
  addTable(
    ['Option', 'Monthly Cost', 'Setup', 'Maintenance'],
    [
      ['n8n Cloud', '$20-50', 'None', 'Managed'],
      ['Azure App Service', '~$13-26', 'Medium', 'Self-managed'],
      ['Azure Container', '~$5-15', 'Medium', 'Self-managed'],
      ['On-premise Docker', 'Hardware only', 'Low', 'Self-managed'],
    ]
  );

  // Integration Capabilities
  checkPageBreak(60);
  addSubtitle('Integration Capabilities');
  addSpace(3);
  
  addText('Document Processing Automation:', 0);
  addBullet('Post-OCR Routing - Route documents to external systems after extraction');
  addBullet('Validation Escalation - Notify stakeholders when documents fail validation');
  addBullet('Auto-Classification - Trigger external ML models for document classification');
  addBullet('Data Enrichment - Augment extracted data with external lookups');
  addSpace(5);

  addText('External System Integrations:', 0);
  addBullet('ERP: SAP, Oracle, NetSuite, QuickBooks');
  addBullet('CRM: Salesforce, HubSpot, Dynamics 365');
  addBullet('ECM: SharePoint, Box, Google Drive, Dropbox');
  addBullet('Email: Gmail, Outlook, SMTP');
  addBullet('Databases: MySQL, PostgreSQL, MongoDB, SQL Server');
  addBullet('Custom APIs: Any REST/GraphQL/SOAP endpoint');
  addSpace(10);

  // Workflow Triggers
  checkPageBreak(50);
  addSubtitle('Webhook Trigger Events');
  addTable(
    ['Trigger Event', 'Use Case'],
    [
      ['batch.completed', 'Export to ERP systems'],
      ['batch.exported', 'Archive confirmation'],
      ['document.validated', 'Data synchronization'],
      ['document.failed', 'Exception handling'],
      ['document.pii_detected', 'Compliance alerts'],
    ]
  );

  // New Page - Sample Workflows
  doc.addPage();
  y = 20;
  
  addSubtitle('Sample Workflow: Invoice Processing Pipeline');
  addSpace(3);
  addText('1. WISDMCapture webhook triggers on batch completion');
  addText('2. n8n retrieves batch documents via API');
  addText('3. Transform extracted data to QuickBooks format');
  addText('4. Create vendor bill in QuickBooks');
  addText('5. Archive original PDF to SharePoint');
  addText('6. Update WISDMCapture batch status');
  addSpace(10);

  addSubtitle('Sample Workflow: Exception Handling');
  addSpace(3);
  addText('1. Validation failure triggers webhook');
  addText('2. n8n evaluates exception rules');
  addText('3. Send Slack notification to team');
  addText('4. Create Jira ticket for tracking');
  addSpace(10);

  // Technical Requirements
  checkPageBreak(50);
  addSubtitle('Technical Requirements');
  addTable(
    ['Resource', 'Minimum', 'Recommended'],
    [
      ['CPU', '1 vCPU', '2 vCPU'],
      ['Memory', '1 GB', '2-4 GB'],
      ['Storage', '10 GB', '50 GB'],
      ['Network', 'HTTPS access', 'Static IP'],
    ]
  );

  // Security
  checkPageBreak(50);
  addSubtitle('Security Considerations');
  addBullet('MCP Connection: OAuth / API Key authentication');
  addBullet('n8n to WISDMCapture: API Key (X-API-Key header)');
  addBullet('Credential Storage: Use n8n\'s built-in credential vault');
  addBullet('Webhook Security: Implement webhook signature verification');
  addBullet('Data Minimization: Pass document IDs, not full content');
  addSpace(10);

  // API Reference
  checkPageBreak(50);
  addSubtitle('WISDMCapture REST API Endpoints');
  addTable(
    ['Endpoint', 'Method', 'Description'],
    [
      ['/api-v1-projects', 'GET', 'List projects'],
      ['/api-v1-batches', 'GET', 'List batches'],
      ['/api-v1-documents', 'GET', 'List documents'],
      ['/api-v1-retrieve', 'GET', 'Get document details'],
    ]
  );

  // New Page - Implementation Checklist
  doc.addPage();
  y = 20;

  addSubtitle('Implementation Checklist');
  addSpace(3);
  
  addText('Phase 1: Setup (Day 1)');
  addBullet('Choose deployment option (Cloud vs Self-hosted)');
  addBullet('Deploy n8n instance');
  addBullet('Enable MCP access in n8n settings');
  addBullet('Connect n8n MCP to Lovable project');
  addSpace(5);

  addText('Phase 2: Basic Integration (Days 2-3)');
  addBullet('Create first webhook workflow');
  addBullet('Configure WISDMCapture webhook to trigger n8n');
  addBullet('Test end-to-end workflow execution');
  addBullet('Implement error handling');
  addSpace(5);

  addText('Phase 3: Production Workflows (Days 4-7)');
  addBullet('Build production workflows (invoice sync, alerts, etc.)');
  addBullet('Configure external system credentials');
  addBullet('Implement retry logic and error notifications');
  addBullet('Document workflow purposes and triggers');
  addSpace(5);

  addText('Phase 4: Monitoring & Maintenance');
  addBullet('Set up execution monitoring');
  addBullet('Configure alerting for failed workflows');
  addBullet('Establish backup procedures');
  addBullet('Create runbook for common issues');
  addSpace(10);

  // Comparison Table
  checkPageBreak(60);
  addSubtitle('n8n vs Windows Agent Comparison');
  addTable(
    ['Feature', 'n8n Integration', 'Windows Agent'],
    [
      ['Deployment', 'Cloud/self-hosted', 'On-premise Windows'],
      ['Scripting', 'JavaScript, Python', 'PowerShell, VB, Python'],
      ['Integrations', '400+ pre-built', 'Custom scripts only'],
      ['Visual Builder', 'Yes', 'No'],
      ['Local File Access', 'No', 'Yes'],
      ['Scanner Integration', 'No', 'Yes'],
      ['Offline Capable', 'No', 'Yes'],
    ]
  );

  // Footer
  addSpace(10);
  addText('Recommendation: Use n8n for cloud/SaaS integrations and Windows Agent for local automation requiring file system or hardware access. Both can be used together.');

  // Resources
  checkPageBreak(40);
  addSpace(10);
  addSubtitle('Support Resources');
  addBullet('n8n Documentation: https://docs.n8n.io');
  addBullet('n8n Community: https://community.n8n.io');
  addBullet('n8n Workflows: https://n8n.io/workflows');
  addBullet('WISDMCapture API: /api-docs (in-app)');

  // Footer on last page
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} | WISDMCapture n8n Integration Datasheet | December 2024`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // Save
  doc.save('n8n-integration-datasheet.pdf');
}
