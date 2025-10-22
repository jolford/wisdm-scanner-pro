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
 * Detect keywords in OCR text and metadata
 * @param ocrText - Full text extracted from document
 * @param ocrMetadata - Metadata with field bounding boxes
 * @param customKeywords - Additional keywords to search for
 * @returns Array of detected keywords with their locations
 */
export const detectKeywords = (
  ocrText: string,
  ocrMetadata: any,
  customKeywords: RedactionKeyword[] = []
): DetectedKeyword[] => {
  const keywords = [...DEFAULT_REDACTION_KEYWORDS, ...customKeywords];
  const detected: DetectedKeyword[] = [];
  
  if (!ocrText || ocrText.length === 0) {
    return detected;
  }
  
  const searchText = ocrText.toLowerCase();
  
  for (const keyword of keywords) {
    const searchTerm = keyword.caseSensitive ? keyword.term : keyword.term.toLowerCase();
    const regex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'gi');
    
    const matches: Array<{ text: string; boundingBox?: any }> = [];
    let match;
    
    // Find all matches in the text
    while ((match = regex.exec(keyword.caseSensitive ? ocrText : searchText)) !== null) {
      const matchedText = ocrText.substring(match.index, match.index + match[0].length);
      
      // Try to find bounding box from OCR metadata
      let boundingBox;
      
      // Check if we have boundingBoxes at the top level
      if (ocrMetadata?.boundingBoxes) {
        // Look through field bounding boxes to see if any field contains this keyword
        for (const [fieldName, bbox] of Object.entries(ocrMetadata.boundingBoxes)) {
          const fieldValue = ocrMetadata.fields?.[fieldName];
          if (fieldValue && 
              typeof fieldValue === 'string' && 
              fieldValue.toLowerCase().includes(searchTerm)) {
            boundingBox = bbox;
            break;
          }
        }
      }
      
      matches.push({
        text: matchedText,
        boundingBox
      });
    }
    
    if (matches.length > 0) {
      detected.push({
        term: keyword.term,
        category: keyword.category,
        matches
      });
    }
  }
  
  return detected;
};

/**
 * Generate redaction boxes from detected keywords
 * @param detectedKeywords - Keywords detected with bounding boxes
 * @param padding - Extra padding around the text (in pixels)
 * @returns Array of redaction boxes
 */
export const generateRedactionBoxes = (
  detectedKeywords: DetectedKeyword[],
  padding: number = 10
): Array<{ x: number; y: number; width: number; height: number }> => {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  
  for (const detected of detectedKeywords) {
    for (const match of detected.matches) {
      if (match.boundingBox) {
        const { x, y, width, height } = match.boundingBox;
        boxes.push({
          x: Math.max(0, x - padding),
          y: Math.max(0, y - padding),
          width: width + padding * 2,
          height: height + padding * 2
        });
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
