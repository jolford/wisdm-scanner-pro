import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  extracted_metadata: any;
  extracted_text: string;
  batch_id: string;
  project_id: string;
  created_at: string;
  batch?: {
    batch_name: string;
  };
  project?: {
    name: string;
    extraction_fields: any;
    metadata: any;
  };
}

const DocumentReprocessing = () => {
  const navigate = useNavigate();
  const { loading: authLoading, isAdmin } = useRequireAuth(true);
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadBadDocuments();
    }
  }, [authLoading, isAdmin]);

  const loadBadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          batch:batches(batch_name),
          project:projects(name, extraction_fields, metadata)
        `)
        .or('extracted_metadata.is.null,extracted_metadata.eq.{}')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error Loading Documents',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (docId: string) => {
    setSelectedDocs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map((d) => d.id)));
    }
  };

  const reprocessDocuments = async () => {
    if (selectedDocs.size === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select documents to reprocess',
        variant: 'destructive',
      });
      return;
    }

    setReprocessing(true);
    const docsToProcess = documents.filter((d) => selectedDocs.has(d.id));
    setProgress({ current: 0, total: docsToProcess.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < docsToProcess.length; i++) {
      const doc = docsToProcess[i];
      setProgress({ current: i + 1, total: docsToProcess.length });

      try {
        // Get extraction fields from project
        const extractionFields = Array.isArray(doc.project?.extraction_fields) 
          ? doc.project.extraction_fields 
          : [];
        const tableFields = doc.project?.metadata?.table_extraction_config?.enabled
          ? doc.project?.metadata?.table_extraction_config?.fields || []
          : [];
        const enableMICR = Boolean(doc.project?.metadata?.enable_check_scanning?.enabled);

        // Determine if this is a PDF or image
        const isPdf = doc.file_type === 'application/pdf';
        
        let requestBody: any = {
          extractionFields,
          tableExtractionFields: tableFields,
          enableCheckScanning: enableMICR,
          documentId: doc.id,
        };

        if (isPdf && doc.extracted_text) {
          // For PDFs, reuse the extracted text if available
          requestBody.textData = doc.extracted_text;
          requestBody.isPdf = true;
        } else {
          // For images or PDFs without text, we need the image data
          // Get a signed URL first
          const { data: signedUrlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.file_url.split('/documents/')[1], 60);

          if (!signedUrlData?.signedUrl) {
            throw new Error('Failed to get signed URL');
          }

          // Fetch the file and convert to base64
          const response = await fetch(signedUrlData.signedUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          requestBody.imageData = base64;
          requestBody.isPdf = isPdf;
        }

        // Call OCR function
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-scan', {
          body: requestBody,
        });

        if (ocrError) throw ocrError;

        // Update document with new data
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            extracted_text: ocrData.text,
            extracted_metadata: ocrData.metadata || {},
            line_items: ocrData.lineItems || [],
          })
          .eq('id', doc.id);

        if (updateError) throw updateError;

        successCount++;
      } catch (error: any) {
        console.error(`Failed to reprocess ${doc.file_name}:`, error);
        failCount++;
      }
    }

    setReprocessing(false);
    setProgress({ current: 0, total: 0 });
    setSelectedDocs(new Set());

    toast({
      title: 'Reprocessing Complete',
      description: `Successfully reprocessed ${successCount} documents. Failed: ${failCount}`,
    });

    // Check if all processed docs belong to the same batch
    const batchIds = [...new Set(docsToProcess.map(d => d.batch_id).filter(Boolean))];
    
    if (batchIds.length === 1 && successCount > 0 && batchIds[0]) {
      // All docs from same batch, navigate to batch validation
      const firstDoc = docsToProcess[0];
      const batchId = batchIds[0];
      
      // Store batch info in session storage
      sessionStorage.setItem('selectedBatch', JSON.stringify({
        id: batchId,
        name: firstDoc?.batch?.batch_name || 'Unknown Batch'
      }));
      
      // Also store project info if available
      if (firstDoc?.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', firstDoc.project_id)
          .single();
        
        if (projectData) {
          sessionStorage.setItem('selectedProject', JSON.stringify(projectData));
        }
      }
      
      navigate(`/queue?tab=validation`);
    } else {
      // Mixed batches or no batch, just reload the list
      loadBadDocuments();
    }
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="Document Reprocessing">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Document Reprocessing" 
      description="Reprocess documents with empty or incorrect metadata"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documents with Bad Metadata</CardTitle>
              <CardDescription>
                Found {documents.length} documents with empty or missing metadata
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={loadBadDocuments}
                disabled={loading || reprocessing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={reprocessDocuments}
                disabled={selectedDocs.size === 0 || reprocessing}
              >
                {reprocessing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Reprocessing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reprocess Selected ({selectedDocs.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reprocessing && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Processing {progress.current} of {progress.total}</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-medium">All documents processed successfully!</p>
              <p className="text-muted-foreground">No documents need reprocessing</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDocs.size === documents.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDocs.has(doc.id)}
                          onCheckedChange={() => toggleDocument(doc.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{doc.file_name}</TableCell>
                      <TableCell>{doc.batch?.batch_name || 'N/A'}</TableCell>
                      <TableCell>{doc.project?.name || 'N/A'}</TableCell>
                      <TableCell>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          Empty Metadata
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default DocumentReprocessing;
