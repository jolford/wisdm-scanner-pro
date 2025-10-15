import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanUploader } from '@/components/ScanUploader';
import { PhysicalScanner } from '@/components/PhysicalScanner';
import { BatchValidationScreen } from '@/components/BatchValidationScreen';
import { ProjectSelector } from '@/components/ProjectSelector';
import { BatchSelector } from '@/components/BatchSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Settings, Upload, ScanLine, CheckCircle, Download, Trash2, Eye, FileText, FolderOpen } from 'lucide-react';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { LicenseWarning } from '@/components/LicenseWarning';
import { useLicense } from '@/hooks/use-license';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import jsPDF from 'jspdf';

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Configure PDF.js worker using a dedicated module worker (avoids CDN)
if ((pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
  
}

const Queue = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const { license, hasCapacity, consumeDocuments } = useLicense();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [validationQueue, setValidationQueue] = useState<any[]>([]);
  const [validatedDocs, setValidatedDocs] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scan');

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

      setValidationQueue(data?.filter(d => d.validation_status === 'pending') || []);
      setValidatedDocs(data?.filter(d => d.validation_status === 'validated') || []);
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  };

  const saveDocument = async (fileName: string, fileType: string, fileUrl: string, text: string, metadata: any) => {
    // Check license capacity before saving
    if (!hasCapacity(1)) {
      toast({
        title: 'License Capacity Exceeded',
        description: 'Your license has insufficient document capacity. Please contact your administrator.',
        variant: 'destructive',
      });
      return null;
    }

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

      // Consume license document
      if (data && license) {
        const consumed = await consumeDocuments(data.id, 1);
        if (!consumed) {
          toast({
            title: 'Warning',
            description: 'Document saved but license was not updated',
            variant: 'destructive',
          });
        }
      }

      await loadQueueDocuments();

      if (selectedBatchId && selectedBatch) {
        await supabase
          .from('batches')
          .update({ 
            total_documents: (selectedBatch.total_documents || 0) + 1,
            processed_documents: (selectedBatch.processed_documents || 0) + 1
          })
          .eq('id', selectedBatchId);
      }

      return data;
    } catch (error) {
      console.error('Error saving document:', error);
      return null;
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
      // Extract text from PDF using pdfjs
       let arrayBuffer: ArrayBuffer | null = null;
       let extractedPdfText = '';
      try {
        arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pages = Math.min(pdf.numPages, 5);
        for (let i = 1; i <= pages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = (textContent.items || [])
            .map((item: any) => (item && item.str) ? item.str : '')
            .join(' ');
          extractedPdfText += pageText + '\n';
        }
      } catch (e) {
        console.warn('PDF text extraction failed:', e);
      }

      if (!extractedPdfText || extractedPdfText.trim().length < 10) {
        try {
          // Always re-read file to avoid using a detached ArrayBuffer
          const freshBuffer = await file.arrayBuffer();
          const loadingTask2 = pdfjsLib.getDocument({ data: freshBuffer as ArrayBuffer });
          const pdf2 = await loadingTask2.promise;
          const page1 = await pdf2.getPage(1);
          let viewport = page1.getViewport({ scale: 1.5 });
          const maxDim = 2000;
          const scale = Math.min(1.5, maxDim / Math.max(viewport.width, viewport.height));
          viewport = page1.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          if (!ctx) throw new Error('Canvas context not available');
          await page1.render({ canvasContext: ctx as any, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');

          const { data, error } = await supabase.functions.invoke('ocr-scan', {
            body: { 
              imageData: dataUrl,
              isPdf: false,
              extractionFields: selectedProject?.extraction_fields || []
            },
          });
          if (error) throw error;

          await saveDocument(file.name, 'application/pdf', dataUrl, data.text, data.metadata || {});
          toast({ title: 'PDF Processed via OCR', description: 'Extracted text from rendered PDF page.' });
          setIsProcessing(false);
          return;
        } catch (fallbackErr: any) {
          console.error('PDF image OCR fallback failed:', fallbackErr);
          toast({
            title: 'PDF Processing Failed',
            description: 'Could not extract text from PDF. Please try a different file.',
            variant: 'destructive',
          });
          setIsProcessing(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: { 
          textData: extractedPdfText,
          isPdf: true,
          extractionFields: selectedProject?.extraction_fields || []
        },
      });
      
      if (error) throw error;
      
      await saveDocument(file.name, 'application/pdf', '', data.text, data.metadata || {});
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

  const handleMultipleFiles = async (files: File[]) => {
    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before uploading',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Processing Multiple Files',
      description: `Processing ${files.length} files...`,
    });

    setIsProcessing(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.type === 'application/pdf') {
          await processPdf(file);
        } else if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          await new Promise((resolve, reject) => {
            reader.onload = async (e) => {
              try {
                const imageData = e.target?.result as string;
                await handleScanComplete('', imageData, file.name);
                resolve(null);
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }
    
    setIsProcessing(false);
    toast({
      title: 'Batch Complete',
      description: `Successfully processed ${files.length} files`,
    });
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

      // Refresh validation queue and switch to validation tab
      await loadQueueDocuments();
      // Defer tab switch to avoid race conditions with Radix Tabs rendering
      setTimeout(() => setActiveTab('validation'), 0);
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

  const exportBatch = async (format: 'csv' | 'json' | 'xml' | 'txt') => {
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

    let content = '';
    let mimeType = '';
    let extension = '';

    switch (format) {
      case 'csv':
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
        content = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
        break;

      case 'json':
        const jsonData = validatedDocs.map(doc => ({
          fileName: doc.file_name,
          date: new Date(doc.created_at).toISOString(),
          metadata: doc.extracted_metadata,
          extractedText: doc.extracted_text,
        }));
        content = JSON.stringify(jsonData, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;

      case 'xml':
        content = '<?xml version="1.0" encoding="UTF-8"?>\n<batch>\n';
        content += `  <name>${selectedBatch?.batch_name || 'export'}</name>\n`;
        content += `  <exportDate>${new Date().toISOString()}</exportDate>\n`;
        content += '  <documents>\n';
        validatedDocs.forEach(doc => {
          content += '    <document>\n';
          content += `      <fileName>${doc.file_name}</fileName>\n`;
          content += `      <date>${new Date(doc.created_at).toISOString()}</date>\n`;
          content += '      <metadata>\n';
          Object.entries(doc.extracted_metadata || {}).forEach(([key, value]) => {
            content += `        <${key}>${value}</${key}>\n`;
          });
          content += '      </metadata>\n';
          content += '    </document>\n';
        });
        content += '  </documents>\n';
        content += '</batch>';
        mimeType = 'application/xml';
        extension = 'xml';
        break;

      case 'txt':
        content = `Batch Export: ${selectedBatch?.batch_name || 'export'}\n`;
        content += `Export Date: ${new Date().toLocaleDateString()}\n`;
        content += `Total Documents: ${validatedDocs.length}\n\n`;
        content += '='.repeat(80) + '\n\n';
        validatedDocs.forEach((doc, index) => {
          content += `Document ${index + 1}: ${doc.file_name}\n`;
          content += `Date: ${new Date(doc.created_at).toLocaleDateString()}\n`;
          content += 'Metadata:\n';
          Object.entries(doc.extracted_metadata || {}).forEach(([key, value]) => {
            content += `  ${key}: ${value}\n`;
          });
          content += '\n' + '-'.repeat(80) + '\n\n';
        });
        mimeType = 'text/plain';
        extension = 'txt';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${selectedBatch?.batch_name || 'export'}-${Date.now()}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: `Batch exported as ${format.toUpperCase()}`,
    });
  };

  const exportImages = async () => {
    if (!validatedDocs.length) {
      toast({
        title: 'No Documents',
        description: 'No validated documents to export',
        variant: 'destructive',
      });
      return;
    }

    const docsWithImages = validatedDocs.filter(doc => doc.file_url);
    
    if (!docsWithImages.length) {
      toast({
        title: 'No Images',
        description: 'No images available for export',
        variant: 'destructive',
      });
      return;
    }

    for (const doc of docsWithImages) {
      try {
        const response = await fetch(doc.file_url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Failed to download ${doc.file_name}:`, error);
      }
    }

    toast({
      title: 'Images Downloaded',
      description: `Downloaded ${docsWithImages.length} images`,
    });
  };

  const markBatchComplete = async () => {
    if (!selectedBatchId) return;

    try {
      const { error } = await supabase
        .from('batches')
        .update({ 
          status: 'complete',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedBatchId);

      if (error) throw error;

      toast({
        title: 'Batch Completed',
        description: 'Batch marked as complete',
      });

      setSelectedBatch({ ...selectedBatch, status: 'complete' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const generatePDF = async () => {
    if (!validatedDocs.length) {
      toast({
        title: 'No Documents',
        description: 'No validated documents to generate PDF',
        variant: 'destructive',
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.text(`Batch: ${selectedBatch?.batch_name || 'Export'}`, 20, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 20, yPosition);
      yPosition += 10;
      doc.text(`Total Documents: ${validatedDocs.length}`, 20, yPosition);
      yPosition += 20;

      // Documents
      validatedDocs.forEach((document, index) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text(`Document ${index + 1}: ${document.file_name}`, 20, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.text(`Date: ${new Date(document.created_at).toLocaleDateString()}`, 20, yPosition);
        yPosition += 6;

        if (document.extracted_metadata) {
          doc.text('Metadata:', 20, yPosition);
          yPosition += 6;

          Object.entries(document.extracted_metadata).forEach(([key, value]) => {
            if (yPosition > pageHeight - 20) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(`  ${key}: ${value}`, 25, yPosition);
            yPosition += 6;
          });
        }

        yPosition += 10;
      });

      doc.save(`batch-${selectedBatch?.batch_name || 'export'}-${Date.now()}.pdf`);

      toast({
        title: 'PDF Generated',
        description: 'Batch exported as PDF successfully',
      });
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast({
        title: 'PDF Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border pl-3">
                <h1 className="text-xl font-bold text-primary">Document Processing Queue</h1>
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
              <Button variant="outline" onClick={() => navigate('/batches')}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Batches
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LicenseWarning />
        
        <div className="space-y-6 mb-6">
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
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
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger value="scanner">
                    <ScanLine className="h-4 w-4 mr-2" />
                    Physical Scanner
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload">
                  {license && (
                    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-primary border-primary/30">
                              License Active
                            </Badge>
                            <span className="text-sm font-medium">Document Capacity</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {license.remaining_documents.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              of {license.total_documents.toLocaleString()} remaining
                            </div>
                          </div>
                        </div>
                        <Progress 
                          value={(license.remaining_documents / license.total_documents) * 100} 
                          className="h-2"
                        />
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Expires: {new Date(license.end_date).toLocaleDateString()}</span>
                          <span>{Math.round((license.remaining_documents / license.total_documents) * 100)}% available</span>
                        </div>
                      </div>
                    </Card>
                  )}
                  <ScanUploader 
                    onScanComplete={handleScanComplete} 
                    onPdfUpload={processPdf}
                    onMultipleFilesUpload={handleMultipleFiles}
                    isProcessing={isProcessing} 
                  />
                </TabsContent>
                
                <TabsContent value="scanner">
                  <PhysicalScanner onScanComplete={handleScanComplete} isProcessing={isProcessing} />
                </TabsContent>
              </Tabs>
            </TabsContent>
            
            <TabsContent value="validation">
              {validationQueue.length === 0 ? (
                <Card className="p-12 text-center">
                  <Eye className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Documents Awaiting Validation</h3>
                  <p className="text-muted-foreground">Scan documents to add them to the validation queue</p>
                </Card>
              ) : (
                <BatchValidationScreen
                  documents={validationQueue}
                  projectFields={selectedProject?.extraction_fields || []}
                  onValidationComplete={loadQueueDocuments}
                  batchId={selectedBatchId}
                />
              )}
            </TabsContent>
            
            <TabsContent value="validated">
              <div className="space-y-4">
                {validatedDocs.length === 0 ? (
                  <Card className="p-12 text-center">
                    <CheckCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Validated Documents</h3>
                    <p className="text-muted-foreground">Validate documents to see them here</p>
                  </Card>
                ) : (
                  validatedDocs.map((doc) => (
                    <Card key={doc.id} className="p-6">
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

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3">Export Metadata</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedProject?.export_types?.includes('csv') && (
                        <Button onClick={() => exportBatch('csv')} disabled={validatedDocs.length === 0} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          CSV Format
                        </Button>
                      )}
                      {selectedProject?.export_types?.includes('json') && (
                        <Button onClick={() => exportBatch('json')} disabled={validatedDocs.length === 0} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          JSON Format
                        </Button>
                      )}
                      {selectedProject?.export_types?.includes('xml') && (
                        <Button onClick={() => exportBatch('xml')} disabled={validatedDocs.length === 0} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          XML Format
                        </Button>
                      )}
                      {selectedProject?.export_types?.includes('txt') && (
                        <Button onClick={() => exportBatch('txt')} disabled={validatedDocs.length === 0} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          TXT Format
                        </Button>
                      )}
                    </div>
                  </div>

                  {selectedProject?.export_types?.includes('images') && (
                    <div>
                      <h4 className="font-semibold mb-3">Export Images</h4>
                      <Button onClick={exportImages} disabled={validatedDocs.length === 0} variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download All Images
                      </Button>
                    </div>
                  )}

                  {selectedProject?.export_types?.includes('pdf') && (
                    <div>
                      <h4 className="font-semibold mb-3">Generate PDF Report</h4>
                      <Button onClick={generatePDF} disabled={validatedDocs.length === 0} variant="outline" className="w-full">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate PDF with Metadata
                      </Button>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Button 
                      onClick={markBatchComplete} 
                      disabled={validatedDocs.length === 0 || selectedBatch?.status === 'complete'}
                      className="w-full"
                      size="lg"
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      {selectedBatch?.status === 'complete' ? 'Batch Completed' : 'Mark Batch as Complete'}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
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
