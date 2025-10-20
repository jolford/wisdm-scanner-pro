// React core hooks for state management and side effects
import { useState, useEffect } from 'react';

// UI component imports from shadcn/ui library
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// Icon imports from lucide-react
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';

// Backend and utility imports
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImageRegionSelector } from './ImageRegionSelector';
import { useSignedUrl } from '@/hooks/use-signed-url';

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
  file_name: string;
  file_url: string;
  extracted_text: string;
  extracted_metadata: Record<string, string>;
  validation_status: string;
  line_items?: Array<Record<string, any>>;
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
  projectFields: Array<{ name: string; description: string }>;
  onValidationComplete: () => void;
  batchId: string;
  onSwitchToExport?: () => void;
}

/**
 * BatchValidationScreen Component
 * Displays a queue of documents for validation, allowing users to review extracted metadata,
 * edit fields, select regions on images for re-extraction, and approve/reject documents.
 */
export const BatchValidationScreen = ({
  documents,
  projectFields,
  onValidationComplete,
  batchId,
  onSwitchToExport,
}: BatchValidationScreenProps) => {
  // Track which document cards are expanded (showing details)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  
  // Store user edits to metadata fields (keyed by document ID, then field name)
  const [editedMetadata, setEditedMetadata] = useState<Record<string, Record<string, string>>>({});
  
  // Store user edits to line items (keyed by document ID)
  const [editedLineItems, setEditedLineItems] = useState<Record<string, Array<Record<string, any>>>>({});
  
  // Track which documents are currently being validated (for loading states)
  const [validatingDocs, setValidatingDocs] = useState<Set<string>>(new Set());
  
  // Toast notifications for user feedback
  const { toast } = useToast();

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
      
      // Update the document in the database
      const { error } = await supabase
        .from('documents')
        .update({
          extracted_metadata: normalizedMetadata,
          line_items: editedLineItems[doc.id] || doc.line_items || [],
          validation_status: status,
          validated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (error) throw error;

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
    <div className="space-y-4 pb-24">
      {/* Header with document count and Validate All button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Validation Queue</h2>
          <p className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? 's' : ''} pending validation
          </p>
        </div>
        <Button
          onClick={handleValidateAll}
          className="bg-green-600 hover:bg-green-700"
          disabled={documents.length === 0}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Validate All
        </Button>
      </div>

      {/* List of documents to validate */}
      <div className="space-y-3">
        {documents.map((doc) => {
          // Calculate state for this document
          const isExpanded = expandedDocs.has(doc.id);
          const isValidating = validatingDocs.has(doc.id);
          const metadata = getMetadataForDoc(doc);

          return (
            <Card key={doc.id} className="overflow-hidden">
              {/* Collapsible card for each document */}
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(doc.id)}>
                {/* Document header: thumbnail, metadata badges, and action buttons */}
                <div className="p-4 flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-3 flex-1">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleValidate(doc, 'validated');
                      }}
                      disabled={isValidating}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Validate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleValidate(doc, 'rejected');
                      }}
                      disabled={isValidating}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
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
                  <div className="p-4 space-y-4 border-t">
                     <div className="grid grid-cols-2 gap-4">
                      {/* Left column: Image with region selector for re-extraction */}
                      <div>
                        <ImageRegionSelectorWithSignedUrl
                          fileUrl={doc.file_url}
                          onRegionSelected={(newMetadata) => handleRegionUpdate(doc.id, newMetadata)}
                          extractionFields={projectFields}
                        />
                      </div>

                      {/* Right column: Editable metadata fields */}
                      <div className="space-y-4">
                        <h4 className="font-semibold">Edit Fields</h4>
                        {projectFields.map((field) => (
                          <div key={field.name}>
                            <Label htmlFor={`${doc.id}-${field.name}`} className="text-sm">
                              {field.name}
                              {field.description && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {field.description}
                                </span>
                              )}
                            </Label>
                            <Input
                              id={`${doc.id}-${field.name}`}
                              value={getMetadataValue(metadata, field.name)}
                              onChange={(e) =>
                                handleFieldChange(doc.id, field.name, e.target.value)
                              }
                              placeholder={`Enter ${field.name}`}
                              className="mt-1"
                            />
                          </div>
                        ))}

                        {/* Line Items Table */}
                        {(doc.line_items && doc.line_items.length > 0) || editedLineItems[doc.id] ? (
                          <div className="mt-6 border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Line Items ({getLineItemsForDoc(doc).length})</h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddLineItem(doc.id)}
                              >
                                Add Row
                              </Button>
                            </div>
                            <div className="border rounded-md overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-muted">
                                  <tr>
                                    {getLineItemsForDoc(doc).length > 0 && Object.keys(getLineItemsForDoc(doc)[0]).map((key) => (
                                      <th key={key} className="px-3 py-2 text-left font-medium">
                                        {key}
                                      </th>
                                    ))}
                                    <th className="px-3 py-2 w-20"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {getLineItemsForDoc(doc).map((item, idx) => (
                                    <tr key={idx} className="border-t">
                                      {Object.entries(item).map(([key, value], vIdx) => (
                                        <td key={vIdx} className="px-2 py-1">
                                          <Input
                                            value={value !== null && value !== undefined ? String(value) : ''}
                                            onChange={(e) => handleLineItemChange(doc.id, idx, key, e.target.value)}
                                            className="h-8 text-sm"
                                          />
                                        </td>
                                      ))}
                                      <td className="px-2 py-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDeleteLineItem(doc.id, idx)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-6 border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Line Items</h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Initialize with empty row with project table extraction field names
                                  const tableConfig = (documents[0] as any)?.table_extraction_config;
                                  const emptyRow: Record<string, any> = {};
                                  if (tableConfig?.fields && Array.isArray(tableConfig.fields)) {
                                    tableConfig.fields.forEach((field: any) => {
                                      emptyRow[field.name] = '';
                                    });
                                  } else {
                                    // Default columns if no config
                                    emptyRow['Line Number'] = '';
                                    emptyRow['Description'] = '';
                                    emptyRow['Quantity'] = '';
                                    emptyRow['Amount'] = '';
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
                        )}
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
    </div>
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