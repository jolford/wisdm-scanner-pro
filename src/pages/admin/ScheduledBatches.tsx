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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ScheduledBatches() {
  useRequireAuth(true);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    frequency: "daily",
    time_of_day: "09:00",
    day_of_week: 1,
    day_of_month: 1,
    is_active: true,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-for-scheduling"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, customer_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["scheduled-exports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_exports")
        .select(`
          *,
          project:projects(id, name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createSchedule = useMutation({
    mutationFn: async (data: any) => {
      const user = await supabase.auth.getUser();
      const project = projects?.find(p => p.id === selectedProject);
      
      const { error } = await supabase.from("scheduled_exports").insert({
        ...data,
        project_id: selectedProject,
        customer_id: project?.customer_id,
        created_by: user.data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-exports"] });
      toast.success("Schedule created");
      setOpen(false);
      setFormData({
        name: "",
        frequency: "daily",
        time_of_day: "09:00",
        day_of_week: 1,
        day_of_month: 1,
        is_active: true,
      });
    },
    onError: () => {
      toast.error("Failed to create schedule");
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_exports")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-exports"] });
      toast.success("Schedule deleted");
    },
    onError: () => {
      toast.error("Failed to delete schedule");
    },
  });

  const toggleSchedule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("scheduled_exports")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-exports"] });
      toast.success("Schedule status updated");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error("Please select a project");
      return;
    }

    createSchedule.mutate(formData);
  };

  const getFrequencyDisplay = (schedule: any) => {
    switch (schedule.frequency) {
      case "daily":
        return `Daily at ${schedule.time_of_day}`;
      case "weekly":
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return `Weekly on ${days[schedule.day_of_week]} at ${schedule.time_of_day}`;
      case "monthly":
        return `Monthly on day ${schedule.day_of_month} at ${schedule.time_of_day}`;
      default:
        return schedule.frequency;
    }
  };

  return (
    <AdminLayout title="Scheduled Batch Processing">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scheduled Batch Processing</h1>
            <p className="text-muted-foreground">
              Automate batch processing at specific times
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Processing Schedule</DialogTitle>
                  <DialogDescription>
                    Set up automatic batch processing
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
                    <Label htmlFor="name">Schedule Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Daily Invoice Processing"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency *</Label>
                    <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time_of_day">Time *</Label>
                    <Input
                      id="time_of_day"
                      type="time"
                      value={formData.time_of_day}
                      onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                      required
                    />
                  </div>

                  {formData.frequency === "weekly" && (
                    <div className="space-y-2">
                      <Label htmlFor="day_of_week">Day of Week *</Label>
                      <Select 
                        value={formData.day_of_week.toString()} 
                        onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.frequency === "monthly" && (
                    <div className="space-y-2">
                      <Label htmlFor="day_of_month">Day of Month (1-31) *</Label>
                      <Input
                        id="day_of_month"
                        type="number"
                        min="1"
                        max="31"
                        value={formData.day_of_month}
                        onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                  )}

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
                  <Button type="submit" disabled={createSchedule.isPending}>
                    Create Schedule
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Schedules</CardTitle>
            <CardDescription>Automated batch processing schedules</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
            ) : !schedules || schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No schedules configured yet
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule: any) => (
                  <Card key={schedule.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{schedule.name}</h3>
                            {schedule.is_active ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {getFrequencyDisplay(schedule)}
                            </span>
                            {schedule.last_run_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                Last run: {format(new Date(schedule.last_run_at), "PPp")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Project: {schedule.project?.name || "Unknown"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.is_active}
                            onCheckedChange={(checked) => 
                              toggleSchedule.mutate({ id: schedule.id, is_active: checked })
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSchedule.mutate(schedule.id)}
                            disabled={deleteSchedule.isPending}
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
