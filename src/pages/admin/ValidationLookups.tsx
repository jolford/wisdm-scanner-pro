import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Settings, CheckCircle, XCircle, Database, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  customer_id: string | null;
  metadata: any;
}

export default function ValidationLookups() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, customer_id, metadata')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const projectsWithLookups = filteredProjects.filter(
    p => p.metadata?.validation_lookup_config?.enabled
  );

  const projectsWithoutLookups = filteredProjects.filter(
    p => !p.metadata?.validation_lookup_config?.enabled
  );

  const getSystemBadge = (system: string) => {
    const colors = {
      filebound: 'bg-blue-500/10 text-blue-500',
      docmgt: 'bg-purple-500/10 text-purple-500',
      sql: 'bg-green-500/10 text-green-500',
      excel: 'bg-orange-500/10 text-orange-500',
      csv: 'bg-yellow-500/10 text-yellow-500',
    };
    return colors[system as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-6 space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Validation Lookups</h1>
        <p className="text-muted-foreground mt-2">
          Manage validation lookup configurations for all projects
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-6">
        {projectsWithLookups.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Projects with Validation Lookups ({projectsWithLookups.length})
            </h2>
            <div className="grid gap-4">
              {projectsWithLookups.map((project) => {
                const config = project.metadata?.validation_lookup_config;
                return (
                  <Card key={project.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          {config?.system && (
                            <Badge className={getSystemBadge(config.system)}>
                              {config.system.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        
                        {config?.project && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Project/Table:</span> {config.project}
                          </p>
                        )}
                        
                        {config?.excelFileName && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">File:</span> {config.excelFileName}
                          </p>
                        )}
                        
                        {config?.lookupFields && config.lookupFields.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium text-muted-foreground">Lookup Fields: </span>
                            <span className="text-muted-foreground">
                              {config.lookupFields.filter(f => f.lookupEnabled).length} enabled
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {projectsWithLookups.length === 0 && (
          <Card className="p-8 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Validation Lookups Configured</h3>
            <p className="text-muted-foreground mb-4">
              No projects have validation lookup configurations enabled. Configure lookup validation in project settings to get started.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/projects')}
            >
              View Projects
            </Button>
          </Card>
        )}

        {filteredProjects.length === 0 && (
          <Card className="p-8 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No projects match your search' : 'Create a project to get started'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
