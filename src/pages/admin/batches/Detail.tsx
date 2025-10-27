import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, CheckCircle2, XCircle, AlertCircle, Trash2, Download, FileSpreadsheet, FileJson, FileType, Cloud, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const BatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          projects (name, extraction_fields, metadata, export_types)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: documents } = useQuery({
    queryKey: ['batch-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('batch_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('batches')
        .update({ status: newStatus as any })
        .eq('id', id);

      if (error) throw error;

      // Trigger automatic export when moving to 'exported' status
      if (newStatus === 'exported') {
        toast({
          title: 'Exporting...',
          description: 'Automatically exporting batch to configured destinations',
        });

        const { data, error: exportError } = await supabase.functions.invoke('auto-export-batch', {
          body: { batchId: id }
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
      toast({
        title: 'Status Updated',
        description: 'Batch status has been updated successfully',
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async () => {
      // Use secure backend function to handle cascading deletes
      const { data, error } = await supabase.functions.invoke('delete-batch-safe', {
        body: { batchId: id },
      });

      if (error || (data && (data as any).error)) {
        throw new Error(error?.message || (data as any)?.error || 'Delete failed');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Batch Deleted',
        description: 'Batch and all its documents have been deleted',
      });
      navigate('/admin/batches');
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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

  const getValidationStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'needs_review':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Export functions
  const getExportConfig = () => {
    const metadata = batch?.projects?.metadata as any;
    return metadata?.export_config || metadata?.exportConfig || {};
  };

  const getEnabledExportTypes = () => {
    const exportConfig = getExportConfig();
    const enabledTypes: string[] = [];
    
    // Check standard export types
    Object.entries(exportConfig).forEach(([type, config]: [string, any]) => {
      if (config?.enabled) {
        enabledTypes.push(type);
      }
    });
    
    // Check ECM systems
    if (exportConfig.filebound?.enabled) {
      enabledTypes.push('filebound');
    }
    if (exportConfig.docmgt?.enabled) {
      enabledTypes.push('docmgt');
    }
    
    return enabledTypes.length > 0 ? enabledTypes : batch?.projects?.export_types || [];
  };

  const getExportDestination = (type: string) => {
    const exportConfig = getExportConfig();
    return exportConfig[type]?.destination || '/exports/';
  };

  const exportToCSV = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const headers = ['File Name', 'Status', 'Page', 'Confidence', 'Type', ...Object.keys(documents[0].extracted_metadata || {})];
    const rows = documents.map(doc => [
      doc.file_name,
      doc.validation_status,
      doc.page_number,
      doc.confidence_score || '',
      doc.file_type,
      ...Object.values(doc.extracted_metadata || {})
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `CSV file downloaded (configured destination: ${getExportDestination('csv')})` 
    });
  };

  const exportToJSON = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const exportData = {
      batch: {
        id: batch?.id,
        name: batch?.batch_name,
        status: batch?.status,
        created_at: batch?.created_at,
        total_documents: batch?.total_documents,
        validated_documents: batch?.validated_documents,
      },
      documents: documents.map(doc => ({
        file_name: doc.file_name,
        validation_status: doc.validation_status,
        page_number: doc.page_number,
        confidence_score: doc.confidence_score,
        file_type: doc.file_type,
        extracted_metadata: doc.extracted_metadata,
        extracted_text: doc.extracted_text,
      }))
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `JSON file downloaded (configured destination: ${getExportDestination('json')})` 
    });
  };

  const exportToTXT = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const text = documents.map(doc => {
      const metadata = Object.entries(doc.extracted_metadata || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      return `File: ${doc.file_name}\nStatus: ${doc.validation_status}\nPage: ${doc.page_number}\n${metadata}\n\nExtracted Text:\n${doc.extracted_text || 'N/A'}\n\n${'='.repeat(80)}\n`;
    }).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `Text file downloaded (configured destination: ${getExportDestination('txt')})` 
    });
  };

  const exportToXML = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const xmlDocs = documents.map(doc => {
      const metadata = Object.entries(doc.extracted_metadata || {})
        .map(([key, value]) => `    <${key}>${value}</${key}>`)
        .join('\n');
      return `  <document>
    <file_name>${doc.file_name}</file_name>
    <validation_status>${doc.validation_status}</validation_status>
    <page_number>${doc.page_number}</page_number>
    <confidence_score>${doc.confidence_score || ''}</confidence_score>
    <file_type>${doc.file_type}</file_type>
    <metadata>
${metadata}
    </metadata>
    <extracted_text>${doc.extracted_text || ''}</extracted_text>
  </document>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<batch>
  <name>${batch?.batch_name}</name>
  <status>${batch?.status}</status>
  <documents>
${xmlDocs}
  </documents>
</batch>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.xml`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `XML file downloaded (configured destination: ${getExportDestination('xml')})` 
    });
  };

  const exportToFilebound = async () => {
    const exportConfig = getExportConfig();
    const fileboundConfig = exportConfig?.filebound;
    
    if (!fileboundConfig?.enabled || !fileboundConfig.url) {
      toast({ 
        title: 'Filebound not configured', 
        description: 'Please configure Filebound export in project settings first',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('export-to-filebound', {
        body: {
          batchId: id,
          fileboundUrl: fileboundConfig.url,
          username: fileboundConfig.username,
          password: fileboundConfig.password,
          project: fileboundConfig.project,
          fieldMappings: fileboundConfig.fieldMappings || {}
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: 'Export successful', 
          description: `Exported to Filebound project: ${fileboundConfig.project}` 
        });
        queryClient.invalidateQueries({ queryKey: ['batch', id] });
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Filebound export error:', error);
      toast({ 
        title: 'Export failed', 
        description: error.message || 'Failed to export to Filebound',
        variant: 'destructive'
      });
    }
  };

  const exportToDocmgt = async () => {
    const exportConfig = getExportConfig();
    const docmgtConfig = exportConfig?.docmgt;
    
    if (!docmgtConfig?.enabled || !docmgtConfig.url) {
      toast({ 
        title: 'Docmgt not configured', 
        description: 'Please configure Docmgt export in project settings first',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('export-to-docmgt', {
        body: {
          batchId: id,
          docmgtUrl: docmgtConfig.url,
          username: docmgtConfig.username,
          password: docmgtConfig.password,
          project: docmgtConfig.project,
          recordTypeId: docmgtConfig.recordTypeId,
          fieldMappings: docmgtConfig.fieldMappings || {}
        },
      });

      if (error) {
        console.error('Docmgt invocation error:', error);
        throw new Error(error.message || 'Failed to invoke export function');
      }

      if (data?.success) {
        toast({ 
          title: 'Export successful', 
          description: data.message || `Successfully exported ${data.results?.length || 0} documents to Docmgt` 
        });
        queryClient.invalidateQueries({ queryKey: ['batch', id] });
      } else {
        // Show detailed error with available record types if provided
        let errorMsg = data?.error || data?.message || 'Export failed';
        if (data?.availableRecordTypes && data.availableRecordTypes.length > 0) {
          errorMsg += '\n\nAvailable RecordTypes: ' + 
            data.availableRecordTypes.map((rt: any) => `${rt.name} (ID: ${rt.id})`).join(', ');
        }
        console.error('Docmgt export failed:', data);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Docmgt export error:', error);
      toast({ 
        title: 'Export failed', 
        description: error.message || 'Failed to export to Docmgt. Check console for details.',
        variant: 'destructive',
        duration: 10000, // Show for 10 seconds for long error messages
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Batch Not Found</h2>
          <Button onClick={() => navigate('/admin/batches')}>Back to Batches</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/admin/batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{batch.batch_name}</h1>
              <Badge className={getStatusColor(batch.status)}>
                {batch.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Project: {batch.projects?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!documents || documents.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {getEnabledExportTypes().includes('csv') && (
                  <DropdownMenuItem onClick={exportToCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('json') && (
                  <DropdownMenuItem onClick={exportToJSON}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('xml') && (
                  <DropdownMenuItem onClick={exportToXML}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as XML
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('txt') && (
                  <DropdownMenuItem onClick={exportToTXT}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as TXT
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('filebound') && (
                  <DropdownMenuItem onClick={exportToFilebound}>
                    <Cloud className="h-4 w-4 mr-2" />
                    Export to Filebound
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('docmgt') && (
                  <DropdownMenuItem onClick={exportToDocmgt}>
                    <Database className="h-4 w-4 mr-2" />
                    Export to Docmgt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select
              value={batch.status}
              onValueChange={(value) => updateStatusMutation.mutate(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="scanning">Scanning</SelectItem>
                <SelectItem value="indexing">Indexing</SelectItem>
                <SelectItem value="validation">Validation</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="exported">Exported</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this batch and all {documents?.length || 0} documents in it. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteBatchMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Documents</p>
            <p className="text-3xl font-bold">{batch.total_documents}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Processed</p>
            <p className="text-3xl font-bold">{batch.processed_documents}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Validated</p>
            <p className="text-3xl font-bold">{batch.validated_documents}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Errors</p>
            <p className="text-3xl font-bold text-destructive">{batch.error_count}</p>
          </Card>
        </div>

        {/* Documents List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents ({documents?.length || 0})
          </h2>
          
          {documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getValidationStatusIcon(doc.validation_status)}
                    <div>
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type} • Page {doc.page_number}
                        {doc.confidence_score && ` • ${doc.confidence_score}% confidence`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.needs_review ? 'destructive' : 'secondary'}>
                      {doc.validation_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents in this batch yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/')}
              >
                Start Scanning
              </Button>
            </div>
          )}
        </Card>

        {/* Export Information */}
        {batch.exported_at && (
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Export Information
            </h3>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Exported At:</span>{' '}
                <span className="text-muted-foreground">
                  {new Date(batch.exported_at).toLocaleString()}
                </span>
              </p>
              {batch.metadata && typeof batch.metadata === 'object' && 'exports' in batch.metadata && Array.isArray(batch.metadata.exports) && batch.metadata.exports.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Exported Files:</p>
                  <div className="space-y-2">
                    {batch.metadata.exports.map((exp: any, idx: number) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{exp.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              Type: {exp.type.toUpperCase()} • Destination: {exp.destination}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700">
                            Exported
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {batch.notes && (
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-2">Notes</h3>
            <p className="text-muted-foreground">{batch.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BatchDetail;
