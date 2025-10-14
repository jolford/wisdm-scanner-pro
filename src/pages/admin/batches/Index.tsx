import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, FolderOpen, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const BatchesIndex = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          projects (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-500',
      scanning: 'bg-purple-500',
      indexing: 'bg-yellow-500',
      validation: 'bg-orange-500',
      complete: 'bg-green-500',
      exported: 'bg-gray-500',
      error: 'bg-red-500',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      new: FolderOpen,
      scanning: Clock,
      indexing: Clock,
      validation: AlertCircle,
      complete: CheckCircle2,
      exported: CheckCircle2,
      error: AlertCircle,
    };
    const Icon = icons[status as keyof typeof icons] || FolderOpen;
    return <Icon className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Batch Management</h1>
              <p className="text-muted-foreground">Manage document processing batches</p>
            </div>
          </div>
          <Button onClick={() => navigate('/admin/batches/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Batch
          </Button>
        </div>

        <div className="grid gap-4">
          {batches?.map((batch) => (
            <Card
              key={batch.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/batches/${batch.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{batch.batch_name}</h3>
                    <Badge className={getStatusColor(batch.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(batch.status)}
                        {batch.status}
                      </span>
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Project: {batch.projects?.name}
                  </p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Total Docs</p>
                      <p className="text-2xl font-bold">{batch.total_documents}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Processed</p>
                      <p className="text-2xl font-bold">{batch.processed_documents}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Validated</p>
                      <p className="text-2xl font-bold">{batch.validated_documents}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Errors</p>
                      <p className="text-2xl font-bold text-destructive">{batch.error_count}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {!batches || batches.length === 0 && (
          <Card className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Batches Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first batch to start processing documents
            </p>
            <Button onClick={() => navigate('/admin/batches/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Batch
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BatchesIndex;
