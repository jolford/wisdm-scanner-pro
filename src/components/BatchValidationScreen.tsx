// React core hooks for state management and side effects
import { useState, useEffect } from 'react';

// UI component imports from shadcn/ui library
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SignatureValidator } from './SignatureValidator';

// Icon imports from lucide-react
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, Printer, Download, RefreshCw, Lightbulb, Loader2, Sparkles, FileText, ShieldAlert, Pencil, Plus } from 'lucide-react';

// Backend and utility imports
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImageRegionSelector } from './ImageRegionSelector';
import { useSignedUrl, getSignedUrl } from '@/hooks/use-signed-url';
import { detectKeywords } from '@/lib/keyword-redaction';
import { ViewOriginalButton } from './ViewOriginalButton';
import { RedactionTool } from './RedactionTool';
// Enhanced feature components
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { SearchFilterBar, DocumentFilters } from './SearchFilterBar';
import { ProgressTrackingDashboard } from './ProgressTrackingDashboard';
import { SmartSuggestionsPanel } from './SmartSuggestionsPanel';
import { PetitionValidationWarnings } from './PetitionValidationWarnings';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useBulkSelection } from '@/hooks/use-bulk-selection';

// Collapsible UI components for expandable document cards
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// PDF.js library for rendering PDF thumbnails and previews
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Configure PDF.js worker once at module load
// This enables PDF processing in a separate thread for better performance
if ((pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
}


/**
 * Document interface representing a single document in the validation queue
 * @property id - Unique identifier for the document
 * @property file_name - Original filename of the uploaded document
 * @property file_url - Storage URL where the document file is located
 * @property extracted_text - Full OCR text extracted from the document
 * @property extracted_metadata - Key-value pairs of extracted fields (e.g., invoice number, date)
 * @property validation_status - Current validation state (pending, validated, rejected)
 */
interface Document {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  extracted_text: string;
  extracted_metadata: Record<string, string>;
  validation_status: string;
  line_items?: Array<Record<string, any>>;
  document_type?: string;
  classification_confidence?: number;
  classification_metadata?: {
    reasoning?: string;
    classified_at?: string;
  };
  // Optional OCR geometry stored with the document (if available)
  word_bounding_boxes?: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>; 
  bounding_boxes?: Record<string, { x: number; y: number; width: number; height: number }>;
}

/**
 * Props for the BatchValidationScreen component
 * @property documents - Array of documents awaiting validation
 * @property projectFields - Field definitions from the project (what metadata to extract)
 * @property onValidationComplete - Callback triggered after a document is validated/rejected
 * @property batchId - ID of the current batch being validated
 * @property onSwitchToExport - Optional callback to switch to export view after validation
 */
interface BatchValidationScreenProps {
  documents: Document[];
  allDocuments?: Document[]; // All documents in batch for progress calculation
  projectFields: Array<{ name: string; description: string }>;
  onValidationComplete: () => void;
  batchId: string;
  batchName?: string;
  onSwitchToExport?: () => void;
  enableSignatureVerification?: boolean;
  detectPii?: boolean; // Whether PII detection is enabled for this project
}

/**
 * BatchValidationScreen Component
 * Displays a queue of documents for validation, allowing users to review extracted metadata,
 * edit fields, select regions on images for re-extraction, and approve/reject documents.
 */
export const BatchValidationScreen = ({
  documents,
  allDocuments,
  projectFields,
  onValidationComplete,
  batchId,
  batchName,
  onSwitchToExport,
  enableSignatureVerification = false,
  detectPii = false,
}: BatchValidationScreenProps) => {
  // Check if this is an AB1466 batch
  const isAB1466Batch = batchName?.includes('AB1466');
  // Check if this is a petition processing project (AB1466 or contains "petition" in name)
  const isPetitionProject = batchName?.toLowerCase().includes('petition') || isAB1466Batch;
  // Track which document cards are expanded (showing details)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  
  // Store user edits to metadata fields (keyed by document ID, then field name)
  const [editedMetadata, setEditedMetadata] = useState<Record<string, Record<string, string>>>({});
  
  // Store user edits to line items (keyed by document ID)
  const [editedLineItems, setEditedLineItems] = useState<Record<string, Array<Record<string, any>>>>({});
  
  // Track which document's line items are expanded
  const [expandedLineItems, setExpandedLineItems] = useState<Record<string, boolean>>({});
  
  // Track which documents are currently being validated (for loading states)
  const [validatingDocs, setValidatingDocs] = useState<Set<string>>(new Set());
  
  // Track zoom levels for each document
  const [documentZoom, setDocumentZoom] = useState<Record<string, number>>({});
  
  // Track rotation for each document (in degrees)
  const [documentRotation, setDocumentRotation] = useState<Record<string, number>>({});
  
  // Track which documents have region selector active
  const [showRegionSelector, setShowRegionSelector] = useState<Set<string>>(new Set());
  
  // Track offensive language detection results for each document
  const [offensiveLanguageResults, setOffensiveLanguageResults] = useState<Record<string, { highlights: any[] }>>({});
  const [isScanning, setIsScanning] = useState(false);
  
  // Fallback PII detection counts computed client-side when DB flag not present
  const [computedPiiCounts, setComputedPiiCounts] = useState<Record<string, number>>({});
  
  // Track which documents are showing unredacted originals (default redacted for PII docs)
  const [showingOriginal, setShowingOriginal] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Only run client-side PII detection if project has PII detection enabled
    if (!detectPii) {
      setComputedPiiCounts({});
      return;
    }
    
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      const hasDbFlag = (doc as any).pii_detected;
      if (!hasDbFlag && doc.extracted_text) {
        try {
          const detected = detectKeywords(
            doc.extracted_text,
            { wordBoundingBoxes: (doc as any).word_bounding_boxes },
            [],
            true // include PII patterns
          );
          counts[doc.id] = detected.length;
        } catch (_) {
          // ignore
        }
      }
    }
    setComputedPiiCounts(counts);
  }, [documents, detectPii]);
  
  // Track calculation variance for each document
  const [calculationVariance, setCalculationVariance] = useState<Record<string, {
    hasVariance: boolean;
    calculatedTotal: string;
    invoiceTotal: string;
    variance: string;
    variancePercent: string;
  }>>({});
  
  // Track AI validation state for each document and field
  const [validatingFields, setValidatingFields] = useState<Set<string>>(new Set());
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, Record<string, number>>>({});
  // Translated text cache per document
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>({});
  
  // Current document index for keyboard navigation
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  
  // Toast notifications for user feedback
