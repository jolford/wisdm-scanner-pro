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
import { Clock, Plus, AlertTriangle, CheckCircle, XCircle, Target, TrendingUp, Bell, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";

interface SLAConfig {
  id: string;
  customer_id: string;
  name: string;
  description: string | null;
  processing_time_target_minutes: number;
  validation_time_target_minutes: number;
  export_time_target_minutes: number;
  uptime_target_percentage: number;
  alert_on_breach: boolean;
  alert_recipients: string[] | null;
  escalation_after_minutes: number;
  escalation_recipients: string[] | null;
  is_active: boolean;
  created_at: string;
}

interface SLABreach {
  id: string;
  breach_type: string;
  entity_type: string;
  entity_id: string | null;
  target_value: number;
  actual_value: number;
  breach_details: Record<string, any> | null;
  acknowledged: boolean;
  resolution_notes: string | null;
  created_at: string;
}

export default function EnhancedSLAMonitoring() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBreach, setSelectedBreach] = useState<SLABreach | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    processing_time_target_minutes: 60,
    validation_time_target_minutes: 120,
    export_time_target_minutes: 30,
    uptime_target_percentage: 99.9,
    alert_on_breach: true,
    alert_recipients: "",
    escalation_after_minutes: 30,
    escalation_recipients: ""
  });

  const { data: configs, isLoading } = useQuery({
    queryKey: ["sla-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_configs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SLAConfig[];
    }
  });

  const { data: breaches } = useQuery({
    queryKey: ["sla-breaches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_breaches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as SLABreach[];
    }
  });

  const { data: metrics } = useQuery({
    queryKey: ["sla-metrics"],
    queryFn: async () => {
      // Calculate SLA metrics from batches and documents
      const { data: batches } = await supabase
        .from("batches")
        .select("id, status, created_at, started_at, completed_at, exported_at")
        .order("created_at", { ascending: false })
        .limit(500);

      let totalProcessingTime = 0;
      let totalValidationTime = 0;
      let totalExportTime = 0;
      let processedCount = 0;
      let validatedCount = 0;
      let exportedCount = 0;

      batches?.forEach(batch => {
        if (batch.started_at && batch.created_at) {
          totalProcessingTime += differenceInMinutes(new Date(batch.started_at), new Date(batch.created_at));
          processedCount++;
        }
        if (batch.completed_at && batch.started_at) {
          totalValidationTime += differenceInMinutes(new Date(batch.completed_at), new Date(batch.started_at));
          validatedCount++;
        }
        if (batch.exported_at && batch.completed_at) {
          totalExportTime += differenceInMinutes(new Date(batch.exported_at), new Date(batch.completed_at));
          exportedCount++;
        }
      });

      const unacknowledgedBreaches = breaches?.filter(b => !b.acknowledged).length || 0;
      const totalBreaches = breaches?.length || 0;

      return {
        avgProcessingTime: processedCount > 0 ? Math.round(totalProcessingTime / processedCount) : 0,
        avgValidationTime: validatedCount > 0 ? Math.round(totalValidationTime / validatedCount) : 0,
        avgExportTime: exportedCount > 0 ? Math.round(totalExportTime / exportedCount) : 0,
        totalBatches: batches?.length || 0,
        unacknowledgedBreaches,
        totalBreaches,
        complianceRate: totalBreaches > 0 ? Math.round((1 - totalBreaches / (batches?.length || 1)) * 100) : 100
      };
    },
    enabled: !!breaches
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userCustomers } = await supabase
        .from("user_customers")
        .select("customer_id")
        .eq("user_id", userData.user?.id)
        .single();

      const { error } = await supabase.from("sla_configs").insert({
        ...data,
        customer_id: userCustomers?.customer_id,
        alert_recipients: data.alert_recipients ? data.alert_recipients.split(",").map(e => e.trim()) : null,
        escalation_recipients: data.escalation_recipients ? data.escalation_recipients.split(",").map(e => e.trim()) : null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-configs"] });
      toast.success("SLA configuration created");
      setIsAddDialogOpen(false);
    },
    onError: (error) => toast.error(`Failed to create SLA config: ${error.message}`)
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("sla_breaches").update({
        acknowledged: true,
        acknowledged_by: userData.user?.id,
        acknowledged_at: new Date().toISOString(),
        resolution_notes: notes,
        resolved_at: new Date().toISOString()
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-breaches"] });
      toast.success("Breach acknowledged");
      setSelectedBreach(null);
      setResolutionNotes("");
    },
    onError: (error) => toast.error(`Failed to acknowledge: ${error.message}`)
  });

  const activeConfig = configs?.find(c => c.is_active);

  const getComplianceColor = (actual: number, target: number) => {
    const ratio = actual / target;
    if (ratio <= 0.8) return "text-green-500";
    if (ratio <= 1.0) return "text-yellow-500";
    return "text-red-500";
  };

  const getComplianceProgress = (actual: number, target: number) => {
    return Math.min(100, Math.round((actual / target) * 100));
  };

  return (
    <AdminLayout title="SLA Monitoring">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="h-8 w-8 text-primary" />
              SLA Monitoring & Compliance
            </h1>
            <p className="text-muted-foreground mt-1">
              Track service level agreements and ensure processing targets are met
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Configure SLA
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Configure SLA Targets</DialogTitle>
                <DialogDescription>
                  Set performance targets and alert thresholds
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>SLA Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Enterprise SLA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="SLA terms and conditions..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Processing Target (min)</Label>
                    <Input
                      type="number"
                      value={formData.processing_time_target_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, processing_time_target_minutes: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Validation Target (min)</Label>
                    <Input
                      type="number"
                      value={formData.validation_time_target_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, validation_time_target_minutes: parseInt(e.target.value) || 120 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Export Target (min)</Label>
                    <Input
                      type="number"
                      value={formData.export_time_target_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, export_time_target_minutes: parseInt(e.target.value) || 30 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Uptime Target (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.uptime_target_percentage}
                      onChange={(e) => setFormData(prev => ({ ...prev, uptime_target_percentage: parseFloat(e.target.value) || 99.9 }))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <Label>Alert on Breach</Label>
                    <p className="text-xs text-muted-foreground">Send notifications when SLA is breached</p>
                  </div>
                  <Switch
                    checked={formData.alert_on_breach}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alert_on_breach: checked }))}
                  />
                </div>
                {formData.alert_on_breach && (
                  <>
                    <div className="space-y-2">
                      <Label>Alert Recipients</Label>
                      <Input
                        value={formData.alert_recipients}
                        onChange={(e) => setFormData(prev => ({ ...prev, alert_recipients: e.target.value }))}
                        placeholder="email1@example.com, email2@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Escalation After (min)</Label>
                      <Input
                        type="number"
                        value={formData.escalation_after_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, escalation_after_minutes: parseInt(e.target.value) || 30 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Escalation Recipients</Label>
                      <Input
                        value={formData.escalation_recipients}
                        onChange={(e) => setFormData(prev => ({ ...prev, escalation_recipients: e.target.value }))}
                        placeholder="manager@example.com"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !formData.name}>
                  {createMutation.isPending ? "Creating..." : "Create SLA"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.complianceRate || 100}%</p>
                  <p className="text-xs text-muted-foreground">SLA Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.avgProcessingTime || 0}m</p>
                  <p className="text-xs text-muted-foreground">Avg Processing Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.unacknowledgedBreaches || 0}</p>
                  <p className="text-xs text-muted-foreground">Pending Breaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.totalBatches || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Batches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeConfig && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current SLA Performance</CardTitle>
                  <CardDescription>{activeConfig.name}</CardDescription>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing Time</span>
                    <span className={getComplianceColor(metrics?.avgProcessingTime || 0, activeConfig.processing_time_target_minutes)}>
                      {metrics?.avgProcessingTime || 0}m / {activeConfig.processing_time_target_minutes}m
                    </span>
                  </div>
                  <Progress value={getComplianceProgress(metrics?.avgProcessingTime || 0, activeConfig.processing_time_target_minutes)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Validation Time</span>
                    <span className={getComplianceColor(metrics?.avgValidationTime || 0, activeConfig.validation_time_target_minutes)}>
                      {metrics?.avgValidationTime || 0}m / {activeConfig.validation_time_target_minutes}m
                    </span>
                  </div>
                  <Progress value={getComplianceProgress(metrics?.avgValidationTime || 0, activeConfig.validation_time_target_minutes)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Export Time</span>
                    <span className={getComplianceColor(metrics?.avgExportTime || 0, activeConfig.export_time_target_minutes)}>
                      {metrics?.avgExportTime || 0}m / {activeConfig.export_time_target_minutes}m
                    </span>
                  </div>
                  <Progress value={getComplianceProgress(metrics?.avgExportTime || 0, activeConfig.export_time_target_minutes)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="breaches">
          <TabsList>
            <TabsTrigger value="breaches">SLA Breaches</TabsTrigger>
            <TabsTrigger value="configs">SLA Configurations</TabsTrigger>
          </TabsList>

          <TabsContent value="breaches" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>SLA Breach History</CardTitle>
                <CardDescription>Track and resolve SLA violations</CardDescription>
              </CardHeader>
              <CardContent>
                {breaches && breaches.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breaches.map((breach) => (
                        <TableRow key={breach.id}>
                          <TableCell>{format(new Date(breach.created_at), "PPp")}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{breach.breach_type}</Badge>
                          </TableCell>
                          <TableCell>{breach.entity_type}</TableCell>
                          <TableCell>{breach.target_value}m</TableCell>
                          <TableCell className="text-red-500 font-medium">{breach.actual_value}m</TableCell>
                          <TableCell>
                            {breach.acknowledged ? (
                              <Badge variant="secondary">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!breach.acknowledged && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => setSelectedBreach(breach)}>
                                    Acknowledge
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Acknowledge SLA Breach</DialogTitle>
                                    <DialogDescription>
                                      Add resolution notes and mark this breach as acknowledged
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 mt-4">
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                      <p><strong>Type:</strong> {breach.breach_type}</p>
                                      <p><strong>Target:</strong> {breach.target_value}m</p>
                                      <p><strong>Actual:</strong> {breach.actual_value}m</p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Resolution Notes</Label>
                                      <Textarea
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                        placeholder="Describe the root cause and corrective actions taken..."
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setSelectedBreach(null)}>Cancel</Button>
                                    <Button 
                                      onClick={() => acknowledgeMutation.mutate({ id: breach.id, notes: resolutionNotes })}
                                      disabled={acknowledgeMutation.isPending}
                                    >
                                      {acknowledgeMutation.isPending ? "Saving..." : "Acknowledge Breach"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No SLA breaches recorded. Great job!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configs" className="mt-4">
            {configs?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No SLA Configurations</h3>
                  <p className="text-muted-foreground mb-4">
                    Create an SLA to start tracking performance targets
                  </p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Configure SLA
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {configs?.map((config) => (
                  <Card key={config.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{config.name}</CardTitle>
                          <CardDescription>{config.description || "No description"}</CardDescription>
                        </div>
                        <Badge variant={config.is_active ? "default" : "secondary"}>
                          {config.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Processing:</span>
                          <p className="font-medium">{config.processing_time_target_minutes} min</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Validation:</span>
                          <p className="font-medium">{config.validation_time_target_minutes} min</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Export:</span>
                          <p className="font-medium">{config.export_time_target_minutes} min</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Uptime:</span>
                          <p className="font-medium">{config.uptime_target_percentage}%</p>
                        </div>
                      </div>
                      {config.alert_on_breach && (
                        <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
                          <Bell className="h-4 w-4" />
                          Alerts enabled • Escalation after {config.escalation_after_minutes} min
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
