/**
 * Error Logs Admin Page
 * 
 * Centralized error tracking and debugging interface for system administrators.
 * Displays all application errors logged from the frontend, including uncaught errors
 * and unhandled promise rejections.
 * 
 * Features:
 * - Real-time error log display (automatically updates via Supabase Realtime)
 * - Expandable error details (stack traces, metadata, user agent)
 * - Error filtering and pagination (limit: 100 most recent)
 * - Individual error deletion
 * - Bulk "Clear All" operation
 * - Manual test error generation for debugging
 * - Component name and URL tracking
 * - Timestamp-based sorting (newest first)
 * 
 * Error Information Captured:
 * - Error message and stack trace
 * - Component/context where error occurred
 * - User ID (if authenticated)
 * - User agent string (browser/device info)
 * - URL where error happened
 * - Additional metadata (custom context)
 * - Timestamp of error occurrence
 * 
 * Use Cases:
 * - Debugging production issues
 * - Monitoring application health
 * - Identifying problematic components
 * - Tracking user-specific errors
 * - Testing error logging functionality
 * 
 * @requires useRequireAuth - Admin-only access
 * @requires AdminLayout - Standard admin page wrapper
 * @requires Supabase Realtime - Auto-updates when new errors occur
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, RefreshCw, Trash2, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { logError } from '@/lib/error-logger';

interface ErrorLog {
  id: string;
  user_id: string | null;
  error_message: string;
  error_stack: string | null;
  component_name: string | null;
  user_agent: string | null;
  url: string | null;
  metadata: any;
  created_at: string;
}

const ErrorLogs = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && isAdmin) {
      loadLogs();

      // Realtime updates for new error logs
      const channel = supabase
        .channel('error-logs')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'error_logs' },
          () => loadLogs()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loading, isAdmin]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: 'Failed to load error logs',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      toast({
        title: 'Logs Cleared',
        description: 'All error logs have been cleared'
      });
      
      setLogs([]);
    } catch (error: any) {
      toast({
        title: 'Failed to clear logs',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleLogTest = async () => {
    await logError(new Error('Test error log'), 'ManualTest', { source: 'ErrorLogsPage' });
    toast({ title: 'Test Error Logged', description: 'A test error was inserted.' });
    loadLogs();
  };

  const handleDeleteLog = async (id: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLogs(prev => prev.filter(log => log.id !== id));
      
      toast({
        title: 'Log Deleted',
        description: 'Error log has been removed'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to delete log',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout title="Error Logs" description="System error tracking and debugging">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-muted-foreground">
              {logs.length} error{logs.length !== 1 ? 's' : ''} logged
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={async () => {
              await logError(new Error('Test error log'), 'ManualTest', { source: 'ErrorLogsPage' });
              toast({ title: 'Test Error Logged', description: 'A test error was inserted.' });
              loadLogs();
            }}>
              <Bug className="h-4 w-4 mr-2" />
              Log Test Error
            </Button>
            <Button variant="outline" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={logs.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Error Message</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No errors logged
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <Collapsible
                    key={log.id}
                    open={expandedLog === log.id}
                    onOpenChange={(open) => setExpandedLog(open ? log.id : null)}
                    asChild
                  >
                    <>
                      <TableRow className="cursor-pointer">
                        <TableCell>
                          {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.component_name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {log.error_message}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {log.url}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                {expandedLog === log.id ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLog(log.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            <div className="space-y-3 text-sm">
                              <div>
                                <span className="font-semibold">Full Error:</span>
                                <p className="mt-1 text-destructive">{log.error_message}</p>
                              </div>
                              {log.error_stack && (
                                <div>
                                  <span className="font-semibold">Stack Trace:</span>
                                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                                    {log.error_stack}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <span className="font-semibold">User Agent:</span>
                                <p className="mt-1 text-muted-foreground text-xs">
                                  {log.user_agent || 'N/A'}
                                </p>
                              </div>
                              {Object.keys(log.metadata || {}).length > 0 && (
                                <div>
                                  <span className="font-semibold">Metadata:</span>
                                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ErrorLogs;