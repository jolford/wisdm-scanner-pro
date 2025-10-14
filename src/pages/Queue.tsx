import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanUploader } from '@/components/ScanUploader';
import { PhysicalScanner } from '@/components/PhysicalScanner';
import { ValidationScreen } from '@/components/ValidationScreen';
import { ProjectSelector } from '@/components/ProjectSelector';
import { BatchSelector } from '@/components/BatchSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Settings, Upload, ScanLine, CheckCircle, FileText, Download, Trash2, Eye } from 'lucide-react';
import wisdmLogo from '@/assets/wisdm-logo.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Queue = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  
  // Scan state
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  
  // Validation state
  const [validationDoc, setValidationDoc] = useState<any>(null);
  
  // Queue documents
  const [ocrQueue, setOcrQueue] = useState<any[]>([]);
  const [validationQueue, setValidationQueue] = useState<any[]>([]);
  const [validatedDocs, setValidatedDocs] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (selectedBatchId) {
      loadQueueDocuments();
    }
  }, [selectedBatchId]);

  const loadQueueDocuments = async () => {
    if (!selectedBatchId) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('batch_id', selectedBatchId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOcrQueue([]);
      setValidationQueue(data?.filter(d => d.validation_status === 'pending') || []);
      setValidatedDocs(data?.filter(d => d.validation_status === 'validated') || []);
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  };

  const saveDocument = async (fileName: string, fileType: string, fileUrl: string, text: string, metadata: any) => {
    try {
      const { data, error } = await supabase.from('documents').insert([{
        project_id: selectedProjectId,
        batch_id: selectedBatchId,
        file_name: fileName,
        file_type: fileType,
        file_url: fileUrl,
        extracted_text: text,
        extracted_metadata: metadata,
        uploaded_by: user?.id,
      }]).select().single();

      if (error) throw error;

      if (data) {
        setValidationDoc(data);
        await loadQueueDocuments();
      }

      if (selectedBatchId && selectedBatch) {
        await supabase
          .from('batches')
          .update({ 
            total_documents: (selectedBatch.total_documents || 0) + 1,
            processed_documents: (selectedBatch.processed_documents || 0) + 1
          })
          .eq('id', selectedBatchId);
      }
    } catch (error) {
      console.error('Error saving document:', error);
    }
  };

  const processPdf = async (file: File) => {
    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before uploading',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pdfData = e.target?.result as string;
          const { data, error } = await supabase.functions.invoke('ocr-scan', {
            body: { 
              imageData: pdfData,
              isPdf: true,
              extractionFields: selectedProject?.extraction_fields || []
            },
          });
          
          if (error) throw error;
          
          await saveDocument(file.name, 'application/pdf', pdfData, data.text, data.metadata || {});
          toast({ title: 'PDF Processed', description: 'Text extracted from PDF.' });
        } catch (error: any) {
          console.error('Error processing PDF:', error);
          toast({
            title: 'PDF Processing Failed',
            description: error.message || 'Failed to process the PDF. Please try again.',
            variant: 'destructive',
          });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      toast({
        title: 'PDF Processing Failed',
        description: error.message || 'Failed to process the PDF. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const handleScanComplete = async (text: string, imageUrl: string, fileName = 'scan.jpg') => {
    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before scanning',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: { 
          imageData: imageUrl,
          isPdf: false,
          extractionFields: selectedProject?.extraction_fields || []
        },
      });

      if (error) throw error;

      await saveDocument(fileName, 'image', imageUrl, data.text, data.metadata || {});

      toast({
        title: 'Scan Complete',
        description: 'Text and metadata extracted successfully.',
      });
    } catch (error: any) {
      console.error('Error processing scan:', error);
      toast({
        title: 'Scan Failed',
        description: error.message || 'Failed to process the image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidation = async (status: 'validated' | 'rejected', metadata: Record<string, string>) => {
    if (selectedBatchId && selectedBatch && status === 'validated') {
      await supabase
        .from('batches')
        .update({ 
          validated_documents: (selectedBatch.validated_documents || 0) + 1
        })
        .eq('id', selectedBatchId);
    }
    
    setValidationDoc(null);
    await loadQueueDocuments();
  };

  const handleDeleteDoc = async (docId: string) => {
    setDocToDelete(docId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docToDelete);

      if (error) throw error;

      toast({
        title: 'Document Deleted',
        description: 'Document removed successfully',
      });

      await loadQueueDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    }
  };

  const exportBatchToCSV = async () => {
    if (!validatedDocs.length) {
      toast({
        title: 'No Documents',
        description: 'No validated documents to export',
        variant: 'destructive',
      });
      return;
    }

    const metadataKeys = new Set<string>();
    validatedDocs.forEach(doc => {
      if (doc.extracted_metadata) {
        Object.keys(doc.extracted_metadata).forEach(key => metadataKeys.add(key));
      }
    });

    const headers = ['File Name', 'Date', ...Array.from(metadataKeys)];
    const rows = validatedDocs.map(doc => {
      const row: string[] = [
        doc.file_name,
        new Date(doc.created_at).toLocaleDateString(),
      ];
      
      metadataKeys.forEach(key => {
        row.push(doc.extracted_metadata?.[key] || '');
      });
      
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${selectedBatch?.batch_name || 'export'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Batch exported to CSV',
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 relative overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-[var(--gradient-mesh)] pointer-events-none" />
      
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 bg-background/80 shadow-[var(--shadow-soft)] relative">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl blur-lg opacity-30 animate-pulse" />
                <img src={wisdmLogo} alt="WISDM Logo" className="h-12 w-auto relative drop-shadow-lg" />
              </div>
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Document Processing Queue
                </h1>
                <p className="text-xs text-muted-foreground">Scan → Extract → Validate → Export</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/admin')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative">
        <div className="space-y-6 mb-6 animate-slide-up">
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectSelect={(id, project) => {
              setSelectedProjectId(id);
              setSelectedProject(project);
              setSelectedBatchId(null);
              setSelectedBatch(null);
            }}
          />
          
          {selectedProjectId && (
            <BatchSelector
              selectedBatchId={selectedBatchId}
              onBatchSelect={(id, batch) => {
                setSelectedBatchId(id);
                setSelectedBatch(batch);
              }}
              projectId={selectedProjectId}
            />
          )}
        </div>

        {selectedProjectId && selectedBatchId && (
          <div className="animate-scale-in">
            <Tabs defaultValue="scan" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-card/50 backdrop-blur-sm p-1 rounded-lg shadow-[var(--shadow-soft)]">
                <TabsTrigger value="scan" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Scan
                </TabsTrigger>
                <TabsTrigger value="validation" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Validation ({validationQueue.length})
                </TabsTrigger>
                <TabsTrigger value="validated" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Validated ({validatedDocs.length})
                </TabsTrigger>
                <TabsTrigger value="export" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="scan">
                {validationDoc ? (
                  <ValidationScreen
                    documentId={validationDoc.id}
                    imageUrl={validationDoc.file_url}
                    fileName={validationDoc.file_name}
                    extractedText={validationDoc.extracted_text}
                    metadata={validationDoc.extracted_metadata}
                    projectFields={selectedProject?.extraction_fields || []}
                    onValidate={handleValidation}
                    onSkip={() => setValidationDoc(null)}
                  />
                ) : (
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-card/50 backdrop-blur-sm p-1 rounded-lg">
                      <TabsTrigger value="upload" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </TabsTrigger>
                      <TabsTrigger value="scanner" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
                        <ScanLine className="h-4 w-4 mr-2" />
                        Physical Scanner
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload">
                      <ScanUploader 
                        onScanComplete={handleScanComplete} 
                        onPdfUpload={processPdf}
                        isProcessing={isProcessing} 
                      />
                    </TabsContent>
                    
                    <TabsContent value="scanner">
                      <PhysicalScanner onScanComplete={handleScanComplete} isProcessing={isProcessing} />
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>
              
              <TabsContent value="validation">
                <div className="space-y-4">
                  {validationQueue.length === 0 ? (
                    <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)] border-border/50">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-20" />
                        <Eye className="h-16 w-16 text-muted-foreground relative" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">No Documents Awaiting Validation</h3>
                      <p className="text-muted-foreground">Scan documents to add them to the validation queue</p>
                    </Card>
                  ) : (
                    validationQueue.map((doc) => (
                      <Card key={doc.id} className="p-6 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)] border-border/50 hover:shadow-[var(--shadow-glow)] transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">{doc.file_name}</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              {new Date(doc.created_at).toLocaleString()}
                            </p>
                            {doc.extracted_metadata && Object.keys(doc.extracted_metadata).length > 0 && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <div className="grid md:grid-cols-2 gap-2">
                                  {Object.entries(doc.extracted_metadata).map(([key, value]) => (
                                    <div key={key} className="text-sm">
                                      <span className="font-medium">{key}:</span>{' '}
                                      <span className="text-muted-foreground">{value as string}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => setValidationDoc(doc)}>
                              Validate
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteDoc(doc.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="validated">
                <div className="space-y-4">
                  {validatedDocs.length === 0 ? (
                    <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)] border-border/50">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-20" />
                        <CheckCircle className="h-16 w-16 text-muted-foreground relative" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">No Validated Documents</h3>
                      <p className="text-muted-foreground">Validate documents to see them here</p>
                    </Card>
                  ) : (
                    validatedDocs.map((doc) => (
                      <Card key={doc.id} className="p-6 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)] border-border/50 hover:shadow-[var(--shadow-glow)] transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">{doc.file_name}</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              {new Date(doc.created_at).toLocaleString()}
                            </p>
                            {doc.extracted_metadata && Object.keys(doc.extracted_metadata).length > 0 && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <div className="grid md:grid-cols-2 gap-2">
                                  {Object.entries(doc.extracted_metadata).map(([key, value]) => (
                                    <div key={key} className="text-sm">
                                      <span className="font-medium">{key}:</span>{' '}
                                      <span className="text-muted-foreground">{value as string}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteDoc(doc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="export">
                <Card className="p-8">
                  <div className="text-center mb-6">
                    <Download className="h-16 w-16 mx-auto mb-4 text-primary" />
                    <h3 className="text-2xl font-semibold mb-2">Export Batch</h3>
                    <p className="text-muted-foreground">
                      Export all validated documents from this batch
                    </p>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-6 mb-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{selectedBatch?.total_documents || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Scanned</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{validationQueue.length}</p>
                        <p className="text-sm text-muted-foreground">Awaiting Validation</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">{validatedDocs.length}</p>
                        <p className="text-sm text-muted-foreground">Validated</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 justify-center">
                    <Button onClick={exportBatchToCSV} size="lg" disabled={validatedDocs.length === 0}>
                      <Download className="h-5 w-5 mr-2" />
                      Export to CSV
                    </Button>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document from the batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Queue;
