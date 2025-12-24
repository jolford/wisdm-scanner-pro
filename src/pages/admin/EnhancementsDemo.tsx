import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  Users, 
  Smartphone, 
  Plug,
  Sparkles,
  AlertTriangle,
  UserPlus,
  Activity,
  WifiOff,
  Accessibility,
  BarChart3,
  Calendar
} from 'lucide-react';

// Import all new components
import { AnomalyDetectionAlert, type Anomaly } from '@/components/AnomalyDetectionAlert';
import { DocumentAssignment, type TeamMember } from '@/components/DocumentAssignment';
import { TeamActivityIndicator, type TeamActivity } from '@/components/TeamActivityIndicator';
import { OfflineIndicator, SyncStatusBadge } from '@/components/OfflineIndicator';
import { TenantUsageMetering } from '@/components/admin/TenantUsageMetering';
import { ScheduledReportsManager } from '@/components/admin/ScheduledReportsManager';
import { DraggableList } from '@/components/DraggableList';
import { BatchProgressNotification } from '@/components/BatchProgressNotification';

// Sample data for demos
const sampleAnomalies: Anomaly[] = [
  {
    id: '1',
    type: 'value_spike',
    severity: 'high',
    field: 'Invoice Total',
    currentValue: 15000,
    averageValue: 2500,
    expectedRange: { min: 1000, max: 5000 },
    deviation: 500,
    message: 'Invoice total is 500% higher than average',
    documentId: 'doc-123',
    detectedAt: new Date()
  },
  {
    id: '2',
    type: 'duplicate_suspect',
    severity: 'medium',
    field: 'Invoice Number',
    currentValue: 'INV-2024-001',
    message: 'Possible duplicate invoice detected',
    documentId: 'doc-124',
    detectedAt: new Date(Date.now() - 3600000)
  },
  {
    id: '3',
    type: 'timing_anomaly',
    severity: 'low',
    field: 'Processing Time',
    currentValue: '45s',
    averageValue: 12,
    deviation: 275,
    message: 'Document took longer than usual to process',
    documentId: 'doc-125',
    detectedAt: new Date(Date.now() - 7200000)
  }
];

const sampleTeamMembers: TeamMember[] = [
  { id: '1', email: 'john@company.com', displayName: 'John Smith', role: 'Reviewer', currentWorkload: 5, status: 'online' },
  { id: '2', email: 'sarah@company.com', displayName: 'Sarah Johnson', role: 'Admin', currentWorkload: 3, status: 'online' },
  { id: '3', email: 'mike@company.com', displayName: 'Mike Wilson', role: 'Validator', currentWorkload: 8, status: 'away' },
  { id: '4', email: 'emily@company.com', displayName: 'Emily Davis', role: 'Reviewer', currentWorkload: 2, status: 'offline' }
];

const sampleActivities: TeamActivity[] = [
  { userId: '1', userName: 'John Smith', action: 'editing', documentId: 'doc-1', documentName: 'Invoice_001.pdf', startedAt: new Date() },
  { userId: '2', userName: 'Sarah Johnson', action: 'reviewing', documentId: 'doc-1', documentName: 'Invoice_001.pdf', startedAt: new Date(Date.now() - 300000) },
  { userId: '3', userName: 'Mike Wilson', action: 'viewing', documentId: 'doc-2', documentName: 'Contract.pdf', startedAt: new Date(Date.now() - 600000) }
];

const sampleDraggableItems = [
  { id: '1', content: 'First validation step' },
  { id: '2', content: 'Second validation step' },
  { id: '3', content: 'Third validation step' },
  { id: '4', content: 'Final review' }
];

