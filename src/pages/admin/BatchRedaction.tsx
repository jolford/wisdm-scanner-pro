import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BatchRedactionSearch } from '@/components/BatchRedactionSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, FolderOpen, FileStack, History, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PATTERN_PRESETS, PII_CATEGORIES } from '@/lib/keyword-redaction';

interface Project {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  batch_name: string;
  total_documents: number;
}

interface RedactionHistory {
  id: string;
  created_at: string;
  action_type: string;
  metadata: any;
  success: boolean;
}

const BatchRedaction = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [history, setHistory] = useState<RedactionHistory[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name')
          .order('name');
        
        if (error) throw error;
        setProjects(data || []);
      } catch (error: any) {
        console.error('Error loading projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  // Load batches when project changes
  useEffect(() => {
    const loadBatches = async () => {
      if (!selectedProject) {
        setBatches([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('batches')
          .select('id, batch_name, total_documents')
          .eq('project_id', selectedProject)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setBatches(data || []);
      } catch (error: any) {
        console.error('Error loading batches:', error);
      }
    };

    loadBatches();
  }, [selectedProject]);

  // Load redaction history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('audit_trail')
          .select('id, created_at, action_type, metadata, success')
          .eq('action_type', 'batch_redaction')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        setHistory(data || []);
      } catch (error: any) {
        console.error('Error loading history:', error);
      }
    };

    loadHistory();
  }, []);

  const handleRedactionsApplied = (documentIds: string[]) => {
    toast({
      title: 'Redactions Complete',
      description: `Successfully processed ${documentIds.length} document(s)`,
    });
    // Reload history
    const loadHistory = async () => {
      const { data } = await supabase
        .from('audit_trail')
        .select('id, created_at, action_type, metadata, success')
        .eq('action_type', 'batch_redaction')
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory(data || []);
    };
    loadHistory();
  };

  return (
    <AdminLayout title="Batch Redaction">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Batch Redaction
          </h1>
          <p className="text-muted-foreground mt-1">
            Search and redact sensitive information across multiple documents
          </p>
        </div>

        <Tabs defaultValue="search" className="space-y-6">
          <TabsList>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              Search & Redact
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Pattern Library
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            {/* Scope Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Select Scope
                </CardTitle>
                <CardDescription>
                  Choose a project and optionally a batch to search within
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select value={selectedProject || "all"} onValueChange={(val) => setSelectedProject(val === "all" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Batch (Optional)</Label>
                  <Select 
                    value={selectedBatch || "all"} 
                    onValueChange={(val) => setSelectedBatch(val === "all" ? "" : val)}
                    disabled={!selectedProject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Batches in Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Batches</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batch_name} ({batch.total_documents || 0} docs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Batch Redaction Search Component */}
            <BatchRedactionSearch
              projectId={selectedProject || undefined}
              batchId={selectedBatch || undefined}
              onApplyRedactions={handleRedactionsApplied}
            />
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Pattern Presets</CardTitle>
                <CardDescription>
                  Pre-configured pattern groups for common compliance requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(PATTERN_PRESETS).map(([key, preset]) => (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{preset.label}</h3>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                      <Badge variant="outline">{preset.categories.length} categories</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {preset.categories.map((cat) => {
                        const catInfo = PII_CATEGORIES[cat as keyof typeof PII_CATEGORIES];
                        return (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {catInfo?.label || cat}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PII Detection Categories</CardTitle>
                <CardDescription>
                  All available categories for PII detection and redaction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(PII_CATEGORIES).map(([key, info]) => (
                    <div key={key} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Badge 
                        variant={info.severity === 'critical' ? 'destructive' : info.severity === 'high' ? 'default' : 'secondary'}
                        className="shrink-0"
                      >
                        {info.severity}
                      </Badge>
                      <span className="font-medium">{info.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Redaction History</CardTitle>
                <CardDescription>
                  Recent batch redaction operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No redaction history found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {history.map((entry) => (
                        <div key={entry.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">
                              {new Date(entry.created_at).toLocaleString()}
                            </span>
                            <Badge variant={entry.success ? 'default' : 'destructive'}>
                              {entry.success ? 'Success' : 'Failed'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Documents: {entry.metadata?.document_count || 0}</p>
                            <p>
                              Success: {entry.metadata?.success_count || 0} / 
                              Failed: {entry.metadata?.failed_count || 0}
                            </p>
                            {entry.metadata?.preset && (
                              <p>Preset: {entry.metadata.preset}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default BatchRedaction;
