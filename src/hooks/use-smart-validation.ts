import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  inferFieldType, 
  validateFieldValue, 
  normalizeFieldValue,
  calculateFieldConfidence,
  getConfidenceLevel
} from '@/lib/ocr-accuracy-helpers';

interface FieldConfig {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  confidence_threshold?: number;
}

interface ValidationResult {
  fieldName: string;
  isValid: boolean;
  meetsThreshold: boolean;
  confidence: number;
  normalizedValue: string;
  suggestion?: string;
  requiresReview: boolean;
  error?: string;
}

interface UseSmartValidationOptions {
  documentId?: string;
  projectFields: FieldConfig[];
  extractedMetadata: Record<string, any>;
  fieldConfidence: Record<string, number>;
  extractedText?: string;
  defaultConfidenceThreshold?: number;
}

/**
 * Smart validation hook that combines:
 * - Field type inference and validation
 * - Confidence threshold checking
 * - Auto-correction suggestions
 * - Batch validation status
 */
export function useSmartValidation(options: UseSmartValidationOptions) {
  const {
    documentId,
    projectFields,
    extractedMetadata,
    fieldConfidence,
    extractedText = '',
    defaultConfidenceThreshold = 0.75
  } = options;

  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Calculate validation results for all fields
  const validationResults = useMemo(() => {
    const results: Record<string, ValidationResult> = {};

    for (const field of projectFields) {
      const rawValue = extractedMetadata?.[field.name];
      const value = typeof rawValue === 'object' && rawValue?.value 
        ? String(rawValue.value)
        : String(rawValue || '');
      
      const rawConfidence = fieldConfidence?.[field.name] ?? 0.5;
      const threshold = field.confidence_threshold ?? defaultConfidenceThreshold;
      
      // Infer field type from name or config
      const fieldType = field.type || inferFieldType(field.name);
      
      // Validate against expected type
      const typeValidation = validateFieldValue(value, fieldType);
      
      // Calculate adjusted confidence
      const adjustedConfidence = calculateFieldConfidence(
        rawConfidence,
        value,
        field.name,
        extractedText
      );
      
      // Normalize value
      const normalizedValue = normalizeFieldValue(value, field.name);
      
      // Determine if requires review
      const meetsThreshold = adjustedConfidence >= threshold;
      const requiresReview = !meetsThreshold || 
        !typeValidation.isValid || 
        (field.required && !value);

      results[field.name] = {
        fieldName: field.name,
        isValid: typeValidation.isValid && (!field.required || !!value),
        meetsThreshold,
        confidence: adjustedConfidence,
        normalizedValue,
        suggestion: typeValidation.suggestion,
        requiresReview,
        error: field.required && !value ? 'Required field is empty' : undefined
      };
    }

    return results;
  }, [projectFields, extractedMetadata, fieldConfidence, extractedText, defaultConfidenceThreshold]);

  // Summary statistics
  const summary = useMemo(() => {
    const results = Object.values(validationResults);
    const total = results.length;
    const valid = results.filter(r => r.isValid && r.meetsThreshold).length;
    const needsReview = results.filter(r => r.requiresReview).length;
    const lowConfidence = results.filter(r => r.confidence < 0.5).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / (total || 1);

    return {
      total,
      valid,
      needsReview,
      lowConfidence,
      avgConfidence,
      canAutoValidate: needsReview === 0,
      overallStatus: needsReview === 0 ? 'ready' as const : 
                     lowConfidence > 0 ? 'critical' as const : 'review' as const
    };
  }, [validationResults]);

  // Get fields that need attention (sorted by priority)
  const fieldsNeedingReview = useMemo(() => {
    return Object.values(validationResults)
      .filter(r => r.requiresReview)
      .sort((a, b) => {
        // Sort by: errors first, then low confidence, then below threshold
        if (a.error && !b.error) return -1;
        if (!a.error && b.error) return 1;
        return a.confidence - b.confidence;
      });
  }, [validationResults]);

  // Validate a single field with server-side AI validation
  const validateFieldWithAI = useCallback(async (
    fieldName: string,
    fieldValue: string
  ) => {
    if (!documentId) return null;
    
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-validation', {
        body: {
          documentId,
          fieldName,
          fieldValue,
          context: extractedText?.substring(0, 1000) // Send context for better validation
        }
      });

      if (error) throw error;

      return data?.validation || null;
    } catch (error) {
      console.error('AI validation error:', error);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [documentId, extractedText]);

  // Apply suggestion to a field
  const applySuggestion = useCallback((fieldName: string): string | null => {
    const result = validationResults[fieldName];
    if (result?.suggestion) {
      return result.suggestion;
    }
    if (result?.normalizedValue !== extractedMetadata?.[fieldName]) {
      return result?.normalizedValue || null;
    }
    return null;
  }, [validationResults, extractedMetadata]);

  // Check if document can be auto-validated
  const canAutoValidate = summary.canAutoValidate;

  return {
    validationResults,
    summary,
    fieldsNeedingReview,
    isValidating,
    validationErrors,
    validateFieldWithAI,
    applySuggestion,
    canAutoValidate
  };
}
