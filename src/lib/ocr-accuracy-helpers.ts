/**
 * OCR Accuracy Helpers
 * 
 * Utilities to improve extraction accuracy through:
 * - Field validation patterns
 * - Format normalization
 * - Confidence scoring
 * - Common OCR error correction
 */

// Common OCR character substitution errors
const OCR_ERROR_MAP: Record<string, string[]> = {
  '0': ['O', 'o', 'D', 'Q'],
  '1': ['l', 'I', 'i', '|', '!'],
  '2': ['Z', 'z'],
  '5': ['S', 's'],
  '6': ['G', 'b'],
  '8': ['B'],
  '9': ['g', 'q'],
  'O': ['0', 'Q', 'D'],
  'l': ['1', 'I', '|'],
  'I': ['1', 'l', '|'],
  'S': ['5', '$'],
  'B': ['8', '3'],
  'Z': ['2', '7'],
  'G': ['6', 'C'],
};

// Field type patterns for validation
const FIELD_PATTERNS: Record<string, RegExp> = {
  phone: /^[\\d\\s\\-\\(\\)\\+\\.]+$/,
  email: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/,
  date: /^\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4}$/,
  currency: /^\\$?[\\d,]+\\.?\\d{0,2}$/,
  ssn: /^\\d{3}[\\-\\s]?\\d{2}[\\-\\s]?\\d{4}$/,
  zip: /^\\d{5}(-\\d{4})?$/,
  number: /^[\\d,\\.]+$/,
  percentage: /^\\d{1,3}(\\.\\d+)?%?$/,
};

/**
 * Detect likely field type from field name
 */
export function inferFieldType(fieldName: string): string | null {
  const name = fieldName.toLowerCase();
  
  if (name.includes('phone') || name.includes('tel') || name.includes('fax')) return 'phone';
  if (name.includes('email') || name.includes('e-mail')) return 'email';
  if (name.includes('date') || name.includes('dob') || name.includes('birth')) return 'date';
  if (name.includes('amount') || name.includes('price') || name.includes('cost') || name.includes('total')) return 'currency';
  if (name.includes('ssn') || name.includes('social')) return 'ssn';
  if (name.includes('zip') || name.includes('postal')) return 'zip';
  if (name.includes('percent') || name.includes('%')) return 'percentage';
  if (name.includes('number') || name.includes('qty') || name.includes('quantity') || name.includes('count')) return 'number';
  
  return null;
}

/**
 * Validate field value against expected type pattern
 */
export function validateFieldValue(value: string, fieldType: string | null): {
  isValid: boolean;
  confidence: number;
  suggestion?: string;
} {
  if (!value || !fieldType) {
    return { isValid: true, confidence: 0.5 };
  }

  const pattern = FIELD_PATTERNS[fieldType];
  if (!pattern) {
    return { isValid: true, confidence: 0.7 };
  }

  const isValid = pattern.test(value.trim());
  
  if (isValid) {
    return { isValid: true, confidence: 0.95 };
  }

  // Try to correct common OCR errors
  const corrected = correctOCRErrors(value, fieldType);
  if (corrected !== value && pattern.test(corrected)) {
    return { 
      isValid: false, 
      confidence: 0.75, 
      suggestion: corrected 
    };
  }

  return { isValid: false, confidence: 0.3 };
}

/**
 * Correct common OCR character substitution errors
 */
export function correctOCRErrors(value: string, fieldType: string): string {
  let corrected = value;

  // For numeric fields, replace letter-like characters with numbers
  if (['phone', 'ssn', 'zip', 'number', 'currency'].includes(fieldType)) {
    corrected = corrected
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss$]/g, '5')
      .replace(/[Bb]/g, '8')
      .replace(/[gq]/g, '9');
  }

  // For alphabetic fields, replace number-like characters with letters
  if (fieldType === 'email') {
    // Keep as-is for email, but fix obvious issues
    corrected = corrected.replace(/\s/g, '');
  }

  return corrected;
}

/**
 * Calculate field confidence based on multiple factors
 */
