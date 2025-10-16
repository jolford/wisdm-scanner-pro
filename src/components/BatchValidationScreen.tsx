import { useState } from 'react';
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

// Thumbnail component that uses a signed URL when needed
const ThumbnailWithSignedUrl = ({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) => {
  const { signedUrl } = useSignedUrl(url);
  return (
    <img
      src={signedUrl || url}
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

  if (loading || !signedUrl) {
    return <div className="py-8 text-center text-muted-foreground">Loading image...</div>;
  }

  return (
    <ImageRegionSelector
      imageUrl={signedUrl}
      onRegionSelected={onRegionSelected}
      extractionFields={extractionFields}
    />
  );
};