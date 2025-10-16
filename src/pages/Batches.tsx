import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FolderOpen, Search, Calendar, User, FileText, Trash2, ArrowRight, Download, HelpCircle, LayoutGrid, List } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  const progressBatch = async (e: React.MouseEvent, batchId: string, currentStatus: string) => {
    e.stopPropagation();
    
    const statusFlow = ['new', 'scanning', 'indexing', 'validation', 'validated', 'exported'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    
    if (currentIndex === -1 || currentIndex === statusFlow.length - 1) {
      toast({
        title: 'Info',
        description: 'Batch is already at final status',
      });
      return;
    }

    const nextStatus = statusFlow[currentIndex + 1];

    try {
      const { error } = await supabase
        .from('batches')
        .update({ status: nextStatus as any })
        .eq('id', batchId);

      if (error) throw error;

      // Trigger automatic export when moving to 'exported' status
      if (nextStatus === 'exported') {
        toast({
          title: 'Exporting...',
          description: 'Automatically exporting batch to configured destinations',
        });

        const { data, error: exportError } = await supabase.functions.invoke('auto-export-batch', {
          body: { batchId }
        });

        if (exportError) {
          console.error('Auto-export error:', exportError);
          toast({
            title: 'Export Warning',
            description: 'Batch status updated but auto-export failed. You can manually export from batch details.',
            variant: 'destructive',
          });
        } else if (data?.success) {
          toast({
            title: 'Batch Exported',
            description: `Successfully exported to ${data.exports?.length || 0} format(s)`,
          });
        }
      } else {
        toast({
          title: 'Success',
          description: `Batch moved to ${nextStatus}`,
        });
      }
      
      loadBatches();
    } catch (error) {
      console.error('Error updating batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to update batch status',
        variant: 'destructive',
      });
    }
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
              <Button variant="outline" onClick={() => navigate('/help')}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </Button>
              <Button variant="default" onClick={() => navigate('/?tab=export')}>
                <Download className="h-4 w-4 mr-2" />
                Export Queue
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
            {filteredBatches.map((batch) => (
              <Card 
                key={batch.id} 
                className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)] hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/batches/${batch.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      {batch.batch_name}
                    </h3>
                    <Badge className={getStatusColor(batch.status)}>
                      {batch.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => progressBatch(e, batch.id, batch.status)}
                      title="Progress to next status"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={(e) => deleteBatch(e, batch.id)}
                      title="Delete batch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Project: {batch.projects?.name || 'N/A'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{batch.profiles?.full_name || batch.profiles?.email || 'Unknown'}</span>
                  </div>

                  <div className="pt-3 border-t flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {batch.total_documents} documents
                    </span>
                    <span className="text-primary font-medium">
                      {batch.validated_documents} validated
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((batch) => (
              <Card 
                key={batch.id} 
                className="p-4 bg-gradient-to-r from-card to-card/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/batches/${batch.id}`)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{batch.batch_name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {batch.projects?.name || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(batch.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {batch.profiles?.full_name || batch.profiles?.email || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-sm text-right">
                      <div className="text-muted-foreground">{batch.total_documents} docs</div>
                      <div className="text-primary font-medium">{batch.validated_documents} validated</div>
                    </div>
                    <Badge className={getStatusColor(batch.status)}>
                      {batch.status}
                    </Badge>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={(e) => progressBatch(e, batch.id, batch.status)}
                        title="Progress to next status"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={(e) => deleteBatch(e, batch.id)}
                        title="Delete batch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Batches;
