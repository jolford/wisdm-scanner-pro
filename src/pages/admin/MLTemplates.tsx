/**
 * ML Templates Admin Page
 * 
 * View and manage machine learning templates that are automatically created
 * for different document types. Templates learn patterns and improve with each batch.
 * 
 * Features:
 * - View all ML templates across projects
 * - See accuracy rates and training data counts
 * - Activate/deactivate templates
 * - Filter by project
 * - Sort by accuracy or training data
 * 
 * @requires useRequireAuth - Admin-only access control
 * @requires AdminLayout - Standard admin page layout
 */

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Sparkles,
  TrendingUp,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';

interface MLTemplate {
  id: string;
  project_id: string;
  template_name: string;
  document_type: string;
  field_patterns: any;
  training_data_count: number;
  accuracy_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  project_name?: string;
}

const MLTemplates = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [templates, setTemplates] = useState<MLTemplate[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'accuracy' | 'training'>('accuracy');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      
      // Fetch templates
      let query = supabase
        .from('ml_document_templates')
        .select('*, projects(name)');
      
      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const templatesWithProjects = data?.map(t => ({
        ...t,
        project_name: t.projects?.name || 'Unknown Project'
      })) || [];
      
      // Sort based on selection
      const sorted = [...templatesWithProjects].sort((a, b) => {
        if (sortBy === 'accuracy') {
          return (b.accuracy_rate || 0) - (a.accuracy_rate || 0);
        } else {
          return b.training_data_count - a.training_data_count;
        }
      });
      
      setTemplates(sorted);
    } catch (error: any) {
      console.error('Error fetching ML templates:', error);
      toast.error('Failed to load ML templates');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  useEffect(() => {
    if (!loading && isAdmin) {
      fetchProjects();
      fetchTemplates();
    }
  }, [loading, isAdmin, selectedProject, sortBy]);

  const toggleTemplateStatus = async (templateId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('ml_document_templates')
        .update({ is_active: !currentStatus })
        .eq('id', templateId);
      
      if (error) throw error;
      
      toast.success(`Template ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template status');
    }
  };

  if (loading || !isAdmin) {
    return null;
  }

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.is_active).length,
    avgAccuracy: templates.length > 0 
      ? templates.reduce((sum, t) => sum + (t.accuracy_rate || 0), 0) / templates.length 
      : 0,
    totalTraining: templates.reduce((sum, t) => sum + t.training_data_count, 0),
  };

  return (
    <AdminLayout title="ML Templates" description="Auto-generated templates that learn from your document processing">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Machine Learning Templates
            </h1>
            <p className="text-muted-foreground mt-1">
              Auto-generated templates that learn from your document processing
            </p>
          </div>
          <Button onClick={fetchTemplates} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Templates</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Templates</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Accuracy</p>
                <p className="text-2xl font-bold">{(stats.avgAccuracy * 100).toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Training Data</p>
                <p className="text-2xl font-bold">{stats.totalTraining.toLocaleString()}</p>
              </div>
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'accuracy' | 'training')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accuracy">Accuracy (High to Low)</SelectItem>
                  <SelectItem value="training">Training Data (Most to Least)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Templates Table */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Templates</h2>
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No ML templates found</p>
                <p className="text-sm mt-1">Templates are created automatically as documents are processed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Training Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.template_name}</TableCell>
                        <TableCell>{template.project_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.document_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {template.accuracy_rate !== null ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={template.accuracy_rate * 100} 
                                  className="h-2 w-20"
                                />
                                <span className="text-sm font-medium">
                                  {(template.accuracy_rate * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not yet measured</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{template.training_data_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {template.is_active ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={() => toggleTemplateStatus(template.id, template.is_active)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default MLTemplates;
