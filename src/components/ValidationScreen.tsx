import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Save, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ValidationScreenProps {
  documentId?: string;
  imageUrl: string;
  fileName: string;
  extractedText: string;
  metadata: Record<string, string>;
  projectFields: Array<{ name: string; description: string }>;
  onValidate: (status: 'validated' | 'rejected', metadata: Record<string, string>) => void;
  onSkip: () => void;
}

export const ValidationScreen = ({
  documentId,
  imageUrl,
  fileName,
  extractedText,
  metadata,
  projectFields,
  onValidate,
  onSkip,
}: ValidationScreenProps) => {
  const [editedMetadata, setEditedMetadata] = useState(metadata);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'validated' | 'rejected'>('pending');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedMetadata(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleValidate = async (status: 'validated' | 'rejected') => {
    setIsSaving(true);
    setValidationStatus(status);

    try {
      if (documentId) {
        const { error } = await supabase
          .from('documents')
          .update({
            extracted_metadata: editedMetadata,
            validation_status: status,
            validated_at: new Date().toISOString(),
          })
          .eq('id', documentId);

        if (error) throw error;
      }

      toast({
        title: status === 'validated' ? 'Document Validated' : 'Document Rejected',
        description: `Document has been marked as ${status}`,
      });

      onValidate(status, editedMetadata);
    } catch (error: any) {
      toast({
        title: 'Validation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Left: Document Image */}
      <Card className="p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Original Document
          </h3>
          <Badge variant="outline">{fileName}</Badge>
        </div>
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Scanned document"
              className="w-full h-auto object-contain"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12" />
            </div>
          )}
        </div>
      </Card>

      {/* Middle: Extracted Text */}
      <Card className="p-6 flex flex-col">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Extracted Text
        </h3>
        <Textarea
          value={extractedText}
          readOnly
          className="flex-1 font-mono text-xs resize-none"
          placeholder="No text extracted yet..."
        />
      </Card>

      {/* Right: Index Fields & Validation */}
      <Card className="p-6 flex flex-col">
        <h3 className="font-semibold mb-4">Index Fields</h3>
        
        <div className="flex-1 overflow-auto space-y-4">
          {projectFields.map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name} className="text-sm">
                {field.name}
                {field.description && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {field.description}
                  </span>
                )}
              </Label>
              <Input
                id={field.name}
                value={editedMetadata[field.name] || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                placeholder={`Enter ${field.name}`}
                className="mt-1"
              />
            </div>
          ))}

          {projectFields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No index fields defined for this project</p>
            </div>
          )}
        </div>

        {/* Validation Actions */}
        <div className="mt-6 space-y-3 pt-6 border-t">
          <div className="flex gap-2">
            <Button
              onClick={() => handleValidate('validated')}
              disabled={isSaving}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isSaving && validationStatus === 'validated' ? 'Validating...' : 'Validate'}
            </Button>
            <Button
              onClick={() => handleValidate('rejected')}
              disabled={isSaving}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isSaving && validationStatus === 'rejected' ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
          <Button
            onClick={onSkip}
            variant="outline"
            className="w-full"
            disabled={isSaving}
          >
            Skip / New Scan
          </Button>
        </div>
      </Card>
    </div>
  );
};
