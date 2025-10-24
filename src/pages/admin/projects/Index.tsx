import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeft, FolderOpen, Edit, Search, SortAsc, FileText } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'fields'>('date');

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
          .map(r => r.data as unknown as Project);
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

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        const aFields = (a.extraction_fields as any[])?.length || 0;
        const bFields = (b.extraction_fields as any[])?.length || 0;
        return bFields - aFields;
      }
    });

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
      <main className="container mx-auto px-4 py-8">
        {/* Stats and Controls */}
        <div className="mb-6 space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold">{projects.length}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold">{filteredProjects.length}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Edit className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-medium">
                    {projects[0] ? new Date(projects[0].created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Search and Sort Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SortAsc className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Most Recent</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="fields">Field Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? 'No Projects Found' : 'No Projects Yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery 
                ? `No projects match "${searchQuery}"`
                : 'Create your first project to start extracting metadata from documents'
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/admin/projects/new')} className="bg-gradient-to-r from-primary to-accent">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="group p-5 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-all border-l-4 border-l-primary/50 hover:border-l-primary">
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                </div>
                
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Extraction Fields</p>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {(project.extraction_fields as any[])?.length || 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(project.extraction_fields as any[])?.slice(0, 3).map((field, idx) => (
                      <span key={idx} className="text-xs bg-muted text-foreground px-2 py-1 rounded border">
                        {field.name}
                      </span>
                    ))}
                    {(project.extraction_fields as any[])?.length > 3 && (
                      <span className="text-xs text-muted-foreground px-2 py-1">
                        +{(project.extraction_fields as any[]).length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                    className="h-7 text-xs"
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
