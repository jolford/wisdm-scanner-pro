import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanUploader } from '@/components/ScanUploader';
import { PhysicalScanner } from '@/components/PhysicalScanner';
import { ValidationScreen } from '@/components/ValidationScreen';
import { ProjectSelector } from '@/components/ProjectSelector';
import { BatchSelector } from '@/components/BatchSelector';
import { supabase } from '@/integrations/supabase/client';
import { useContextualToast } from '@/lib/toast-helper';
import { useAuth } from '@/hooks/use-auth';
import { Sparkles, Upload, ScanLine, LogOut, FileText, Settings, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LicenseWarning } from '@/components/LicenseWarning';
import { useLicense } from '@/hooks/use-license';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { applyDocumentNamingPattern } from '@/lib/document-naming';

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Configure PDF.js worker using a module worker once at module load
if ((pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
  
}

const Index = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { license, hasCapacity, consumeDocuments } = useLicense();
  const [extractedText, setExtractedText] = useState('');
  const [extractedMetadata, setExtractedMetadata] = useState<Record<string, string>>({});
  const [boundingBoxes, setBoundingBoxes] = useState<Record<string, any>>({});
  const [currentImage, setCurrentImage] = useState('');
  const [wordBoundingBoxes, setWordBoundingBoxes] = useState<any[]>([]);
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const { toast } = useContextualToast();
  const showValidation = !!currentDocumentId;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  const saveDocument = async (fileName: string, fileType: string, fileUrl: string, text: string, metadata: any, lineItems: any[] = []) => {
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
      // Apply document naming pattern if configured
      const namingPattern = (selectedProject as any)?.metadata?.document_naming_pattern;
      const finalFileName = applyDocumentNamingPattern(namingPattern, metadata, fileName);

      const { data, error } = await supabase.from('documents').insert([{
        project_id: selectedProjectId,
        batch_id: selectedBatchId,
        file_name: finalFileName,
        file_type: fileType,
        file_url: fileUrl,
        extracted_text: text,
        extracted_metadata: metadata,
        line_items: lineItems,
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

      // Store document ID for validation
      if (data) {
        setCurrentDocumentId(data.id);
      }

      // Update batch counts
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

  const processPdf = async (file: File) => {
    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before uploading',
        variant: 'destructive',
      });
      return;
    }

    setCurrentFileName(file.name);
    setIsProcessing(true);
    
    try {
      // First, upload the PDF file to storage
      const fileName = `${selectedBatchId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // Get public URL for the uploaded PDF
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Fast path: extract text from PDF using pdfjs for small, text-based PDFs
      let arrayBuffer: ArrayBuffer | null = null;
      let extractedPdfText = '';
      try {
        arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer as ArrayBuffer });
        const pdf = await loadingTask.promise;
        const pages = Math.min(pdf.numPages, 3);
        for (let i = 1; i <= pages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = (textContent.items || [])
            .map((item: any) => (item && item.str) ? item.str : '')
            .join(' ');
          extractedPdfText += pageText + '\n';
        }
      } catch (e) {
        console.warn('PDF text extraction fallback:', e);
      }

      if (extractedPdfText && extractedPdfText.trim().length > 10) {
        const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
          ? selectedProject?.metadata?.table_extraction_config?.fields || []
          : [];
        
        // Create document first with pending status
        const doc = await saveDocument(file.name, 'application/pdf', publicUrl, '', {}, []);
        if (!doc) throw new Error('Failed to create document');

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Create job for OCR processing
        const { error: jobError } = await supabase.from('jobs').insert([{
          job_type: 'ocr_document',
          customer_id: selectedProject?.customer_id || null,
          user_id: user.id,
          priority: 'normal',
          payload: {
            documentId: doc.id,
            textData: extractedPdfText,
            isPdf: true,
            extractionFields: selectedProject?.extraction_fields || [],
            tableExtractionFields: tableFields,
            enableCheckScanning: selectedProject?.enable_check_scanning || false,
          },
        }]);

        if (jobError) throw jobError;
        toast({ title: 'PDF Queued', description: 'Processing in background...' });
      } else {
        // Fallback: render first PDF page to image and run OCR
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

          const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
            ? selectedProject?.metadata?.table_extraction_config?.fields || []
            : [];

          setCurrentImage(dataUrl);

          // Create document first with pending status
          const doc = await saveDocument(file.name, 'application/pdf', publicUrl, '', {}, []);
          if (!doc) throw new Error('Failed to create document');

          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          // Create job for OCR processing
          const { error: jobError } = await supabase.from('jobs').insert([{
            job_type: 'ocr_document',
            customer_id: selectedProject?.customer_id || null,
            user_id: user.id,
            priority: 'normal',
            payload: {
              documentId: doc.id,
              imageData: dataUrl,
              isPdf: false,
              extractionFields: selectedProject?.extraction_fields || [],
              tableExtractionFields: tableFields,
              enableCheckScanning: selectedProject?.enable_check_scanning || false,
            },
          }]);

          if (jobError) throw jobError;
          toast({ title: 'PDF Queued', description: 'Processing in background...' });
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

  const handleScanComplete = async (text: string, imageUrl: string, fileName = 'scan.jpg') => {
    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before scanning',
        variant: 'destructive',
      });
      return;
    }

    setCurrentImage(imageUrl);
    setCurrentFileName(fileName);
    setIsProcessing(true);

    try {
      const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
        ? selectedProject?.metadata?.table_extraction_config?.fields || []
        : [];
      
      // Create document first with pending status
      const doc = await saveDocument(fileName, 'image', imageUrl, '', {}, []);
      if (!doc) throw new Error('Failed to create document');
      setCurrentDocumentId(doc.id);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create job for OCR processing
      const { error: jobError } = await supabase.from('jobs').insert([{
        job_type: 'ocr_document',
        customer_id: selectedProject?.customer_id || null,
        user_id: user.id,
        priority: 'normal',
        payload: {
          documentId: doc.id,
          imageData: imageUrl,
          isPdf: false,
          extractionFields: selectedProject?.extraction_fields || [],
          tableExtractionFields: tableFields,
          enableCheckScanning: selectedProject?.enable_check_scanning || false,
        },
      }]);

      if (jobError) throw jobError;

      toast({
        title: 'Scan Queued',
        description: 'Processing in background. Waiting for results...',
      });

      // Poll for OCR completion
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      const pollInterval = setInterval(async () => {
        attempts++;
        
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('extracted_text, extracted_metadata, word_bounding_boxes')
          .eq('id', doc.id)
          .single();

        if (docError || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (attempts >= maxAttempts) {
            toast({
              title: 'OCR Timeout',
              description: 'Processing is taking longer than expected. Check the Queue tab for status.',
              variant: 'destructive',
            });
          }
          setIsProcessing(false);
          return;
        }

        // Check if OCR has completed
        if (docData && docData.extracted_text) {
          clearInterval(pollInterval);
          
          // Load the extracted data
          setExtractedText(docData.extracted_text || '');
          
          // Parse metadata with type checking
          const metadata = docData.extracted_metadata as Record<string, any> || {};
          setExtractedMetadata(typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {});
          
          // Parse word bounding boxes with type checking
          const wordBoxes = docData.word_bounding_boxes as any[] || [];
          setWordBoundingBoxes(Array.isArray(wordBoxes) ? wordBoxes : []);
          
          // Load bounding boxes from metadata if available
          if (typeof metadata === 'object' && metadata.boundingBoxes) {
            setBoundingBoxes(metadata.boundingBoxes);
          }

          toast({
            title: 'OCR Complete',
            description: 'Document is ready for validation',
          });
          
          setIsProcessing(false);
        }
      }, 1000); // Check every second
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
    // Update batch validated count
    if (selectedBatchId && selectedBatch && status === 'validated') {
      await supabase
        .from('batches')
        .update({ 
          validated_documents: (selectedBatch.validated_documents || 0) + 1
        })
        .eq('id', selectedBatchId);
    }
    
    // Reset for next scan
    handleReset();
  };

  const handleReset = () => {
    setExtractedText('');
    setExtractedMetadata({});
    setBoundingBoxes({});
    setCurrentImage('');
    setCurrentFileName('');
    setCurrentDocumentId(null);
    // Don't reset project/batch selection
  };

  if (authLoading) {
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
                <h1 className="text-xl font-bold">Scanner Pro</h1>
                <p className="text-xs text-muted-foreground">Advanced OCR & ICR Technology</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <Button variant="outline" onClick={() => navigate('/admin/batches')}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Batches
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/admin')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => navigate('/batches')}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Batches
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Powered by AI</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <LicenseWarning />
        
        {!showValidation ? (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">
                Scan Documents with AI Precision
              </h2>
              <p className="text-lg text-muted-foreground">
                Select a project, then upload images, PDFs, or scan from your physical scanner
              </p>
            </div>

            <div className="space-y-6 mb-6">
              <ProjectSelector
                selectedProjectId={selectedProjectId}
                onProjectSelect={async (id, project) => {
                  setSelectedProjectId(id);
                  setSelectedBatchId(null);
                  setSelectedBatch(null);
                  try {
                    const { data, error } = await supabase
                      .from('projects')
                      .select('*')
                      .eq('id', id)
                      .single();
                    if (!error && data) {
                      setSelectedProject(data);
                    } else {
                      setSelectedProject(project); // fallback
                    }
                  } catch {
                    setSelectedProject(project); // fallback on any unexpected error
                  }
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
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger value="scanner" className="flex items-center gap-2">
                    <ScanLine className="h-4 w-4" />
                    Physical Scanner
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload">
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
            )}
          </div>
        ) : (
          <ValidationScreen
            documentId={currentDocumentId || undefined}
            imageUrl={currentImage}
            fileName={currentFileName}
            extractedText={extractedText}
            metadata={extractedMetadata}
            boundingBoxes={boundingBoxes}
            wordBoundingBoxes={wordBoundingBoxes}
            projectFields={selectedProject?.extraction_fields || []}
            projectName={selectedProject?.name}
            projectId={selectedProject?.id}
            enableSignatureVerification={selectedProject?.enable_signature_verification || false}
            onValidate={handleValidation}
            onSkip={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>High-quality OCR and ICR powered by advanced AI technology</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