const { toast } = useToast();
  const [signatureDialogDocId, setSignatureDialogDocId] = useState<string | null>(null);
  const [redactionDialogDocId, setRedactionDialogDocId] = useState<string | null>(null);
  
  // Filter documents based on search and filters
  const filteredDocuments = documents.filter(doc => {
    // Search across all fields
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const metadata = doc.extracted_metadata as Record<string, any> || {};
      const matchesSearch = 
        doc.file_name?.toLowerCase().includes(searchLower) ||
        Object.values(metadata).some(value => 
          String(value).toLowerCase().includes(searchLower)
        );
      if (!matchesSearch) return false;
    }

    // Apply filters
    if (filters.documentType && doc.document_type !== filters.documentType) {
      return false;
    }
    
    if (filters.minConfidence && doc.classification_confidence) {
      if (doc.classification_confidence < filters.minConfidence / 100) {
        return false;
      }
    }
    
    if (filters.hasIssues) {
      const hasIssues = 
        offensiveLanguageResults[doc.id] ||
        calculationVariance[doc.id]?.hasVariance;
      if (!hasIssues) return false;
    }

    return true;
  });
  
  // Bulk selection hook
  const {
    selectedIds,
    toggleSelection,
    clearSelection,
    isSelected,
    selectedCount,
    toggleAll,
    isAllSelected,
  } = useBulkSelection(filteredDocuments);
  
  // Calculate progress metrics from all documents in batch (not just pending ones)
  const docsForMetrics = allDocuments || documents;
  const progressMetrics = {
    totalDocuments: docsForMetrics.length,
    validated: docsForMetrics.filter(d => d.validation_status === 'validated').length,
    pending: docsForMetrics.filter(d => d.validation_status === 'pending').length,
    rejected: docsForMetrics.filter(d => d.validation_status === 'rejected').length,
    avgTimePerDoc: 45, // This could be calculated from actual validation times
    accuracy: docsForMetrics.length > 0 
      ? Math.round((docsForMetrics.filter(d => d.validation_status === 'validated').length / docsForMetrics.length) * 100)
      : 0,
    topVendor: undefined, // Could be calculated from metadata
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'v',
        description: 'Validate current document',
        category: 'Validation',
        handler: () => {
          const currentDoc = filteredDocuments[currentDocIndex];
          if (currentDoc && currentDoc.validation_status === 'pending') {
            handleValidate(currentDoc, 'validated');
          }
        },
      },
      {
        key: 'r',
        description: 'Reject current document',
        category: 'Validation',
        handler: () => {
          const currentDoc = filteredDocuments[currentDocIndex];
          if (currentDoc && currentDoc.validation_status === 'pending') {
            handleValidate(currentDoc, 'rejected');
          }
        },
      },
      {
        key: 'n',
        description: 'Next document',
        category: 'Navigation',
        handler: () => {
          setCurrentDocIndex(prev => 
            Math.min(prev + 1, filteredDocuments.length - 1)
          );
        },
      },
      {
        key: 'p',
        description: 'Previous document',
        category: 'Navigation',
        handler: () => {
          setCurrentDocIndex(prev => Math.max(prev - 1, 0));
        },
      },
      {
        key: 'e',
        description: 'Expand/collapse current document',
        category: 'Navigation',
        handler: () => {
          const currentDoc = filteredDocuments[currentDocIndex];
          if (currentDoc) {
            toggleExpanded(currentDoc.id);
          }
        },
      },
      {
        key: 'Escape',
        description: 'Clear selection',
        category: 'Actions',
        handler: () => {
          if (selectedCount > 0) {
            clearSelection();
          }
        },
      },
    ],
  });

  /**
   * Bulk validate selected documents
   */
  const handleBulkValidate = async () => {
    const selectedDocs = filteredDocuments.filter(d => selectedIds.has(d.id));
    for (const doc of selectedDocs) {
      await handleValidate(doc, 'validated');
    }
    clearSelection();
  };

  /**
   * Bulk reject selected documents
   */
  const handleBulkReject = async () => {
    const selectedDocs = filteredDocuments.filter(d => selectedIds.has(d.id));
    for (const doc of selectedDocs) {
      await handleValidate(doc, 'rejected');
    }
    clearSelection();
  };

  /**
   * Bulk delete selected documents
   */
  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: 'Documents Deleted',
        description: `${selectedIds.size} documents deleted successfully`,
      });

      clearSelection();
      onValidationComplete();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  /**
   * Detect offensive language in all documents for AB1466 projects
   */
  useEffect(() => {
    const detectOffensiveLanguageForBatch = async () => {
      // Check if this is an AB1466 project by looking at first document's batch
      if (documents.length === 0) return;
      
      // Get project info to check if it's AB1466
      try {
        const { data: batchData } = await supabase
          .from('batches')
          .select('project_id')
          .eq('id', batchId)
          .single();
        
        if (!batchData) return;
        
        const { data: projectData } = await supabase
          .from('projects')
          .select('name')
          .eq('id', batchData.project_id)
          .single();
        
        if (!projectData) return;
        
        const projectName = projectData.name.toLowerCase();
        const isAB1466 = projectName.includes('ab') && projectName.includes('1466');
        
        if (!isAB1466) return;
        
        setIsScanning(true);
        const results: Record<string, { highlights: any[] }> = {};
        
        // Scan each document for offensive language
        for (const doc of documents) {
          if (!doc.extracted_text) continue;
          
          try {
            const { data, error } = await supabase.functions.invoke('detect-offensive-language', {
              body: {
                text: doc.extracted_text,
                wordBoundingBoxes: (doc as any).word_bounding_boxes || [],
              },
            });
            
            if (!error && data?.highlights && data.highlights.length > 0) {
              results[doc.id] = {
                highlights: data.highlights,
              };
            }
          } catch (e) {
            console.error(`Failed to scan document ${doc.id}:`, e);
          }
        }
        
        setOffensiveLanguageResults(results);
        
        // Notify if any documents have sensitive language
        const docsWithIssues = Object.keys(results).length;
        if (docsWithIssues > 0) {
          toast({
            title: 'Sensitive Language Detected',
            description: `${docsWithIssues} document(s) contain potentially problematic phrases`,
            variant: 'destructive',
          });
        }
      } catch (e) {
        console.error('Failed to detect offensive language:', e);
      } finally {
        setIsScanning(false);
      }
    };
    
    detectOffensiveLanguageForBatch();
  }, [documents, batchId]);

  /**
   * Check for calculation variance in all documents with line items
   */
  useEffect(() => {
    const checkCalculationVariance = async () => {
      const results: Record<string, any> = {};
      
      for (const doc of documents) {
        try {
          const items: any[] = (doc.line_items as any[]) || [];
          if (!items.length) continue;
          
          const meta: Record<string, any> = (doc.extracted_metadata as any) || {};
          
          let calculatedTotal = 0;
          let hasValidAmounts = false;
          
          // Sum up line items
          items.forEach((item: any) => {
            for (const key of Object.keys(item || {})) {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes('total') ||
                lowerKey.includes('amount') ||
                lowerKey.includes('price') ||
                lowerKey.includes('extended') ||
                lowerKey.includes('subtotal')
              ) {
                const value = item[key];
                if (value !== null && value !== undefined && value !== '') {
                  const clean = String(value).replace(/[$,]/g, '').trim();
                  const num = parseFloat(clean);
                  if (!isNaN(num) && num !== 0) {
                    calculatedTotal += num;
                    hasValidAmounts = true;
                    break;
                  }
                }
              }
            }
          });
          
          if (!hasValidAmounts) continue;
          
          // Find invoice total
          let invoiceTotal: number | null = null;
          for (const key of Object.keys(meta || {})) {
            const lowerKey = key.toLowerCase();
            if (
              lowerKey.includes('total') ||
              lowerKey.includes('amount') ||
              lowerKey.includes('grand') ||
              lowerKey.includes('balance') ||
              lowerKey.includes('due')
            ) {
              const value = meta[key];
              if (value !== null && value !== undefined && value !== '') {
                const clean = String(value).replace(/[$,]/g, '').trim();
                const num = parseFloat(clean);
                if (!isNaN(num) && num > 0) {
                  invoiceTotal = num;
                  break;
                }
              }
            }
          }
          
          if (invoiceTotal === null) continue;
          
          const variance = Math.abs(calculatedTotal - invoiceTotal);
          const variancePercent = (variance / invoiceTotal) * 100;
          
          if (variance >= 0.01) {
            results[doc.id] = {
              hasVariance: true,
              calculatedTotal: calculatedTotal.toFixed(2),
              invoiceTotal: invoiceTotal.toFixed(2),
              variance: variance.toFixed(2),
              variancePercent: variancePercent.toFixed(2),
            };
          }
        } catch (e) {
          console.warn(`Failed to check calculation variance for document ${doc.id}:`, e);
        }
      }
      
      setCalculationVariance(results);
    };
    
    checkCalculationVariance();
  }, [documents]);

  /**
   * Reset all state when batchId changes to prevent showing wrong thumbnails/data
   * from previous batch
   */
  useEffect(() => {
    setExpandedDocs(new Set());
    setEditedMetadata({});
    setEditedLineItems({});
    setValidatingDocs(new Set());
    setDocumentZoom({});
    setDocumentRotation({});
    setShowRegionSelector(new Set());
    setOffensiveLanguageResults({});
    setCalculationVariance({});
    clearSelection();
    setSearchQuery('');
    setFilters({});
    setCurrentDocIndex(0);
  }, [batchId]);

  /**
   * Toggle the expanded/collapsed state of a document card
   * @param docId - The ID of the document to toggle
   */
  const toggleExpanded = (docId: string) => {
    setExpandedDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  /**
   * Handle changes to metadata field inputs
   * Stores user edits in local state until validation is clicked
   * @param docId - The document being edited
   * @param fieldName - The field name being changed
   * @param value - The new value for the field
   */
  const handleFieldChange = (docId: string, fieldName: string, value: string) => {
    setEditedMetadata(prev => ({
      ...prev,
      [docId]: {
        ...(prev[docId] || {}),
        [fieldName]: value,
      }
    }));
  };

  /**
   * Validate a specific field using AI
   */
  const validateFieldWithAI = async (docId: string, fieldName: string, fieldValue: string) => {
    if (!fieldValue) {
      toast({ title: 'Nothing to validate', description: 'Please enter a value first.' });
      return;
    }

    const fieldKey = `${docId}-${fieldName}`;
    setValidatingFields(prev => new Set(prev).add(fieldKey));

    try {
      const doc = documents.find(d => d.id === docId);
      if (!doc) return;

      const { data, error } = await supabase.functions.invoke('smart-validation', {
        body: {
          documentId: docId,
          fieldName,
          fieldValue,
          context: (doc.extracted_text || '').substring(0, 500)
        }
      });

      if (error) throw error;

      if (data?.validation) {
        const validation = data.validation as any;

        // Update confidence
        if (typeof validation.confidence === 'number') {
          setFieldConfidence(prev => ({
            ...prev,
            [docId]: {
              ...(prev[docId] || {}),
              [fieldName]: validation.confidence,
            }
          }));
        }

        // Apply corrected/validated value
        const corrected = validation.validated_value ?? validation.corrected_value ?? validation.value;
        if (corrected !== undefined && corrected !== null && corrected !== '') {
          handleFieldChange(docId, fieldName, String(corrected));
        }

        // Show toast with validation result
        if (validation.is_valid === false || validation.isValid === false) {
          toast({
            title: 'Validation Issue',
            description: validation.reasoning || 'Field may need correction',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Field Validated',
            description: validation.reasoning || 'Field looks good',
          });
        }
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast({
        title: 'Validation Failed',
        description: error.message || 'Could not validate field',
        variant: 'destructive',
      });
    } finally {
      setValidatingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldKey);
        return newSet;
      });
    }
  };

  /**
   * Validate all fields for a document
   */
  const validateAllFieldsForDoc = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const metadata = getMetadataForDoc(doc);
    
    for (const field of projectFields) {
      const value = getMetadataValue(metadata, field.name);
      if (value) {
        await validateFieldWithAI(docId, field.name, value);
      }
    }
  };

  /**
   * Get the line items for a document (edited or original)
   */
  const getLineItemsForDoc = (doc: Document): Array<Record<string, any>> => {
    if (editedLineItems[doc.id]) {
      return editedLineItems[doc.id];
    }
    return doc.line_items || [];
  };

  /**
   * Update a line item cell value
   */
  const handleLineItemChange = (docId: string, rowIndex: number, columnName: string, value: string) => {
    setEditedLineItems(prev => {
      const doc = documents.find(d => d.id === docId);
      const currentItems = prev[docId] || (doc?.line_items || []);
      const newItems = [...currentItems];
      if (!newItems[rowIndex]) {
        newItems[rowIndex] = {};
      }
      newItems[rowIndex] = {
        ...newItems[rowIndex],
        [columnName]: value,
      };
      return {
        ...prev,
        [docId]: newItems,
      };
    });
  };

  /**
   * Add a new empty line item row
   */
  const handleAddLineItem = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const currentItems = getLineItemsForDoc(doc);
    const emptyRow: Record<string, any> = {};
    
    // Create empty row with same columns as existing items
    if (currentItems.length > 0) {
      Object.keys(currentItems[0]).forEach(key => {
        emptyRow[key] = '';
      });
    }

    setEditedLineItems(prev => ({
      ...prev,
      [docId]: [...currentItems, emptyRow],
    }));
  };

  /**
   * Delete a line item row
   */
  const handleDeleteLineItem = (docId: string, rowIndex: number) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const currentItems = getLineItemsForDoc(doc);
    const newItems = currentItems.filter((_, idx) => idx !== rowIndex);

    setEditedLineItems(prev => ({
      ...prev,
      [docId]: newItems,
    }));
  };

  /**
   * Get the current metadata for a document, merging original + user edits
   * @param doc - The document to get metadata for
   * @returns Combined metadata object (original plus any pending edits)
   */
  const getMetadataForDoc = (doc: Document) => {
    return {
      ...doc.extracted_metadata,
      ...(editedMetadata[doc.id] || {})
    };
  };

  /**
   * Extract string value from metadata (handles both old and new format)
   * Old format: metadata[field] = "value"
   * New format: metadata[field] = { value: "value", bbox: {...} }
   * @param metadata - The metadata object
   * @param fieldName - The field name to extract
   * @returns The string value of the field
   */
  const getMetadataValue = (metadata: any, fieldName: string): string => {
    const value = metadata[fieldName];
    if (!value) return '';
    // New format: { value: "...", bbox: {...} }
    if (typeof value === 'object' && value.value !== undefined) {
      return String(value.value);
    }
    // Old format: just a string
    return String(value);
  };

  /**
   * Handle zoom in for a document
   */
  const handleZoomIn = (docId: string) => {
    setDocumentZoom(prev => ({
      ...prev,
      [docId]: Math.min((prev[docId] || 1) + 0.25, 3)
    }));
  };

  /**
   * Handle zoom out for a document
   */
  const handleZoomOut = (docId: string) => {
    setDocumentZoom(prev => ({
      ...prev,
      [docId]: Math.max((prev[docId] || 1) - 0.25, 0.5)
    }));
  };

  /**
   * Handle rotate for a document
   */
  const handleRotate = (docId: string) => {
    setDocumentRotation(prev => ({
      ...prev,
      [docId]: ((prev[docId] || 0) + 90) % 360
    }));
  };

  /**
   * Handle reset zoom and rotation for a document
   */
  const handleReset = (docId: string) => {
    setDocumentZoom(prev => ({
      ...prev,
      [docId]: 1
    }));
    setDocumentRotation(prev => ({
      ...prev,
      [docId]: 0
    }));
  };

  /**
   * Handle print for a document
   */
  const handlePrint = async (docId: string, fileUrl: string) => {
    try {
      toast({
        title: "Preparing to print...",
        description: "Loading document for printing",
      });

      // Fetch the file (handles signed URLs if needed)
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const isPdf = blob.type === 'application/pdf' || fileUrl.toLowerCase().includes('.pdf');
      
      let imageDataUrl: string;
      
      if (isPdf) {
        // Convert PDF first page to image for printing
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        imageDataUrl = canvas.toDataURL('image/png');
      } else {
        // For images, create data URL
        imageDataUrl = URL.createObjectURL(blob);
      }

      // Open print window with the image
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: "Print Failed",
          description: "Please allow popups to print documents",
          variant: "destructive",
        });
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Document</title>
            <style>
              @media print {
                body { margin: 0; }
                img { max-width: 100%; height: auto; page-break-after: avoid; }
              }
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${imageDataUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Clean up blob URL after a delay
      if (!isPdf) {
        setTimeout(() => URL.revokeObjectURL(imageDataUrl), 1000);
      }
    } catch (error) {
      console.error('Print failed:', error);
      toast({
        title: "Print Failed",
        description: "Could not prepare document for printing",
        variant: "destructive",
      });
    }
  };

  /**
   * Handle download for a document
   */
  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the file.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handle metadata updates from the ImageRegionSelector
   * Called when user selects a region on the document and extracts data from it
   * @param docId - The document being updated
   * @param newMetadata - The newly extracted metadata from the selected region
   */
  const handleRegionUpdate = (docId: string, newMetadata: Record<string, string>) => {
    setEditedMetadata(prev => ({
      ...prev,
      [docId]: {
        ...(prev[docId] || {}),
        ...newMetadata
      }
    }));
    
    // Notify user that region extraction completed
    toast({
      title: 'Region Updated',
      description: 'Metadata updated from selected region',
    });
  };

  /**
   * Validate or reject a document
   * Saves the edited metadata to the database and updates validation status
   * @param doc - The document to validate/reject
   * @param status - Either 'validated' or 'rejected'
   */
  const handleValidate = async (doc: Document, status: 'validated' | 'rejected') => {
    // Mark this document as currently being validated (for loading state)
    setValidatingDocs(prev => new Set(prev).add(doc.id));

    try {
      // Get the complete metadata (original + edits)
      const metadata = getMetadataForDoc(doc);
      
      // Normalize metadata to ensure we're only storing string values
      // This handles both old format (strings) and new format (objects with bbox)
      const normalizedMetadata: Record<string, string> = {};
      Object.keys(metadata).forEach(key => {
        normalizedMetadata[key] = getMetadataValue(metadata, key);
      });
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Track field changes
      const originalMeta = doc.extracted_metadata || {};
      const changedFields: Array<{field_name: string; old_value: string; new_value: string}> = [];
      
      Object.keys(normalizedMetadata).forEach(key => {
        const oldVal = String(originalMeta[key] || '');
        const newVal = String(normalizedMetadata[key] || '');
        if (oldVal !== newVal) {
          changedFields.push({
            field_name: key,
            old_value: oldVal,
            new_value: newVal
          });
        }
      });

      // Update the document in the database and fetch related batch/project
      const { error, data: updatedDoc } = await supabase
        .from('documents')
        .update({
          extracted_metadata: normalizedMetadata,
          line_items: editedLineItems[doc.id] || doc.line_items || [],
          validation_status: status,
          validated_at: new Date().toISOString(),
          validated_by: user?.id,
        })
        .eq('id', doc.id)
        .select(`
          id, file_name,
          batch:batches(batch_name),
          project:projects(name, customer_id)
        `)
        .single();
      
      // Log field changes
      if (!error && user && changedFields.length > 0) {
        await supabase.from('field_changes').insert(
          changedFields.map(cf => ({
            document_id: doc.id,
            user_id: user.id,
            field_name: cf.field_name,
            old_value: cf.old_value,
            new_value: cf.new_value,
            change_type: 'edit',
            validation_status: status
          }))
        );
        
        // Feed corrections to ML learning system
        try {
          await supabase.functions.invoke('learn-from-corrections', {
            body: {
              documentId: doc.id,
              projectId: doc.project_id,
              corrections: changedFields.map(cf => ({
                field_name: cf.field_name,
                original_value: cf.old_value,
                corrected_value: cf.new_value
              }))
            }
          });
          console.log('✓ ML system learned from', changedFields.length, 'corrections');
        } catch (mlError) {
          console.error('ML learning failed (non-critical):', mlError);
        }
      }

      if (error) throw error;

      // Trigger webhook notification for document validation
      if (updatedDoc && status === 'validated') {
        try {
          let targetCustomerId = (updatedDoc as any).project?.customer_id as string | null | undefined;
          if (!targetCustomerId && user?.id) {
            const { data: uc } = await supabase
              .from('user_customers')
              .select('customer_id')
              .eq('user_id', user.id)
              .limit(1);
            targetCustomerId = uc?.[0]?.customer_id ?? null;
          }

          await supabase.functions.invoke('send-webhook', {
            body: {
              customer_id: targetCustomerId,
              event_type: 'document.validated',
              payload: {
                document_id: doc.id,
                document_name: doc.file_name,
                batch_id: (updatedDoc as any).batch_id ?? batchId,
                batch_name: (updatedDoc as any).batch?.batch_name,
                project_name: (updatedDoc as any).project?.name,
                validated_by: user?.id,
                validated_at: new Date().toISOString(),
                metadata: normalizedMetadata,
              }
            }
          });
        } catch (webhookError) {
          console.error('Webhook notification failed:', webhookError);
        }
      }

      // Update batch validated count (only for validated documents)
      if (status === 'validated') {
        const { data: batch } = await supabase
          .from('batches')
          .select('validated_documents')
          .eq('id', batchId)
          .single();

        if (batch) {
          await supabase
            .from('batches')
            .update({ 
              validated_documents: (batch.validated_documents || 0) + 1
            })
            .eq('id', batchId);
        }
      }

      // Show success toast
      toast({
        title: status === 'validated' ? 'Document Validated' : 'Document Rejected',
        description: `${doc.file_name} marked as ${status}`,
      });

      // Notify parent component that validation state changed
      // This will trigger a reload of documents, updating the progress dashboard
      onValidationComplete();
      
      // If this was the last document, switch to export view
      if (status === 'validated' && onSwitchToExport && documents.length === 1) {
        setTimeout(() => onSwitchToExport?.(), 100);
      }
    } catch (error: any) {
      // Show error toast
      toast({
        title: 'Validation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      // Remove from validating set (loading state complete)
      setValidatingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  /**
   * Validate all documents in the queue at once
   * Processes documents sequentially and then switches to export view
   */
  const handleValidateAll = async () => {
    // Validate each document sequentially
    for (const doc of documents) {
      await handleValidate(doc, 'validated');
    }
    // After all documents validated, switch to export view
    if (onSwitchToExport) {
      setTimeout(() => onSwitchToExport(), 100);
    }
  };

  // --- RENDER COMPONENT ---
  return (
    <TooltipProvider>
    <div className="space-y-4 pb-24">
      {/* Progress Tracking Dashboard */}
      <ProgressTrackingDashboard 
        metrics={progressMetrics}
        batchName={batchName}
      />

      {/* Search & Filter Bar */}
      <SearchFilterBar
        onSearch={setSearchQuery}
        onFilterChange={setFilters}
        totalResults={filteredDocuments.length}
      />

      {/* Header with document count and Validate All button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {filteredDocuments.length > 0 && (
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all documents"
            />
          )}
          <div>
            <h2 className="text-2xl font-bold">Validation Queue</h2>
            <p className="text-muted-foreground">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} 
              {searchQuery || filters.documentType || filters.minConfidence || filters.hasIssues ? ' (filtered)' : ' pending validation'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleValidateAll}
          variant="default"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          disabled={filteredDocuments.length === 0}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Validate All
        </Button>
      </div>

      {/* List of documents to validate */}
      <div className="space-y-3">
        {filteredDocuments.map((doc, index) => {
          // Calculate state for this document
          const isExpanded = expandedDocs.has(doc.id);
          const isValidating = validatingDocs.has(doc.id);
          const metadata = getMetadataForDoc(doc);
          const isCurrent = index === currentDocIndex;

          return (
            <Card 
              key={doc.id} 
              className={`overflow-hidden ${isCurrent ? 'ring-2 ring-primary' : ''} ${isSelected(doc.id) ? 'bg-accent/20' : ''}`}
            >
              {/* Collapsible card for each document */}
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(doc.id)}>
                {/* Document header: thumbnail, metadata badges, and action buttons */}
                <div className="p-4 flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Checkbox for bulk selection */}
                    <Checkbox
                      checked={isSelected(doc.id)}
                      onCheckedChange={() => toggleSelection(doc.id)}
                      aria-label={`Select ${doc.file_name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {/* Document thumbnail (image or PDF first page) */}
                    {doc.file_url ? (
                      <div className="flex-shrink-0">
                        <ThumbnailWithSignedUrl 
                          url={doc.file_url}
                          alt={doc.file_name}
                          fileType={(doc as any).file_type}
                          className="w-16 h-20 object-cover rounded border border-border"
                        />
                      </div>
                    ) : (
                      /* Placeholder if no thumbnail available */
                      <div className="w-16 h-20 flex items-center justify-center bg-muted rounded border border-border">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {/* Document name and metadata badges */}
                    <div className="flex-1">
                      <h3 className="font-semibold">{doc.file_name}</h3>
                      
                      {/* Document Classification */}
                      {doc.document_type && (
                        <div className="flex flex-wrap gap-2 mt-1 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            📄 {doc.document_type.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                          {doc.classification_confidence !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(doc.classification_confidence * 100)}% confident
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {/* PII Detection Warning Badge */}
                      {(((doc as any).pii_detected) || ((computedPiiCounts[doc.id] || 0) > 0)) && (
                        <div className="flex flex-wrap gap-2 mt-1 mb-1">
                          <Badge variant="destructive" className="text-xs">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            PII Detected ({(doc as any).detected_pii_regions?.length || computedPiiCounts[doc.id] || 0} items)
                          </Badge>
                        </div>
                      )}
                      
                      {/* Sensitive Language Warning Badge */}
                      {offensiveLanguageResults[doc.id] && (
                        <div className="flex flex-wrap gap-2 mt-1 mb-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-block">
                                  <Badge variant="destructive" className="text-xs cursor-help">
                                    ⚠️ {offensiveLanguageResults[doc.id].highlights.length} Sensitive Phrase{offensiveLanguageResults[doc.id].highlights.length !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <div className="space-y-1">
                                  {offensiveLanguageResults[doc.id].highlights.slice(0, 3).map((h: any, idx: number) => (
                                    <div key={idx} className="text-xs">
                                      <strong>{h.text}</strong> - {h.reason}
                                    </div>
                                  ))}
                                  {offensiveLanguageResults[doc.id].highlights.length > 3 && (
                                    <div className="text-xs italic">
                                      +{offensiveLanguageResults[doc.id].highlights.length - 3} more...
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                      
                      {/* Calculation Mismatch Warning Badge */}
                      {calculationVariance[doc.id]?.hasVariance && (
                        <div className="flex flex-wrap gap-2 mt-1 mb-1">
                          <Badge variant="destructive" className="text-xs">
                            ⚠️ CALCULATION MISMATCH: ${calculationVariance[doc.id].variance} variance
                          </Badge>
                        </div>
                      )}
                      
                      {/* Show all extracted fields as badges */}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {projectFields.map((field) => (
                          <Badge key={field.name} variant="outline" className="text-xs">
                            {field.name}: {getMetadataValue(metadata, field.name) || 'N/A'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Action buttons: Validate, Reject, Expand/Collapse */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleValidate(doc, 'validated');
                      }}
                      disabled={isValidating}
                      className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Validate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleValidate(doc, 'rejected');
                      }}
                      disabled={isValidating}
                      className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 shadow-sm"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Reject
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {/* Expanded content: image viewer and editable fields */}
                <CollapsibleContent>
                  <div className="p-2 sm:p-4 space-y-4 border-t">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left column: Image with controls */}
                      <div className="space-y-3">
                        {/* Document Controls */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm">Document Preview</h4>
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            {/* Zoom Controls */}
                            <div className="flex items-center gap-0.5 sm:gap-1 border rounded-md">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleZoomOut(doc.id)}
                                disabled={(documentZoom[doc.id] || 1) <= 0.5}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Zoom Out"
                              >
                                <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <span className="text-[10px] sm:text-xs font-medium px-1 sm:px-2 min-w-[2.5rem] sm:min-w-[3rem] text-center">
                                {Math.round((documentZoom[doc.id] || 1) * 100)}%
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleZoomIn(doc.id)}
                                disabled={(documentZoom[doc.id] || 1) >= 3}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Zoom In"
                              >
                                <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                            
                            {/* Additional Controls */}
                            <div className="flex items-center gap-0.5 sm:gap-1 border rounded-md">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRotate(doc.id)}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Rotate 90°"
                              >
                                <RotateCw className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReset(doc.id)}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Reset View"
                              >
                                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              {/* Redaction (Draw Zones) */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRedactionDialogDocId(doc.id)}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Redact (Draw Zones)"
                              >
                                <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrint(doc.id, doc.file_url)}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Print"
                              >
                                <Printer className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(doc.file_url, doc.file_name)}
                                className="h-7 sm:h-8 px-1 sm:px-2"
                                title="Download"
                              >
                                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Image Preview with Zoom and Rotation */}
                        <div className="overflow-auto max-h-[300px] sm:max-h-[400px] bg-muted/30 rounded-lg p-2 sm:p-4">
                          <div className="relative">
                            <FullImageWithSignedUrl
                              url={(doc as any).redacted_file_url || doc.file_url}
                              alt={doc.file_name}
                              fileType={(doc as any).file_type}
                              zoom={documentZoom[doc.id] || 1}
                              rotation={documentRotation[doc.id] || 0}
                            />
                            {/* Auto PII redaction overlay - only show if NOT viewing original */}
                            {!showingOriginal.has(doc.id) && (() => {
                              // Prefer server-detected regions; fallback to client detection if available
                              const pii = (doc as any).detected_pii_regions || [];
                              let boxes = (Array.isArray(pii) ? pii.map((r: any) => r?.bbox).filter(Boolean) : []) as Array<{ x: number; y: number; width: number; height: number }>;

                              if (boxes.length === 0 && ((computedPiiCounts[doc.id] || 0) > 0)) {
                                try {
                                  const detected = detectKeywords(
                                    doc.extracted_text || '',
                                    { wordBoundingBoxes: (doc as any).word_bounding_boxes },
                                    [],
                                    true
                                  ) as any[];
                                  boxes = detected
                                    .flatMap((d: any) => (d.matches?.map((m: any) => m.boundingBox).filter(Boolean)) || [])
                                    .filter(Boolean);
                                } catch {
                                  // ignore client detection errors
                                }
                              }

                              if (boxes.length > 0) {
                                const viewW = Math.max(1000, ...boxes.map((b: any) => (b.x + b.width)));
                                const viewH = Math.max(1000, ...boxes.map((b: any) => (b.y + b.height)));
                                return (
                                  <svg
                                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                    preserveAspectRatio="none"
                                    viewBox={`0 0 ${viewW} ${viewH}`}
                                  >
                                    {boxes.map((b: any, idx: number) => (
                                      <rect
                                        key={idx}
                                        x={b.x}
                                        y={b.y}
                                        width={b.width}
                                        height={b.height}
                                        fill="rgba(0,0,0,0.85)"
                                        stroke="rgba(0,0,0,0.9)"
                                        strokeWidth="2"
                                      />
                                    ))}
                                  </svg>
                                );
                              }

                              if ((doc as any).pii_detected) {
                                return (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                                    <span className="text-[10px] sm:text-xs text-white/90 bg-black/60 px-2 py-1 rounded">PII auto‑redacted</span>
                                  </div>
                                );
                              }

                              return null;
                            })()}
                          </div>
                        </div>

                        {/* View Original Toggle (for PII documents) */}
                        {((doc as any).pii_detected || computedPiiCounts[doc.id] > 0) && (
                          <ViewOriginalButton
                            documentId={doc.id}
                            showingOriginal={showingOriginal.has(doc.id)}
                            onToggle={() => {
                              setShowingOriginal(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(doc.id)) {
                                  newSet.delete(doc.id);
                                } else {
                                  newSet.add(doc.id);
                                }
                                return newSet;
                              });
                            }}
                          />
                        )}

                        {/* Toggle Region Selector Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowRegionSelector(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(doc.id)) {
                                newSet.delete(doc.id);
                              } else {
                                newSet.add(doc.id);
                              }
                              return newSet;
                            });
                          }}
                          className="w-full"
                        >
                          {showRegionSelector.has(doc.id) ? 'Hide' : 'Show'} Region Selector
                        </Button>

                        {/* Region Selector for Re-OCR (conditionally shown) */}
                        {showRegionSelector.has(doc.id) && (
                          <ImageRegionSelectorWithSignedUrl
                            fileUrl={doc.file_url}
                            onRegionSelected={(newMetadata) => handleRegionUpdate(doc.id, newMetadata)}
                            extractionFields={projectFields}
                          />
                        )}
                      </div>

                      {/* Right column: Editable metadata fields */}
                      <div className="space-y-4">
                        <Tabs defaultValue="fields" className="w-full">
                          <TabsList className={`w-full grid ${isAB1466Batch ? 'grid-cols-3' : 'grid-cols-2'} p-0.5 sm:p-1 h-auto`}>
                            <TabsTrigger value="fields" className="text-[10px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 data-[state=active]:text-xs sm:data-[state=active]:text-sm">
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                              Edit Fields
                            </TabsTrigger>
                            {isAB1466Batch && (
                              <TabsTrigger value="image" className="text-[10px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 data-[state=active]:text-xs sm:data-[state=active]:text-sm">
                                <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                                Sensitive
                              </TabsTrigger>
                            )}
                            <TabsTrigger value="text" className="text-[10px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 data-[state=active]:text-xs sm:data-[state=active]:text-sm">
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                              Extracted Text
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="fields" className="space-y-4 mt-4">
                            {/* AI Smart Validation Banner */}
                            <div className="p-2 sm:p-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg mb-4">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-2 flex-1">
                                  <span className="text-xl sm:text-2xl animate-pulse">✨</span>
                                  <div className="flex-1">
                                    <div className="text-xs sm:text-sm font-medium mb-1">AI Smart Validation</div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground space-y-0.5 sm:space-y-1">
                                      <div className="flex items-center gap-1">
                                        <span className="text-amber-500">💡</span>
                                        <span>Click 💡 next to any field or use Validate All</span>
                                      </div>
                                      <div className="hidden sm:block">1. Fill in field values (e.g., Invoice Total)</div>
                                      <div className="hidden sm:block">2. Click the 💡 lightbulb icon next to the field</div>
                                      <div className="hidden sm:block">3. AI will validate and suggest corrections if needed</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <Button
                                    size="sm"
                                    onClick={() => validateAllFieldsForDoc(doc.id)}
                                    className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none h-8 text-xs sm:text-sm"
                                  >
                                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                                    Validate All
                                  </Button>
                                  {enableSignatureVerification && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSignatureDialogDocId(doc.id)}
                                      className="flex-1 sm:flex-none h-8 text-xs sm:text-sm"
                                    >
                                      <span className="hidden sm:inline">✍️ Signature</span>
                                      <span className="sm:hidden">✍️</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
</div>

                            <Dialog open={signatureDialogDocId === doc.id} onOpenChange={(o) => setSignatureDialogDocId(o ? doc.id : null)}>
                              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Signature Verification</DialogTitle>
                                </DialogHeader>
                                <SignatureValidator 
                                  documentImageUrl={doc.file_url}
                                  projectId={doc.project_id}
                                  currentMetadata={getMetadataForDoc(doc)}
                                />
                              </DialogContent>
                            </Dialog>

                            {/* Redaction Tool Dialog */}
                            <Dialog open={redactionDialogDocId === doc.id} onOpenChange={(o) => setRedactionDialogDocId(o ? doc.id : null)}>
                              <DialogContent className="sm:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Redact PII</DialogTitle>
                                </DialogHeader>
                                <RedactionTool
                                  imageUrl={doc.file_url}
                                  documentId={doc.id}
                                  ocrText={doc.extracted_text}
                                  ocrMetadata={{ wordBoundingBoxes: (doc as any).word_bounding_boxes, boundingBoxes: (doc as any).bounding_boxes }}
                                  onRedactionSaved={async () => {
                                    setRedactionDialogDocId(null);
                                    onValidationComplete();
                                    toast({ title: 'Redaction saved', description: 'The redacted version is now displayed in the preview.' });
                                  }}
                                  onCancel={() => setRedactionDialogDocId(null)}
                                />
                              </DialogContent>
                            </Dialog>

                            {/* Petition Validation Warnings - Only show for petition projects */}
                            {isPetitionProject && doc.line_items && doc.line_items.length > 0 && (
                              <div className="mb-6">
                                <PetitionValidationWarnings
                                  documentId={doc.id}
                                  batchId={batchId}
                                  metadata={getMetadataForDoc(doc)}
                                />
                              </div>
                            )}

                            {projectFields.map((field) => {
                              const fieldValue = getMetadataValue(metadata, field.name);
                              const fieldKey = `${doc.id}-${field.name}`;
                              const isValidating = validatingFields.has(fieldKey);
                              const confidence = fieldConfidence[doc.id]?.[field.name];
                              const hasValue = fieldValue && fieldValue !== '';
                              
                              return (
                                <div key={field.name}>
                                  <div className="flex items-center justify-between mb-1">
                                    <Label htmlFor={`${doc.id}-${field.name}`} className="text-sm">
                                      {field.name}
                                      {field.description && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {field.description}
                                        </span>
                                      )}
                                      {confidence !== undefined && (
                                        <Badge 
                                          variant={confidence > 0.8 ? "default" : confidence > 0.5 ? "secondary" : "destructive"}
                                          className="ml-2 text-xs"
                                        >
                                          {Math.round(confidence * 100)}% confident
                                        </Badge>
                                      )}
                                    </Label>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => validateFieldWithAI(doc.id, field.name, fieldValue)}
                                          disabled={isValidating || !hasValue}
                                          className="h-8 w-8 p-0"
                                        >
                                          {isValidating ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                          ) : (
                                            <Lightbulb className={`h-4 w-4 ${hasValue ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Click to validate this field with AI</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <Input
                                    id={`${doc.id}-${field.name}`}
                                    value={fieldValue}
                                    onChange={(e) =>
                                      handleFieldChange(doc.id, field.name, e.target.value)
                                    }
                                    placeholder={`Enter ${field.name}`}
                                    className="mt-1"
                                  />
                                </div>
                              );
                            })}

                            {/* Line Items Table - Only show if table extraction is configured or line items exist */}
                            {(() => {
                          const hasLineItems = (doc.line_items && doc.line_items.length > 0) || editedLineItems[doc.id];
                          const tableConfig = (documents[0] as any)?.table_extraction_config;
                          const hasTableConfig = tableConfig?.fields && Array.isArray(tableConfig.fields) && tableConfig.fields.length > 0;
                          
                          // Only show line items section if configured or if items already exist
                          if (!hasLineItems && !hasTableConfig) {
                            return null;
                          }
                          
                          const isExpanded = expandedLineItems[doc.id] ?? true;
                          
                          if (hasLineItems) {
                            return (
                              <Collapsible
                                open={isExpanded}
                                onOpenChange={(open) => setExpandedLineItems(prev => ({ ...prev, [doc.id]: open }))}
                                className="mt-6 border-t pt-4"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2 font-semibold text-base">
                                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                      Line Items ({getLineItemsForDoc(doc).length})
                                    </Button>
                                  </CollapsibleTrigger>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAddLineItem(doc.id)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Row
                                  </Button>
                                </div>
                                
                                <CollapsibleContent className="animate-accordion-down">
                                  <div className="border rounded-lg overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-muted/50">
                                            {getLineItemsForDoc(doc).length > 0 && Object.keys(getLineItemsForDoc(doc)[0]).map((key) => (
                                              <TableHead key={key} className="font-semibold min-w-[200px]">
                                                {key}
                                              </TableHead>
                                            ))}
                                            <TableHead className="w-20 text-center">Actions</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {getLineItemsForDoc(doc).map((item, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                                              {Object.entries(item).map(([key, value], vIdx) => (
                                                <TableCell key={vIdx} className="py-3 align-top">
                                                  <Textarea
                                                    value={value !== null && value !== undefined ? String(value) : ''}
                                                    onChange={(e) => handleLineItemChange(doc.id, idx, key, e.target.value)}
                                                    className="min-h-[80px] resize-y border-muted-foreground/20 focus:border-primary transition-colors"
                                                    rows={3}
                                                  />
                                                </TableCell>
                                              ))}
                                              <TableCell className="text-center align-top pt-5">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => handleDeleteLineItem(doc.id, idx)}
                                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                >
                                                  <XCircle className="h-4 w-4" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          } else {
                            return (
                              <div className="mt-6 border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold">Line Items</h4>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const emptyRow: Record<string, any> = {};
                                      if (tableConfig?.fields && Array.isArray(tableConfig.fields)) {
                                        tableConfig.fields.forEach((field: any) => {
                                          emptyRow[field.name] = '';
                                        });
                                      }
                                      setEditedLineItems(prev => ({
                                        ...prev,
                                        [doc.id]: [emptyRow],
                                      }));
                                    }}
                                  >
                                    Add Line Items
                                  </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">No line items extracted. Click "Add Line Items" to manually add rows.</p>
                              </div>
                            );
                            }
                            })()}
                          </TabsContent>
                          
                          <TabsContent value="image" className="mt-4">
                            {offensiveLanguageResults[doc.id]?.highlights && offensiveLanguageResults[doc.id].highlights.length > 0 ? (
                              <div className="space-y-4">
                                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                  <p className="text-sm font-medium text-destructive mb-2">
                                    ⚠️ {offensiveLanguageResults[doc.id].highlights.length} Sensitive Phrase(s) Detected
                                  </p>
                                  <div className="space-y-1">
                                    {offensiveLanguageResults[doc.id].highlights.map((highlight: any, idx: number) => (
                                      <div key={idx} className="text-xs text-muted-foreground">
                                        • "{highlight.text}" - {highlight.category} ({highlight.severity})
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="relative border rounded-lg overflow-hidden bg-background">
                                  <FullImageWithSignedUrl
                                    url={doc.file_url}
                                    alt={doc.file_name}
                                    fileType={(doc as any).file_type}
                                    zoom={1}
                                    rotation={0}
                                  />
                                  {(() => {
                                    const boxes = offensiveLanguageResults[doc.id].highlights
                                      .map((h: any) => h.boundingBox)
                                      .filter(Boolean);
                                    const viewW = boxes.length ? Math.max(...boxes.map((b: any) => b.x + b.width)) : 1000;
                                    const viewH = boxes.length ? Math.max(...boxes.map((b: any) => b.y + b.height)) : 1000;
                                    return (
                                      <svg 
                                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                        preserveAspectRatio="none"
                                        viewBox={`0 0 ${viewW} ${viewH}`}
                                      >
                                        {boxes.map((box: any, idx: number) => (
                                          <rect
                                            key={idx}
                                            x={box.x}
                                            y={box.y}
                                            width={box.width}
                                            height={box.height}
                                            fill="rgba(239, 68, 68, 0.3)"
                                            stroke="rgb(239, 68, 68)"
                                            strokeWidth="2"
                                          />
                                        ))}
                                      </svg>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground py-8">
                                No sensitive language detected in this document
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="text" className="mt-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Raw Extracted Text</Label>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      if (!doc.extracted_text) return;
                                      const { data, error } = await supabase.functions.invoke('translate-text', {
                                        body: { text: doc.extracted_text }
                                      });
                                      if (error) throw error;
                                      if (data?.text) {
                                        setTranslatedTexts(prev => ({ ...prev, [doc.id]: data.text }));
                                        toast({ title: 'Translated', description: 'Non-English text translated to English.' });
                                      }
                                    } catch (e: any) {
                                      toast({ title: 'Translation failed', description: e.message || 'Please try again later', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  Translate to English
                                </Button>
                              </div>
                              <Textarea
                                value={doc.extracted_text || 'No text extracted'}
                                readOnly
                                className="min-h-[400px] font-mono text-sm"
                              />
                              {translatedTexts[doc.id] && (
                                <div className="space-y-2">
                                  <Label className="text-sm">Translated (English)</Label>
                                  <Textarea
                                    value={translatedTexts[doc.id]}
                                    readOnly
                                    className="min-h-[300px] font-mono text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

        {/* Empty state: show when no documents in queue */}
        {documents.length === 0 && (
          <Card className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">No documents pending validation</p>
          </Card>
        )}
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkValidate={handleBulkValidate}
        onBulkReject={handleBulkReject}
        onBulkDelete={handleBulkDelete}
        mode="validation"
      />
    </div>
    </TooltipProvider>
  );
};

/**
 * FullImageWithSignedUrl Component
 * Displays a full-size image with signed URL support and PDF rendering
 * Used for image preview with zoom functionality
 */
const FullImageWithSignedUrl = ({
  url,
  alt,
  fileType,
  zoom = 1,
  rotation = 0,
}: {
  url: string;
  alt: string;
  fileType?: string;
  zoom?: number;
  rotation?: number;
}) => {
  // Get signed URL for secure access to the file
  const { signedUrl, loading } = useSignedUrl(url);
  
  // Store the rendered image (data URL for PDFs, or direct URL for images)
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  
  // Detect if file is a PDF based on file type or URL
  const isPdf = Boolean(fileType?.toLowerCase().includes('pdf')) || /\.pdf($|\?)/i.test((signedUrl || url) || '') || /\.pdf$/i.test(alt);

  // Effect to generate display URL when signed URL changes
  useEffect(() => {
    const generateDisplayUrl = async () => {
      const src = signedUrl || url;
      try {
        // For non-PDF images, use the URL directly
        if (!isPdf) {
          setDisplayUrl(src);
          return;
        }

        // Prefer downloading via SDK to avoid CORS and 400 responses
        let buffer: ArrayBuffer | null = null;
        try {
          // Extract storage path from URL
          let filePath: string | null = null;
          try {
            const u = new URL(src);
            const m = u.pathname.match(/\/documents\/(.+)$/);
            filePath = m ? decodeURIComponent(m[1]) : null;
          } catch {
            const m = src.match(/\/documents\/(.+?)(?:\?|#|$)/);
            filePath = m ? decodeURIComponent(m[1]) : null;
          }

          if (filePath) {
            const { data, error } = await supabase.storage.from('documents').download(filePath);
            if (!error && data) {
              buffer = await data.arrayBuffer();
            }
          }
        } catch (e) {
          // ignore, will fallback to fetch below
        }

        // If SDK download failed, fallback to fetch of the signed URL
        if (!buffer) {
          const resp = await fetch(src, { cache: 'no-store' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          buffer = await resp.arrayBuffer();
        }

        // Render first page as image at higher resolution
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) { setDisplayUrl(null); return; }
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        setDisplayUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('PDF render failed (after SDK+fetch attempts)', e);
        setDisplayUrl(null); // ensure error UI renders instead of broken <img>
      }
    };

    generateDisplayUrl();
  }, [signedUrl, url, isPdf]);

  // Show loading state
  if (loading || !signedUrl) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading image...</p>
        </div>
      </div>
    );
  }

  // Show error state if display URL failed to generate
  if (!displayUrl) {
    return (
      <div className="w-full h-48 flex flex-col items-center justify-center bg-muted rounded gap-2">
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
        <a
          href={signedUrl || url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Open original file
        </a>
      </div>
    );
  }

  // Render image with zoom and rotation
  return (
    <img
      src={displayUrl}
      alt={alt}
      className="w-full h-auto object-contain transition-transform"
      style={{
        transform: `scale(${zoom}) rotate(${rotation}deg)`,
        transformOrigin: 'center'
      }}
      onError={(e) => {
        console.error('Image failed to load');
        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
      }}
    />
  );
};

/**
 * ThumbnailWithSignedUrl Component
 * Displays a thumbnail for a document file (image or PDF)
 * For PDFs, renders the first page as an image thumbnail
 * Uses signed URLs for secure access to storage
 */
const ThumbnailWithSignedUrl = ({
  url,
  alt,
  className,
  fileType,
}: {
  url: string;
  alt: string;
  className?: string;
  fileType?: string;
}) => {
  // Get signed URL for secure access to the file
  const { signedUrl } = useSignedUrl(url);
  
  // Store the rendered thumbnail image (data URL)
  const [thumb, setThumb] = useState<string | null>(null);
  
  // Detect if file is a PDF based on file type or URL
  const isPdf = Boolean(fileType?.toLowerCase().includes('pdf')) || /\.pdf($|\?)/i.test((signedUrl || url) || '') || /\.pdf$/i.test(alt);

  // Effect to generate thumbnail when URL changes
  useEffect(() => {
    const makeThumb = async () => {
      const src = signedUrl || url;
      try {
        // Quick path: if not a PDF, use the URL directly as thumbnail
        if (!isPdf) {
          setThumb(src);
          return;
        }
        // For PDFs: Render first page as thumbnail image
        // Try to render first page of PDF into a small canvas
        // Fetch PDF file as array buffer
        const resp = await fetch(src, { cache: 'no-store' });
        const buffer = await resp.arrayBuffer();
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        // Get first page
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        // Create canvas to render PDF page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        // Scale to thumbnail size (64px wide)
        const targetWidth = 64;
        const scale = targetWidth / viewport.width;
        const scaledVp = page.getViewport({ scale });
        canvas.width = Math.round(scaledVp.width);
        canvas.height = Math.round(scaledVp.height);
        // Render PDF page to canvas
        await page.render({ canvasContext: context, viewport: scaledVp }).promise;
        // Convert canvas to data URL and store as thumbnail
        setThumb(canvas.toDataURL('image/png'));
      } catch (e) {
        // First method failed, try alternative URL-based loading
        console.error('PDF thumbnail render failed (bytes path)', { src, error: e });
        console.warn('Thumbnail render failed, trying URL method', e);
        try {
          // Alternative method: load PDF directly from URL
          const loadingTask = pdfjsLib.getDocument({ url: src });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) { setThumb(null); return; }
          const targetWidth = 64;
          const scale = targetWidth / viewport.width;
          const scaledVp = page.getViewport({ scale });
          canvas.width = Math.round(scaledVp.width);
          canvas.height = Math.round(scaledVp.height);
          await page.render({ canvasContext: context, viewport: scaledVp }).promise;
          setThumb(canvas.toDataURL('image/png'));
        } catch (e2) {
          // Both methods failed - show appropriate fallback
          // If it's a PDF, prefer showing the icon placeholder
          if (isPdf) {
            setThumb(null);
          } else {
            // For images, try to use the URL directly
            setThumb(src);
          }
        }
      }
    };
    // Run thumbnail generation
    makeThumb();
  }, [signedUrl, url, alt, fileType]);

  // If thumbnail failed to generate, show placeholder icon
  if (!thumb) {
    const href = signedUrl || url;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="w-16 h-20 flex items-center justify-center bg-muted rounded border border-border hover:bg-muted/60">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </a>
    );
  }

  // Render thumbnail image
  return (
    <img
      src={thumb || signedUrl || url}
      alt={alt}
      className={className}
      onError={(e) => {
        // Fallback to placeholder if image fails to load
        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
      }}
    />
  );
};

/**
 * ImageRegionSelectorWithSignedUrl Component
 * Wrapper that handles signed URL fetching and PDF-to-image conversion
 * before passing to ImageRegionSelector
 * Allows users to select regions on document images for re-extraction
 */
const ImageRegionSelectorWithSignedUrl = ({ 
  fileUrl, 
  onRegionSelected, 
  extractionFields 
}: { 
  fileUrl: string;
  onRegionSelected: (metadata: Record<string, string>) => void;
  extractionFields: any[];
}) => {
  // Get signed URL for secure access
  const { signedUrl, loading } = useSignedUrl(fileUrl);
  
  // Store the preview image (converted from PDF if needed)
  const [preview, setPreview] = useState<string | null>(null);
  
  // Detect if file is a PDF
  const isPdf = /\.pdf($|\?)/i.test(fileUrl);

  // Effect to generate preview image from PDF when signed URL is ready, or use image directly
  useEffect(() => {
    const run = async () => {
      if (!signedUrl) return;
      
      // For non-PDF images, just use the URL directly
      if (!isPdf) {
        setPreview(signedUrl);
        return;
      }
      
      // For PDFs, render first page as image
      try {
        // Fetch PDF file
        const resp = await fetch(signedUrl);
        const buffer = await resp.arrayBuffer();
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        // Get first page
        const page = await pdf.getPage(1);
        // Render at higher scale for better quality in region selector
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        // Render PDF page to canvas
        await page.render({ canvasContext: ctx, viewport }).promise;
        // Convert to data URL for display
        setPreview(canvas.toDataURL('image/png'));
      } catch (e) {
        // First method failed, try alternative URL-based loading
        try {
          const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { setPreview(null); return; }
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          setPreview(canvas.toDataURL('image/png'));
        } catch (e2) {
          // Both methods failed - cannot generate preview
          setPreview(null);
        }
      }
    };
    // Run preview generation
    run();
  }, [signedUrl, isPdf]);

  // Show loading state while fetching signed URL
  if (loading || !signedUrl) {
    return <div className="py-8 text-center text-muted-foreground">Loading image...</div>;
  }

  // Show error state if preview failed to generate
  if (!preview) {
    return <div className="py-8 text-center text-muted-foreground">Preview unavailable</div>;
  }

  // Render the ImageRegionSelector with the prepared preview image
  return (
    <ImageRegionSelector
      imageUrl={preview}
      onRegionSelected={onRegionSelected}
      extractionFields={extractionFields}
    />
  );
};