export default function EnhancementsDemo() {
  const [activeTab, setActiveTab] = useState('ai');
  const [draggableItems, setDraggableItems] = useState(sampleDraggableItems);

  return (
    <AdminLayout title="Enhancements Demo">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Enhancement Components Demo
          </h1>
          <p className="text-muted-foreground mt-1">
            Preview all new components and hooks added to the platform
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="ai" className="gap-2">
              <Brain className="h-4 w-4" />
              AI Features
            </TabsTrigger>
            <TabsTrigger value="collab" className="gap-2">
              <Users className="h-4 w-4" />
              Collaboration
            </TabsTrigger>
            <TabsTrigger value="mobile" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile/A11y
            </TabsTrigger>
            <TabsTrigger value="integration" className="gap-2">
              <Plug className="h-4 w-4" />
              Integration
            </TabsTrigger>
          </TabsList>

          {/* AI-Powered Features */}
          <TabsContent value="ai" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold">Anomaly Detection</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically detects unusual patterns in document data like value spikes, 
                  duplicates, and timing anomalies.
                </p>
                <AnomalyDetectionAlert
                  anomalies={sampleAnomalies}
                  onDismiss={(id) => console.log('Dismissed:', id)}
                  onInvestigate={(anomaly) => console.log('Investigating:', anomaly)}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Hook: useAnomalyDetection</CardTitle>
                  <CardDescription>
                    Provides real-time anomaly detection for batches and documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="p-3 bg-muted rounded-lg font-mono text-xs">
                    {`const { anomalies, isAnalyzing, analyzeCurrentBatch } = useAnomalyDetection({
  projectId: 'xxx',
  batchId: 'yyy',
  thresholds: { valueDeviationPercent: 50 }
});`}
                  </div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Builds statistical baselines from validated documents</li>
                    <li>• Detects value spikes/drops beyond configured thresholds</li>
                    <li>• Identifies duplicate suspects and timing anomalies</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batch Progress Notifications</CardTitle>
                <CardDescription>
                  Real-time progress tracking for batch processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BatchProgressNotification />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collaboration Tools */}
          <TabsContent value="collab" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Document Assignment</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Assign documents to team members for review with workload visibility.
                </p>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <span className="text-sm">Assign document to:</span>
                      <DocumentAssignment
                        documentId="demo-doc"
                        teamMembers={sampleTeamMembers}
                        onAssign={async (memberId) => console.log('Assigned to:', memberId)}
                        onUnassign={async () => console.log('Unassigned')}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold">Team Activity Indicator</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  See who's viewing, editing, or reviewing documents in real-time.
                </p>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <span className="text-sm text-muted-foreground">All activity:</span>
                      <div className="mt-2">
                        <TeamActivityIndicator activities={sampleActivities} />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <span className="text-sm text-muted-foreground">On document "doc-1":</span>
                      <div className="mt-2">
                        <TeamActivityIndicator 
                          activities={sampleActivities} 
                          currentDocumentId="doc-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Draggable List</CardTitle>
                <CardDescription>
                  Reorderable lists for workflow steps, validation rules, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DraggableList
                  items={draggableItems}
                  onReorder={setDraggableItems}
                  keyExtractor={(item) => item.id}
                  renderItem={(item) => (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.id}</Badge>
                      <span>{item.content}</span>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mobile & Accessibility */}
          <TabsContent value="mobile" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold">Offline Mode</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Queue changes when offline, sync automatically when back online.
                </p>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm">Sync status badge:</span>
                      <SyncStatusBadge />
                    </div>
                    <Separator />
                    <div>
                      <span className="text-sm text-muted-foreground">
                        The OfflineIndicator appears in the bottom-right when offline or with pending changes.
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hook: useOfflineMode</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="p-3 bg-muted rounded-lg font-mono text-xs">
                      {`const { 
  isOnline, 
  pendingCount, 
  queueAction, 
  syncPendingActions 
} = useOfflineMode();`}
                    </div>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Monitors online/offline status</li>
                      <li>• Queues actions to localStorage when offline</li>
                      <li>• Auto-syncs when connection restored</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Accessibility className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-semibold">Screen Reader Support</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Announce dynamic content changes for screen reader users.
                </p>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hook: useScreenReader</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="p-3 bg-muted rounded-lg font-mono text-xs">
                      {`const { 
  announce, 
  announceLoading, 
  announceComplete, 
  announceError 
} = useScreenReader();

// Usage
announceLoading('documents');
announceComplete('5 documents loaded');`}
                    </div>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• ARIA live region announcements</li>
                      <li>• Focus trap management</li>
                      <li>• Dynamic content change announcements</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Integration & Export */}
          <TabsContent value="integration" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Tenant Usage Metering</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Track usage, quotas, and billing for multi-tenant SaaS deployments.
                </p>
                <TenantUsageMetering 
                  customerId="demo-customer"
                  showAllTenants={false}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold">Scheduled Reports</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automate report generation and delivery on a schedule.
                </p>
                <ScheduledReportsManager customerId="demo-customer" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Global offline indicator for demo */}
        <OfflineIndicator variant="detailed" />
      </div>
    </AdminLayout>
  );
}
