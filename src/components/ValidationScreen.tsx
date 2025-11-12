import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Save, FileText, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, Lightbulb, Crop, Eraser, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { documentMetadataSchema } from '@/lib/validation-schemas';
import { safeErrorMessage } from '@/lib/error-handler';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageRegionSelector } from './ImageRegionSelector';
import { RedactionTool } from './RedactionTool';
import { InteractiveDocumentViewer } from './InteractiveDocumentViewer';
import { LineItemValidation } from './LineItemValidation';
import { PetitionValidationWarnings } from './PetitionValidationWarnings';
import { useAuth } from '@/hooks/use-auth';
import { useSignedUrl } from '@/hooks/use-signed-url';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Configure PDF.js worker once
if ((pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
}


interface ValidationScreenProps {
  documentId?: string;
  projectId?: string; // Added for fetching reference signatures
  imageUrl: string;
  fileName: string;
  extractedText: string;
  metadata: Record<string, string>;
  projectFields: Array<{ name: string; description: string }>;
  projectName?: string; // Added to detect AB1466 project
  enableSignatureVerification?: boolean; // Enable signature verification for this project
  boundingBoxes?: Record<string, { x: number; y: number; width: number; height: number }>;
  wordBoundingBoxes?: Array<{ text: string; bbox: any }>;
  onValidate: (status: 'validated' | 'rejected', metadata: Record<string, string>) => void;
  onSkip: () => void;
  onSwitchToExport?: () => void;
  classification?: {
    document_type?: string;
    confidence?: number;
    reasoning?: string;
  };
}

export const ValidationScreen = ({
  documentId,
  projectId,
  imageUrl,
  fileName,
  extractedText,
  metadata,
  projectFields,
  projectName,
  enableSignatureVerification = false,
  boundingBoxes = {},
  wordBoundingBoxes = [],
  onValidate,
  onSkip,
  onSwitchToExport,
  classification,
}: ValidationScreenProps) => {
  const [editedMetadata, setEditedMetadata] = useState(metadata);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, number>>({});
  const [validationSuggestions, setValidationSuggestions] = useState<Record<string, any>>({});
  const [isValidating, setIsValidating] = useState(false);
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [useInteractiveViewer, setUseInteractiveViewer] = useState(true);
  const [offensiveHighlights, setOffensiveHighlights] = useState<Array<{
    text: string;
    category: string;
    severity: string;
    reason: string;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
  }>>([]);
  const [isAnalyzingLanguage, setIsAnalyzingLanguage] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string>('');
  const [signatureValidationResult, setSignatureValidationResult] = useState<any>(null);
  const [isValidatingSignature, setIsValidatingSignature] = useState(false);
  const [referenceSignatures, setReferenceSignatures] = useState<any[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [entityIdField, setEntityIdField] = useState<string>('');
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string>('');
  const [selectedReferenceMeta, setSelectedReferenceMeta] = useState<any>(null);
  const [lineItems, setLineItems] = useState<Array<Record<string, any>>>([]);
  const [validationLookupConfig, setValidationLookupConfig] = useState<any>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { signedUrl: displayUrl } = useSignedUrl(currentImageUrl);
  const isPdf = fileName?.toLowerCase().endsWith('.pdf');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Resolve signature verification from prop or backend (project settings)
  const [sigEnabled, setSigEnabled] = useState<boolean>(enableSignatureVerification);
  useEffect(() => { setSigEnabled(enableSignatureVerification); }, [enableSignatureVerification]);
  useEffect(() => {
    if (!projectId) return;
    if (enableSignatureVerification) return; // already true via prop
    (async () => {
      try {
        const { data } = await supabase
          .from('projects')
          .select('enable_signature_verification')
          .eq('id', projectId)
          .single();
        if (data?.enable_signature_verification) setSigEnabled(true);
      } catch (_) {
        // ignore - non-blocking enhancement
      }
    })();
  }, [projectId, enableSignatureVerification]);

  // Fallback: auto-enable if project has signature cues
  useEffect(() => {
    if (sigEnabled) return;
    const hasSignatureField = (projectFields || []).some(
      (f) => f?.name?.toLowerCase().includes('signature')
    );
    if (hasSignatureField) setSigEnabled(true);
  }, [sigEnabled, projectFields]);

  // Fallback: enable if project already has active signature references
  useEffect(() => {
    if (!projectId || sigEnabled) return;
    (async () => {
      try {
        const { count } = await supabase
          .from('signature_references')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('is_active', true);
        if ((count || 0) > 0) {
          setSigEnabled(true);
        }
      } catch {
        // ignore - optional enhancement
      }
    })();
  }, [projectId, sigEnabled]);

  // Additional fallback: enable if metadata includes signature
  useEffect(() => {
    if (sigEnabled) return;
    const keys = Object.keys(editedMetadata || {});
    const hasSigMeta = keys.some(k => k?.toLowerCase().includes('signature'));
    if (hasSigMeta) setSigEnabled(true);
  }, [sigEnabled, editedMetadata]);

  // Debugging visibility
  useEffect(() => {
    const hasSigField = (projectFields || []).some(f => f?.name?.toLowerCase().includes('signature'));
    const hasSigMeta = Object.keys(editedMetadata || {}).some(k => k?.toLowerCase().includes('signature'));
    console.debug('SignatureSection visibility', { projectId, propEnabled: enableSignatureVerification, sigEnabled, hasSigField, hasSigMeta, refs: referenceSignatures?.length || 0 });
  }, [projectId, enableSignatureVerification, sigEnabled, projectFields, editedMetadata, referenceSignatures]);

  // Resolved OCR geometry for redaction (props or lazy-fetched)
  const [resolvedBoundingBoxes, setResolvedBoundingBoxes] = useState(boundingBoxes);
  const [resolvedWordBoxes, setResolvedWordBoxes] = useState<Array<{ text: string; bbox: any }>>(wordBoundingBoxes || []);

  // Helper to normalize any metadata value to a displayable string
  const toFieldString = (v: any): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      // Handle new format { value: string, bbox: {...} }
      if ('value' in v && (typeof (v as any).value === 'string' || typeof (v as any).value === 'number')) {
        return String((v as any).value);
      }
    }
    return '';
  };

  const normalizeSuggestions = (arr: any): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s: any) => {
        if (typeof s === 'string') return s;
        if (typeof s === 'number' || typeof s === 'boolean') return String(s);
        if (s && typeof s === 'object' && 'value' in s) return String(s.value);
        return '';
      })
      .filter(Boolean);
  };

  // Load field confidence, line items, and validation config from document and project
  useEffect(() => {
    const loadDocumentData = async () => {
      if (!documentId) return;
      
      const { data, error } = await supabase
        .from('documents')
        .select('field_confidence, validation_suggestions, line_items')
        .eq('id', documentId)
        .single();
      
      if (!error && data) {
        setFieldConfidence((data.field_confidence as Record<string, number>) || {});
        setValidationSuggestions((data.validation_suggestions as Record<string, any>) || {});
        setLineItems((data.line_items as Array<Record<string, any>>) || []);
      }
    };

    const loadProjectConfig = async () => {
      if (!projectId) return;
      
      const { data, error } = await supabase
        .from('projects')
        .select('metadata')
        .eq('id', projectId)
        .single();
      
      if (!error && data?.metadata) {
        const metadata = data.metadata as any;
        if (metadata.validation_lookup_config) {
          setValidationLookupConfig(metadata.validation_lookup_config);
        }
      }
    };
    
    loadDocumentData();
    loadProjectConfig();
  }, [documentId, projectId]);
  
  // Smart validation function
  const validateField = async (fieldName: string, fieldValue: any) => {
    if (!documentId) return;

    const valueStr = toFieldString(fieldValue);
    if (!valueStr) {
      toast({ title: 'Nothing to validate', description: 'Please enter a value first.' });
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-validation', {
        body: {
          documentId,
          fieldName,
          fieldValue: valueStr,
          context: extractedText.substring(0, 500)
        }
      });

      if (error) throw error;

      if (data?.validation) {
        const validation = data.validation as any;

        // Update confidence
        if (typeof validation.confidence === 'number') {
          setFieldConfidence(prev => ({
            ...prev,
            [fieldName]: validation.confidence,
          }));
        }

        // Apply corrected/validated value when provided
        const corrected = validation.validated_value ?? validation.corrected_value ?? validation.value;
        if (corrected !== undefined && corrected !== null && corrected !== '') {
          setEditedMetadata(prev => ({ ...prev, [fieldName]: toFieldString(corrected) }));
        }

        // Normalize and show suggestions
        const suggs = normalizeSuggestions(validation.suggestions);
        if (suggs.length > 0) {
          setValidationSuggestions(prev => ({ ...prev, [fieldName]: { ...validation, suggestions: suggs } }));
          setSuggestions(prev => ({ ...prev, [fieldName]: suggs }));
        }

        toast({
          title: 'AI validation complete',
          description: corrected ? `Updated ${fieldName} to ${toFieldString(corrected)}` : (suggs.length ? 'Suggestions available below' : 'No changes suggested'),
        });
      }
    } catch (error: any) {
      console.error('Smart validation failed:', error);
      const message = error?.message || 'Unexpected error running AI validation';
      toast({ title: 'Validation failed', description: message, variant: 'destructive' });
    } finally {
      setIsValidating(false);
    }
  };
  useEffect(() => { setResolvedBoundingBoxes(boundingBoxes); }, [boundingBoxes]);
  useEffect(() => { setResolvedWordBoxes(wordBoundingBoxes || []); }, [wordBoundingBoxes]);

  // Fetch reference signatures when project changes
  useEffect(() => {
    if (projectId) {
      fetchReferenceSignatures();
    }
  }, [projectId]);

  const fetchReferenceSignatures = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('signature_references')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true);
      
      if (error) throw error;
      setReferenceSignatures(data || []);
    } catch (error) {
      console.error('Error fetching reference signatures:', error);
    }
  };
  
  
  useEffect(() => {
    const run = async () => {
      if (!displayUrl) { setPreviewUrl(null); return; }
      if (!isPdf) { setPreviewUrl(displayUrl); return; }
      try {
        // Fetch bytes first to avoid any cross-origin quirks
        const resp = await fetch(displayUrl);
        const buffer = await resp.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        let viewport = page.getViewport({ scale: 1.2 });
        const maxDim = 1800;
        const scale = Math.min(1.2, maxDim / Math.max(viewport.width, viewport.height));
        viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        setPreviewUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('PDF preview render failed', e);
        setPreviewUrl(null);
      }
    };
    run();
  }, [displayUrl, isPdf]);

