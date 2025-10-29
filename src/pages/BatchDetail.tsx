import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, FileText, CheckCircle2, XCircle, AlertCircle, Calendar, User, FolderOpen, Download, FileJson, FileSpreadsheet, FileType, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ValidationScreen } from '@/components/ValidationScreen';

const BatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Clear selected document when batch changes to prevent showing wrong image
  useEffect(() => {
    setSelectedDocument(null);
  }, [id]);

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch-detail', id],
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
      
      // Fetch user profile separately
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.created_by)
        .single();

      return {
        ...data,
        profiles: profile || { full_name: '', email: '' }
      };
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

  // Get export config from project metadata
  const getExportConfig = () => {
    const metadata = batch?.projects?.metadata as any;
    return metadata?.exportConfig || {};
  };

  const getEnabledExportTypes = () => {
    const exportConfig = getExportConfig();
    const enabledTypes: string[] = [];
    
    // Check which export types are enabled in the project config
    Object.entries(exportConfig).forEach(([type, config]: [string, any]) => {
      if (config?.enabled) {
        enabledTypes.push(type);
      }
    });
    
    return enabledTypes.length > 0 ? enabledTypes : batch?.projects?.export_types || [];
  };

  const getExportDestination = (type: string) => {
    const exportConfig = getExportConfig();
    return exportConfig[type]?.destination || '/exports/';
  };

  const extractMetadataValue = (value: any): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'value' in value) return value.value;
    return String(value || '');
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
      ...Object.values(doc.extracted_metadata || {}).map(extractMetadataValue)
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const destination = getExportDestination('csv');
    a.download = `${batch?.batch_name || 'batch'}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `CSV file downloaded (configured destination: ${destination})` 
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
    const destination = getExportDestination('json');
    a.download = `${batch?.batch_name || 'batch'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `JSON file downloaded (configured destination: ${destination})` 
    });
  };

  const exportToTXT = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const text = documents.map(doc => {
      const metadata = Object.entries(doc.extracted_metadata || {})
        .map(([key, value]) => `${key}: ${extractMetadataValue(value)}`)
        .join('\n');
      return `File: ${doc.file_name}\nStatus: ${doc.validation_status}\nPage: ${doc.page_number}\n${metadata}\n\nExtracted Text:\n${doc.extracted_text || 'N/A'}\n\n${'='.repeat(80)}\n`;
    }).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const destination = getExportDestination('txt');
    a.download = `${batch?.batch_name || 'batch'}-export.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `Text file downloaded (configured destination: ${destination})` 
    });
  };

  const exportToXML = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const xmlDocs = documents.map(doc => {
      const metadata = Object.entries(doc.extracted_metadata || {})
        .map(([key, value]) => `    <${key}>${extractMetadataValue(value)}</${key}>`)
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
    const destination = getExportDestination('xml');
    a.download = `${batch?.batch_name || 'batch'}-export.xml`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `XML file downloaded (configured destination: ${destination})` 
    });
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
          <Button onClick={() => navigate('/batches')}>Back to Batches</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 pb-32">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <FolderOpen className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">{batch.batch_name}</h1>
              <Badge className={getStatusColor(batch.status)}>
                {batch.status}
              </Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!documents || documents.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Batch
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
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Project: {batch.projects?.name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(batch.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {batch.profiles?.full_name || batch.profiles?.email}
              </span>
            </div>
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

        {/* Batch Custom Fields */}
        {(batch.metadata as any)?.custom_fields && Object.keys((batch.metadata as any).custom_fields).length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Batch Custom Fields
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries((batch.metadata as any).custom_fields).map(([key, value]) => (
                <div key={key} className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{key}</p>
                  <p className="font-medium">{value as string}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              These fields are included in all exports for this batch
            </p>
          </Card>
        )}

        {/* Documents List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents ({documents?.length || 0})
          </h2>
          
          {selectedDocument ? (
            <div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedDocument(null)}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
              <ValidationScreen
                documentId={selectedDocument.id}
                imageUrl={selectedDocument.file_url}
                fileName={selectedDocument.file_name}
                extractedText={selectedDocument.extracted_text || ''}
                metadata={selectedDocument.extracted_metadata || {}}
                boundingBoxes={selectedDocument.bounding_boxes || {}}
                wordBoundingBoxes={selectedDocument.word_bounding_boxes || []}
                projectFields={(batch.projects?.extraction_fields as Array<{ name: string; description: string }>) || []}
                projectName={batch.projects?.name}
                enableSignatureVerification={(batch.projects as any)?.enable_signature_verification || false}
                onValidate={async () => {
                  setSelectedDocument(null);
                }}
                onSkip={() => setSelectedDocument(null)}
              />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getValidationStatusIcon(doc.validation_status)}
                    <div className="flex-1">
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type} • Page {doc.page_number}
                        {doc.confidence_score && ` • ${doc.confidence_score}% confidence`}
                      </p>
                      
                      {doc.extracted_metadata && Object.keys(doc.extracted_metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <div className="grid md:grid-cols-3 gap-2">
                            {Object.entries(doc.extracted_metadata).map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="font-medium">{key}:</span>{' '}
                                <span className="text-muted-foreground">{extractMetadataValue(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.needs_review ? 'destructive' : 'secondary'}>
                      {doc.validation_status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Validate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents in this batch yet</p>
            </div>
          )}
        </Card>

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
