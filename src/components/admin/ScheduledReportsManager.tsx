import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  FileDown,
  Plus,
  Trash2,
  Play,
  Pause,
  Mail,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScheduledReport {
  id: string;
  name: string;
  reportType: 'batch_summary' | 'validation_metrics' | 'cost_report' | 'audit_log';
  schedule: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv' | 'xlsx';
  recipients: string[];
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  projectId?: string;
  filters?: Record<string, any>;
}

interface ScheduledReportsManagerProps {
  customerId: string;
  projectId?: string;
  className?: string;
}

const reportTypeOptions = [
  { value: 'batch_summary', label: 'Batch Summary', description: 'Overview of batch processing' },
  { value: 'validation_metrics', label: 'Validation Metrics', description: 'Validation stats and accuracy' },
  { value: 'cost_report', label: 'Cost Report', description: 'Processing costs breakdown' },
  { value: 'audit_log', label: 'Audit Log', description: 'User activity and changes' }
];

const scheduleOptions = [
  { value: 'daily', label: 'Daily', description: 'Every day at 8:00 AM' },
  { value: 'weekly', label: 'Weekly', description: 'Every Monday at 8:00 AM' },
  { value: 'monthly', label: 'Monthly', description: 'First day of month at 8:00 AM' }
];

export function ScheduledReportsManager({
  customerId,
  projectId,
  className
}: ScheduledReportsManagerProps) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  // Form state for new report
  const [newReport, setNewReport] = useState({
    name: '',
    reportType: 'batch_summary' as ScheduledReport['reportType'],
    schedule: 'weekly' as ScheduledReport['schedule'],
    format: 'pdf' as ScheduledReport['format'],
    recipients: ''
  });

  const loadReports = useCallback(async () => {
    // Simulated data - in production, load from database
    setReports([
      {
        id: '1',
        name: 'Weekly Batch Summary',
        reportType: 'batch_summary',
        schedule: 'weekly',
        format: 'pdf',
        recipients: ['admin@company.com', 'manager@company.com'],
        isActive: true,
        lastRunAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: '2',
        name: 'Monthly Cost Report',
        reportType: 'cost_report',
        schedule: 'monthly',
        format: 'xlsx',
        recipients: ['finance@company.com'],
        isActive: true,
        lastRunAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        nextRunAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    ]);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleCreateReport = async () => {
    if (!newReport.name || !newReport.recipients) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const report: ScheduledReport = {
      id: crypto.randomUUID(),
      name: newReport.name,
      reportType: newReport.reportType,
      schedule: newReport.schedule,
      format: newReport.format,
      recipients: newReport.recipients.split(',').map(e => e.trim()),
      isActive: true,
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      projectId
    };

    setReports(prev => [...prev, report]);
    setShowCreateDialog(false);
    setNewReport({
      name: '',
      reportType: 'batch_summary',
      schedule: 'weekly',
      format: 'pdf',
      recipients: ''
    });

    toast({
      title: 'Report Scheduled',
      description: `"${report.name}" has been scheduled successfully.`
    });
  };

  const toggleReportActive = (reportId: string) => {
    setReports(prev =>
      prev.map(r =>
        r.id === reportId ? { ...r, isActive: !r.isActive } : r
      )
    );
  };

  const deleteReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    toast({
      title: 'Report Deleted',
      description: 'The scheduled report has been removed.'
    });
  };

  const runReportNow = async (report: ScheduledReport) => {
    toast({
      title: 'Report Generating',
      description: `"${report.name}" is being generated and will be sent to ${report.recipients.length} recipients.`
    });
    
    // Update last run time
    setReports(prev =>
      prev.map(r =>
        r.id === report.id ? { ...r, lastRunAt: new Date() } : r
      )
    );
  };

  const formatDate = (date?: Date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduled Reports
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3 w-3" />
                Add Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Report</DialogTitle>
                <DialogDescription>
                  Configure a report to be automatically generated and emailed.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Report Name</Label>
                  <Input
                    id="name"
                    value={newReport.name}
                    onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Weekly Processing Summary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select
                      value={newReport.reportType}
                      onValueChange={(v) => setNewReport(prev => ({ 
                        ...prev, 
                        reportType: v as ScheduledReport['reportType'] 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {reportTypeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Schedule</Label>
                    <Select
                      value={newReport.schedule}
                      onValueChange={(v) => setNewReport(prev => ({ 
                        ...prev, 
                        schedule: v as ScheduledReport['schedule'] 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scheduleOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={newReport.format}
                    onValueChange={(v) => setNewReport(prev => ({ 
                      ...prev, 
                      format: v as ScheduledReport['format'] 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                      <SelectItem value="xlsx">Excel Workbook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipients">Recipients (comma-separated)</Label>
                  <Input
                    id="recipients"
                    value={newReport.recipients}
                    onChange={(e) => setNewReport(prev => ({ ...prev, recipients: e.target.value }))}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateReport}>
                  Create Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No scheduled reports</p>
            <p className="text-xs">Create one to automate your reporting</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={cn(
                    "p-3 rounded-lg border transition-opacity",
                    !report.isActive && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {report.name}
                        </span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {report.schedule}
                        </Badge>
                        <Badge variant="outline" className="text-xs uppercase">
                          {report.format}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Next: {formatDate(report.nextRunAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{report.recipients.length} recipients</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Switch
                        checked={report.isActive}
                        onCheckedChange={() => toggleReportActive(report.id)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => runReportNow(report)}
                        title="Run Now"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteReport(report.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
