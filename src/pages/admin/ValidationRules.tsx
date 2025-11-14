import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ValidationRules() {
  useRequireAuth(true);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [formData, setFormData] = useState({
    field_name: "",
    rule_type: "regex",
    rule_config: "{}",
    error_message: "",
    severity: "error",
    is_active: true,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-for-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["validation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validation_rules")
        .select(`
          *,
          project:projects(id, name),
          document_class:document_classes(id, name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createRule = useMutation({
    mutationFn: async (data: any) => {
      const user = await supabase.auth.getUser();
      const { error } = await supabase.from("validation_rules").insert({
        ...data,
        created_by: user.data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["validation-rules"] });
      toast.success("Validation rule created");
      setOpen(false);
      setFormData({
        field_name: "",
        rule_type: "regex",
        rule_config: "{}",
        error_message: "",
        severity: "error",
        is_active: true,
      });
    },
    onError: () => {
      toast.error("Failed to create validation rule");
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("validation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["validation-rules"] });
      toast.success("Validation rule deleted");
    },
    onError: () => {
      toast.error("Failed to delete validation rule");
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("validation_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["validation-rules"] });
      toast.success("Rule status updated");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error("Please select a project");
      return;
    }
    
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(formData.rule_config);
    } catch (error) {
      toast.error("Invalid JSON in rule configuration");
      return;
    }

    createRule.mutate({
      ...formData,
      project_id: selectedProject,
      rule_config: parsedConfig,
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "destructive";
      case "warning": return "warning";
      default: return "secondary";
    }
  };

  return (
    <AdminLayout title="Validation Rules">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Validation Rules</h1>
            <p className="text-muted-foreground">
              Define custom validation rules to ensure data quality and consistency across your documents. Create regex patterns, required field checks, format validations, and cross-field rules that automatically flag documents that don't meet your business requirements. Rules can be set to error (blocking) or warning (advisory) levels.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Validation Rule</DialogTitle>
                  <DialogDescription>
                    Define a new validation rule for document fields
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Project *</Label>
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="field_name">Field Name *</Label>
                    <Input
                      id="field_name"
                      value={formData.field_name}
                      onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                      placeholder="e.g., email, phone, amount"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule_type">Rule Type *</Label>
                      <Select value={formData.rule_type} onValueChange={(v) => setFormData({ ...formData, rule_type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regex">Regex Pattern</SelectItem>
                          <SelectItem value="range">Numeric Range</SelectItem>
                          <SelectItem value="required">Required Field</SelectItem>
                          <SelectItem value="lookup">Database Lookup</SelectItem>
                          <SelectItem value="format">Date/Time Format</SelectItem>
                          <SelectItem value="custom">Custom Logic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="severity">Severity *</Label>
                      <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule_config">Rule Configuration (JSON) *</Label>
                    <Textarea
                      id="rule_config"
                      value={formData.rule_config}
                      onChange={(e) => setFormData({ ...formData, rule_config: e.target.value })}
                      placeholder='{"pattern": "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$"}'
                      rows={3}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Example for regex: {`{"pattern": "^\\d{3}-\\d{2}-\\d{4}$"}`}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="error_message">Error Message *</Label>
                    <Input
                      id="error_message"
                      value={formData.error_message}
                      onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
                      placeholder="Describe what's wrong when validation fails"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRule.isPending}>
                    Create Rule
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Rules</CardTitle>
            <CardDescription>Manage validation rules across your projects</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
            ) : !rules || rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No validation rules configured yet
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule: any) => (
                  <Card key={rule.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(rule.severity)}>
                              {rule.severity}
                            </Badge>
                            <Badge variant="outline">{rule.rule_type}</Badge>
                            <span className="font-medium">{rule.field_name}</span>
                            {!rule.is_active && (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {rule.error_message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Project: {rule.project?.name || "Unknown"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) => 
                              toggleRule.mutate({ id: rule.id, is_active: checked })
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRule.mutate(rule.id)}
                            disabled={deleteRule.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
