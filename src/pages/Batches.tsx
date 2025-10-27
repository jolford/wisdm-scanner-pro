import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, FolderOpen, Search, Calendar, User, FileText, Trash2, ArrowRight, Download, HelpCircle, LayoutGrid, List, CheckCircle2, Clock, AlertCircle, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Batch {
  id: string;
  batch_name: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  total_documents: number;
  validated_documents: number;
  created_by: string;
  project_id: string;
  projects: {
    name: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

const Batches = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(preferences?.default_batch_view || 'grid');

  // Update view mode when preferences load
  useEffect(() => {
    if (preferences?.default_batch_view) {
      setViewMode(preferences.default_batch_view);
    }
  }, [preferences?.default_batch_view]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else {
        loadBatches();
      }
    }
  }, [authLoading, user, navigate]);

  const loadBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          projects(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch user profiles separately
      const batchesWithProfiles = await Promise.all((data || []).map(async (batch) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', batch.created_by)
          .single();
        
        return {
          ...batch,
          profiles: profile || { full_name: '', email: '' }
        };
      }));

      setBatches(batchesWithProfiles as any);
    } catch (error) {
      console.error('Error loading batches:', error);
      toast({
        title: 'Error',
        description: 'Failed to load batches',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteBatch = async (e: React.MouseEvent, batchId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this batch? This action cannot be undone.')) {
      return;
    }

    try {
      // First, delete any scanner import logs that reference this batch
      const { error: logsError } = await supabase
        .from('scanner_import_logs')
        .delete()
        .eq('batch_id', batchId);

      if (logsError) throw logsError;

      // Then delete the batch
      const { error } = await supabase.from('batches').delete().eq('id', batchId);
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Batch deleted successfully',
      });
      
      loadBatches();
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete batch',
        variant: 'destructive',
      });
    }
  };

  const openBatchQueue = async (e: React.MouseEvent, batch: Batch) => {
    e.stopPropagation();
    
    // Map batch status to queue tab
    const statusToTab: Record<string, string> = {
      'new': 'scan',
      'scanning': 'scan',
      'indexing': 'validation',
      'validation': 'validation',
      'validated': 'export',
      'complete': 'export',
      'exported': 'export',
    };
    
    const tab = statusToTab[batch.status] || 'scan';
    
    // Navigate to queue with batch context stored in sessionStorage
    sessionStorage.setItem('selectedBatchId', batch.id);
    sessionStorage.setItem('selectedProjectId', batch.project_id);
    
    navigate(`/?tab=${tab}`);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-500',
      scanning: 'bg-purple-500',
      indexing: 'bg-yellow-500',
      validation: 'bg-orange-500',
      validated: 'bg-teal-500',
      complete: 'bg-green-500',
      exported: 'bg-gray-500',
      error: 'bg-red-500',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      new: Package,
      scanning: Clock,
      indexing: Clock,
      validation: AlertCircle,
      validated: CheckCircle2,
      complete: CheckCircle2,
      exported: CheckCircle2,
      error: AlertCircle,
    };
    return icons[status as keyof typeof icons] || Package;
  };

  const getStatusBorderColor = (status: string) => {
    const colors = {
      new: 'border-l-blue-500',
      scanning: 'border-l-purple-500',
      indexing: 'border-l-yellow-500',
      validation: 'border-l-orange-500',
      validated: 'border-l-teal-500',
      complete: 'border-l-green-500',
      exported: 'border-l-gray-500',
      error: 'border-l-red-500',
    };
    return colors[status as keyof typeof colors] || 'border-l-gray-500';
  };

  const getProgressPercentage = (batch: Batch) => {
    if (batch.total_documents === 0) return 0;
    return Math.round((batch.validated_documents / batch.total_documents) * 100);
  };

  const filteredBatches = batches.filter(batch =>
    batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
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
                <h1 className="text-xl font-bold">Batch Queue</h1>
                <p className="text-xs text-muted-foreground">View all document batches</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log('Help button clicked - navigating to /help');
                  navigate('/help');
                }}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </Button>
              <Button variant="outline" onClick={() => navigate('/settings')}>
                <User className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="default" onClick={() => navigate('/')}>
                <Download className="h-4 w-4 mr-2" />
                Go to Queue
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search batches, projects, or users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {filteredBatches.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              {batches.length === 0 ? 'No Batches Yet' : 'No Matching Batches'}
            </h3>
            <p className="text-muted-foreground">
              {batches.length === 0 
                ? 'Create a batch to start processing documents' 
                : 'Try a different search term'}
            </p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBatches.map((batch) => {
              const StatusIcon = getStatusIcon(batch.status);
              const progressPercent = getProgressPercentage(batch);
              
              return (
                <Card 
                  key={batch.id} 
                  className={`group relative overflow-hidden border-l-4 ${getStatusBorderColor(batch.status)} bg-gradient-to-br from-card via-card to-card/80 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1`}
                  onClick={() => navigate(`/batches/${batch.id}`)}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 pr-2">
                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2 group-hover:text-primary transition-colors">
                          <FolderOpen className="h-5 w-5 text-primary" />
                          <span className="line-clamp-2">{batch.batch_name}</span>
                        </h3>
                        <Badge className={`${getStatusColor(batch.status)} text-white`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {batch.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="outline"
                          className="hover:bg-primary hover:text-primary-foreground"
                          onClick={(e) => openBatchQueue(e, batch)}
                          title="Open batch in queue"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => deleteBatch(e, batch.id)}
                          title="Delete batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{batch.projects?.name || 'N/A'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{batch.profiles?.full_name || batch.profiles?.email || 'Unknown'}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-foreground">{batch.total_documents}</div>
                        <div className="text-xs text-muted-foreground">Total Docs</div>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-primary">{batch.validated_documents}</div>
                        <div className="text-xs text-muted-foreground">Validated</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-primary">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((batch) => {
              const StatusIcon = getStatusIcon(batch.status);
              const progressPercent = getProgressPercentage(batch);
              
              return (
                <Card 
                  key={batch.id} 
                  className={`group border-l-4 ${getStatusBorderColor(batch.status)} bg-gradient-to-r from-card via-card to-card/80 shadow-sm hover:shadow-lg transition-all cursor-pointer`}
                  onClick={() => navigate(`/batches/${batch.id}`)}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold truncate group-hover:text-primary transition-colors">{batch.batch_name}</h3>
                            <Badge className={`${getStatusColor(batch.status)} text-white shrink-0`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {batch.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1 truncate">
                              <FileText className="h-3 w-3 shrink-0" />
                              {batch.projects?.name || 'N/A'}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Calendar className="h-3 w-3" />
                              {new Date(batch.created_at).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1 truncate">
                              <User className="h-3 w-3 shrink-0" />
                              {batch.profiles?.full_name || batch.profiles?.email || 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                        {/* Progress */}
                        <div className="w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold text-primary">{progressPercent}%</span>
                          </div>
                          <Progress value={progressPercent} className="h-1.5" />
                        </div>
                        
                        {/* Stats */}
                        <div className="flex gap-4 text-sm">
                          <div className="text-right">
                            <div className="font-bold text-foreground">{batch.total_documents}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">{batch.validated_documents}</div>
                            <div className="text-xs text-muted-foreground">Validated</div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="outline"
                            className="hover:bg-primary hover:text-primary-foreground"
                            onClick={(e) => openBatchQueue(e, batch)}
                            title="Open batch in queue"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => deleteBatch(e, batch.id)}
                            title="Delete batch"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Batches;
