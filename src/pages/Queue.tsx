import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useContextualToast } from '@/lib/toast-helper';
import { LogOut, Settings, Upload, ScanLine, CheckCircle, Download, Trash2, Eye, FileText, FolderOpen, Cloud, Database, HelpCircle, User } from 'lucide-react';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { LicenseWarning } from '@/components/LicenseWarning';
import { useLicense } from '@/hooks/use-license';
import { usePermissions } from '@/hooks/use-permissions';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getSignedUrl } from '@/hooks/use-signed-url';
import { analyzePdfSeparation, getDocumentName, SeparationConfig } from '@/lib/pdf-separator';
import { applyDocumentNamingPattern } from '@/lib/document-naming';
import { safeErrorMessage, logError } from '@/lib/error-handler';
import { safeInvokeEdgeFunction } from '@/lib/edge-function-helper';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from 'jspdf';
import { isTiffFile, convertTiffToPngDataUrl } from '@/lib/image-utils';

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// PDF.js worker is initialized lazily inside the Queue component to avoid errors on non-queue routes.

const Queue = () => {
  // Lazily initialize PDF.js worker to prevent global crashes on auth pages
  useEffect(() => {
    try {
      if ((pdfjsLib as any).GlobalWorkerOptions) {
        (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
      }
    } catch (e) {
      console.warn('PDF worker init failed', e);
    }
  }, []);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useContextualToast();
  const { license, hasCapacity, consumeDocuments } = useLicense();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  // Helper function to extract metadata value (handles both old string format and new {value, bbox} format)
  const extractMetadataValue = (value: any): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'value' in value) return value.value;
    return String(value || '');
  };
  
  // Downscale a data URL to JPEG with max dimension to avoid Edge Function payload limits
  const downscaleDataUrl = async (dataUrl: string, maxDim = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Use JPEG to greatly reduce size
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };
  
  // Resilient OCR invocation with retries/backoff
  const invokeOcr = async (payload: any, maxRetries = 3): Promise<any> => {
    let lastErr: any = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data, error } = await safeInvokeEdgeFunction<any>('ocr-scan', { body: payload });
      if (!error && data) return data;
      lastErr = error;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
    throw new Error(lastErr?.message || 'OCR service unreachable');
  };
  
  const [processingBatches, setProcessingBatches] = useState<Set<string>>(new Set());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  
  // Helper to check if current batch is processing
  const isProcessing = selectedBatchId ? processingBatches.has(selectedBatchId) : false;
  
  // Helper to set processing state for current batch
  const setProcessing = (processing: boolean) => {
    if (!selectedBatchId) return;
    setProcessingBatches(prev => {
      const newSet = new Set(prev);
      if (processing) {
        newSet.add(selectedBatchId);
      } else {
        newSet.delete(selectedBatchId);
      }
      return newSet;
    });
  };
  const [validationQueue, setValidationQueue] = useState<any[]>([]);
  const [validatedDocs, setValidatedDocs] = useState<any[]>([]);
  const [readyNotified, setReadyNotified] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
