import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditEntry {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  metadata: any;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message: string;
  created_at: string;
  profiles?: { email: string; full_name: string };
}

export function AuditTrailViewer() {
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7d');

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter, entityFilter, dateFilter]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    
    let query = supabase
      .from('audit_trail')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(100);

    // Apply filters
    if (actionFilter !== 'all') {
      query = query.eq('action_type', actionFilter);
    }
    
    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter);
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      query = query.gte('created_at', dateThreshold.toISOString());
    }

      const { data, error } = await query;

    setLoading(false);

    if (error) {
      toast({ title: "Error loading audit logs", description: error.message, variant: "destructive" });
    } else {
      setAuditLogs(data as any || []);
    }
  };

  const exportAuditLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Success', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.profiles?.email || 'Unknown',
        log.action_type,
        log.entity_type,
        log.entity_id || '',
        log.success ? 'Yes' : 'No',
        log.ip_address || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action_type.toLowerCase().includes(search) ||
      log.entity_type.toLowerCase().includes(search) ||
      log.profiles?.email?.toLowerCase().includes(search) ||
      log.entity_id?.toLowerCase().includes(search)
    );
  });

  const getActionBadgeVariant = (action: string) => {
    const variants: Record<string, any> = {
      create: 'default',
      edit: 'secondary',
      delete: 'destructive',
      export: 'outline',
      view: 'secondary',
      validate: 'default',
    };
    return variants[action] || 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <div>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Complete audit log of all system activities and changes
              </CardDescription>
            </div>
          </div>
          <Button onClick={exportAuditLogs} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="view">View</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="edit">Edit</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="validate">Validate</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="batch">Batches</SelectItem>
              <SelectItem value="project">Projects</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="license">Licenses</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 Hours</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Audit Log Table */}
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{log.profiles?.full_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{log.profiles?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action_type)}>
                        {log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.entity_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {JSON.stringify(log.metadata).substring(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Logs</p>
            <p className="text-2xl font-bold">{filteredLogs.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Successful</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredLogs.filter(l => l.success).length}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-600">
              {filteredLogs.filter(l => !l.success).length}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Unique Users</p>
            <p className="text-2xl font-bold">
              {new Set(filteredLogs.map(l => l.user_id)).size}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
