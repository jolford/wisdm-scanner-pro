// Demo data for marketing presentations

export const demoProjects = [
  {
    id: 'demo-invoices',
    name: 'Invoice Processing',
    description: 'Automated invoice data extraction and validation',
    icon: 'invoice',
    documentCount: 1247,
    validatedCount: 1189,
    pendingCount: 58,
    accuracy: 96.4
  },
  {
    id: 'demo-contracts',
    name: 'Contract Management',
    description: 'Legal document classification and key term extraction',
    icon: 'contract',
    documentCount: 423,
    validatedCount: 401,
    pendingCount: 22,
    accuracy: 94.8
  },
  {
    id: 'demo-receipts',
    name: 'Expense Receipts',
    description: 'Receipt scanning with automatic categorization',
    icon: 'receipt',
    documentCount: 3891,
    validatedCount: 3756,
    pendingCount: 135,
    accuracy: 97.2
  },
  {
    id: 'demo-forms',
    name: 'Application Forms',
    description: 'Form data extraction with field validation',
    icon: 'form',
    documentCount: 892,
    validatedCount: 867,
    pendingCount: 25,
    accuracy: 95.1
  }
];

export const demoBatches = [
  {
    id: 'batch-001',
    name: 'Q4 Invoices - Acme Corp',
    project: 'Invoice Processing',
    status: 'validated',
    documentCount: 47,
    processedCount: 47,
    confidenceScore: 98.2,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: 'batch-002',
    name: 'New Vendor Contracts',
    project: 'Contract Management',
    status: 'processing',
    documentCount: 12,
    processedCount: 8,
    confidenceScore: 94.5,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: 'batch-003',
    name: 'Travel Expenses - November',
    project: 'Expense Receipts',
    status: 'pending',
    documentCount: 156,
    processedCount: 0,
    confidenceScore: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  }
];

export const demoMetrics = {
  documentsToday: 247,
  documentsThisWeek: 1893,
  documentsThisMonth: 8421,
  averageConfidence: 96.8,
  averageProcessingTime: 2.3, // seconds
  validationRate: 94.2,
  automationRate: 87.5,
  costSavings: 12450, // dollars
  timesSaved: 342 // hours
};

export const demoRecentActivity = [
  {
    id: 'activity-1',
    action: 'Batch validated',
    target: 'Q4 Invoices - Acme Corp',
    user: 'Sarah Johnson',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: 'activity-2',
    action: 'Documents uploaded',
    target: '47 files to Invoice Processing',
    user: 'Mike Chen',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
  },
  {
    id: 'activity-3',
    action: 'Workflow triggered',
    target: 'Auto-Route High Confidence',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString()
  },
  {
    id: 'activity-4',
    action: 'Export completed',
    target: 'SharePoint - Finance Dept',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
  },
  {
    id: 'activity-5',
    action: 'PII detected and redacted',
    target: 'Employee Application #4521',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString()
  }
];

export const demoIntegrations = [
  { name: 'Microsoft SharePoint', status: 'connected', documentsExported: 4521 },
  { name: 'Microsoft Teams', status: 'connected', notificationsSent: 892 },
  { name: 'QuickBooks Online', status: 'connected', invoicesSynced: 1247 },
  { name: 'Salesforce', status: 'pending', documentsExported: 0 },
  { name: 'FileBound', status: 'connected', documentsExported: 2341 }
];

export const demoConfidenceData = [
  { date: 'Mon', confidence: 94.2, documents: 142 },
  { date: 'Tue', confidence: 95.8, documents: 187 },
  { date: 'Wed', confidence: 96.4, documents: 203 },
  { date: 'Thu', confidence: 95.1, documents: 168 },
  { date: 'Fri', confidence: 97.2, documents: 221 },
  { date: 'Sat', confidence: 96.8, documents: 89 },
  { date: 'Sun', confidence: 97.5, documents: 67 }
];