const [isExporting, setIsExporting] = useState(false);
  const [docmgtRtDialogOpen, setDocmgtRtDialogOpen] = useState(false);
  const [docmgtRtOptions, setDocmgtRtOptions] = useState<Array<{ id: string | number; name: string }>>([]);
  const [docmgtSelectedRtId, setDocmgtSelectedRtId] = useState<string>('');
  
  // MICR support: derive flag and ensure MICR fields are included in extraction when enabled
  const enableMICR = Boolean((selectedProject as any)?.enable_check_scanning || (selectedProject as any)?.metadata?.enable_check_scanning?.enabled);
  const baseProjectFields: Array<{ name: string; description: string }> = (selectedProject as any)?.extraction_fields || [];
  const micrFieldNames: string[] = enableMICR ? ['Routing Number', 'Account Number', 'Check Number'] : [];
  const extractionFields: Array<{ name: string; description: string }> = [
    ...baseProjectFields,
    ...micrFieldNames
      .filter((f) => !baseProjectFields.some((bf: any) => (bf?.name || '').toLowerCase() === f.toLowerCase()))
      .map((name) => ({ name, description: '' })),
  ];

  const isReadyForExport = validationQueue.length === 0 && validatedDocs.length > 0;

  // Initialize active tab from URL parameter or default to 'scan'
  const initialTab = searchParams.get('tab') || 'scan';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    // Check MFA enforcement - if user has MFA enrolled but hasn't completed it
    const checkMFALevel = async () => {
      if (!user) return;
      
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        
        const hasVerifiedFactor = factorsData?.totp?.some((f: any) => f.status === 'verified');
        const currentLevel = aalData?.currentLevel;
        
        // If user has MFA enrolled but is only at AAL1, redirect to complete MFA
        if (hasVerifiedFactor && currentLevel === 'aal1') {
          console.log('MFA required but not completed - redirecting to auth');
          await supabase.auth.signOut();
          navigate('/auth');
        }
      } catch (error) {
        console.error('Error checking MFA level:', error);
      }
    };

    if (user) {
      checkMFALevel();
    }
  }, [authLoading, user, navigate]);

  // Check sessionStorage for pre-selected batch/project from Batches page
  useEffect(() => {
    const storedBatchId = sessionStorage.getItem('selectedBatchId');
    const storedProjectId = sessionStorage.getItem('selectedProjectId');
    
    if (storedBatchId && storedProjectId && storedBatchId !== 'null' && storedProjectId !== 'null') {
      // Validate that the batch still exists before using it
      (async () => {
        try {
          const { data, error } = await supabase
            .from('batches')
            .select('id')
            .eq('id', storedBatchId)
            .single();
          
          if (!error && data) {
            setSelectedProjectId(storedProjectId);
            setSelectedBatchId(storedBatchId);
          } else {
            // Batch no longer exists, clear sessionStorage
            sessionStorage.removeItem('selectedBatchId');
            sessionStorage.removeItem('selectedProjectId');
          }
        } catch (e) {
          console.warn('Failed to validate stored batch:', e);
          sessionStorage.removeItem('selectedBatchId');
          sessionStorage.removeItem('selectedProjectId');
        }
      })();
    }
  }, []);

  // Load documents when batch is selected
  useEffect(() => {
    if (selectedBatchId) {
      loadQueueDocuments();
    } else {
      setValidationQueue([]);
      setValidatedDocs([]);
    }
  }, [selectedBatchId]);

  // CRITICAL: Always reload project when batch changes to ensure correct extraction fields
  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedProject(null);
      return;
    }
    
    (async () => {
      try {
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('project_id')
          .eq('id', selectedBatchId)
          .single();
        
        if (batchError || !batchData) {
          console.warn('Failed to load batch data', batchError);
          return;
        }
        
        // Always reload project when batch changes to get fresh extraction fields
        const { data: projectData, error: projectError } = await supabase
          .rpc('get_project_safe', { project_id: batchData.project_id })
          .single();
        
        if (!projectError && projectData) {
          setSelectedProjectId(projectData.id);
          setSelectedProject(projectData);
        }
      } catch (e) {
        console.warn('Failed to load project for batch', e);
      }
    })();
  }, [selectedBatchId]); // Only depend on selectedBatchId to force reload

  useEffect(() => {
    if (!selectedBatchId) return;
    if (isReadyForExport && !readyNotified && selectedBatch?.status !== 'complete') {
      (async () => {
        try {
          await supabase
            .from('batches')
            .update({ metadata: { ...(selectedBatch?.metadata || {}), ready_for_export: true } })
            .eq('id', selectedBatchId);
          toast({ title: 'Ready for Export', description: 'All documents validated. Batch is ready for export.' });
        } catch (e) {
          console.warn('Failed to set ready_for_export flag:', e);
        } finally {
          setReadyNotified(true);
        }
      })();
    }
  }, [isReadyForExport, readyNotified, selectedBatch?.status, selectedBatchId]);

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

    setProcessing(true);
    
    try {
      // First, upload the original PDF file to storage
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

      // Get separation config from project
      const separationConfig: SeparationConfig = (selectedProject as any)?.metadata?.separation_config || { method: 'page_count', pagesPerDocument: 1 } as SeparationConfig;
      
      // Load PDF for analysis
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      
      // Analyze document boundaries based on separation config
      const effectiveConfig: SeparationConfig = (separationConfig.method === 'none' && pdfDoc.numPages > 1)
        ? ({ method: 'page_count', pagesPerDocument: 1 } as SeparationConfig)
        : separationConfig;
      const boundaries = await analyzePdfSeparation(pdfDoc, effectiveConfig);
      
      toast({
        title: 'Processing PDF',
        description: `Found ${boundaries.length} document(s) using ${effectiveConfig.method} separation`,
      });
      
      // Process documents in parallel batches for speed
      const BATCH_SIZE = 8;
      const processingErrors: string[] = [];
      
      for (let batchStart = 0; batchStart < boundaries.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, boundaries.length);
        const batch = boundaries.slice(batchStart, batchEnd);
        
        await Promise.all(
          batch.map(async (boundary, batchIndex) => {
            const i = batchStart + batchIndex;
            const docName = getDocumentName(file.name, i, boundaries.length);
            
            try {
              // Extract text from pages in this boundary
              let extractedPdfText = '';
              for (let pageNum = boundary.startPage; pageNum <= boundary.endPage; pageNum++) {
                try {
                  const page = await pdfDoc.getPage(pageNum);
                  const textContent = await page.getTextContent();
                  const pageText = (textContent.items || [])
                    .map((item: any) => (item && item.str) ? item.str : '')
                    .join(' ');
                  extractedPdfText += pageText + '\n';
                } catch (e) {
                  console.warn(`Failed to extract text from page ${pageNum}:`, e);
                }
              }
              
              // If no text extracted, try OCR on first page of document
              if (!extractedPdfText || extractedPdfText.trim().length < 10) {
                try {
                  const page = await pdfDoc.getPage(boundary.startPage);
                  let viewport = page.getViewport({ scale: 1.5 });
                  const maxDim = 2000;
                  const scale = Math.min(1.5, maxDim / Math.max(viewport.width, viewport.height));
                  viewport = page.getViewport({ scale });
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  canvas.width = Math.ceil(viewport.width);
                  canvas.height = Math.ceil(viewport.height);
                  if (!ctx) throw new Error('Canvas context not available');
                  await page.render({ canvasContext: ctx as any, viewport }).promise;
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  let payloadImageData = await downscaleDataUrl(dataUrl, 1600, 0.85);

                  const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
                    ? selectedProject?.metadata?.table_extraction_config?.fields || []
                    : [];

                  const data = await invokeOcr({
                    imageData: payloadImageData,
                    isPdf: false,
                    extractionFields,
                    tableExtractionFields: tableFields,
                    enableCheckScanning: enableMICR,
                    customerId: selectedProject?.customer_id,
                  });
                  if (!data) {
                    throw new Error('OCR service returned no data');
                  }

                  await saveDocument(docName, 'application/pdf', publicUrl, data.text, data.metadata || {}, data.lineItems || []);
                  return;
                } catch (fallbackErr: any) {
                  console.error('PDF OCR fallback failed:', fallbackErr);
                  throw fallbackErr;
                }
              }

              // Process extracted text
              const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled 
                ? selectedProject?.metadata?.table_extraction_config?.fields || []
                : [];
              
              const data = await invokeOcr({ 
                textData: extractedPdfText,
                isPdf: true,
                extractionFields,
                tableExtractionFields: tableFields,
                enableCheckScanning: enableMICR,
                customerId: selectedProject?.customer_id,
              });
              if (!data) {
                throw new Error('OCR service returned no data');
              }
              
              await saveDocument(docName, 'application/pdf', publicUrl, data.text, data.metadata || {}, data.lineItems || []);
            } catch (err: any) {
              console.error(`Failed to process document ${docName}:`, err);
              processingErrors.push(`${docName}: ${err.message}`);
            }
          })
        );
      }
      
      if (processingErrors.length > 0) {
        toast({
          title: 'Some Documents Failed',
          description: `${processingErrors.length} document(s) failed to process`,
          variant: 'destructive',
        });
      }
      
      toast({ 
        title: 'PDF Processed', 
        description: `Successfully separated into ${boundaries.length} document(s).` 
      });

      // Refresh validation queue and switch to validation tab
      await loadQueueDocuments();
      setTimeout(() => handleTabChange('validation'), 0);
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      toast({
        title: 'PDF Processing Failed',
        description: error.message || 'Failed to process the PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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

    // Validate batch still exists before processing
    const { data: batchCheck, error: batchError } = await supabase
      .from('batches')
      .select('id')
      .eq('id', selectedBatchId)
      .single();
    
    if (batchError || !batchCheck) {
      toast({
        title: 'Invalid Batch',
        description: 'The selected batch no longer exists. Please select a valid batch.',
        variant: 'destructive',
      });
      setSelectedBatchId(null);
      setSelectedBatch(null);
      sessionStorage.removeItem('selectedBatchId');
      return;
    }

    const total = files.length;
    toast({ title: 'Processing Multiple Files', description: `Processing ${total} files...` });
    setProcessing(true);

    const MAX_CONCURRENT = 8; // Optimal throughput
    const queue = [...files];
    const processingErrors: string[] = [];
    let processed = 0;

    const processFile = async (file: File) => {
      try {
        if (file.type === 'application/pdf') {
          await processPdf(file);
        } else if (file.type.startsWith('image/')) {
          if (isTiffFile(file)) {
            const pngDataUrl = await convertTiffToPngDataUrl(file);
            await handleScanComplete('', pngDataUrl, file.name.replace(/\.tiff?$/i, '.png'));
          } else {
            const reader = new FileReader();
            const imageData = await new Promise<string>((resolve, reject) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            await handleScanComplete('', imageData, file.name);
          }
        }
      } catch (err: any) {
        console.error(`Error processing file ${file.name}:`, err);
        processingErrors.push(`${file.name}: ${err?.message || 'Unknown error'}`);
      } finally {
        processed += 1;
      }
    };

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }).map(async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        await processFile(next);
        // Small delay to reduce chance of rate limiting
        await new Promise((r) => setTimeout(r, 150));
      }
    });

    await Promise.all(workers);

    setProcessing(false);

    if (processingErrors.length > 0) {
      toast({
        title: 'Some Documents Failed',
        description: `${processingErrors.length} of ${total} document(s) failed to process`,
        variant: 'destructive',
      });
    }

    toast({ title: 'Batch Complete', description: `Successfully processed ${processed} of ${total} files` });

    // After processing all files, go to Validation tab
    await loadQueueDocuments();
    setTimeout(() => handleTabChange('validation'), 0);
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

    // Validate batch still exists
    const { data: batchCheck, error: batchError } = await supabase
      .from('batches')
      .select('id')
      .eq('id', selectedBatchId)
      .single();
    
    if (batchError || !batchCheck) {
      toast({
        title: 'Invalid Batch',
        description: 'The selected batch no longer exists. Please select a valid batch.',
        variant: 'destructive',
      });
      setSelectedBatchId(null);
      setSelectedBatch(null);
      sessionStorage.removeItem('selectedBatchId');
      setProcessing(false);
      return;
    }

    setProcessing(true);

    try {
      const tableFields = selectedProject?.metadata?.table_extraction_config?.enabled
        ? selectedProject?.metadata?.table_extraction_config?.fields || []
        : [];
      
      // Downscale large inline images to avoid request size limits
      let payloadImageData = imageUrl;
      if (typeof payloadImageData === 'string' && payloadImageData.startsWith('data:')) {
        try {
          payloadImageData = await downscaleDataUrl(payloadImageData, 1600, 0.85);
        } catch (e) {
          console.warn('Image downscale failed, sending original');
        }
      }
      
      const data = await invokeOcr({ 
        imageData: payloadImageData,
        isPdf: false,
        extractionFields,
        tableExtractionFields: tableFields,
        enableCheckScanning: enableMICR,
        customerId: selectedProject?.customer_id,
      });

      if (!data) {
        throw new Error('OCR service returned no data');
      }

      await saveDocument(fileName, 'image', imageUrl, data.text, data.metadata || {}, data.lineItems || []);

      toast({
        title: 'Scan Complete',
        description: 'Text and metadata extracted successfully.',
      });

      // Refresh validation queue and switch to validation tab
      await loadQueueDocuments();
      // Defer tab switch to avoid race conditions with Radix Tabs rendering
      setTimeout(() => handleTabChange('validation'), 0);
    } catch (error: any) {
      console.error('Error processing scan:', error);
      logError('Queue.handleScanComplete', error);
      toast({
        title: 'Scan Failed',
        description: safeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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

  const exportBatch = async (format: 'csv' | 'json' | 'xml' | 'txt' | 'sql' | 'access' | 'oracle') => {
    if (!validatedDocs.length) {
      toast({
        title: 'No Documents',
        description: 'No validated documents to export',
        variant: 'destructive',
      });
      return;
    }

    // Get batch custom fields from metadata
    const batchCustomFields = (selectedBatch?.metadata as any)?.custom_fields || {};

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
        // Include batch custom fields in headers
        const batchFieldHeaders = Object.keys(batchCustomFields);
        const headers = ['File Name', 'Date', ...batchFieldHeaders, ...Array.from(metadataKeys)];
        const rows = validatedDocs.map(doc => {
          const row: string[] = [
            doc.file_name,
            new Date(doc.created_at).toLocaleDateString(),
          ];
          // Add batch custom field values
          batchFieldHeaders.forEach(key => {
            row.push(batchCustomFields[key] || '');
          });
          // Add document metadata
          metadataKeys.forEach(key => {
            row.push(extractMetadataValue(doc.extracted_metadata?.[key]) || '');
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
          batchFields: batchCustomFields,
          metadata: doc.extracted_metadata,
          extractedText: doc.extracted_text,
        }));
        content = JSON.stringify({ batch: selectedBatch?.batch_name, batchFields: batchCustomFields, documents: jsonData }, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;

      case 'xml':
        content = '<?xml version="1.0" encoding="UTF-8"?>\n<batch>\n';
        content += `  <name>${selectedBatch?.batch_name || 'export'}</name>\n`;
        content += `  <exportDate>${new Date().toISOString()}</exportDate>\n`;
        // Add batch custom fields
        if (Object.keys(batchCustomFields).length > 0) {
          content += '  <batchFields>\n';
          Object.entries(batchCustomFields).forEach(([key, value]) => {
            content += `    <${key}>${value}</${key}>\n`;
          });
          content += '  </batchFields>\n';
        }
        content += '  <documents>\n';
        validatedDocs.forEach(doc => {
          content += '    <document>\n';
          content += `      <fileName>${doc.file_name}</fileName>\n`;
          content += `      <date>${new Date(doc.created_at).toISOString()}</date>\n`;
          content += '      <metadata>\n';
          Object.entries(doc.extracted_metadata || {}).forEach(([key, value]) => {
            content += `        <${key}>${extractMetadataValue(value)}</${key}>\n`;
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
        content += `Total Documents: ${validatedDocs.length}\n`;
        // Add batch custom fields
        if (Object.keys(batchCustomFields).length > 0) {
          content += '\nBatch Fields:\n';
          Object.entries(batchCustomFields).forEach(([key, value]) => {
            content += `  ${key}: ${value}\n`;
          });
        }
        content += '\n' + '='.repeat(80) + '\n\n';
        validatedDocs.forEach((doc, index) => {
          content += `Document ${index + 1}: ${doc.file_name}\n`;
          content += `Date: ${new Date(doc.created_at).toLocaleDateString()}\n`;
          content += 'Metadata:\n';
          Object.entries(doc.extracted_metadata || {}).forEach(([key, value]) => {
            content += `  ${key}: ${extractMetadataValue(value)}\n`;
          });
          content += '\n' + '-'.repeat(80) + '\n\n';
        });
        mimeType = 'text/plain';
        extension = 'txt';
        break;

      case 'sql':
        // SQL INSERT statements
        const tableName = (selectedBatch?.batch_name || 'documents').replace(/[^a-zA-Z0-9_]/g, '_');
        content = `-- SQL Export for ${selectedBatch?.batch_name || 'export'}\n`;
        content += `-- Generated on ${new Date().toISOString()}\n\n`;
        content += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        content += `  id INT PRIMARY KEY AUTO_INCREMENT,\n`;
        content += `  file_name VARCHAR(255),\n`;
        content += `  created_date DATETIME,\n`;
        Object.keys(batchCustomFields).forEach(key => {
          content += `  ${key.replace(/[^a-zA-Z0-9_]/g, '_')} TEXT,\n`;
        });
        metadataKeys.forEach(key => {
          content += `  ${key.replace(/[^a-zA-Z0-9_]/g, '_')} TEXT,\n`;
        });
        content = content.slice(0, -2) + '\n);\n\n';
        validatedDocs.forEach(doc => {
          const values: string[] = [
            `'${doc.file_name.replace(/'/g, "''")}'`,
            `'${new Date(doc.created_at).toISOString()}'`,
          ];
          Object.keys(batchCustomFields).forEach(key => {
            values.push(`'${String(batchCustomFields[key] || '').replace(/'/g, "''")}'`);
          });
          metadataKeys.forEach(key => {
            const val = extractMetadataValue(doc.extracted_metadata?.[key]) || '';
            values.push(`'${String(val).replace(/'/g, "''")}'`);
          });
          content += `INSERT INTO ${tableName} VALUES (NULL, ${values.join(', ')});\n`;
        });
        mimeType = 'text/plain';
        extension = 'sql';
        break;

      case 'access':
        // Microsoft Access-compatible SQL
        const accessTableName = (selectedBatch?.batch_name || 'documents').replace(/[^a-zA-Z0-9_]/g, '_');
        content = `-- Microsoft Access Export for ${selectedBatch?.batch_name || 'export'}\n`;
        content += `-- Generated on ${new Date().toISOString()}\n\n`;
        content += `CREATE TABLE [${accessTableName}] (\n`;
        content += `  [ID] AUTOINCREMENT PRIMARY KEY,\n`;
        content += `  [FileName] TEXT(255),\n`;
        content += `  [CreatedDate] DATETIME,\n`;
        Object.keys(batchCustomFields).forEach(key => {
          content += `  [${key}] MEMO,\n`;
        });
        metadataKeys.forEach(key => {
          content += `  [${key}] MEMO,\n`;
        });
        content = content.slice(0, -2) + '\n);\n\n';
        validatedDocs.forEach(doc => {
          const values: string[] = [
            `'${doc.file_name.replace(/'/g, "''")}'`,
            `#${new Date(doc.created_at).toLocaleDateString()}#`,
          ];
          Object.keys(batchCustomFields).forEach(key => {
            values.push(`'${String(batchCustomFields[key] || '').replace(/'/g, "''")}'`);
          });
          metadataKeys.forEach(key => {
            const val = extractMetadataValue(doc.extracted_metadata?.[key]) || '';
            values.push(`'${String(val).replace(/'/g, "''")}'`);
          });
          content += `INSERT INTO [${accessTableName}] ([FileName], [CreatedDate]`;
          Object.keys(batchCustomFields).forEach(key => {
            content += `, [${key}]`;
          });
          metadataKeys.forEach(key => {
            content += `, [${key}]`;
          });
          content += `) VALUES (${values.join(', ')});\n`;
        });
        mimeType = 'text/plain';
        extension = 'sql';
        break;

      case 'oracle':
        // Oracle SQL
        const oracleTableName = (selectedBatch?.batch_name || 'documents').replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
        content = `-- Oracle SQL Export for ${selectedBatch?.batch_name || 'export'}\n`;
        content += `-- Generated on ${new Date().toISOString()}\n\n`;
        content += `CREATE TABLE ${oracleTableName} (\n`;
        content += `  ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n`;
        content += `  FILE_NAME VARCHAR2(255),\n`;
        content += `  CREATED_DATE TIMESTAMP,\n`;
        Object.keys(batchCustomFields).forEach(key => {
          content += `  ${key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()} CLOB,\n`;
        });
        metadataKeys.forEach(key => {
          content += `  ${key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()} CLOB,\n`;
        });
        content = content.slice(0, -2) + '\n);\n\n';
        validatedDocs.forEach(doc => {
          const values: string[] = [
            `'${doc.file_name.replace(/'/g, "''")}'`,
            `TO_TIMESTAMP('${new Date(doc.created_at).toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`,
          ];
          Object.keys(batchCustomFields).forEach(key => {
            values.push(`'${String(batchCustomFields[key] || '').replace(/'/g, "''")}'`);
          });
          metadataKeys.forEach(key => {
            const val = extractMetadataValue(doc.extracted_metadata?.[key]) || '';
            values.push(`'${String(val).replace(/'/g, "''")}'`);
          });
          content += `INSERT INTO ${oracleTableName} (FILE_NAME, CREATED_DATE`;
          Object.keys(batchCustomFields).forEach(key => {
            content += `, ${key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`;
          });
          metadataKeys.forEach(key => {
            content += `, ${key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`;
          });
          content += `) VALUES (${values.join(', ')});\n`;
        });
        mimeType = 'text/plain';
        extension = 'sql';
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

  // ECM export helpers
  const getExportConfig = () => {
    const metadata = selectedProject?.metadata as any;
    return metadata?.export_config || metadata?.exportConfig || {};
  };

  const exportToFilebound = async () => {
    const exportConfig = getExportConfig();
    const fb = exportConfig.filebound;
    if (!fb?.enabled || !fb.url) {
      toast({ title: 'Filebound not configured', description: 'Configure Filebound export in project settings.', variant: 'destructive' });
      return;
    }
    if (!validatedDocs.length) {
      toast({ title: 'No Documents', description: 'No validated documents to export', variant: 'destructive' });
      return;
    }
    try {
      setIsExporting(true);
      toast({ title: 'Exporting to Filebound', description: `Project: ${fb.project}` });
      const { data, error } = await supabase.functions.invoke('export-to-filebound', {
        body: {
          batchId: selectedBatchId
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Exported to Filebound', description: `Exported ${validatedDocs.length} documents` });
      } else {
        throw new Error(data?.error || 'Export failed');
      }
    } catch (err: any) {
      console.error('Filebound export error:', err);
      toast({ title: 'Export failed', description: err.message || 'Failed to export to Filebound', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToDocmgt = async () => {
    const exportConfig = getExportConfig();
    const dm = exportConfig.docmgt;
    if (!dm?.enabled || !dm.url) {
      toast({ title: 'Docmgt not configured', description: 'Configure Docmgt export in project settings.', variant: 'destructive' });
      return;
    }
    if (!validatedDocs.length) {
      toast({ title: 'No Documents', description: 'No validated documents to export', variant: 'destructive' });
      return;
    }
    try {
      setIsExporting(true);
      toast({ title: 'Exporting to Docmgt', description: `Project: ${dm.project}` });
      const { data, error } = await supabase.functions.invoke('export-to-docmgt', {
        body: {
          batchId: selectedBatchId,
          recordTypeId: dm.recordTypeId || (Number.isFinite(Number(dm.project)) ? Number(dm.project) : undefined),
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Exported to Docmgt', description: `Exported ${validatedDocs.length} documents` });
      } else {
        const available = Array.isArray((data as any)?.availableRecordTypes)
          ? (data as any).availableRecordTypes.filter((rt: any) => rt?.id)
          : [];
        if (available.length) {
          setDocmgtRtOptions(available);
          setDocmgtSelectedRtId(String(available[0].id));
          setDocmgtRtDialogOpen(true);
          toast({ title: 'Select Docmgt RecordType', description: 'Choose a RecordType to retry export.' });
          return;
        }
        const detail = (data as any)?.results?.find((r: any) => r?.error)?.error || (data as any)?.message || (data as any)?.error || 'Export failed';
        toast({ title: 'Export failed', description: detail, variant: 'destructive' });
        return;
      }
    } catch (err: any) {
      console.error('Docmgt export error:', err);
      toast({ title: 'Export failed', description: err.message || 'Failed to export to Docmgt', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const retryDocmgtExportWithRecordType = async () => {
    if (!docmgtSelectedRtId) return;
    try {
      setIsExporting(true);
      const { data, error } = await supabase.functions.invoke('export-to-docmgt', {
        body: { batchId: selectedBatchId, recordTypeId: Number(docmgtSelectedRtId) },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Exported to Docmgt', description: `Exported ${validatedDocs.length} documents` });
        setDocmgtRtDialogOpen(false);
      } else {
        const detail = (data as any)?.message || (data as any)?.error || 'Export failed';
        toast({ title: 'Export failed', description: detail, variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Docmgt export retry error:', err);
      toast({ title: 'Export failed', description: err.message || 'Failed to export to Docmgt', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
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
        // Get signed URL for secure access
        const signedUrl = await getSignedUrl(doc.file_url);
        const response = await fetch(signedUrl);
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
      setIsExporting(true);
      
      // Check if any ECM exports are configured
      const exportConfig = getExportConfig();
      const autoExports: string[] = [];

      // Auto-export to Filebound if configured
      if (exportConfig.filebound?.enabled) {
        try {
          console.log('Auto-exporting to Filebound...');
          const { data, error } = await supabase.functions.invoke('export-to-filebound', {
            body: { batchId: selectedBatchId }
          });
          if (error) throw error;
          autoExports.push('Filebound');
          console.log('Filebound export successful:', data);
        } catch (err: any) {
          console.error('Filebound auto-export failed:', err);
          toast({
            title: 'Filebound Export Failed',
            description: err.message || 'Failed to export to Filebound',
            variant: 'destructive',
          });
        }
      }

      // Auto-export to Docmgt if configured
      if (exportConfig.docmgt?.enabled) {
        try {
          console.log('Auto-exporting to Docmgt...');
          const { data, error } = await supabase.functions.invoke('export-to-docmgt', {
            body: {
              batchId: selectedBatchId,
              recordTypeId: Number.isFinite(Number(exportConfig.docmgt.project)) ? Number(exportConfig.docmgt.project) : (exportConfig.docmgt.recordTypeId || undefined),
            }
          });
          if (error) throw error;
          if (data?.success) {
            autoExports.push('Docmgt');
            console.log('Docmgt export successful:', data);
          } else {
            const available = Array.isArray((data as any)?.availableRecordTypes)
              ? (data as any).availableRecordTypes.filter((rt: any) => rt?.id)
              : [];
            if (available.length) {
              setDocmgtRtOptions(available);
              setDocmgtSelectedRtId(String(available[0].id));
              setDocmgtRtDialogOpen(true);
              toast({ title: 'Select Docmgt RecordType', description: 'Choose a RecordType to retry export.' });
            } else {
              const detail = (data as any)?.message || (data as any)?.error || 'Export failed';
              throw new Error(detail);
            }
          }
        } catch (err: any) {
          console.error('Docmgt auto-export failed:', err);
          toast({
            title: 'Docmgt Export Failed',
            description: err.message || 'Failed to export to Docmgt',
            variant: 'destructive',
          });
        }
      }

      // Mark batch as complete
      const { error } = await supabase
        .from('batches')
        .update({ 
          status: 'complete',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedBatchId);

      if (error) throw error;

      const exportMessage = autoExports.length > 0 
        ? ` and exported to ${autoExports.join(', ')}`
        : '';

      toast({
        title: 'Batch Completed',
        description: `Batch marked as complete${exportMessage}`,
      });

      setSelectedBatch({ ...selectedBatch, status: 'complete' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
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
            doc.text(`  ${key}: ${extractMetadataValue(value)}`, 25, yPosition);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <img 
                src={wisdmLogo} 
                alt="WISDM Logo" 
                className="h-10 w-auto transition-transform duration-300 hover:scale-105" 
              />
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate">
                  Document Processing
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Scan → Extract → Validate → Export</p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                <span className="text-xs font-semibold text-primary">⚡ AI</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  console.log('Help button clicked - navigating to /help');
                  navigate('/help');
                }} 
                className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-3"
              >
                <HelpCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Help</span>
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-3">
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate('/batches')} className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-3">
                <FolderOpen className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Batches</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-3">
                <User className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button variant="outline" size="sm" onClick={signOut} className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-3">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <LicenseWarning />
        
        <div className="space-y-3 sm:space-y-6 mb-4 sm:mb-6">
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectSelect={(id, project) => {
              setSelectedProjectId(id);
              setSelectedProject(project);
              sessionStorage.setItem('selectedProjectId', id);
              setSelectedBatchId(null);
              setSelectedBatch(null);
              sessionStorage.removeItem('selectedBatchId');
            }}
          />
          
          {selectedProjectId && (
            <BatchSelector
              selectedBatchId={selectedBatchId}
              onBatchSelect={(id, batch) => {
                setSelectedBatchId(id);
                setSelectedBatch(batch);
                if (id) {
                  sessionStorage.setItem('selectedBatchId', id);
                } else {
                  sessionStorage.removeItem('selectedBatchId');
                }
              }}
              projectId={selectedProjectId}
            />
          )}
        </div>

        {selectedProjectId && selectedBatchId && (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 sm:mb-6 h-auto sm:h-12 bg-muted/50 p-1 backdrop-blur-sm">
              <TabsTrigger value="scan" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-0 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">
                <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Scan</span>
              </TabsTrigger>
              <TabsTrigger value="validation" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-0 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">
                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium hidden sm:inline">Validation</span>
                <span className="font-medium sm:hidden">Valid</span>
                <Badge variant="secondary" className="text-xs sm:ml-1 bg-primary/10 text-primary border-0">
                  {validationQueue.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="validated" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-0 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium hidden sm:inline">Quality Control</span>
                <span className="font-medium sm:hidden">QC</span>
                <Badge variant="secondary" className="text-xs sm:ml-1 bg-success/10 text-success border-0">
                  {validatedDocs.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-0 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Export</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="scan" className="animate-fade-in">
              {!permissions.can_scan ? (
                <Card className="p-6 sm:p-12 text-center border-destructive/50 bg-destructive/5">
                  <Upload className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-destructive" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Scan Access Restricted</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">You don't have permission to scan documents. Contact your administrator.</p>
                </Card>
              ) : (
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
                  <TabsTrigger value="upload" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="scanner" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                    <ScanLine className="h-3 w-3 sm:h-4 sm:w-4" />
                    Scanner
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
              )}
            </TabsContent>
            
            <TabsContent value="validation">
              {!permissions.can_validate ? (
                <Card className="p-12 text-center border-destructive/50 bg-destructive/5">
                  <Eye className="h-16 w-16 mx-auto mb-4 text-destructive" />
                  <h3 className="text-xl font-semibold mb-2">Validation Access Restricted</h3>
                  <p className="text-muted-foreground">You don't have permission to validate documents. Contact your administrator.</p>
                </Card>
              ) : validationQueue.length === 0 ? (
                <Card className="p-12 text-center">
                  <Eye className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Documents Awaiting Validation</h3>
                  <p className="text-muted-foreground">Scan documents to add them to the validation queue</p>
                </Card>
              ) : (
                <BatchValidationScreen
                  documents={validationQueue}
                  projectFields={extractionFields}
                  onValidationComplete={loadQueueDocuments}
                  batchId={selectedBatchId}
                  onSwitchToExport={() => handleTabChange('export')}
                />
              )}
            </TabsContent>
            
            <TabsContent value="validated" className="animate-fade-in">
              <div className="space-y-4">
                {isReadyForExport && (
                  <Card className="p-4 border-success/40 bg-success/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-success">Ready for Export</h4>
                        <p className="text-sm text-muted-foreground">All documents are validated. You can export the batch now.</p>
                      </div>
                      <Button variant="outline" onClick={() => handleTabChange('export')} className="hover:border-success/50 hover:bg-success/10">
                        Go to Export
                      </Button>
                    </div>
                  </Card>
                )}
                {validatedDocs.length === 0 ? (
                  <Card className="p-12 text-center border-dashed border-2 bg-gradient-to-br from-success/5 to-accent/10">
                    <div className="animate-scale-in">
                      <CheckCircle className="h-16 w-16 mx-auto mb-4 text-success/40" />
                      <h3 className="text-xl font-semibold mb-2">No Quality Control Documents</h3>
                      <p className="text-muted-foreground">Validate documents to see them here</p>
                    </div>
                  </Card>
                ) : (
                  validatedDocs.map((doc) => (
                    <Card 
                      key={doc.id} 
                      className="p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border-l-4 border-l-success bg-gradient-to-r from-success/5 to-transparent"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-success" />
                            <h3 className="text-lg font-semibold">{doc.file_name}</h3>
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                              Quality Control
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">
                            {new Date(doc.created_at).toLocaleString()}
                          </p>
                          {doc.extracted_metadata && Object.keys(doc.extracted_metadata).length > 0 && (
                            <div className="bg-muted/30 rounded-lg p-4 backdrop-blur-sm">
                              <p className="text-xs font-semibold text-muted-foreground mb-3">Extracted Metadata</p>
                              <div className="grid md:grid-cols-2 gap-3">
                                {Object.entries(doc.extracted_metadata).map(([key, value]) => (
                                  <div key={key} className="text-sm">
                                    <span className="font-medium text-foreground">{key}:</span>{' '}
                                    <span className="text-muted-foreground">{extractMetadataValue(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="export">
              {!permissions.can_export ? (
                <Card className="p-12 text-center border-destructive/50 bg-destructive/5">
                  <Download className="h-16 w-16 mx-auto mb-4 text-destructive" />
                  <h3 className="text-xl font-semibold mb-2">Export Access Restricted</h3>
                  <p className="text-muted-foreground">You don't have permission to export documents. Contact your administrator.</p>
                </Card>
              ) : (
              <Card className="p-8">
                <div className="text-center mb-6">
                  <Download className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <h3 className="text-2xl font-semibold mb-2">Export Batch</h3>
                  <p className="text-muted-foreground">
                    Export all validated documents from this batch
                  </p>
                  {isReadyForExport && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-success/30 bg-success/10 text-success text-sm">
                      Ready for Export
                    </div>
                  )}
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
                      <p className="text-sm text-muted-foreground">Quality Control</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3">Export Metadata</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {(selectedProject?.export_types?.includes('csv') || getExportConfig().csv?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('csv')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">CSV Format</span>
                        </Button>
                      )}
                      {(selectedProject?.export_types?.includes('json') || getExportConfig().json?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('json')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">JSON Format</span>
                        </Button>
                      )}
                      {(selectedProject?.export_types?.includes('xml') || getExportConfig().xml?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('xml')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">XML Format</span>
                        </Button>
                      )}
                      {(selectedProject?.export_types?.includes('txt') || getExportConfig().txt?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('txt')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">TXT Format</span>
                        </Button>
                      )}
                      {(selectedProject?.export_types?.includes('sql') || getExportConfig().sql?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('sql')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">SQL Format</span>
                        </Button>
                      )}
                      {(selectedProject?.export_types?.includes('access') || getExportConfig().access?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('access')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">Access Format</span>
                        </Button>
                      )}
                      {(selectedProject?.export_types?.includes('oracle') || getExportConfig().oracle?.enabled) && (
                        <Button 
                          onClick={() => exportBatch('oracle')} 
                          disabled={validatedDocs.length === 0 || isExporting} 
                          variant="outline"
                          className="h-20 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Download className="h-5 w-5" />
                          <span className="font-medium">Oracle Format</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {(selectedProject?.export_types?.includes('images') || getExportConfig().images?.enabled) && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Image Export</h4>
                      <Button 
                        onClick={exportImages} 
                        disabled={validatedDocs.length === 0} 
                        variant="outline" 
                        className="w-full h-16 gap-2 hover:border-primary/50 hover:bg-primary/5"
                      >
                        <Download className="h-5 w-5" />
                        <span className="font-medium">Download All Images</span>
                      </Button>
                    </div>
                  )}

                  {(selectedProject?.export_types?.includes('pdf') || getExportConfig().pdf?.enabled) && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">PDF Report</h4>
                      <Button 
                        onClick={generatePDF} 
                        disabled={validatedDocs.length === 0} 
                        variant="outline" 
                        className="w-full h-16 gap-2 hover:border-primary/50 hover:bg-primary/5"
                      >
                        <FileText className="h-5 w-5" />
                        <span className="font-medium">Generate PDF with Metadata</span>
                      </Button>
                    </div>
                  )}

                  {(getExportConfig().filebound?.enabled || getExportConfig().docmgt?.enabled) && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">External ECM Exports</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {getExportConfig().filebound?.enabled && (
                          <Button onClick={exportToFilebound} disabled={validatedDocs.length === 0 || isExporting} variant="outline" className="h-16 gap-2 hover:border-primary/50 hover:bg-primary/5">
                            <Cloud className="h-5 w-5" />
                            <span className="font-medium">Export to Filebound</span>
                          </Button>
                        )}
                        {getExportConfig().docmgt?.enabled && (
                          <Button onClick={exportToDocmgt} disabled={validatedDocs.length === 0 || isExporting} variant="outline" className="h-16 gap-2 hover:border-primary/50 hover:bg-primary/5">
                            <Database className="h-5 w-5" />
                            <span className="font-medium">Export to Docmgt</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-6 border-t">
                    <Button 
                      onClick={markBatchComplete} 
                      disabled={validatedDocs.length === 0 || selectedBatch?.status === 'complete' || isExporting}
                      className="w-full h-14 text-base gap-2 bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70"
                      size="lg"
                    >
                      <CheckCircle className="h-5 w-5" />
                      {isExporting ? 'Exporting & Completing...' : selectedBatch?.status === 'complete' ? 'Batch Completed' : 'Mark Batch as Complete'}
                    </Button>
                    {(getExportConfig().filebound?.enabled || getExportConfig().docmgt?.enabled) && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Will automatically export to {[
                          getExportConfig().filebound?.enabled && 'Filebound',
                          getExportConfig().docmgt?.enabled && 'Docmgt'
                        ].filter(Boolean).join(' and ')} when completed
                      </p>
                    )}
                  </div>
                </div>
              </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
</main>

      <AlertDialog open={docmgtRtDialogOpen} onOpenChange={setDocmgtRtDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Docmgt RecordType</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a RecordType to retry the export.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={docmgtSelectedRtId} onValueChange={setDocmgtSelectedRtId}>
              <SelectTrigger>
                <SelectValue placeholder="Select RecordType" />
              </SelectTrigger>
              <SelectContent>
                {docmgtRtOptions.map((rt) => (
                  <SelectItem key={String(rt.id)} value={String(rt.id)}>
                    {rt.name} (ID: {String(rt.id)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={retryDocmgtExportWithRecordType} disabled={!docmgtSelectedRtId || isExporting}>
              {isExporting ? 'Exporting...' : 'Retry Export'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
