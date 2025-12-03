import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, Clock, Archive, AlertTriangle, FileText, Calendar, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";

interface RetentionPolicy {
  id: string;
  customer_id: string;
  name: string;
  description: string | null;
  retention_days: number;
  applies_to_projects: string[] | null;
  applies_to_document_types: string[] | null;
  auto_purge: boolean;
  archive_before_purge: boolean;
  archive_location: string | null;
  is_active: boolean;
  created_at: string;
}

interface PurgeLog {
  id: string;
  document_id: string;
  document_name: string | null;
  purge_reason: string;
  archived_location: string | null;
  purged_at: string;
  metadata: Record<string, any> | null;
}

export default function RetentionPolicies() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    retention_days: 365,
    auto_purge: false,
    archive_before_purge: true,
    archive_location: ""
  });

  const { data: policies, isLoading } = useQuery({
    queryKey: ["retention-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retention_policies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RetentionPolicy[];
    }
  });

  const { data: purgeLogs } = useQuery({
    queryKey: ["purge-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_purge_logs")
        .select("*")
        .order("purged_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PurgeLog[];
    }
  });

  const { data: retentionStats } = useQuery({
    queryKey: ["retention-stats"],
    queryFn: async () => {
      // Get documents due for purge based on retention policies
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, created_at, file_name, batch_id")
        .order("created_at", { ascending: true })
        .limit(1000);
      
      if (error) throw error;
      
      const now = new Date();
      let dueForPurge = 0;
      let archived = purgeLogs?.length || 0;
      
      policies?.forEach(policy => {
        if (policy.is_active) {
          const cutoffDate = new Date(now.getTime() - policy.retention_days * 24 * 60 * 60 * 1000);
          documents?.forEach(doc => {
            if (new Date(doc.created_at) < cutoffDate) {
              dueForPurge++;
            }
          });
        }
      });

      return {
        totalDocuments: documents?.length || 0,
        dueForPurge,
        archived,
        activePolicies: policies?.filter(p => p.is_active).length || 0
      };
    },
    enabled: !!policies
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userCustomers } = await supabase
        .from("user_customers")
        .select("customer_id")
        .eq("user_id", userData.user?.id)
        .single();

      const { error } = await supabase.from("retention_policies").insert({
        ...data,
        customer_id: userCustomers?.customer_id,
        created_by: userData.user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retention-policies"] });
      toast.success("Retention policy created");
      setIsAddDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        retention_days: 365,
        auto_purge: false,
        archive_before_purge: true,
        archive_location: ""
      });
    },
    onError: (error) => toast.error(`Failed to create policy: ${error.message}`)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RetentionPolicy> & { id: string }) => {
      const { error } = await supabase.from("retention_policies").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retention-policies"] });
      toast.success("Policy updated");
    },
    onError: (error) => toast.error(`Failed to update policy: ${error.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("retention_policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retention-policies"] });
      toast.success("Policy deleted");
    },
    onError: (error) => toast.error(`Failed to delete policy: ${error.message}`)
  });

  return (
    <AdminLayout title="Retention Policies">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Archive className="h-8 w-8 text-primary" />
              Document Retention & Auto-Purge
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure data lifecycle policies for GDPR, HIPAA, and compliance requirements
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Retention Policy</DialogTitle>
                <DialogDescription>
                  Define how long documents should be retained before archival or deletion
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Policy Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., GDPR 7-Year Retention"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe when this policy applies..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retention Period (Days)</Label>
                  <Input
                    type="number"
                    value={formData.retention_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, retention_days: parseInt(e.target.value) || 365 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    = {Math.round(formData.retention_days / 365 * 10) / 10} years
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Purge</Label>
                    <p className="text-xs text-muted-foreground">Automatically delete expired documents</p>
                  </div>
                  <Switch
                    checked={formData.auto_purge}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_purge: checked }))}
                  />
                </div>
                {formData.auto_purge && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Archive Before Purge</Label>
                        <p className="text-xs text-muted-foreground">Create backup before deletion</p>
                      </div>
                      <Switch
                        checked={formData.archive_before_purge}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, archive_before_purge: checked }))}
                      />
                    </div>
                    {formData.archive_before_purge && (
                      <div className="space-y-2">
                        <Label>Archive Location</Label>
                        <Input
                          value={formData.archive_location}
                          onChange={(e) => setFormData(prev => ({ ...prev, archive_location: e.target.value }))}
                          placeholder="s3://bucket/archives/ or /path/to/archive"
                        />
                      </div>
                    )}
                  </>
                )}
                <div className="p-3 bg-amber-500/10 text-amber-700 rounded-lg text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Auto-purge is irreversible. Ensure archive settings are configured correctly before enabling.</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !formData.name}>
                  {createMutation.isPending ? "Creating..." : "Create Policy"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{retentionStats?.totalDocuments || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Documents</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{retentionStats?.dueForPurge || 0}</p>
                  <p className="text-xs text-muted-foreground">Due for Purge</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Archive className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{retentionStats?.archived || 0}</p>
                  <p className="text-xs text-muted-foreground">Archived/Purged</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Settings className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{retentionStats?.activePolicies || 0}</p>
                  <p className="text-xs text-muted-foreground">Active Policies</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="policies">
          <TabsList>
            <TabsTrigger value="policies">Retention Policies</TabsTrigger>
            <TabsTrigger value="audit">Purge Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="policies" className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading policies...</div>
            ) : policies?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Retention Policies</h3>
                  <p className="text-muted-foreground mb-4">
                    Create policies to manage document lifecycle and ensure compliance
                  </p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Policy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {policies?.map((policy) => (
                  <Card key={policy.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{policy.name}</CardTitle>
                          <CardDescription>{policy.description || "No description"}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={policy.is_active ? "default" : "secondary"}>
                            {policy.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {policy.auto_purge && (
                            <Badge variant="destructive">Auto-Purge</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">Retention:</span>
                          <p className="font-medium">{policy.retention_days} days ({Math.round(policy.retention_days / 365 * 10) / 10} years)</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Auto-Purge:</span>
                          <p className="font-medium">{policy.auto_purge ? "Enabled" : "Disabled"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Archive First:</span>
                          <p className="font-medium">{policy.archive_before_purge ? "Yes" : "No"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Archive Location:</span>
                          <p className="font-medium truncate">{policy.archive_location || "Not configured"}</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Switch
                          checked={policy.is_active}
                          onCheckedChange={(checked) => updateMutation.mutate({ id: policy.id, is_active: checked })}
                        />
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(policy.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Chain of Custody Audit Trail</CardTitle>
                <CardDescription>Complete record of all document deletions and archives</CardDescription>
              </CardHeader>
              <CardContent>
                {purgeLogs && purgeLogs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Archive Location</TableHead>
                        <TableHead>Metadata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purgeLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(log.purged_at), "PPp")}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{log.document_name || log.document_id}</TableCell>
                          <TableCell>{log.purge_reason}</TableCell>
                          <TableCell className="max-w-xs truncate">{log.archived_location || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.metadata ? JSON.stringify(log.metadata) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No documents have been purged yet. Purge logs will appear here when documents are deleted.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
