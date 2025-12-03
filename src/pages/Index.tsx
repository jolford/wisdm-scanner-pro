import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanUploader } from '@/components/ScanUploader';
import { PhysicalScanner } from '@/components/PhysicalScanner';
import { ValidationScreen } from '@/components/ValidationScreen';
import { ProjectSelector } from '@/components/ProjectSelector';
import { BatchSelector } from '@/components/BatchSelector';
import { ProgressTrackingDashboard } from '@/components/ProgressTrackingDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useContextualToast } from '@/lib/toast-helper';
import { useAuth } from '@/hooks/use-auth';
import { useFileLaunch } from '@/hooks/use-file-launch';
import { Sparkles, Upload, ScanLine, LogOut, FileText, Settings, FolderOpen, BookOpen, LayoutDashboard, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LicenseWarning } from '@/components/LicenseWarning';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InstallPrompt } from '@/components/InstallPrompt';
import { useLicense } from '@/hooks/use-license';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { useQuery } from '@tanstack/react-query';
import { applyDocumentNamingPattern } from '@/lib/document-naming';
import imageCompression from 'browser-image-compression';

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
  
  // Dashboard pinned state - persisted in localStorage
  const [isDashboardPinned, setIsDashboardPinned] = useState(() => {
    return localStorage.getItem('dashboardPinned') === 'true';
  });

  // Toggle dashboard pin
  const toggleDashboardPin = () => {
    const newValue = !isDashboardPinned;
    setIsDashboardPinned(newValue);
    localStorage.setItem('dashboardPinned', String(newValue));
  };

  // Fetch dashboard metrics
  const { data: dashboardMetrics } = useQuery({
    queryKey: ['dashboard-metrics', selectedBatchId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get documents for metrics
      let query = supabase
        .from('documents')
        .select('id, validation_status, created_at, confidence_score, extracted_metadata');
      
      if (selectedBatchId) {
        query = query.eq('batch_id', selectedBatchId);
      } else {
        query = query.gte('created_at', today);
      }
      
      const { data: docs } = await query;
      
      if (!docs) return null;
      
      const validated = docs.filter(d => d.validation_status === 'validated').length;
      const pending = docs.filter(d => d.validation_status === 'pending' || !d.validation_status).length;
      const rejected = docs.filter(d => d.validation_status === 'rejected').length;
      
      // Calculate average confidence
      const confidenceScores = docs.filter(d => d.confidence_score).map(d => d.confidence_score as number);
      const avgConfidence = confidenceScores.length > 0 
        ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
        : 0;
      
      // Find top vendor
      const vendors = docs
        .map(d => (d.extracted_metadata as any)?.vendor_name)
        .filter(Boolean);
      const vendorCounts: Record<string, number> = vendors.reduce((acc: Record<string, number>, v: string) => {
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const sortedVendors = Object.entries(vendorCounts).sort(([, a], [, b]) => b - a);
      const topVendor = sortedVendors[0]?.[0];
      
      return {
        totalDocuments: docs.length,
        validated,
        pending,
        rejected,
        avgTimePerDoc: 12, // Placeholder average
        topVendor,
        accuracy: avgConfidence || 95
      };
    },
    enabled: isDashboardPinned,
    refetchInterval: isDashboardPinned ? 10000 : false
  });

  useEffect(() => {
    console.log('Auth state:', { authLoading, user: user?.id, hasUser: !!user });
    if (!authLoading && !user) {
      console.log('Redirecting to auth - no user found');
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  // Reset processing state if user becomes invalid
  useEffect(() => {
    if (!authLoading && !user && isProcessing) {
      console.log('Resetting processing state due to invalid session');
      setIsProcessing(false);
      setCurrentDocumentId(null);
      toast({
        title: 'Session Expired',
        description: 'Please sign in again to continue.',
        variant: 'destructive',
      });
    }
  }, [authLoading, user, isProcessing]);

  // Preselect previously used project on load (for seamless PWA imports)
  useEffect(() => {
    if (selectedProjectId) return;
    const stored = sessionStorage.getItem('selectedProjectId') || localStorage.getItem('lastSelectedProjectId');
    if (stored) {
      setSelectedProjectId(stored);
      (async () => {
        try {
          const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('id', stored)
            .single();
          if (data) setSelectedProject(data);
        } catch (e) {
          console.warn('Failed to load stored project details', e);
        }
      })();
    }
  }, []);

  useFileLaunch(async (files) => {
    console.log('LaunchQueue: received files via PWA launch', { count: files?.length, names: files?.map(f => f.name) });
    try {
      // Ensure a project is selected: try current state, sessionStorage, then localStorage
      let projectId =
        selectedProjectId ||
        sessionStorage.getItem('selectedProjectId') ||
        localStorage.getItem('lastSelectedProjectId');

      // If still not available, auto-select when there's exactly one accessible project
      if (!projectId) {
        try {
          const { data: projList } = await supabase
            .from('projects')
            .select('id, customer_id')
            .eq('is_active', true)
            .order('name')
            .limit(2);
          if (projList && projList.length === 1) {
            projectId = projList[0].id;
            setSelectedProjectId(projectId);
            setSelectedProject(projList[0]);
            sessionStorage.setItem('selectedProjectId', projectId);
            localStorage.setItem('lastSelectedProjectId', projectId);
          }
        } catch {}
      }

      if (!projectId) {
        toast({
          title: 'Select a Project',
          description: 'Please select a project before importing documents.',
          variant: 'destructive',
        });
        return;
      }

      // Ensure we have project details (for customer_id)
      if (!selectedProject || selectedProject?.id !== projectId) {
        try {
          const { data: proj } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();
          if (proj) {
            setSelectedProject(proj);
          }
        } catch {}
      }

      // Auto-create batch with timestamp
      const batchName = `Import ${new Date().toLocaleString()}`;

      const { data: newBatch, error: batchError } = await supabase
        .from('batches')
        .insert({
          project_id: projectId,
          batch_name: batchName,
          customer_id:
            (selectedProject && selectedProject.id === projectId
              ? selectedProject.customer_id
              : null) || undefined,
          created_by: user?.id,
          status: 'new',
        })
        .select()
        .single();

      if (batchError || !newBatch) {
        throw batchError || new Error('Failed to create batch');
      }

      setSelectedProjectId(projectId);
      sessionStorage.setItem('selectedProjectId', projectId);
      localStorage.setItem('lastSelectedProjectId', projectId);

      setSelectedBatchId(newBatch.id);
      setSelectedBatch(newBatch);

      toast({
        title: 'Batch Created',
        description: `Created "${batchName}" and importing ${files.length} file(s)...`,
      });

      // Process all dropped files
      await handleMultipleFiles(files);
    } catch (error: any) {
      console.error('Error handling file launch:', error);
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import documents',
        variant: 'destructive',
      });
    }
  });

  const saveDocument = async (
    fileName: string,
    fileType: string,
    fileUrl: string,
    text: string,
    metadata: any,
    lineItems: any[] = []
  ) => {
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

      // If we received a large inline data URL, upload it to storage and store a URL instead
      let storedUrl = fileUrl;
      if (typeof storedUrl === 'string' && storedUrl.startsWith('data:')) {
        try {
          const mimeMatch = storedUrl.match(/^data:([^;]+);/);
          const contentType = mimeMatch?.[1] || (fileType.startsWith('image') ? 'image/png' : 'application/octet-stream');
          const blob = await (await fetch(storedUrl)).blob();
          const safeName = finalFileName.replace(/[^\w.\-]+/g, '_');
          const objectPath = `${selectedBatchId}/${Date.now()}_${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(objectPath, blob, { contentType, upsert: false });
          if (uploadError) {
            throw new Error(`Failed to upload file: ${uploadError.message}`);
          }
          const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(objectPath);
          storedUrl = publicUrl;
        } catch (e: any) {
          console.error('Inline image upload failed:', e);
          throw e;
        }
      }

      const { data, error } = await supabase
        .from('documents')
        .insert([
          {
            project_id: selectedProjectId,
            batch_id: selectedBatchId,
            file_name: finalFileName,
            file_type: fileType,
            file_url: storedUrl,
            extracted_text: text,
            extracted_metadata: metadata,
            line_items: lineItems,
            uploaded_by: user?.id,
          },
        ])
        .select()
        .single();

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
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to upload documents.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before uploading',
        variant: 'destructive',
      });
      return;
    }

    console.log(`Starting batch upload of ${files.length} files`);
    toast({
      title: 'Uploading Files',
      description: `Uploading ${files.length} file(s)...`,
    });

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;
    
    // Process all files in parallel for faster upload
    const uploadPromises = files.map(async (file) => {
      try {
        console.log(`Processing file: ${file.name}`);
        
        if (file.type === 'application/pdf') {
          // For PDFs, upload and queue without waiting
          console.log(`Processing PDF: ${file.name}`);
          await processPdfNoWait(file);
        } else if (file.type.startsWith('image/')) {
          // For images, upload and queue without waiting
          console.log(`Processing image: ${file.name}`);
          const imageData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              console.log(`Image loaded: ${file.name}, size: ${e.target?.result?.toString().length} chars`);
              resolve(e.target?.result as string);
            };
            reader.onerror = (e) => {
              console.error(`Failed to read file: ${file.name}`, e);
              reject(e);
            };
            reader.readAsDataURL(file);
          });
          
          await handleScanCompleteNoWait(imageData, file.name);
        } else {
          console.warn(`Unsupported file type: ${file.type} for file: ${file.name}`);
          throw new Error(`Unsupported file type: ${file.type}`);
        }
        
        successCount++;
        console.log(`✓ Successfully queued: ${file.name} (${successCount}/${files.length})`);
      } catch (error: any) {
        errorCount++;
        console.error(`✗ Error processing file ${file.name}:`, error);
        console.error('Error details:', { 
          message: error.message, 
          stack: error.stack,
          fileType: file.type,
          fileName: file.name,
          fileSize: file.size
        });
      }
    });

    await Promise.all(uploadPromises);
    
    // Trigger parallel OCR processing for the batch
    if (successCount > 0 && selectedBatchId) {
      console.log(`Triggering parallel OCR for batch ${selectedBatchId} with ${successCount} documents`);
      try {
        const { error: parallelError } = await supabase.functions.invoke('parallel-ocr-batch', {
          body: { 
            batchId: selectedBatchId,
            maxParallel: 3
          }
        });
        
        if (parallelError) {
          console.error('Failed to trigger parallel OCR:', parallelError);
        } else {
          console.log('✓ Parallel OCR triggered successfully');
        }
      } catch (e) {
        console.error('Error triggering parallel OCR:', e);
      }

      // Trigger duplicate detection for the batch
      console.log(`Triggering duplicate detection for batch ${selectedBatchId}`);
      try {
        // Give OCR a moment to process, then check duplicates
        setTimeout(async () => {
          const { data: batchDocs } = await supabase
            .from('documents')
            .select('id')
            .eq('batch_id', selectedBatchId);
          
          if (batchDocs && batchDocs.length > 1) {
            for (const doc of batchDocs) {
              try {
                await supabase.functions.invoke('detect-duplicates', {
                  body: {
                    documentId: doc.id,
                    batchId: selectedBatchId,
                    checkCrossBatch: false,
                    thresholds: { name: 0.85, address: 0.90, signature: 0.85 }
                  }
                });
              } catch (dupError) {
                console.error(`Duplicate detection failed for ${doc.id}:`, dupError);
              }
            }
            console.log('✓ Duplicate detection triggered');
          }
        }, 3000); // Wait 3 seconds for OCR to complete
      } catch (e) {
        console.error('Error triggering duplicate detection:', e);
      }
    }
    
    setIsProcessing(false);
    
    if (errorCount === 0) {
      toast({
        title: 'Upload Complete',
        description: `${successCount} file(s) uploaded. Processing in parallel...`,
      });
    } else {
      toast({
        title: 'Upload Completed with Errors',
        description: `${successCount} succeeded, ${errorCount} failed. Check console for details.`,
        variant: 'destructive',
      });
    }
  };

  // Compress image for faster upload and processing
  const compressImage = async (imageDataUrl: string): Promise<string> => {
    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      // Skip compression if already small (< 500KB)
      if (blob.size < 500 * 1024) {
        console.log('Image already small, skipping compression');
        return imageDataUrl;
      }

      const originalSize = (blob.size / 1024 / 1024).toFixed(2);
      console.log(`Compressing image (${originalSize}MB)...`);

      // Compress image
      const options = {
        maxSizeMB: 1, // Max 1MB
        maxWidthOrHeight: 2048, // Max dimension
        useWebWorker: true,
        fileType: 'image/jpeg' as const,
      };
      
      const compressedBlob = await imageCompression(blob as File, options);
      const compressedSize = (compressedBlob.size / 1024 / 1024).toFixed(2);
      console.log(`Compressed: ${originalSize}MB -> ${compressedSize}MB`);
      
      // Convert back to data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressedBlob);
      });
    } catch (error) {
      console.warn('Image compression failed, using original:', error);
      return imageDataUrl; // Fallback to original
    }
  };

  // Non-blocking version that just queues the document for processing
  const handleScanCompleteNoWait = async (imageUrl: string, fileName: string) => {
    console.log(`Starting handleScanCompleteNoWait for: ${fileName}`);
    
    const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
      ? selectedProject?.metadata?.table_extraction_config?.fields || []
      : [];
    
    // Compress image before uploading
    console.log(`Compressing image: ${fileName}`);
    const compressedImage = await compressImage(imageUrl);
    console.log(`Image compressed: ${fileName}`);
    
    // Create document with pending status
    console.log(`Saving document: ${fileName}`);
    const doc = await saveDocument(fileName, 'image', compressedImage, '', {}, []);
    if (!doc) {
      console.error(`Failed to save document: ${fileName}`);
      throw new Error('Failed to create document');
    }
    console.log(`Document saved: ${fileName}, ID: ${doc.id}`);

    // Create job for OCR processing
    console.log(`Creating OCR job for document: ${doc.id}`);
    const { error: jobError } = await supabase.from('jobs').insert([{
      job_type: 'ocr_document',
      customer_id: selectedProject?.customer_id || null,
      user_id: user?.id,
      priority: 'normal',
      payload: {
        documentId: doc.id,
        imageData: compressedImage,
        isPdf: false,
        extractionFields: selectedProject?.extraction_fields || [],
        tableExtractionFields: tableFields,
        enableCheckScanning: selectedProject?.enable_check_scanning || false,
      },
    }]);

    if (jobError) {
      console.error(`Failed to create OCR job for document ${doc.id}:`, jobError);
      throw jobError;
    }
    console.log(`✓ OCR job created for document ${doc.id}`);
  };

  // Non-blocking PDF processor
  const processPdfNoWait = async (file: File) => {
    // Upload PDF to storage first
    const fileName = `${selectedBatchId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, { contentType: 'application/pdf' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    // Create document with pending status
    const doc = await saveDocument(file.name, 'application/pdf', publicUrl, '', {}, []);
    if (!doc) throw new Error('Failed to create document');

    // Create job for OCR processing
    const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
      ? selectedProject?.metadata?.table_extraction_config?.fields || []
      : [];

    const { error: jobError } = await supabase.from('jobs').insert([{
      job_type: 'ocr_document',
      customer_id: selectedProject?.customer_id || null,
      user_id: user?.id,
      priority: 'normal',
      payload: {
        documentId: doc.id,
        fileUrl: publicUrl,
        isPdf: true,
        extractionFields: selectedProject?.extraction_fields || [],
        tableExtractionFields: tableFields,
        enableCheckScanning: selectedProject?.enable_check_scanning || false,
      },
    }]);

    if (jobError) throw jobError;
    console.log(`Created OCR job for PDF ${doc.id}`);
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
    if (!user) {
      console.error('No user authenticated');
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to upload documents.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      navigate('/auth');
      return;
    }

    if (!selectedProjectId || !selectedBatchId) {
      toast({
        title: 'Select Project and Batch',
        description: 'Please select both a project and batch before scanning',
        variant: 'destructive',
      });
      setIsProcessing(false);
      return;
    }

    console.log('Starting upload:', { user: user.id, projectId: selectedProjectId, batchId: selectedBatchId, fileName });
    
    // Compress image before uploading
    const compressedImage = await compressImage(imageUrl);
    
    setCurrentImage(compressedImage);
    setCurrentFileName(fileName);
    setIsProcessing(true);

    try {
      const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
        ? selectedProject?.metadata?.table_extraction_config?.fields || []
        : [];
      
      // Create document first with pending status
      const doc = await saveDocument(fileName, 'image', compressedImage, '', {}, []);
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
          imageData: compressedImage,
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
        console.log(`Polling attempt ${attempts}/${maxAttempts} for document ${doc.id}`);
        
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('extracted_text, extracted_metadata, word_bounding_boxes')
          .eq('id', doc.id)
          .single();

        if (docError) {
          console.error('Error polling document:', docError);
          clearInterval(pollInterval);
          toast({
            title: 'Processing Error',
            description: 'Failed to check document status. Check the Queue tab.',
            variant: 'destructive',
          });
          setIsProcessing(false);
          return;
        }

        if (attempts >= maxAttempts) {
          console.warn('Polling timeout reached');
          clearInterval(pollInterval);
          toast({
            title: 'OCR Timeout',
            description: 'Processing is taking longer than expected. Check the Queue tab for status.',
            variant: 'destructive',
          });
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
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/api-docs')}
                className="h-9 w-9"
                title="API Documentation"
              >
                <BookOpen className="h-4 w-4" />
              </Button>
              <Button 
                variant={isDashboardPinned ? "default" : "ghost"}
                size="icon"
                onClick={toggleDashboardPin}
                className="h-9 w-9"
                title={isDashboardPinned ? "Unpin Dashboard" : "Pin Dashboard"}
              >
                {isDashboardPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <ThemeToggle />
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
        <InstallPrompt />
        
        {/* Pinned Dashboard */}
        {isDashboardPinned && dashboardMetrics && (
          <div className="mb-8 max-w-md ml-auto">
            <ProgressTrackingDashboard 
              metrics={dashboardMetrics}
              batchName={selectedBatch?.batch_name || 'Today\'s Activity'}
            />
          </div>
        )}
        
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
                  sessionStorage.setItem('selectedProjectId', id);
                  localStorage.setItem('lastSelectedProjectId', id);
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
                  <PhysicalScanner 
                    projectId={selectedProjectId || undefined}
                    batchId={selectedBatchId || undefined}
                    customerId={selectedProject?.customer_id}
                    onScanComplete={handleMultipleFiles}
                  />
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
