/**
 * Keyword-based redaction for compliance with laws like California AB 1466
 * Automatically detects sensitive terms and generates redaction boxes
 */

export interface RedactionKeyword {
  term: string;
  category: string;
  caseSensitive?: boolean;
}

export interface DetectedKeyword {
  term: string;
  category: string;
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
 * PII detection patterns for automatic redaction
 * Detects personally identifiable information that should be redacted
 */
export const PII_KEYWORDS: RedactionKeyword[] = [
  // Social Security Numbers (SSN)
  { term: '\\b\\d{3}-\\d{2}-\\d{4}\\b', category: 'ssn', caseSensitive: false },
  { term: '\\b\\d{9}\\b', category: 'ssn', caseSensitive: false },
  
  // Credit Card Numbers (basic pattern)
  { term: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b', category: 'credit_card', caseSensitive: false },
  
  // Email addresses
  { term: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', category: 'email', caseSensitive: false },
  
  // Phone numbers (various formats)
  { term: '\\b\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b', category: 'phone', caseSensitive: false },
  
  // Driver's License patterns (state-specific can be added)
  { term: '\\b[A-Z]{1,2}\\d{6,8}\\b', category: 'drivers_license', caseSensitive: false },
  
  // Passport numbers
  { term: '\\b[A-Z]{1,2}\\d{6,9}\\b', category: 'passport', caseSensitive: false },
  
  // Date of Birth patterns
  { term: '\\b(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])/(19|20)\\d{2}\\b', category: 'dob', caseSensitive: false },
  { term: '\\b(19|20)\\d{2}-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])\\b', category: 'dob', caseSensitive: false },
];

/**
 * Default keywords based on AB 1466 protected characteristics
 * These are unlawfully restrictive covenant terms that should be redacted
 */
export const DEFAULT_REDACTION_KEYWORDS: RedactionKeyword[] = [
  // Race-based restrictions
  { term: 'caucasian', category: 'race' },
  { term: 'white persons', category: 'race' },
  { term: 'white people', category: 'race' },
  { term: 'negro', category: 'race' },
  { term: 'colored', category: 'race' },
  { term: 'african', category: 'race' },
  { term: 'asian', category: 'race' },
  { term: 'chinese', category: 'race' },
  { term: 'japanese', category: 'race' },
  { term: 'mexican', category: 'race' },
  { term: 'hispanic', category: 'race' },
  { term: 'semitic', category: 'race' },
  { term: 'aryan', category: 'race' },
  
  // Religious restrictions
  { term: 'jewish', category: 'religion' },
  { term: 'hebrew', category: 'religion' },
  { term: 'catholic', category: 'religion' },
  { term: 'muslim', category: 'religion' },
  
  // National origin
  { term: 'foreign born', category: 'national_origin' },
  { term: 'alien', category: 'national_origin' },
  
  // Common restrictive covenant phrases
  { term: 'shall not be sold to', category: 'restrictive_covenant' },
  { term: 'shall not be occupied by', category: 'restrictive_covenant' },
  { term: 'shall not be leased to', category: 'restrictive_covenant' },
  { term: 'shall not be rented to', category: 'restrictive_covenant' },
  { term: 'prohibited from', category: 'restrictive_covenant' },
  { term: 'restricted to', category: 'restrictive_covenant' },
  { term: 'no person of', category: 'restrictive_covenant' },
  { term: 'excepting persons of', category: 'restrictive_covenant' },
];

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
  includePII: boolean = false
): DetectedKeyword[] => {
  const keywords = [
    ...DEFAULT_REDACTION_KEYWORDS, 
    ...(includePII ? PII_KEYWORDS : []),
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
      // Use regex directly for PII patterns
      try {
        const regex = new RegExp(searchTerm, keyword.caseSensitive ? 'g' : 'gi');
        let textMatch;
        while ((textMatch = regex.exec(ocrText)) !== null) {
          matches.push({ text: textMatch[0] });
        }
      } catch (e) {
        console.warn(`Invalid regex pattern: ${searchTerm}`, e);
      }

      // Also try to locate geometry at token level for regex patterns
      if (wordTokens.length > 0) {
        try {
          const tokenRegex = new RegExp(searchTerm, keyword.caseSensitive ? 'g' : 'gi');

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
            const rects: Array<{ x: number; y: number; width: number; height: number } | null> = [];

            for (let w = 0; w < maxWindow && i + w < wordTokens.length; w++) {
              const t = wordTokens[i + w];
              if (!t) break;
              // Preserve spacing to allow regex with optional whitespace separators
              concatText = concatText ? concatText + ' ' + (t.raw ?? '') : String(t.raw ?? '');
              rects.push(t.bbox ?? null);

              if (tokenRegex.test(concatText)) {
                const valid = rects.filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;
                if (valid.length) {
                  const x1 = Math.min(...valid.map(r => r.x));
                  const y1 = Math.min(...valid.map(r => r.y));
                  const x2 = Math.max(...valid.map(r => r.x + r.width));
                  const y2 = Math.max(...valid.map(r => r.y + r.height));
                  matches.push({
                    text: concatText,
                    boundingBox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
                  });
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
      detected.push({ term: keyword.term, category: keyword.category, matches });
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
