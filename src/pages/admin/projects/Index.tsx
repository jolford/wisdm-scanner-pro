import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeft, FolderOpen, Edit, Search, SortAsc, FileText, LayoutGrid, Table as TableIcon, List, Package, Folder, Star, Bookmark, Briefcase, Layers, Box, Grid3x3, LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { EmptyState } from '@/components/ui/empty-state';

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  star: Star,
  bookmark: Bookmark,
  briefcase: Briefcase,
  layers: Layers,
  box: Box,
  grid: Grid3x3,
  package: Package,
};

// Returns either a Lucide icon ID or a custom URL
const resolveIcon = (iconUrl: string | null): { type: 'lucide' | 'url', value: string } | null => {
  if (!iconUrl) return null;
  
  // Check if it's a Lucide icon ID
  if (LUCIDE_ICON_MAP[iconUrl.toLowerCase()]) {
    return { type: 'lucide', value: iconUrl.toLowerCase() };
  }
  
  // Otherwise it's a custom uploaded URL
  return { type: 'url', value: iconUrl };
};

interface Project {
  id: string;
  name: string;
  description: string;
  extraction_fields: any;
  created_at: string;
  customer_id: string | null;
  icon_url: string | null;
}

// Extend the RPC return type to include icon_url
interface ProjectSafeResult extends Project {
  enable_check_scanning?: boolean;
  enable_signature_verification?: boolean;
  export_types?: string[];
  queues?: any;
  metadata?: any;
}

interface Customer {
  id: string;
  company_name: string;
}

const Projects = () => {
  const { loading } = useRequireAuth(true);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'fields'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'list'>('grid');
  const [groupByCustomer, setGroupByCustomer] = useState(false);

  useEffect(() => {
    if (!loading) {
      loadProjects();
    }
  }, [loading]);

  const loadProjects = async () => {
    try {
      // Load customers first
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name');
      
      if (customersData) setCustomers(customersData);

      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id, created_at, customer_id')
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
          .map(r => {
            const data = r.data as unknown as ProjectSafeResult;
            return {
              id: data.id,
              name: data.name,
              description: data.description,
              extraction_fields: data.extraction_fields,
              created_at: data.created_at,
              customer_id: data.customer_id,
              icon_url: data.icon_url || null,
            } as Project;
          });
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

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'Unassigned';
    return customers.find(c => c.id === customerId)?.company_name || 'Unknown';
  };

  const renderProjectsView = (projectsList: Project[]) => {
    if (viewMode === 'table') {
      return (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Fields</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsList.map((project) => (
                <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="w-12">
                    {(() => {
                      const icon = resolveIcon(project.icon_url);
                      if (!icon) {
                        return (
                          <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        );
                      }
                      if (icon.type === 'lucide') {
                        const IconComponent = LUCIDE_ICON_MAP[icon.value];
                        return (
                          <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                        );
                      }
                      return (
                        <img 
                          src={icon.value} 
                          alt={`${project.name} icon`}
                          className="h-8 w-8 object-contain rounded"
                        />
                      );
                    })()}
                  </TableCell>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCustomerName(project.customer_id)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">{project.description || 'No description'}</TableCell>
                  <TableCell className="text-center">
                    <Badge>{(project.extraction_fields as any[])?.length || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(project.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      );
    }

    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
          {projectsList.map((project) => (
            <Card key={project.id} className="p-4 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary/50 hover:border-l-primary">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    {(() => {
                      const icon = resolveIcon(project.icon_url);
                      if (!icon) {
                        return (
                          <div className="h-6 w-6 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        );
                      }
                      if (icon.type === 'lucide') {
                        const IconComponent = LUCIDE_ICON_MAP[icon.value];
                        return (
                          <div className="h-6 w-6 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-4 w-4 text-primary" />
                          </div>
                        );
                      }
                      return (
                        <img 
                          src={icon.value} 
                          alt={`${project.name} icon`}
                          className="h-6 w-6 object-contain rounded flex-shrink-0"
                        />
                      );
                    })()}
                    <h3 className="text-base font-semibold truncate">{project.name}</h3>
                    <Badge variant="outline" className="shrink-0">{getCustomerName(project.customer_id)}</Badge>
                    <Badge className="shrink-0">{(project.extraction_fields as any[])?.length || 0} fields</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{project.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-muted-foreground">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    // Grid view (default)
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projectsList.map((project) => (
          <Card key={project.id} className="group p-5 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-all border-l-4 border-l-primary/50 hover:border-l-primary">
            <div className="mb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {(() => {
                    const icon = resolveIcon(project.icon_url);
                    if (!icon) {
                      return (
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                      );
                    }
                    if (icon.type === 'lucide') {
                      const IconComponent = LUCIDE_ICON_MAP[icon.value];
                      return (
                        <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                      );
                    }
                    return (
                      <img 
                        src={icon.value} 
                        alt={`${project.name} icon`}
                        className="h-8 w-8 object-contain rounded flex-shrink-0"
                      />
                    );
                  })()}
                  <h3 className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              {project.customer_id && (
                <Badge variant="outline" className="mb-2">{getCustomerName(project.customer_id)}</Badge>
              )}
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
    );
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

          {/* Search, Sort, and View Controls */}
          <div className="flex flex-col gap-3">
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

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)} className="w-auto">
                <TabsList>
                  <TabsTrigger value="grid" className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Grid
                  </TabsTrigger>
                  <TabsTrigger value="table" className="gap-2">
                    <TableIcon className="h-4 w-4" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-2">
                    <List className="h-4 w-4" />
                    List
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                variant={groupByCustomer ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByCustomer(!groupByCustomer)}
              >
                {groupByCustomer ? "Ungroup" : "Group by Customer"}
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loadingProjects && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty State - No projects at all */}
        {!loadingProjects && projects.length === 0 && (
          <EmptyState
            icon={Package}
            title="No projects yet"
            description="Get started by creating your first project to begin processing documents."
            action={{
              label: "Create First Project",
              onClick: () => navigate('/admin/projects/new'),
            }}
          />
        )}

        {/* No Results State - After filtering */}
        {!loadingProjects && projects.length > 0 && filteredProjects.length === 0 && (
          <EmptyState
            icon={Search}
            title="No projects found"
            description={`Try adjusting your search${searchQuery ? ` for "${searchQuery}"` : ' or filters'}.`}
          />
        )}

        {/* Projects Views */}
        {!loadingProjects && filteredProjects.length > 0 && groupByCustomer ? (
          <div className="space-y-6">
            {/* Unassigned Projects */}
            {filteredProjects.filter(p => !p.customer_id).length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Unassigned
                  <Badge variant="secondary">{filteredProjects.filter(p => !p.customer_id).length}</Badge>
                </h2>
                {renderProjectsView(filteredProjects.filter(p => !p.customer_id))}
              </div>
            )}
            
            {/* Projects grouped by customer */}
            {customers.map(customer => {
              const customerProjects = filteredProjects.filter(p => p.customer_id === customer.id);
              if (customerProjects.length === 0) return null;
              
              return (
                <div key={customer.id}>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    {customer.company_name}
                    <Badge variant="secondary">{customerProjects.length}</Badge>
                  </h2>
                  {renderProjectsView(customerProjects)}
                </div>
              );
            })}
          </div>
        ) : (
          renderProjectsView(filteredProjects)
        )}
      </main>
    </div>
  );
};

export default Projects;
