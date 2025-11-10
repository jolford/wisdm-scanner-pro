import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Edit, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function ReleaseNotesManager() {
  useRequireAuth(false, true); // Require system admin
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<any>(null);
  const [formData, setFormData] = useState({
    version: "",
    version_name: "",
    release_date: new Date().toISOString().split('T')[0],
    status: "published",
    is_latest: false,
    description: "",
    highlights: "[]",
    features: "[]",
  });

  const { data: releases, isLoading } = useQuery({
    queryKey: ["release-notes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("release_notes")
        .select("*")
        .order("release_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createRelease = useMutation({
    mutationFn: async (data: any) => {
      const user = await supabase.auth.getUser();
      
      // Parse JSON strings
      let highlights, features;
      try {
        highlights = JSON.parse(data.highlights);
        features = JSON.parse(data.features);
      } catch (error) {
        throw new Error("Invalid JSON format in highlights or features");
      }

      const { error } = await supabase.from("release_notes").insert({
        ...data,
        highlights,
        features,
        created_by: user.data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-notes-admin"] });
      toast.success("Release created successfully");
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create release");
    },
  });

  const updateRelease = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Parse JSON strings
      let highlights, features;
      try {
        highlights = typeof data.highlights === 'string' ? JSON.parse(data.highlights) : data.highlights;
        features = typeof data.features === 'string' ? JSON.parse(data.features) : data.features;
      } catch (error) {
        throw new Error("Invalid JSON format in highlights or features");
      }

      const { error } = await supabase
        .from("release_notes")
        .update({ ...data, highlights, features })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-notes-admin"] });
      toast.success("Release updated successfully");
      setOpen(false);
      setEditingRelease(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update release");
    },
  });

  const deleteRelease = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("release_notes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-notes-admin"] });
      toast.success("Release deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete release");
    },
  });

  const resetForm = () => {
    setFormData({
      version: "",
      version_name: "",
      release_date: new Date().toISOString().split('T')[0],
      status: "published",
      is_latest: false,
      description: "",
      highlights: "[]",
      features: "[]",
    });
    setEditingRelease(null);
  };

  const handleEdit = (release: any) => {
    setEditingRelease(release);
    setFormData({
      version: release.version,
      version_name: release.version_name,
      release_date: release.release_date,
      status: release.status,
      is_latest: release.is_latest,
      description: release.description,
      highlights: JSON.stringify(release.highlights, null, 2),
      features: JSON.stringify(release.features, null, 2),
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRelease) {
      updateRelease.mutate({ id: editingRelease.id, data: formData });
    } else {
      createRelease.mutate(formData);
    }
  };

  return (
    <AdminLayout title="Release Notes Manager">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Release Notes Manager</h1>
            <p className="text-muted-foreground">
              Manage version releases and feature announcements
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/release-notes')}>
              <Eye className="h-4 w-4 mr-2" />
              View Public Page
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { resetForm(); } }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Release
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingRelease ? 'Edit' : 'Create'} Release</DialogTitle>
                    <DialogDescription>
                      {editingRelease ? 'Update' : 'Add'} a new version release with features and highlights
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="version">Version *</Label>
                        <Input
                          id="version"
                          value={formData.version}
                          onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                          placeholder="e.g., 2.3.0"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="release_date">Release Date *</Label>
                        <Input
                          id="release_date"
                          type="date"
                          value={formData.release_date}
                          onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="version_name">Version Name *</Label>
                      <Input
                        id="version_name"
                        value={formData.version_name}
                        onChange={(e) => setFormData({ ...formData, version_name: e.target.value })}
                        placeholder="e.g., Phase 3: Bulk Operations & Analytics"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of this release"
                        rows={3}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status *</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end space-x-2 pb-2">
                        <Switch
                          id="is_latest"
                          checked={formData.is_latest}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_latest: checked })}
                        />
                        <Label htmlFor="is_latest">Mark as Latest Release</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="highlights">Highlights (JSON Array) *</Label>
                      <Textarea
                        id="highlights"
                        value={formData.highlights}
                        onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                        placeholder='[{"title": "Feature Name", "description": "Feature description"}]'
                        rows={5}
                        className="font-mono text-sm"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: Array of objects with "title" and "description" fields
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="features">Features (JSON Array) *</Label>
                      <Textarea
                        id="features"
                        value={formData.features}
                        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                        placeholder='[{"section": "Section Name", "items": ["Feature 1", "Feature 2"]}]'
                        rows={8}
                        className="font-mono text-sm"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: Array of objects with "section" string and "items" array
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRelease.isPending || updateRelease.isPending}>
                      {editingRelease ? 'Update' : 'Create'} Release
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Published Releases</CardTitle>
            <CardDescription>Manage all version releases</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading releases...</div>
            ) : !releases || releases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No releases yet. Create your first one!
              </div>
            ) : (
              <div className="space-y-3">
                {releases.map((release: any) => (
                  <Card key={release.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">{release.version}</Badge>
                            {release.is_latest && (
                              <Badge variant="secondary">Latest</Badge>
                            )}
                            {release.status === 'draft' && (
                              <Badge variant="outline">Draft</Badge>
                            )}
                            <span className="font-semibold">{release.version_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{release.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(release.release_date), "PPP")}
                            </span>
                            <span>{release.highlights?.length || 0} highlights</span>
                            <span>{release.features?.length || 0} feature sections</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(release)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRelease.mutate(release.id)}
                            disabled={deleteRelease.isPending}
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
