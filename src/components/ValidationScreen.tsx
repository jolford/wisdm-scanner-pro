import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Save, FileText, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, Lightbulb, Crop, Eraser } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { documentMetadataSchema } from '@/lib/validation-schemas';
import { safeErrorMessage } from '@/lib/error-handler';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageRegionSelector } from './ImageRegionSelector';
import { RedactionTool } from './RedactionTool';
import { useAuth } from '@/hooks/use-auth';

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
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [selectedText, setSelectedText] = useState('');
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [showRedactionTool, setShowRedactionTool] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Generate suggestions from extracted text
  useEffect(() => {
    if (extractedText && projectFields.length > 0) {
      const newSuggestions: Record<string, string[]> = {};
      const lines = extractedText.split('\n').filter(line => line.trim());
      
      projectFields.forEach(field => {
        const fieldNameLower = field.name.toLowerCase();
        const matches = lines.filter(line => 
          line.toLowerCase().includes(fieldNameLower) || 
          (field.description && line.toLowerCase().includes(field.description.toLowerCase()))
        );
        if (matches.length > 0) {
          newSuggestions[field.name] = matches.slice(0, 3).map(m => m.trim());
        }
      });
      
      setSuggestions(newSuggestions);
    }
  }, [extractedText, projectFields]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!documentId) return;
    
    try {
      await supabase
        .from('documents')
        .update({ extracted_metadata: editedMetadata })
        .eq('id', documentId);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [documentId, editedMetadata]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedMetadata(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Real-time validation
    try {
      documentMetadataSchema.parse({ ...editedMetadata, [fieldName]: value });
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    } catch (error: any) {
      const fieldError = error.errors?.find((e: any) => e.path[0] === fieldName);
      if (fieldError) {
        setFieldErrors(prev => ({ ...prev, [fieldName]: fieldError.message }));
      }
    }

    // Debounced auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(autoSave, 2000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter = Validate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleValidate('validated');
      }
      // Esc = Reject
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleValidate('rejected');
      }
      // Ctrl/Cmd + S = Skip
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editedMetadata, onSkip]);

  // Text selection handler
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text) {
      setSelectedText(text);
    }
  };

  const applySuggestion = (fieldName: string, suggestion: string) => {
    handleFieldChange(fieldName, suggestion);
    toast({
      title: 'Suggestion Applied',
      description: `Field "${fieldName}" has been filled`,
    });
  };

  const handleRegionSelected = (newMetadata: Record<string, string>) => {
    // Merge new metadata with existing
    const mergedMetadata = { ...editedMetadata, ...newMetadata };
    setEditedMetadata(mergedMetadata);
    setShowRegionSelector(false);
  };

  const handleRedactionSaved = (redactedUrl: string, isPermanent: boolean) => {
    setCurrentImageUrl(redactedUrl);
    setShowRedactionTool(false);
    toast({
      title: 'Redaction Complete',
      description: isPermanent 
        ? 'Document permanently redacted' 
        : 'Redacted version saved'
    });
  };

  const handleValidate = async (status: 'validated' | 'rejected') => {
    // Validate metadata with zod
    try {
      documentMetadataSchema.parse(editedMetadata);
    } catch (error: any) {
      const firstError = error.errors?.[0];
      toast({
        title: 'Validation Error',
        description: firstError?.message || 'Please check your input',
        variant: 'destructive',
      });
      return;
    }

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
        description: safeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Left: Document Image with Controls */}
        <Card className="p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Original Document
            </h3>
            <Badge variant="outline">{fileName}</Badge>
          </div>
          
          {/* Image Controls */}
          <div className="flex gap-2 mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImageZoom(prev => Math.min(prev + 0.25, 3))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImageZoom(prev => Math.max(prev - 0.25, 0.5))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={showRegionSelector ? "default" : "outline"}
                  onClick={() => setShowRegionSelector(!showRegionSelector)}
                >
                  <Crop className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showRegionSelector ? 'Cancel Selection' : 'Select Region to Re-OCR'}</TooltipContent>
            </Tooltip>

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={showRedactionTool ? "default" : "outline"}
                    onClick={() => setShowRedactionTool(!showRedactionTool)}
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showRedactionTool ? 'Cancel Redaction' : 'Redact Document'}</TooltipContent>
              </Tooltip>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setImageZoom(1);
                setImageRotation(0);
              }}
              className="ml-auto text-xs"
            >
              Reset
            </Button>
          </div>

          <div 
            ref={imageContainerRef}
            className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4"
          >
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt="Scanned document"
                className="w-full h-auto object-contain transition-transform cursor-move"
                style={{
                  transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                  transformOrigin: 'center center'
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <FileText className="h-12 w-12" />
              </div>
            )}
          </div>
          
          {/* Region Selector */}
          {showRegionSelector && (
            <div className="mt-4">
              <ImageRegionSelector
                imageUrl={currentImageUrl}
                onRegionSelected={handleRegionSelected}
                extractionFields={projectFields}
              />
            </div>
          )}

          {/* Redaction Tool */}
          {showRedactionTool && documentId && (
            <div className="mt-4">
              <RedactionTool
                imageUrl={currentImageUrl}
                documentId={documentId}
                onRedactionSaved={handleRedactionSaved}
                onCancel={() => setShowRedactionTool(false)}
              />
            </div>
          )}
        </Card>

      {/* Middle: Extracted Text with Selection */}
      <Card className="p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Extracted Text
          </h3>
          {selectedText && (
            <Badge variant="secondary" className="text-xs">
              "{selectedText.substring(0, 20)}..." selected
            </Badge>
          )}
        </div>
        <Textarea
          value={extractedText}
          readOnly
          onMouseUp={handleTextSelection}
          className="flex-1 font-mono text-xs resize-none select-text cursor-text"
          placeholder="No text extracted yet..."
        />
        <p className="text-xs text-muted-foreground mt-2">
          💡 Tip: Select text and use suggestions below
        </p>
      </Card>

      {/* Right: Index Fields & Validation */}
      <Card className="p-6 flex flex-col">
        <h3 className="font-semibold mb-4">Index Fields</h3>
        
        <div className="flex-1 overflow-auto space-y-4">
          {projectFields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className="text-sm">
                {field.name}
                {field.description && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {field.description}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id={field.name}
                  value={editedMetadata[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={`Enter ${field.name}`}
                  maxLength={500}
                  className={`${fieldErrors[field.name] ? 'border-destructive' : ''}`}
                />
                {fieldErrors[field.name] && (
                  <p className="text-xs text-destructive mt-1">
                    {fieldErrors[field.name]}
                  </p>
                )}
              </div>
              
              {/* Suggestions */}
              {suggestions[field.name] && suggestions[field.name].length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <Lightbulb className="h-3 w-3 text-muted-foreground mt-1" />
                  {suggestions[field.name].map((suggestion, idx) => (
                    <Button
                      key={idx}
                      size="sm"
                      variant="ghost"
                      onClick={() => applySuggestion(field.name, suggestion)}
                      className="h-6 text-xs px-2 bg-muted/50 hover:bg-muted"
                    >
                      {suggestion.substring(0, 30)}...
                    </Button>
                  ))}
                </div>
              )}
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
          <div className="text-xs text-muted-foreground mb-2 space-y-1">
            <p>⌨️ Keyboard shortcuts:</p>
            <p>• Ctrl/Cmd + Enter = Validate</p>
            <p>• Esc = Reject</p>
            <p>• Ctrl/Cmd + S = Skip</p>
          </div>
          
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleValidate('validated')}
                  disabled={isSaving}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isSaving && validationStatus === 'validated' ? 'Validating...' : 'Validate'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl/Cmd + Enter</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleValidate('rejected')}
                  disabled={isSaving}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {isSaving && validationStatus === 'rejected' ? 'Rejecting...' : 'Reject'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Esc</TooltipContent>
            </Tooltip>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onSkip}
                variant="outline"
                className="w-full"
                disabled={isSaving}
              >
                Skip / New Scan
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ctrl/Cmd + S</TooltipContent>
          </Tooltip>
        </div>
      </Card>
    </div>
    </TooltipProvider>
  );
};
