import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  History, 
  GitBranch, 
  Clock, 
  User, 
  Play, 
  Pause, 
  FileEdit, 
  Plus,
  ChevronDown,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  name: string;
  description: string | null;
  workflow_nodes: any;
  workflow_edges: any;
  trigger_events: string[] | null;
  is_active: boolean;
  change_type: string;
  change_summary: string | null;
  changed_by: string | null;
  changed_at: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  projects: { id: string; name: string } | null;
}

export default function Workflows() {
  const navigate = useNavigate();
  const [filterProject, setFilterProject] = useState<string>("all");
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select(`
          *,
          projects!inner(id, name)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Workflow[];
    },
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ["workflow-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_versions")
        .select("*")
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data as WorkflowVersion[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-for-filter"],
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

  const toggleWorkflowExpanded = (workflowId: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      if (next.has(workflowId)) {
        next.delete(workflowId);
      } else {
        next.add(workflowId);
      }
      return next;
    });
  };

  const getVersionsForWorkflow = (workflowId: string) => {
    return versions?.filter(v => v.workflow_id === workflowId) || [];
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'activated':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'deactivated':
        return <Pause className="h-4 w-4 text-amber-500" />;
      case 'updated':
        return <FileEdit className="h-4 w-4 text-blue-500" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      created: "default",
      activated: "default",
      deactivated: "secondary",
      updated: "outline",
    };
    return (
      <Badge variant={variants[changeType] || "outline"} className="capitalize">
        {changeType}
      </Badge>
    );
  };

  const handleRestoreVersion = async (version: WorkflowVersion) => {
    if (!window.confirm(`Restore workflow to version ${version.version_number}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("workflows")
        .update({
          name: version.name,
          description: version.description,
          workflow_nodes: version.workflow_nodes,
          workflow_edges: version.workflow_edges,
          trigger_events: version.trigger_events,
          is_active: version.is_active,
        })
        .eq("id", version.workflow_id);

      if (error) throw error;
      toast.success(`Restored to version ${version.version_number}`);
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error("Failed to restore version");
    }
  };

  const filteredWorkflows = workflows?.filter(w => 
    filterProject === "all" || w.project_id === filterProject
  );

  const totalVersions = versions?.length || 0;
  const recentChanges = versions?.filter(v => {
    const changed = new Date(v.changed_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return changed > weekAgo;
  }).length || 0;

  const lastPublished = workflows?.length 
    ? workflows.reduce((latest, w) => 
        new Date(w.updated_at) > new Date(latest.updated_at) ? w : latest
      )
    : null;

  return (
    <AdminLayout title="Workflow Version History">
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <GitBranch className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{workflows?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <History className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalVersions}</p>
                  <p className="text-sm text-muted-foreground">Total Versions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{recentChanges}</p>
                  <p className="text-sm text-muted-foreground">Changes This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Play className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {workflows?.filter(w => w.is_active).length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-lg font-semibold">
                    {lastPublished 
                      ? format(new Date(lastPublished.updated_at), "MMM d, yyyy")
                      : "—"
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Last Published</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Version History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Version History
                </CardTitle>
                <CardDescription>
                  Track changes and restore previous workflow configurations
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/admin/workflow-builder")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {workflowsLoading || versionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading version history...
              </div>
            ) : filteredWorkflows && filteredWorkflows.length > 0 ? (
              <div className="space-y-4">
                {filteredWorkflows.map((workflow) => {
                  const workflowVersions = getVersionsForWorkflow(workflow.id);
                  const isExpanded = expandedWorkflows.has(workflow.id);
                  
                  return (
                    <Collapsible
                      key={workflow.id}
                      open={isExpanded}
                      onOpenChange={() => toggleWorkflowExpanded(workflow.id)}
                    >
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardContent className="pt-6 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{workflow.name}</h3>
                                    <Badge variant={workflow.is_active ? "default" : "secondary"}>
                                      {workflow.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                    <Badge variant="outline">
                                      {workflowVersions.length} versions
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {workflow.projects?.name} • Last updated{" "}
                                    {format(new Date(workflow.updated_at), "MMM d, yyyy 'at' h:mm a")}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/workflow-builder?projectId=${workflow.project_id}&workflowId=${workflow.id}`);
                                }}
                              >
                                <FileEdit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t">
                            {workflowVersions.length > 0 ? (
                              <div className="divide-y">
                                {workflowVersions.map((version, index) => (
                                  <div
                                    key={version.id}
                                    className="px-6 py-4 flex items-center justify-between hover:bg-muted/30"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                                        {getChangeTypeIcon(version.change_type)}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">
                                            Version {version.version_number}
                                          </span>
                                          {getChangeTypeBadge(version.change_type)}
                                          {index === 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                              Current
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {version.change_summary || "No summary"}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                          <Clock className="h-3 w-3" />
                                          {format(new Date(version.changed_at), "MMM d, yyyy 'at' h:mm a")}
                                          {version.changed_by && (
                                            <>
                                              <User className="h-3 w-3 ml-2" />
                                              <span>User</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {index > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRestoreVersion(version)}
                                      >
                                        <RotateCcw className="h-4 w-4 mr-1" />
                                        Restore
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="px-6 py-8 text-center text-muted-foreground">
                                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No version history yet</p>
                                <p className="text-sm">Changes will be tracked automatically</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No workflows found</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/admin/workflow-builder")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Workflow
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