// Lazy-fetch word-level boxes when opening Redaction Tool (for previously saved docs)
useEffect(() => {
  const shouldFetch = showRedactionTool && (!resolvedWordBoxes || resolvedWordBoxes.length === 0);
  if (!shouldFetch) return;
  const imgSrc = previewUrl || displayUrl || currentImageUrl;
  if (!imgSrc) return;
  toast({ title: 'Preparing Auto‑Redaction', description: 'Analyzing coordinates…' });
  (async () => {
    try {
      const tableFields: any[] = [];
      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: {
          imageData: imgSrc,
          isPdf: false,
          extractionFields: projectFields || [],
          tableExtractionFields: tableFields,
          enableCheckScanning: false,
        },
      });
      if (error) { console.error('Auto-redact OCR fetch failed', error); return; }
      setResolvedWordBoxes(data?.wordBoundingBoxes || []);
      if (!resolvedBoundingBoxes || Object.keys(resolvedBoundingBoxes || {}).length === 0) {
        setResolvedBoundingBoxes(data?.boundingBoxes || {});
      }
    } catch (e) {
      console.error('Failed fetching word boxes', e);
    }
  })();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [showRedactionTool, previewUrl, displayUrl, currentImageUrl]);

// Auto-detect offensive language for AB 1466 projects
useEffect(() => {
  const isAB1466 = projectName?.toLowerCase().includes('ab') && projectName?.toLowerCase().includes('1466');
  if (!isAB1466 || !extractedText || isAnalyzingLanguage) return;
  
  const detectOffensiveLanguage = async () => {
    setIsAnalyzingLanguage(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-offensive-language', {
        body: {
          text: extractedText,
          wordBoundingBoxes: resolvedWordBoxes,
        },
      });
      
      if (error) {
        console.error('Failed to detect offensive language:', error);
        return;
      }
      
      if (data?.highlights && data.highlights.length > 0) {
        setOffensiveHighlights(data.highlights);
        toast({
          title: 'Offensive Language Detected',
          description: `Found ${data.highlights.length} potentially problematic phrase(s) highlighted in yellow`,
        });
      }
    } catch (error) {
      console.error('Error detecting offensive language:', error);
    } finally {
      setIsAnalyzingLanguage(false);
    }
  };
  
  detectOffensiveLanguage();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [extractedText, projectName, resolvedWordBoxes]);

