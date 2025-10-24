import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, ArrowLeft, FolderOpen, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import wisdmLogo from '@/assets/wisdm-logo.png';

interface Project {
  id: string;
  name: string;
  description: string;
  extraction_fields: any;
  created_at: string;
}

const Projects = () => {
  const { loading } = useRequireAuth(true);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!loading) {
      loadProjects();
    }
  }, [loading]);

  const loadProjects = async () => {
    try {
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id, created_at')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Use get_project_safe to fetch full project data securely
      if (allProjects && allProjects.length > 0) {
        const projectPromises = allProjects.map(p => 
          supabase.rpc('get_project_safe', { project_id: p.id }).single()
        );
        const results = await Promise.all(projectPromises);
        const projects = results
          .filter(r => !r.error && r.data)
          .map(r => r.data as any as Project);
        setProjects(projects);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  if (loading || loadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-xl font-bold">Projects</h1>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/admin/projects/new')} className="bg-gradient-to-r from-primary to-accent">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {projects.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first project to start extracting metadata from documents
            </p>
            <Button onClick={() => navigate('/admin/projects/new')} className="bg-gradient-to-r from-primary to-accent">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)] hover:shadow-[var(--shadow-glow)] transition-all">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Extraction Fields:</p>
                  <div className="flex flex-wrap gap-2">
                    {(project.extraction_fields as any[])?.slice(0, 3).map((field, idx) => (
                      <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {field.name}
                      </span>
                    ))}
                    {(project.extraction_fields as any[])?.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{(project.extraction_fields as any[]).length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Projects;
