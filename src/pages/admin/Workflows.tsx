import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Edit, Trash2, Plus, Workflow as WorkflowIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Workflows() {
  const navigate = useNavigate();
  const [filterProject, setFilterProject] = useState<string>("all");

  const { data: workflows, isLoading: workflowsLoading, refetch } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select(`
          *,
          projects!inner(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
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

  const handleToggleActive = async (workflowId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("workflows")
        .update({ is_active: !currentStatus })
        .eq("id", workflowId);

      if (error) throw error;

      toast.success(`Workflow ${!currentStatus ? "activated" : "deactivated"}`);
      refetch();
    } catch (error) {
      console.error("Error toggling workflow:", error);
      toast.error("Failed to update workflow status");
    }
  };

  const handleDelete = async (workflowId: string, workflowName: string) => {
    if (!window.confirm(`Are you sure you want to delete the workflow "${workflowName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("workflows")
        .delete()
        .eq("id", workflowId);

      if (error) throw error;

      toast.success("Workflow deleted successfully");
      refetch();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      toast.error("Failed to delete workflow");
    }
  };

  const handleEdit = (projectId: string, workflowId: string) => {
    navigate(`/admin/workflow-builder?projectId=${projectId}&workflowId=${workflowId}`);
  };

  const filteredWorkflows = workflows?.filter(w => 
    filterProject === "all" || w.project_id === filterProject
  );

  return (
    <AdminLayout title="Workflow Management">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <WorkflowIcon className="h-5 w-5" />
                  All Workflows
                </CardTitle>
                <CardDescription>
                  View and manage automated workflows across all projects
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

            {workflowsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading workflows...
              </div>
            ) : filteredWorkflows && filteredWorkflows.length > 0 ? (
              <div className="space-y-4">
                {filteredWorkflows.map((workflow) => (
                  <Card key={workflow.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              {workflow.name}
                            </h3>
                            <Badge variant={workflow.is_active ? "default" : "secondary"}>
                              {workflow.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          {workflow.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {workflow.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Project:</span>{" "}
                              {workflow.projects?.name}
                            </div>
                            {workflow.trigger_events && (
                              <div>
                                <span className="font-medium">Triggers:</span>{" "}
                                {Array.isArray(workflow.trigger_events) 
                                  ? workflow.trigger_events.join(", ")
                                  : workflow.trigger_events}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Nodes:</span>{" "}
                              {workflow.workflow_nodes && typeof workflow.workflow_nodes === 'object'
                                ? Array.isArray(workflow.workflow_nodes) 
                                  ? workflow.workflow_nodes.length 
                                  : 0
                                : 0}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Active</span>
                            <Switch
                              checked={workflow.is_active}
                              onCheckedChange={() => handleToggleActive(workflow.id, workflow.is_active)}
                            />
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(workflow.project_id, workflow.id)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(workflow.id, workflow.name)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <WorkflowIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
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
