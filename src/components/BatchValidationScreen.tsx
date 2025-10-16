import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImageRegionSelector } from './ImageRegionSelector';
import { useSignedUrl } from '@/hooks/use-signed-url';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Configure PDF.js worker once
if ((pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
}


interface Document {
  id: string;
  file_name: string;
  file_url: string;
  extracted_text: string;
  extracted_metadata: Record<string, string>;
  validation_status: string;
}

interface BatchValidationScreenProps {
  documents: Document[];
  projectFields: Array<{ name: string; description: string }>;
  onValidationComplete: () => void;
  batchId: string;
  onSwitchToExport?: () => void;
}

export const BatchValidationScreen = ({
  documents,
  projectFields,
  onValidationComplete,
  batchId,
  onSwitchToExport,
}: BatchValidationScreenProps) => {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [editedMetadata, setEditedMetadata] = useState<Record<string, Record<string, string>>>({});
  const [validatingDocs, setValidatingDocs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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

  const handleFieldChange = (docId: string, fieldName: string, value: string) => {
    setEditedMetadata(prev => ({
      ...prev,
      [docId]: {
        ...(prev[docId] || {}),
        [fieldName]: value,
      }
    }));
  };

  const getMetadataForDoc = (doc: Document) => {
    return {
      ...doc.extracted_metadata,
      ...(editedMetadata[doc.id] || {})
    };
  };

  const handleRegionUpdate = (docId: string, newMetadata: Record<string, string>) => {
    setEditedMetadata(prev => ({
      ...prev,
      [docId]: {
        ...(prev[docId] || {}),
        ...newMetadata
      }
    }));
    
    toast({
      title: 'Region Updated',
      description: 'Metadata updated from selected region',
    });
  };

  const handleValidate = async (doc: Document, status: 'validated' | 'rejected') => {
    setValidatingDocs(prev => new Set(prev).add(doc.id));

    try {
      const metadata = getMetadataForDoc(doc);
      
      const { error } = await supabase
        .from('documents')
        .update({
          extracted_metadata: metadata,
          validation_status: status,
          validated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (error) throw error;

      // Update batch validated count
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

      toast({
        title: status === 'validated' ? 'Document Validated' : 'Document Rejected',
        description: `${doc.file_name} marked as ${status}`,
      });

      onValidationComplete();
      
      // If all documents are validated/rejected, switch to export
      if (status === 'validated' && onSwitchToExport && documents.length === 1) {
        setTimeout(() => onSwitchToExport?.(), 100);
      }
    } catch (error: any) {
      toast({
        title: 'Validation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setValidatingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  const handleValidateAll = async () => {
    for (const doc of documents) {
      await handleValidate(doc, 'validated');
    }
    // After all documents validated, switch to export
    if (onSwitchToExport) {
      setTimeout(() => onSwitchToExport(), 100);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="space-y-3">
        {documents.map((doc) => {
          const isExpanded = expandedDocs.has(doc.id);
          const isValidating = validatingDocs.has(doc.id);
          const metadata = getMetadataForDoc(doc);

          return (
            <Card key={doc.id} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(doc.id)}>
                <div className="p-4 flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Thumbnail */}
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
                      <div className="w-16 h-20 flex items-center justify-center bg-muted rounded border border-border">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{doc.file_name}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {projectFields.map((field) => (
                          <Badge key={field.name} variant="outline" className="text-xs">
                            {field.name}: {metadata[field.name] || 'N/A'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
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

                <CollapsibleContent>
                  <div className="p-4 space-y-4 border-t">
                     <div className="grid grid-cols-2 gap-4">
                      {/* Image with region selector */}
                      <div>
                        <ImageRegionSelectorWithSignedUrl
                          fileUrl={doc.file_url}
                          onRegionSelected={(newMetadata) => handleRegionUpdate(doc.id, newMetadata)}
                          extractionFields={projectFields}
                        />
                      </div>

                      {/* Editable fields */}
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
                              value={metadata[field.name] || ''}
                              onChange={(e) =>
                                handleFieldChange(doc.id, field.name, e.target.value)
                              }
                              placeholder={`Enter ${field.name}`}
                              className="mt-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

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

// Thumbnail component that uses a signed URL and renders PDF first page when needed
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
  const { signedUrl } = useSignedUrl(url);
  const [thumb, setThumb] = useState<string | null>(null);
  const isPdf = Boolean(fileType?.toLowerCase().includes('pdf')) || /\.pdf($|\?)/i.test((signedUrl || url) || '') || /\.pdf$/i.test(alt);

  useEffect(() => {
    const makeThumb = async () => {
      const src = signedUrl || url;
      try {
        // Quick path: if not a PDF, use the URL directly
        if (!isPdf) {
          setThumb(src);
          return;
        }
        // Try to render first page of PDF into a small canvas
        const resp = await fetch(src, { cache: 'no-store' });
        const buffer = await resp.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        const targetWidth = 64;
        const scale = targetWidth / viewport.width;
        const scaledVp = page.getViewport({ scale });
        canvas.width = Math.round(scaledVp.width);
        canvas.height = Math.round(scaledVp.height);
        await page.render({ canvasContext: context, viewport: scaledVp }).promise;
        setThumb(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('PDF thumbnail render failed (bytes path)', { src, error: e });
        console.warn('Thumbnail render failed, trying URL method', e);
        try {
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
          // If it's a PDF, prefer showing the icon placeholder
          if (isPdf) {
            setThumb(null);
          } else {
            setThumb(src);
          }
        }
      }
    };
    makeThumb();
  }, [signedUrl, url, alt, fileType]);

  if (!thumb) {
    const href = signedUrl || url;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="w-16 h-20 flex items-center justify-center bg-muted rounded border border-border hover:bg-muted/60">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </a>
    );
  }

  return (
    <img
      src={thumb || signedUrl || url}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
      }}
    />
  );
};

// Helper component to handle signed URL for ImageRegionSelector
const ImageRegionSelectorWithSignedUrl = ({ 
  fileUrl, 
  onRegionSelected, 
  extractionFields 
}: { 
  fileUrl: string;
  onRegionSelected: (metadata: Record<string, string>) => void;
  extractionFields: any[];
}) => {
  const { signedUrl, loading } = useSignedUrl(fileUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const isPdf = /\.pdf($|\?)/i.test(fileUrl);

  useEffect(() => {
    const run = async () => {
      if (!signedUrl) return;
      try {
        const resp = await fetch(signedUrl);
        const buffer = await resp.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        setPreview(canvas.toDataURL('image/png'));
      } catch (e) {
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
          setPreview(null);
        }
      }
    };
    run();
  }, [signedUrl]);

  if (loading || !signedUrl) {
    return <div className="py-8 text-center text-muted-foreground">Loading image...</div>;
  }

  if (!preview) {
    return <div className="py-8 text-center text-muted-foreground">Preview unavailable</div>;
  }

  return (
    <ImageRegionSelector
      imageUrl={preview}
      onRegionSelected={onRegionSelected}
      extractionFields={extractionFields}
    />
  );
};