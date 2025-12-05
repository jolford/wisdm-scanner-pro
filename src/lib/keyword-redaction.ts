/**
 * Keyword-based redaction for compliance with laws like California AB 1466
 * Automatically detects sensitive terms and generates redaction boxes
 */

export interface RedactionKeyword {
  term: string;
  category: string;
  caseSensitive?: boolean;
  label?: string; // Human-readable label for UI display
}

export interface DetectedKeyword {
  term: string;
  category: string;
  label?: string;
  matches: Array<{
    text: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

/**
 * PII category definitions for UI
 */
export const PII_CATEGORIES = {
  ssn: { label: 'Social Security Number', icon: 'id-card', severity: 'critical' },
  credit_card: { label: 'Credit Card', icon: 'credit-card', severity: 'critical' },
  bank_account: { label: 'Bank Account', icon: 'landmark', severity: 'critical' },
  routing_number: { label: 'Routing Number', icon: 'route', severity: 'high' },
  email: { label: 'Email Address', icon: 'mail', severity: 'medium' },
  phone: { label: 'Phone Number', icon: 'phone', severity: 'medium' },
  dob: { label: 'Date of Birth', icon: 'calendar', severity: 'high' },
  drivers_license: { label: 'Driver\'s License', icon: 'car', severity: 'critical' },
  passport: { label: 'Passport Number', icon: 'book-open', severity: 'critical' },
  itin: { label: 'ITIN', icon: 'hash', severity: 'critical' },
  ein: { label: 'EIN', icon: 'building', severity: 'high' },
  medical_record: { label: 'Medical Record #', icon: 'heart-pulse', severity: 'critical' },
  health_insurance: { label: 'Health Insurance ID', icon: 'shield', severity: 'critical' },
  medicare: { label: 'Medicare/Medicaid ID', icon: 'hospital', severity: 'critical' },
  ip_address: { label: 'IP Address', icon: 'globe', severity: 'medium' },
  vin: { label: 'Vehicle ID (VIN)', icon: 'car', severity: 'high' },
  address: { label: 'Physical Address', icon: 'map-pin', severity: 'medium' },
  name: { label: 'Person Name', icon: 'user', severity: 'medium' },
} as const;

/**
 * PII detection patterns for automatic redaction
 * Expanded library covering HIPAA, GDPR, CCPA, and other compliance needs
 */
export const PII_KEYWORDS: RedactionKeyword[] = [
  // ============ CRITICAL SEVERITY ============
  
  // Social Security Numbers (SSN) - flexible pattern for various formats
  { term: '\\b\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{4}\\b', category: 'ssn', label: 'SSN' },
  { term: '\\bSSN[:\\s]*\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{4}\\b', category: 'ssn', label: 'SSN (labeled)' },
  
  // Individual Taxpayer Identification Number (ITIN) - starts with 9
  { term: '\\b9\\d{2}[\\s.-]?\\d{2}[\\s.-]?\\d{4}\\b', category: 'itin', label: 'ITIN' },
  
  // Credit Card Numbers (Visa, MC, Amex, Discover)
  { term: '\\b4\\d{3}[\\s.-]?\\d{4}[\\s.-]?\\d{4}[\\s.-]?\\d{4}\\b', category: 'credit_card', label: 'Visa' },
  { term: '\\b5[1-5]\\d{2}[\\s.-]?\\d{4}[\\s.-]?\\d{4}[\\s.-]?\\d{4}\\b', category: 'credit_card', label: 'MasterCard' },
  { term: '\\b3[47]\\d{2}[\\s.-]?\\d{6}[\\s.-]?\\d{5}\\b', category: 'credit_card', label: 'Amex' },
  { term: '\\b6(?:011|5\\d{2})[\\s.-]?\\d{4}[\\s.-]?\\d{4}[\\s.-]?\\d{4}\\b', category: 'credit_card', label: 'Discover' },
  { term: '\\b\\d{4}[\\s.-]?\\d{4}[\\s.-]?\\d{4}[\\s.-]?\\d{4}\\b', category: 'credit_card', label: 'Card Number' },
  
  // Bank Account Numbers (8-17 digits)
  { term: '\\b(?:account|acct)[#:\\s]*\\d{8,17}\\b', category: 'bank_account', label: 'Account Number' },
  { term: '\\b\\d{8,17}\\b', category: 'bank_account', label: 'Potential Account' },
  
  // ABA Routing Numbers (9 digits, specific checksum)
  { term: '\\b[0-3]\\d{8}\\b', category: 'routing_number', label: 'Routing Number' },
  { term: '\\b(?:routing|aba)[#:\\s]*\\d{9}\\b', category: 'routing_number', label: 'ABA Routing' },
  
  // Driver's License patterns (state-specific)
  { term: '\\b[A-Z]{1,2}\\d{6,8}\\b', category: 'drivers_license', label: 'License #' },
  { term: '\\b(?:DL|DLN|license)[#:\\s]*[A-Z0-9]{6,12}\\b', category: 'drivers_license', label: 'Driver License' },
  
  // Passport numbers (US format)
  { term: '\\b[A-Z]{1,2}\\d{6,9}\\b', category: 'passport', label: 'Passport #' },
  { term: '\\b(?:passport)[#:\\s]*[A-Z0-9]{6,9}\\b', category: 'passport', label: 'Passport Number' },
  
  // ============ HEALTHCARE / HIPAA ============
  
  // Medical Record Numbers (MRN)
  { term: '\\b(?:MRN|medical record)[#:\\s]*[A-Z0-9]{6,15}\\b', category: 'medical_record', label: 'MRN' },
  { term: '\\b(?:patient id|patient#)[:\\s]*[A-Z0-9]{6,12}\\b', category: 'medical_record', label: 'Patient ID' },
  
  // Health Insurance Policy Numbers
  { term: '\\b(?:policy|member|subscriber)[#:\\s]*[A-Z0-9]{8,15}\\b', category: 'health_insurance', label: 'Insurance ID' },
  { term: '\\b(?:group)[#:\\s]*[A-Z0-9]{6,12}\\b', category: 'health_insurance', label: 'Group #' },
  
  // Medicare/Medicaid IDs (Medicare Beneficiary Identifier - 11 chars)
  { term: '\\b[1-9][A-Z][A-Z0-9][0-9][A-Z][A-Z0-9][0-9]{4}[A-Z]{2}\\b', category: 'medicare', label: 'Medicare ID' },
  { term: '\\b(?:medicare|medicaid)[#:\\s]*[A-Z0-9]{9,12}\\b', category: 'medicare', label: 'Medicare/Medicaid' },
  
  // ============ HIGH SEVERITY ============
  
  // Employer Identification Number (EIN) - XX-XXXXXXX
  { term: '\\b\\d{2}[\\s.-]?\\d{7}\\b', category: 'ein', label: 'EIN' },
  { term: '\\b(?:EIN|TIN|Tax ID)[:\\s]*\\d{2}[\\s.-]?\\d{7}\\b', category: 'ein', label: 'Tax ID' },
  
  // Date of Birth patterns
  { term: '\\b(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])/(19|20)\\d{2}\\b', category: 'dob', label: 'DOB (MM/DD/YYYY)' },
  { term: '\\b(19|20)\\d{2}-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])\\b', category: 'dob', label: 'DOB (YYYY-MM-DD)' },
  { term: '\\b(?:DOB|birth date|date of birth)[:\\s]*.{6,12}\\b', category: 'dob', label: 'DOB (labeled)' },
  
  // Vehicle Identification Number (VIN) - 17 characters
  { term: '\\b[A-HJ-NPR-Z0-9]{17}\\b', category: 'vin', label: 'VIN' },
  { term: '\\b(?:VIN|vehicle)[#:\\s]*[A-HJ-NPR-Z0-9]{17}\\b', category: 'vin', label: 'Vehicle ID' },
  
  // ============ MEDIUM SEVERITY ============
  
  // Email addresses
  { term: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', category: 'email', label: 'Email' },
  
  // Phone numbers (various formats)
  { term: '\\b\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b', category: 'phone', label: 'Phone' },
  { term: '\\b\\+1[\\s.-]?\\d{3}[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b', category: 'phone', label: 'Phone (+1)' },
  { term: '\\b\\d{10}\\b', category: 'phone', label: '10-digit Phone' },
  
  // IP Addresses (IPv4)
  { term: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b', category: 'ip_address', label: 'IP Address' },
  
  // Physical Address Patterns (US)
  { term: '\\b\\d{1,5}\\s+[A-Za-z]+\\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\\b', category: 'address', label: 'Street Address' },
  { term: '\\b(?:PO|P\\.O\\.)\\s*Box\\s*\\d+\\b', category: 'address', label: 'PO Box' },
  { term: '\\b[A-Z]{2}\\s*\\d{5}(?:-\\d{4})?\\b', category: 'address', label: 'State + ZIP' },
];

/**
 * Default keywords based on AB 1466 protected characteristics
 * These are unlawfully restrictive covenant terms that should be redacted
 */
export const DEFAULT_REDACTION_KEYWORDS: RedactionKeyword[] = [
  // Race-based restrictions
  { term: 'caucasian', category: 'race', label: 'Race' },
  { term: 'white persons', category: 'race', label: 'Race' },
  { term: 'white people', category: 'race', label: 'Race' },
  { term: 'negro', category: 'race', label: 'Race' },
  { term: 'colored', category: 'race', label: 'Race' },
  { term: 'african', category: 'race', label: 'Race' },
  { term: 'asian', category: 'race', label: 'Race' },
  { term: 'chinese', category: 'race', label: 'Race' },
  { term: 'japanese', category: 'race', label: 'Race' },
  { term: 'mexican', category: 'race', label: 'Race' },
  { term: 'hispanic', category: 'race', label: 'Race' },
  { term: 'semitic', category: 'race', label: 'Race' },
  { term: 'aryan', category: 'race', label: 'Race' },
  
  // Religious restrictions
  { term: 'jewish', category: 'religion', label: 'Religion' },
  { term: 'hebrew', category: 'religion', label: 'Religion' },
  { term: 'catholic', category: 'religion', label: 'Religion' },
  { term: 'muslim', category: 'religion', label: 'Religion' },
  
  // National origin
  { term: 'foreign born', category: 'national_origin', label: 'National Origin' },
  { term: 'alien', category: 'national_origin', label: 'National Origin' },
  
  // Common restrictive covenant phrases
  { term: 'shall not be sold to', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'shall not be occupied by', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'shall not be leased to', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'shall not be rented to', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'prohibited from', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'restricted to', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'no person of', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
  { term: 'excepting persons of', category: 'restrictive_covenant', label: 'Restrictive Covenant' },
];

/**
 * Preset pattern groups for batch redaction
 */
export const PATTERN_PRESETS = {
  'pii-full': {
    label: 'All PII (Comprehensive)',
    description: 'SSN, credit cards, bank accounts, phone, email, DOB, licenses',
    categories: ['ssn', 'credit_card', 'bank_account', 'routing_number', 'email', 'phone', 'dob', 'drivers_license', 'passport', 'itin', 'ein', 'ip_address', 'vin', 'address']
  },
  'pii-financial': {
    label: 'Financial PII',
    description: 'SSN, credit cards, bank accounts, routing numbers, EIN',
    categories: ['ssn', 'credit_card', 'bank_account', 'routing_number', 'ein', 'itin']
  },
  'pii-healthcare': {
    label: 'Healthcare / HIPAA',
    description: 'Medical records, insurance IDs, Medicare/Medicaid, DOB',
    categories: ['medical_record', 'health_insurance', 'medicare', 'dob', 'ssn']
  },
  'pii-contact': {
    label: 'Contact Information',
    description: 'Email, phone, address, IP address',
    categories: ['email', 'phone', 'address', 'ip_address']
  },
  'pii-identity': {
    label: 'Identity Documents',
    description: 'SSN, driver\'s license, passport, ITIN',
    categories: ['ssn', 'drivers_license', 'passport', 'itin']
  },
  'ab1466': {
    label: 'CA AB 1466 (Restrictive Covenants)',
    description: 'Race, religion, national origin discriminatory terms',
    categories: ['race', 'religion', 'national_origin', 'restrictive_covenant']
  }
} as const;

/**
 * Get keywords by category filter
 */
export const getKeywordsByCategories = (categories: string[]): RedactionKeyword[] => {
  const piiFiltered = PII_KEYWORDS.filter(k => categories.includes(k.category));
  const ab1466Filtered = DEFAULT_REDACTION_KEYWORDS.filter(k => categories.includes(k.category));
  return [...piiFiltered, ...ab1466Filtered];
};

/**
 * Get keywords by preset name
 */
export const getKeywordsByPreset = (presetKey: keyof typeof PATTERN_PRESETS): RedactionKeyword[] => {
  const preset = PATTERN_PRESETS[presetKey];
  return getKeywordsByCategories([...preset.categories]);
};

/**
 * Detect keywords in OCR text and word-level bounding boxes
 * @param ocrText - Full text extracted from document
 * @param ocrMetadata - Metadata with field and word bounding boxes
 * @param customKeywords - Additional keywords to search for
 * @returns Array of detected keywords with their locations
 */
export const detectKeywords = (
  ocrText: string,
  ocrMetadata: any,
  customKeywords: RedactionKeyword[] = [],
  includePII: boolean = false,
  piiCategories?: string[] // Optional filter for specific PII categories
): DetectedKeyword[] => {
  let piiKeywords = includePII ? PII_KEYWORDS : [];
  
  // Filter PII keywords by category if specified
  if (includePII && piiCategories && piiCategories.length > 0) {
    piiKeywords = PII_KEYWORDS.filter(k => piiCategories.includes(k.category));
  }
  
  const keywords = [
    ...DEFAULT_REDACTION_KEYWORDS, 
    ...piiKeywords,
    ...customKeywords
  ];
  const detected: DetectedKeyword[] = [];
  
  if (!ocrText || ocrText.length === 0) {
    return detected;
  }
  
  const searchText = ocrText.toLowerCase();

  // Prepare word tokens for phrase-level matching (from OCR word boxes)
  const wordTokens: Array<{ raw: string; norm: string; bbox: { x: number; y: number; width: number; height: number } | null }>
    = Array.isArray(ocrMetadata?.wordBoundingBoxes)
      ? ocrMetadata.wordBoundingBoxes.map((w: any) => ({
          raw: String(w?.text ?? ''),
          norm: normalizeText(String(w?.text ?? '')),
          bbox: w?.bbox ?? null,
        }))
      : [];

  for (const keyword of keywords) {
    const searchTerm = keyword.caseSensitive ? keyword.term : keyword.term.toLowerCase();
    const searchNorm = normalizeText(searchTerm);
    const parts = searchNorm.split(' ').filter(Boolean);

    const matches: Array<{ text: string; boundingBox?: any }> = [];

    // Check if this is a regex pattern (PII detection)
    const isRegexPattern = searchTerm.includes('\\b') || searchTerm.includes('\\d') || searchTerm.includes('[');
    
    if (isRegexPattern) {
      // 1) Fast textual scan to count occurrences (text-only matches for UX even if geometry missing)
      try {
        const regex = new RegExp(searchTerm, keyword.caseSensitive ? 'g' : 'gi');
        let textMatch;
        while ((textMatch = regex.exec(ocrText)) !== null) {
          matches.push({ text: textMatch[0] });
        }
      } catch (e) {
        console.warn(`Invalid regex pattern: ${searchTerm}`, e);
      }

      // 2) Try to locate geometry at token level for regex patterns
      if (wordTokens.length > 0) {
        try {
          // Build a non-global regex to avoid lastIndex state between tests
          const tokenRegex = new RegExp(searchTerm, keyword.caseSensitive ? '' : 'i');

          // 1) Single-token matches
          for (const wt of wordTokens) {
            if (!wt?.raw) continue;
            if (tokenRegex.test(String(wt.raw)) && wt.bbox) {
              matches.push({ text: String(wt.raw), boundingBox: wt.bbox });
            }
          }

          // 2) Multi-token sliding window (covers patterns split across tokens e.g. SSN "123-45-6789")
          const maxWindow = 6; // reasonable cap for performance
          for (let i = 0; i < wordTokens.length; i++) {
            let concatText = '';
            let concatTextNormalized = ''; // Remove all non-alphanumeric except spaces
            const rects: Array<{ x: number; y: number; width: number; height: number } | null> = [];

            for (let w = 0; w < maxWindow && i + w < wordTokens.length; w++) {
              const t = wordTokens[i + w];
              if (!t) break;
              // Preserve original text
              concatText = concatText ? concatText + ' ' + (t.raw ?? '') : String(t.raw ?? '');
              // Create normalized version for matching (remove special chars except digits/letters)
              const normalized = String(t.raw ?? '').replace(/[^\d\w]/g, '');
              concatTextNormalized = concatTextNormalized ? concatTextNormalized + normalized : normalized;
              rects.push(t.bbox ?? null);

              // Test both original and normalized versions
              const testStrings = [concatText, concatTextNormalized, concatText.replace(/\s+/g, '')];
              
              for (const testStr of testStrings) {
                if (tokenRegex.test(testStr)) {
                  const valid = rects.filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;
                  if (valid.length) {
                    const x1 = Math.min(...valid.map(r => r.x));
                    const y1 = Math.min(...valid.map(r => r.y));
                    const x2 = Math.max(...valid.map(r => r.x + r.width));
                    const y2 = Math.max(...valid.map(r => r.y + r.height));
                    
                    // Check if we already have this match (avoid duplicates)
                    const isDuplicate = matches.some(m => 
                      m.boundingBox && 
                      Math.abs(m.boundingBox.x - x1) < 1 && 
                      Math.abs(m.boundingBox.y - y1) < 1
                    );
                    
                    if (!isDuplicate) {
                      matches.push({
                        text: concatText,
                        boundingBox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
                      });
                    }
                    break; // Stop testing other formats once we found a match
                  }
                }
              }
            }
          }
        } catch (e) {
          // ignore token regex issues
        }
      }
    } else {
      // 1) Fast textual scan to count occurrences (for UX info)
      const regex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'gi');
      let textMatch;
      while ((textMatch = regex.exec(keyword.caseSensitive ? ocrText : searchText)) !== null) {
        matches.push({ text: ocrText.substring(textMatch.index, textMatch.index + textMatch[0].length) });
      }
    }

    // 2) Try to locate geometry from words (handles single and multi-word phrases)
    if (wordTokens.length > 0) {
      if (parts.length === 1) {
        // Single word: require equality on normalized token
        for (const wt of wordTokens) {
          if (wt.norm === parts[0] && wt.bbox) {
            matches.push({ text: wt.raw, boundingBox: wt.bbox });
          }
        }
      } else {
        // Phrase: sliding window
        for (let i = 0; i <= wordTokens.length - parts.length; i++) {
          const window = wordTokens.slice(i, i + parts.length);
          const joined = window.map(w => w.norm).join(' ');
          if (joined === searchNorm) {
            const rects = window.map(w => w.bbox).filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;
            if (rects.length) {
              const x1 = Math.min(...rects.map(r => r.x));
              const y1 = Math.min(...rects.map(r => r.y));
              const x2 = Math.max(...rects.map(r => r.x + r.width));
              const y2 = Math.max(...rects.map(r => r.y + r.height));
              matches.push({ text: window.map(w => w.raw).join(' '), boundingBox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } });
            }
          }
        }
      }
    }

    // 3) Fallback to field-level boxes when available
    if (ocrMetadata?.boundingBoxes) {
      for (const [fieldName, bbox] of Object.entries(ocrMetadata.boundingBoxes)) {
        const fieldValue = (ocrMetadata.fields as any)?.[fieldName];
        if (typeof fieldValue === 'string' && normalizeText(fieldValue).includes(searchNorm)) {
          matches.push({ text: String(fieldValue), boundingBox: bbox });
        }
      }
    }

    if (matches.length > 0) {
      detected.push({ 
        term: keyword.term, 
        category: keyword.category, 
        label: keyword.label,
        matches 
      });
    }
  }
  
  return detected;
};

// Normalize text for matching: lowercase, remove punctuation, collapse spaces
const normalizeText = (str: string) => str
  .toLowerCase()
  .replace(/[^a-z0-9]+/gi, ' ')
  .trim()
  .replace(/\s+/g, ' ');


/**
 * Generate redaction boxes from detected keywords
 * @param detectedKeywords - Keywords detected with bounding boxes
 * @param padding - Extra padding around the text (in percentage or pixels)
 * @param imageWidth - Width of the image (to convert percentage to pixels)
 * @param imageHeight - Height of the image (to convert percentage to pixels)
 * @returns Array of redaction boxes in pixel coordinates
 */
export const generateRedactionBoxes = (
  detectedKeywords: DetectedKeyword[],
  padding: number = 2,
  imageWidth?: number,
  imageHeight?: number
): Array<{ x: number; y: number; width: number; height: number }> => {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  
  for (const detected of detectedKeywords) {
    for (const match of detected.matches) {
      if (match.boundingBox) {
        let { x, y, width, height } = match.boundingBox;
        
        // Convert percentage-based coordinates to pixels if dimensions provided
        if (imageWidth && imageHeight) {
          // Assume bbox values are percentages (0-100)
          x = (x / 100) * imageWidth;
          y = (y / 100) * imageHeight;
          width = (width / 100) * imageWidth;
          height = (height / 100) * imageHeight;
          
          // Convert padding from percentage to pixels
          const paddingX = (padding / 100) * imageWidth;
          const paddingY = (padding / 100) * imageHeight;
          
          boxes.push({
            x: Math.max(0, x - paddingX),
            y: Math.max(0, y - paddingY),
            width: width + paddingX * 2,
            height: height + paddingY * 2
          });
        } else {
          // Use as-is (assume already in correct coordinate system)
          boxes.push({
            x: Math.max(0, x - padding),
            y: Math.max(0, y - padding),
            width: width + padding * 2,
            height: height + padding * 2
          });
        }
      }
    }
  }
  
  return boxes;
};

/**
 * Escape special regex characters
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Merge overlapping or nearby redaction boxes
 * @param boxes - Array of redaction boxes
 * @param threshold - Distance threshold for merging (in pixels)
 * @returns Merged array of redaction boxes
 */
export const mergeRedactionBoxes = (
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
  threshold: number = 20
): Array<{ x: number; y: number; width: number; height: number }> => {
  if (boxes.length <= 1) return boxes;
  
  const merged: Array<{ x: number; y: number; width: number; height: number }> = [];
  const used = new Set<number>();
  
  for (let i = 0; i < boxes.length; i++) {
    if (used.has(i)) continue;
    
    let current = { ...boxes[i] };
    let didMerge = true;
    
    while (didMerge) {
      didMerge = false;
      
      for (let j = 0; j < boxes.length; j++) {
        if (i === j || used.has(j)) continue;
        
        const other = boxes[j];
        
        // Check if boxes overlap or are nearby
        const horizontalOverlap = 
          current.x <= other.x + other.width + threshold &&
          current.x + current.width + threshold >= other.x;
          
        const verticalOverlap =
          current.y <= other.y + other.height + threshold &&
          current.y + current.height + threshold >= other.y;
        
        if (horizontalOverlap && verticalOverlap) {
          // Merge the boxes
          const minX = Math.min(current.x, other.x);
          const minY = Math.min(current.y, other.y);
          const maxX = Math.max(current.x + current.width, other.x + other.width);
          const maxY = Math.max(current.y + current.height, other.y + other.height);
          
          current = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
          
          used.add(j);
          didMerge = true;
        }
      }
    }
    
    merged.push(current);
    used.add(i);
  }
  
  return merged;
};

/**
 * Summarize detected keywords by category for UI display
 */
export const summarizeDetections = (detected: DetectedKeyword[]): Record<string, { count: number; label: string }> => {
  const summary: Record<string, { count: number; label: string }> = {};
  
  for (const d of detected) {
    if (!summary[d.category]) {
      const catInfo = PII_CATEGORIES[d.category as keyof typeof PII_CATEGORIES];
      summary[d.category] = { 
        count: 0, 
        label: catInfo?.label || d.label || d.category 
      };
    }
    summary[d.category].count += d.matches.length;
  }
  
  return summary;
};