// Client-side calculation verification (fallback for older docs)
useEffect(() => {
  const compute = async () => {
    if (!documentId) return;
    if (editedMetadata['_calculationMatch']) return; // already computed

    const { data, error } = await supabase
      .from('documents')
      .select('line_items, extracted_metadata')
      .eq('id', documentId)
      .single();

    if (error) {
      console.warn('Failed to fetch document for calculation verification', error);
      return;
    }

    const items: any[] = (data?.line_items as any[]) || [];
    if (!items.length) return;

    const meta: Record<string, any> = (data?.extracted_metadata as any) || editedMetadata;

    let calculatedTotal = 0;
    let hasValidAmounts = false;

    try {
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

      if (!hasValidAmounts) return;

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

      if (invoiceTotal === null) return;

      const variance = Math.abs(calculatedTotal - invoiceTotal);
      const variancePercent = (variance / invoiceTotal) * 100;

      setEditedMetadata(prev => ({
        ...prev,
        _calculatedLineItemsTotal: calculatedTotal.toFixed(2),
        _invoiceTotal: invoiceTotal!.toFixed(2),
        _calculationVariance: variance.toFixed(2),
        _calculationVariancePercent: variancePercent.toFixed(2),
        _calculationMatch: variance < 0.01 ? 'true' : 'false',
      }));
    } catch (e) {
      console.warn('Client-side calculation verification failed', e);
    }
  };

  compute();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [documentId]);
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

  const handleSignatureValidation = async () => {
    if (!signatureImage) {
      toast({
        title: 'No signature image',
        description: 'Please upload a signature image first',
        variant: 'destructive',
      });
      return;
    }

    setIsValidatingSignature(true);
    try {
      let referenceImageUrl = null;
      
      // If a reference signature is selected, fetch it
      if (selectedReferenceId) {
        const reference = referenceSignatures.find(r => r.id === selectedReferenceId);
        if (reference) {
          // Get signed URL for the reference signature
          const { data: urlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(reference.signature_image_url, 3600);
          
          if (urlData?.signedUrl) {
            // Convert to base64
            const response = await fetch(urlData.signedUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            referenceImageUrl = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        }
      } else if (entityIdField && editedMetadata?.[entityIdField]) {
        // Auto-match based on entity ID field
        const matchingRef = referenceSignatures.find(
          r => r.entity_id === String(editedMetadata[entityIdField])
        );
        
        if (matchingRef) {
          // Reflect selection in UI
          setSelectedReferenceId(matchingRef.id);
          
          const { data: urlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(matchingRef.signature_image_url, 3600);
          
          if (urlData?.signedUrl) {
            const response = await fetch(urlData.signedUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            referenceImageUrl = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
          
          toast({
            title: 'Auto-matched reference',
            description: `Using reference for ${matchingRef.entity_name || matchingRef.entity_id}`,
          });
        }
      }

      const { data, error } = await supabase.functions.invoke('validate-signature', {
        body: {
          signatureImage,
          referenceImage: referenceImageUrl,
          strictMode: !!referenceImageUrl
        }
      });

      if (error) throw error;

      setSignatureValidationResult(data);
      
      if (referenceImageUrl && data.match !== undefined) {
        toast({
          title: data.match ? 'Signature Match' : 'Signature Mismatch',
          description: `Similarity: ${Math.round((data.similarityScore || 0) * 100)}% - ${data.recommendation || 'review'}`,
          variant: data.match ? 'default' : 'destructive',
        });
      } else if (data.signatureDetected) {
        toast({
          title: 'Signature Detected',
          description: `Detected with ${Math.round((data.confidence || 0) * 100)}% confidence`,
        });
      } else {
        toast({
          title: 'No signature detected',
          description: 'Please verify the image contains a valid signature',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Signature validation failed:', error);
      toast({
        title: 'Validation failed',
        description: error?.message || 'Failed to validate signature',
        variant: 'destructive',
      });
    } finally {
      setIsValidatingSignature(false);
    }
  };

  const handleSignatureImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSignatureImage(result);
      setSignatureValidationResult(null); // Reset previous results
    };
    reader.readAsDataURL(file);
  };

  const handleRegionClick = async (x: number, y: number) => {
    toast({
      title: 'Extracting text...',
      description: `Extracting text at position (${x.toFixed(1)}%, ${y.toFixed(1)}%)`,
    });
    
    // In a real implementation, you would:
    // 1. Send the coordinates to an OCR service
    // 2. Get back the text at that position
    // 3. Populate the focused field with the extracted text
    
    // For now, we'll show a placeholder
    toast({
      title: 'Feature Coming Soon',
      description: 'Point-and-click text extraction will be available in the next update',
    });
  };

  const handleFieldFocus = (fieldName: string) => {
    setFocusedField(fieldName);
    // Scroll to the field in the form
    const fieldElement = document.getElementById(fieldName);
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldElement.focus();
    }
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
        // Include signature validation results in metadata if available
        const finalMetadata = signatureValidationResult 
          ? { ...editedMetadata, _signatureValidation: JSON.stringify(signatureValidationResult) }
          : editedMetadata;
          
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error, data: updatedDoc } = await supabase
          .from('documents')
          .update({
            extracted_metadata: finalMetadata,
            validation_status: status,
            validated_at: new Date().toISOString(),
            validated_by: user?.id,
          })
          .eq('id', documentId)
          .select('*, batch:batches(batch_name), project:projects(name, customer_id)')
          .single();

        if (error) throw error;

        // Trigger webhook notification for document validation
        if (updatedDoc && status === 'validated') {
          try {
            let targetCustomerId = updatedDoc.project?.customer_id as string | null | undefined;
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
                  document_id: documentId,
                  document_name: fileName,
                  batch_name: updatedDoc.batch?.batch_name,
                  project_name: updatedDoc.project?.name,
                  validated_by: user?.id,
                  validated_at: new Date().toISOString(),
                  metadata: finalMetadata,
                }
              }
            });
          } catch (webhookError) {
            console.error('Webhook notification failed:', webhookError);
            // Don't fail validation if webhook fails
          }
        }
      }

      toast({
        title: status === 'validated' ? 'Document Validated' : 'Document Rejected',
        description: `Document has been marked as ${status}`,
      });

      const finalMetadata = signatureValidationResult 
        ? { ...editedMetadata, _signatureValidation: JSON.stringify(signatureValidationResult) }
        : editedMetadata;
      
      onValidate(status, finalMetadata);
      
      // Switch to export tab if validated and callback provided
      if (status === 'validated' && onSwitchToExport) {
        setTimeout(() => onSwitchToExport(), 100);
      }
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
      <div className="grid grid-cols-[2fr_1fr_2fr] gap-6 min-h-[calc(100vh-12rem)] pb-40">
        {/* Left: Document Viewer */}
        {useInteractiveViewer && Object.keys(boundingBoxes).length > 0 ? (
          <InteractiveDocumentViewer
            imageUrl={previewUrl || displayUrl || currentImageUrl}
            fileName={fileName}
            boundingBoxes={boundingBoxes}
            onFieldClick={handleFieldFocus}
            onRegionClick={handleRegionClick}
            highlightedField={focusedField}
            offensiveHighlights={offensiveHighlights}
          />
        ) : (
          <Card className="p-6 flex flex-col" key="traditional-viewer">
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
                src={previewUrl || displayUrl || currentImageUrl}
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
                imageUrl={previewUrl || displayUrl || currentImageUrl}
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
                ocrText={extractedText}
                ocrMetadata={{ fields: metadata, boundingBoxes: resolvedBoundingBoxes, wordBoundingBoxes: resolvedWordBoxes }}
                onRedactionSaved={handleRedactionSaved}
                onCancel={() => setShowRedactionTool(false)}
              />
            </div>
          )}
        </Card>
        )}

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
        
        {/* Offensive Language Alerts */}
        {offensiveHighlights.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600 text-sm">
                ⚠️ {offensiveHighlights.length} OFFENSIVE PHRASE(S) DETECTED
              </Badge>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {offensiveHighlights.map((highlight, idx) => (
                <div key={idx} className="p-3 bg-background/50 rounded border border-yellow-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs border-yellow-500/50">
                      {highlight.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-red-500/50">
                      {highlight.severity.toUpperCase()} SEVERITY
                    </Badge>
                  </div>
                  <p className="text-sm font-mono mb-2 text-yellow-600 dark:text-yellow-400">
                    "{highlight.text}"
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {highlight.reason}
                  </p>
                  {!highlight.boundingBox && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                      💡 Coordinates unavailable - locate manually in text
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-medium text-yellow-700 dark:text-yellow-300">
              ⚠️ Review and manually redact problematic content as required by law
            </p>
          </div>
        )}
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
      <Card className="p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Index Fields</h3>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Validation Available
          </Badge>
        </div>
        
        {/* AI Validation Section - Always Visible at Top */}
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-primary/30 rounded-lg shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <div>
                <span className="font-semibold text-base">AI Smart Validation</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click 💡 next to any field or use Validate All
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                console.log('Validate All clicked');
                projectFields.forEach(field => {
                  const value = editedMetadata[field.name] || '';
                  if (value && !field.name.startsWith('_')) {
                    console.log(`Validating field: ${field.name} with value:`, value);
                    validateField(field.name, value);
                  }
                });
              }}
              disabled={isValidating}
              size="sm"
              variant="default"
              className="h-8 font-semibold"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              {isValidating ? 'Validating...' : 'Validate All'}
            </Button>
          </div>
          <div className="flex items-start gap-2 text-xs bg-white/50 dark:bg-black/20 p-2 rounded border border-primary/20">
            <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">How it works:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                <li>Fill in a field value (e.g., Invoice Total)</li>
                <li>Click the 💡 lightbulb icon next to the field</li>
                <li>AI will validate and suggest corrections if needed</li>
              </ol>
            </div>
          </div>
        </div>
        
        {/* Signature Verification Section */}
        {(sigEnabled || true) && (
          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-2 border-purple-300/30 dark:border-purple-700/30 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50">
                <span className="text-lg">✍️</span>
              </div>
              <div>
                <span className="font-semibold text-base">Signature Verification</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload and validate document signatures
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {referenceSignatures.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Compare Against Reference</Label>
                  <Select value={selectedReferenceId || 'none'} onValueChange={(val) => setSelectedReferenceId(val === 'none' ? null : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reference signature..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Detection only)</SelectItem>
                      {referenceSignatures.map((ref) => (
                        <SelectItem key={ref.id} value={ref.id}>
                          {ref.entity_name || ref.entity_id} ({ref.entity_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedReferenceMeta && referencePreviewUrl && (
                    <div className="mt-2 flex items-center gap-3 p-2 rounded border bg-muted/30">
                      <img src={referencePreviewUrl} alt="Reference signature preview" className="h-10 w-auto object-contain rounded" />
                      <div className="text-xs">
                        <p className="font-medium">Using reference: {selectedReferenceMeta.entity_name || selectedReferenceMeta.entity_id}</p>
                        <p className="text-muted-foreground">{selectedReferenceMeta.entity_type} • ID: {selectedReferenceMeta.entity_id}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Or auto-match using field:
                    <Input
                      placeholder="e.g., voter_id"
                      value={entityIdField}
                      onChange={(e) => setEntityIdField(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="signature-upload" className="text-sm mb-2 block">
                  Upload Signature Image
                </Label>
                <Input
                  id="signature-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureImageUpload}
                  className="cursor-pointer"
                />
              </div>
              
              {signatureImage && (
                <div className="space-y-2">
                  <div className="relative w-full h-32 bg-white dark:bg-gray-900 rounded border">
                    <img
                      src={signatureImage}
                      alt="Signature"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  <Button
                    onClick={handleSignatureValidation}
                    disabled={isValidatingSignature}
                    size="sm"
                    className="w-full"
                    variant="default"
                  >
                    {isValidatingSignature ? 'Validating...' : (selectedReferenceId || (entityIdField && editedMetadata?.[entityIdField]) ? 'Compare Signature' : 'Detect Signature')}
                  </Button>
                </div>
              )}
              
              {signatureValidationResult && (
                <div className={`p-3 rounded border ${
                  signatureValidationResult.match !== undefined
                    ? (signatureValidationResult.match ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700' : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700')
                    : (signatureValidationResult.signatureDetected ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700' : 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700')
                }`}>
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    {signatureValidationResult.match !== undefined ? (
                      <>
                        <Badge variant={signatureValidationResult.match ? 'default' : 'secondary'} className="text-xs">
                          {signatureValidationResult.match ? '✓ Match' : '≈ No Match'}
                        </Badge>
                        {signatureValidationResult.similarityScore !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(signatureValidationResult.similarityScore * 100)}% similarity
                          </Badge>
                        )}
                        {signatureValidationResult.recommendation && (
                          <Badge 
                            variant={signatureValidationResult.recommendation === 'accept' ? 'default' : signatureValidationResult.recommendation === 'review' ? 'secondary' : 'destructive'} 
                            className="text-xs"
                          >
                            {signatureValidationResult.recommendation}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <>
                        <Badge variant={signatureValidationResult.signatureDetected ? 'default' : 'destructive'} className="text-xs">
                          {signatureValidationResult.signatureDetected ? '✓ Signature Detected' : '✗ No Signature'}
                        </Badge>
                        {signatureValidationResult.confidence !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(signatureValidationResult.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  
                  {signatureValidationResult.analysis && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {signatureValidationResult.analysis}
                    </p>
                  )}
                  
                  {signatureValidationResult.characteristics && (
                    <div className="mt-2 text-xs space-y-1">
                      <p><strong>Handwritten:</strong> {signatureValidationResult.characteristics.isHandwritten ? 'Yes' : 'No'}</p>
                      <p><strong>Complexity:</strong> {signatureValidationResult.characteristics.complexity}</p>
                      <p><strong>Clarity:</strong> {signatureValidationResult.characteristics.clarity}</p>
                    </div>
                  )}

                  {signatureValidationResult.differences && signatureValidationResult.differences.length > 0 && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold">Differences:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {signatureValidationResult.differences.map((diff: string, idx: number) => (
                          <li key={idx}>{diff}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {signatureValidationResult.similarities && signatureValidationResult.similarities.length > 0 && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold">Similarities:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {signatureValidationResult.similarities.map((sim: string, idx: number) => (
                          <li key={idx}>{sim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Petition Validation Warnings */}
        {documentId && (
          <div className="mb-4">
            <PetitionValidationWarnings
              documentId={documentId}
              batchId={documentId}
              metadata={editedMetadata}
            />
          </div>
        )}

        {/* Fraud Detection - Coming in Phase 2
        {documentId && lineItems && lineItems.length > 0 && (
          <div className="mb-4">
            <FraudDetectionPanel
              documentId={documentId}
              batchId={documentId}
              lineItems={lineItems}
              metadata={editedMetadata}
            />
          </div>
        )}
        */}
        
        <div className="flex-1 overflow-auto">
          {/* Document Classification */}
          {classification?.document_type && (
            <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <Badge variant="outline" className="text-sm">
                  📄 {classification.document_type.replace(/_/g, ' ').toUpperCase()}
                </Badge>
                {classification.confidence !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(classification.confidence * 100)}% confident
                  </Badge>
                )}
              </div>
              {classification.reasoning && (
                <p className="text-xs text-muted-foreground mt-2">
                  {classification.reasoning}
                </p>
              )}
            </div>
          )}
          
          {/* Calculation Variance Warning */}
          {editedMetadata['_calculationMatch'] === 'false' && (
            <div className="mb-4 p-4 bg-destructive/10 border-2 border-destructive/50 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <Badge variant="destructive" className="text-sm">
                  ⚠️ CALCULATION MISMATCH
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Line Items Total:</span>{' '}
                  <span className="font-mono">${editedMetadata['_calculatedLineItemsTotal']}</span>
                </p>
                <p>
                  <span className="font-medium">Invoice Total:</span>{' '}
                  <span className="font-mono">${editedMetadata['_invoiceTotal']}</span>
                </p>
                <p className="text-destructive font-semibold pt-2 border-t border-destructive/20">
                  <span className="font-bold">VARIANCE:</span>{' '}
                  <span className="font-mono text-lg">${editedMetadata['_calculationVariance']}</span>
                  <span className="ml-2 text-base">({editedMetadata['_calculationVariancePercent']}%)</span>
                </p>
              </div>
              <p className="mt-3 text-sm text-destructive font-medium">
                ⚠️ Please verify line items and totals before validating
              </p>
            </div>
          )}
          
          {editedMetadata['_calculationMatch'] === 'true' && (
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium">Calculation verified</span>
                <span className="font-mono ml-auto">${editedMetadata['_calculatedLineItemsTotal']}</span>
              </div>
            </div>
          )}
          
          {/* Line Item Validation for Petitions */}
          {(() => {
            console.log('LineItemValidation check:', {
              hasLineItems: lineItems && lineItems.length > 0,
              lineItemsCount: lineItems?.length,
              hasValidationConfig: !!validationLookupConfig,
              validationSystem: validationLookupConfig?.system,
              validationEnabled: validationLookupConfig?.enabled
            });
            return null;
          })()}
          {lineItems && lineItems.length > 0 && validationLookupConfig && 
           (validationLookupConfig.system === 'excel' || validationLookupConfig.system === 'csv') && (
            <div className="mb-6">
              <LineItemValidation
                lineItems={lineItems}
                lookupConfig={validationLookupConfig}
                keyField="Printed_Name"
              />
            </div>
          )}
          
          <div className="space-y-4">
            {projectFields.map((field) => {
            // Skip internal calculation fields from display
            if (field.name.startsWith('_calculation') || field.name.startsWith('_invoiceTotal') || field.name.startsWith('_calculated')) {
              return null;
            }
            
            return (
            <div key={field.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={field.name} className="text-sm">
                  {field.name}
                  {field.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {field.description}
                    </span>
                  )}
                </Label>
                {fieldConfidence[field.name] !== undefined && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge 
                          variant={
                            fieldConfidence[field.name] >= 0.9 ? 'default' :
                            fieldConfidence[field.name] >= 0.7 ? 'secondary' : 'destructive'
                          }
                          className="text-xs"
                        >
                          {Math.round(fieldConfidence[field.name] * 100)}% confident
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {validationSuggestions[field.name]?.reasoning || 'AI confidence score'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    id={field.name}
                    value={editedMetadata[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    onFocus={() => setFocusedField(field.name)}
                    onBlur={() => {
                      setFocusedField(null);
                      // Auto-validate on blur if field has value
                      if (editedMetadata[field.name]) {
                        validateField(field.name, editedMetadata[field.name]);
                      }
                    }}
                    placeholder={`Enter ${field.name}`}
                    maxLength={500}
                    className={`flex-1 ${fieldErrors[field.name] ? 'border-destructive' : ''}`}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log(`Lightbulb clicked for field: ${field.name}`, editedMetadata[field.name]);
                            validateField(field.name, editedMetadata[field.name] || '');
                          }}
                          disabled={isValidating || !editedMetadata[field.name]}
                          className="hover:bg-amber-50 hover:border-amber-300"
                        >
                          <Lightbulb className={`h-4 w-4 ${editedMetadata[field.name] ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Click to validate with AI</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
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
            );
          })}

          {projectFields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No index fields defined for this project</p>
            </div>
          )}
          </div>
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
