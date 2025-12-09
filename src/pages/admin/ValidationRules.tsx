import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useNavigate } from "react-router-dom";
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
import { AlertCircle, Plus, Trash2, ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";

interface ValidationRuleTemplate {
  name: string;
  description: string;
  field_name: string;
  rule_type: string;
  rule_config: string;
  regex_pattern?: string;
  error_message: string;
  severity: string;
}

const VALIDATION_TEMPLATES: ValidationRuleTemplate[] = [
  {
    name: "Email Address",
    description: "Validate email format",
    field_name: "email",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    error_message: "Invalid email address format",
    severity: "error",
  },
  {
    name: "US Phone Number",
    description: "Validate US phone format (XXX) XXX-XXXX",
    field_name: "phone",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$",
    error_message: "Invalid US phone number format",
    severity: "error",
  },
  {
    name: "Social Security Number",
    description: "Validate SSN format XXX-XX-XXXX",
    field_name: "ssn",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^\\d{3}-\\d{2}-\\d{4}$",
    error_message: "Invalid SSN format (expected XXX-XX-XXXX)",
    severity: "error",
  },
  {
    name: "ZIP Code (US)",
    description: "Validate 5 or 9 digit ZIP code",
    field_name: "zip_code",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^\\d{5}(-\\d{4})?$",
    error_message: "Invalid ZIP code format",
    severity: "error",
  },
  {
    name: "Invoice Number",
    description: "Alphanumeric invoice number",
    field_name: "invoice_number",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^[A-Z0-9-]{3,20}$",
    error_message: "Invoice number must be 3-20 alphanumeric characters",
    severity: "error",
  },
  {
    name: "Currency Amount",
    description: "Validate dollar amount format",
    field_name: "amount",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^\\$?[0-9]{1,3}(,?[0-9]{3})*(\\.\\d{2})?$",
    error_message: "Invalid currency format",
    severity: "error",
  },
  {
    name: "Date (MM/DD/YYYY)",
    description: "US date format validation",
    field_name: "date",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])/(19|20)\\d{2}$",
    error_message: "Invalid date format (expected MM/DD/YYYY)",
    severity: "error",
  },
  {
    name: "Required Field",
    description: "Ensure field is not empty",
    field_name: "required_field",
    rule_type: "required",
    rule_config: "{}",
    error_message: "This field is required",
    severity: "error",
  },
  {
    name: "Numeric Range (0-100)",
    description: "Value must be between 0 and 100",
    field_name: "percentage",
    rule_type: "range",
    rule_config: '{"min": 0, "max": 100}',
    error_message: "Value must be between 0 and 100",
    severity: "error",
  },
  {
    name: "Positive Amount",
    description: "Amount must be greater than zero",
    field_name: "amount",
    rule_type: "range",
    rule_config: '{"min": 0.01}',
    error_message: "Amount must be greater than zero",
    severity: "error",
  },
  {
    name: "Credit Card Number",
    description: "Basic credit card format (16 digits)",
    field_name: "card_number",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}$",
    error_message: "Invalid credit card number format",
    severity: "error",
  },
  {
    name: "State Code (US)",
    description: "Two-letter US state code",
    field_name: "state",
    rule_type: "regex",
    rule_config: "{}",
    regex_pattern: "^(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])$",
    error_message: "Invalid US state code",
    severity: "error",
  },
];

export default function ValidationRules() {
  useRequireAuth(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [formData, setFormData] = useState({
    field_name: "",
    rule_type: "regex",
    rule_config: "{}",
    error_message: "",
    severity: "error",
    is_active: true,
  });
  const [regexPattern, setRegexPattern] = useState("");

  const loadTemplate = (template: ValidationRuleTemplate) => {
    setFormData({
      field_name: template.field_name,
      rule_type: template.rule_type,
      rule_config: template.rule_config,
      error_message: template.error_message,
      severity: template.severity,
      is_active: true,
    });
    setRegexPattern(template.regex_pattern || "");
    setTemplateDialogOpen(false);
    setOpen(true);
    toast.success(`Template "${template.name}" loaded`);
  };

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
      setRegexPattern("");
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
      // For regex type, auto-construct JSON from pattern field
      if (formData.rule_type === "regex") {
        if (!regexPattern) {
          toast.error("Please enter a regex pattern");
          return;
        }
        parsedConfig = { pattern: regexPattern };
      } else {
        parsedConfig = JSON.parse(formData.rule_config);
      }
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
      <div className="mb-4">
        <Button onClick={() => navigate(-1)} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Validation Rules</h1>
            <p className="text-muted-foreground">
              Define custom validation rules to ensure data quality and consistency across your documents. Create regex patterns, required field checks, format validations, and cross-field rules that automatically flag documents that don't meet your business requirements. Rules can be set to error (blocking) or warning (advisory) levels.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Validation Rule Templates</DialogTitle>
                  <DialogDescription>
                    Choose a pre-built template to quickly create common validation rules
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 py-4 overflow-y-auto max-h-[50vh]">
                  {VALIDATION_TEMPLATES.map((template, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => loadTemplate(template)}
                    >
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {template.rule_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 font-mono truncate">
                          Field: {template.field_name}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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

                  {formData.rule_type === "regex" ? (
                    <div className="space-y-2">
                      <Label htmlFor="regex_pattern">Regex Pattern *</Label>
                      <Input
                        id="regex_pattern"
                        value={regexPattern}
                        onChange={(e) => setRegexPattern(e.target.value)}
                        placeholder="C\d{4}-\d+"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter just the pattern (no JSON needed). Example: ^\d{`{3}`}-\d{`{2}`}-\d{`{4}`}$
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="rule_config">Rule Configuration (JSON) *</Label>
                      <Textarea
                        id="rule_config"
                        value={formData.rule_config}
                        onChange={(e) => setFormData({ ...formData, rule_config: e.target.value })}
                        placeholder='{"min": 0, "max": 100}'
                        rows={3}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter configuration as JSON. Example for range: {`{"min": 0, "max": 100}`}
                      </p>
                    </div>
                  )}

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