export function calculateFieldConfidence(
  rawConfidence: number,
  fieldValue: string,
  fieldName: string,
  extractedText: string
): number {
  let confidence = rawConfidence;

  // Boost if value appears clearly in extracted text
  if (extractedText && fieldValue && extractedText.toLowerCase().includes(fieldValue.toLowerCase())) {
    confidence = Math.min(1, confidence + 0.1);
  }

  // Reduce for very short values (more prone to errors)
  if (fieldValue && fieldValue.length < 3) {
    confidence *= 0.9;
  }

  // Validate against expected type
  const fieldType = inferFieldType(fieldName);
  const validation = validateFieldValue(fieldValue, fieldType);
  
  if (validation.isValid) {
    confidence = Math.min(1, confidence + 0.05);
  } else if (fieldType) {
    // Penalize invalid format for typed fields
    confidence *= 0.7;
  }

  // Cap at 1.0
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Normalize field value based on inferred type
 */
export function normalizeFieldValue(value: string, fieldName: string): string {
  if (!value) return value;

  const fieldType = inferFieldType(fieldName);
  let normalized = value.trim();

  switch (fieldType) {
    case 'phone':
      // Remove non-phone characters, preserve formatting
      normalized = normalized.replace(/[^\\d\\s\\-\\(\\)\\+\\.]/g, '');
      break;
    
    case 'currency':
      // Ensure consistent currency format
      normalized = normalized.replace(/[^\\d\\.,\\$]/g, '');
      if (!normalized.startsWith('$') && /^\d/.test(normalized)) {
        normalized = '$' + normalized;
      }
      break;
    
    case 'ssn':
      // Format as XXX-XX-XXXX
      const ssnDigits = normalized.replace(/\D/g, '');
      if (ssnDigits.length === 9) {
        normalized = `${ssnDigits.slice(0,3)}-${ssnDigits.slice(3,5)}-${ssnDigits.slice(5)}`;
      }
      break;
    
    case 'zip':
      // Format as 5 or 5+4 digits
      const zipDigits = normalized.replace(/\D/g, '');
      if (zipDigits.length === 9) {
        normalized = `${zipDigits.slice(0,5)}-${zipDigits.slice(5)}`;
      } else if (zipDigits.length === 5) {
        normalized = zipDigits;
      }
      break;
    
    case 'email':
      normalized = normalized.toLowerCase().replace(/\s/g, '');
      break;
    
    case 'date':
      // Try to normalize date format
      normalized = normalizeDateValue(normalized);
      break;
  }

  return normalized;
}

/**
 * Normalize date to MM/DD/YYYY format
 */
function normalizeDateValue(value: string): string {
  // Try common date formats
  const patterns = [
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/, // M/D/YYYY
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/, // M/D/YY
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/, // YYYY/M/D
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      let month, day, year;
      
      if (match[1].length === 4) {
        // YYYY/M/D format
        year = match[1];
        month = match[2].padStart(2, '0');
        day = match[3].padStart(2, '0');
      } else {
        month = match[1].padStart(2, '0');
        day = match[2].padStart(2, '0');
        year = match[3].length === 2 ? '20' + match[3] : match[3];
      }
      
      return `${month}/${day}/${year}`;
    }
  }

  return value;
}

/**
 * Get smart suggestions for a field based on similar documents
 */
export function getSimilarityScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  
  // Levenshtein distance
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i-1] === s2[j-1]) {
        dp[i][j] = dp[i-1][j-1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
  }
  
  const maxLen = Math.max(m, n);
  return 1 - (dp[m][n] / maxLen);
}

/**
 * Extract confidence metrics for display
 */
export function getConfidenceLevel(score: number): {
  level: 'high' | 'medium' | 'low';
  color: string;
  label: string;
} {
  if (score >= 0.9) {
    return { level: 'high', color: 'text-green-600', label: 'High Confidence' };
  } else if (score >= 0.7) {
    return { level: 'medium', color: 'text-yellow-600', label: 'Medium Confidence' };
  } else {
    return { level: 'low', color: 'text-red-600', label: 'Low Confidence - Review Needed' };
  }
}
