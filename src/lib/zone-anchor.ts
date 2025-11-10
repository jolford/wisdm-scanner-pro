/**
 * Zone Anchor Utilities
 * Helper functions for finding anchor text and calculating relative zone positions
 */

interface WordBoundingBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor_text?: string;
  anchor_offset_x?: number;
  anchor_offset_y?: number;
}

interface CalculatedZone {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorFound: boolean;
  anchorPosition?: { x: number; y: number };
}

/**
 * Find anchor text in word bounding boxes
 * @param anchorText Text to search for
 * @param wordBoxes Array of word bounding boxes from OCR
 * @param searchRadius Maximum distance to search (pixels)
 * @returns Position of anchor text or null if not found
 */
export function findAnchorText(
  anchorText: string,
  wordBoxes: WordBoundingBox[],
  searchRadius: number = 100
): { x: number; y: number } | null {
  if (!anchorText || !wordBoxes || wordBoxes.length === 0) {
    return null;
  }

  const normalizedAnchor = anchorText.toLowerCase().trim();
  
  // Try exact match first
  for (const box of wordBoxes) {
    if (box.text.toLowerCase().trim() === normalizedAnchor) {
      return { x: box.x, y: box.y };
    }
  }
  
  // Try partial match (contains)
  for (const box of wordBoxes) {
    if (box.text.toLowerCase().includes(normalizedAnchor)) {
      return { x: box.x, y: box.y };
    }
  }
  
  // Try fuzzy match - split anchor into words and find best sequence
  const anchorWords = normalizedAnchor.split(/\s+/);
  if (anchorWords.length > 1) {
    for (let i = 0; i < wordBoxes.length - anchorWords.length + 1; i++) {
      let match = true;
      let maxDistance = 0;
      
      for (let j = 0; j < anchorWords.length; j++) {
        const boxText = wordBoxes[i + j].text.toLowerCase();
        if (!boxText.includes(anchorWords[j])) {
          match = false;
          break;
        }
        
        // Check if words are within search radius
        if (j > 0) {
          const prevBox = wordBoxes[i + j - 1];
          const currBox = wordBoxes[i + j];
          const distance = Math.sqrt(
            Math.pow(currBox.x - prevBox.x, 2) + 
            Math.pow(currBox.y - prevBox.y, 2)
          );
          maxDistance = Math.max(maxDistance, distance);
        }
      }
      
      if (match && maxDistance <= searchRadius) {
        return { x: wordBoxes[i].x, y: wordBoxes[i].y };
      }
    }
  }
  
  return null;
}

/**
 * Calculate zone position based on anchor text
 * @param zone Zone definition with optional anchor
 * @param wordBoxes Word bounding boxes from OCR
 * @returns Calculated zone position with anchor status
 */
export function calculateZonePosition(
  zone: Zone,
  wordBoxes: WordBoundingBox[]
): CalculatedZone {
  // If no anchor text, use absolute positioning
  if (!zone.anchor_text) {
    return {
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      anchorFound: false,
    };
  }

  // Find anchor position
  const anchorPos = findAnchorText(zone.anchor_text, wordBoxes);
  
  if (!anchorPos) {
    // Anchor not found, fall back to absolute positioning
    console.warn(`Anchor text "${zone.anchor_text}" not found, using absolute positioning`);
    return {
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      anchorFound: false,
    };
  }

  // Calculate relative position from anchor
  const offsetX = zone.anchor_offset_x ?? zone.x;
  const offsetY = zone.anchor_offset_y ?? zone.y;
  
  return {
    x: anchorPos.x + (offsetX - zone.x),
    y: anchorPos.y + (offsetY - zone.y),
    width: zone.width,
    height: zone.height,
    anchorFound: true,
    anchorPosition: anchorPos,
  };
}

/**
 * Calculate positions for multiple zones
 * @param zones Array of zone definitions
 * @param wordBoxes Word bounding boxes from OCR
 * @returns Array of calculated zone positions
 */
export function calculateZonePositions(
  zones: Zone[],
  wordBoxes: WordBoundingBox[]
): CalculatedZone[] {
  return zones.map(zone => calculateZonePosition(zone, wordBoxes));
}

/**
 * Extract text from calculated zone position
 * @param calculatedZone Zone with calculated position
 * @param wordBoxes Word bounding boxes from OCR
 * @returns Extracted text from zone
 */
export function extractTextFromZone(
  calculatedZone: CalculatedZone,
  wordBoxes: WordBoundingBox[]
): string {
  const { x, y, width, height } = calculatedZone;
  
  const wordsInZone = wordBoxes.filter(box => {
    // Check if word center is within zone
    const wordCenterX = box.x + box.width / 2;
    const wordCenterY = box.y + box.height / 2;
    
    return (
      wordCenterX >= x &&
      wordCenterX <= x + width &&
      wordCenterY >= y &&
      wordCenterY <= y + height
    );
  });
  
  // Sort by position (top to bottom, left to right)
  wordsInZone.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 10) return yDiff; // Different lines
    return a.x - b.x; // Same line, sort by x
  });
  
  return wordsInZone.map(box => box.text).join(' ');
}
