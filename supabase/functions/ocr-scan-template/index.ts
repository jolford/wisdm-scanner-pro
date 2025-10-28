/**
 * Template-Based OCR Extraction Module for Casino Vouchers
 * 
 * Uses predefined extraction patterns and heuristics for Fort Hall Casino vouchers
 * instead of relying on unreliable AI vision models.
 */

export interface ExtractionZone {
  fieldName: string;
  // Extraction hints and patterns
  searchPatterns: RegExp[];
  contextKeywords?: string[]; // Words that appear near the field
  cleanupRules?: ((text: string) => string)[];
  validationPattern?: RegExp;
}

export interface Template {
  name: string;
  documentType: string;
  zones: ExtractionZone[];
  overallHints?: string[];
}

/**
 * Extract fields using pattern matching and heuristics
 */
export async function extractWithTemplate(
  fullText: string,
  template: Template
): Promise<{
  success: boolean;
  fields: Record<string, { value: string; confidence: number }>;
  overallConfidence: number;
}> {
  try {
    const fields: Record<string, { value: string; confidence: number }> = {};
    const lines = fullText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
    let totalConfidence = 0;
    let extractedCount = 0;

    for (const zone of template.zones) {
      let bestMatch = '';
      let bestConfidence = 0;

      // Try each search pattern
      for (const pattern of zone.searchPatterns) {
        // Search in full text first
        const matches = fullText.match(pattern);
        if (matches && matches[0]) {
          let candidate = matches[0];
          
          // Apply cleanup rules
          if (zone.cleanupRules) {
            for (const rule of zone.cleanupRules) {
              candidate = rule(candidate);
            }
          }

          // Check validation if specified
          if (zone.validationPattern) {
            if (zone.validationPattern.test(candidate)) {
              bestMatch = candidate;
              bestConfidence = 0.95;
              break;
            }
          } else {
            bestMatch = candidate;
            bestConfidence = 0.8;
          }
        }

        // Also try line-by-line search with context
        if (!bestMatch && zone.contextKeywords) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const hasContext = zone.contextKeywords.some(kw => 
              line.toLowerCase().includes(kw.toLowerCase())
            );

            if (hasContext) {
              const matches = line.match(pattern);
              if (matches && matches[0]) {
                let candidate = matches[0];
                
                if (zone.cleanupRules) {
                  for (const rule of zone.cleanupRules) {
                    candidate = rule(candidate);
                  }
                }

                if (!zone.validationPattern || zone.validationPattern.test(candidate)) {
                  bestMatch = candidate;
                  bestConfidence = 0.9;
                  break;
                }
              }
            }
          }
        }
      }

      fields[zone.fieldName] = {
        value: bestMatch,
        confidence: bestConfidence
      };

      if (bestMatch) {
        totalConfidence += bestConfidence;
        extractedCount++;
      }
    }

    const overallConfidence = extractedCount > 0 
      ? totalConfidence / extractedCount 
      : 0;

    return {
      success: extractedCount >= template.zones.length * 0.75, // At least 75% success
      fields,
      overallConfidence
    };
  } catch (error) {
    console.error('Template extraction error:', error);
    return {
      success: false,
      fields: {},
      overallConfidence: 0
    };
  }
}

/**
 * Fort Hall Casino Voucher Template
 * Based on standard Fort Hall Casino cashout ticket layout
 */
export const FORT_HALL_CASINO_TEMPLATE: Template = {
  name: 'Fort Hall Casino Cashout Ticket',
  documentType: 'casino_voucher',
  zones: [
    {
      fieldName: 'Validation Date',
      searchPatterns: [
        /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}/,  // With time
        /\d{1,2}\/\d{1,2}\/\d{4}/  // Date only
      ],
      contextKeywords: ['VALIDATION', 'TICKET'],
      validationPattern: /\d{1,2}\/\d{1,2}\/\d{4}/,
      cleanupRules: [
        (text) => {
          // Extract just the date part if time is included
          const match = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
          return match ? match[0] : text;
        }
      ]
    },
    {
      fieldName: 'Amount',
      searchPatterns: [
        /\$[\d,]+\.\d{2}/g  // Dollar amounts
      ],
      contextKeywords: [],
      validationPattern: /^\$[\d,]+\.\d{2}$/,
      cleanupRules: [
        (text) => {
          // Find the LARGEST dollar amount (main amount, not fees)
          const amounts = text.match(/\$[\d,]+\.\d{2}/g) || [];
          if (amounts.length === 0) return text;
          
          // Parse and find max
          let maxAmount = 0;
          let maxAmountStr = '';
          
          for (const amt of amounts) {
            const num = parseFloat(amt.replace(/[$,]/g, ''));
            if (num > maxAmount) {
              maxAmount = num;
              maxAmountStr = amt;
            }
          }
          
          return maxAmountStr;
        }
      ]
    },
    {
      fieldName: 'Ticket Number',
      searchPatterns: [
        /\d{2}-\d{4}-\d{4}-\d{4}-\d{4}/,  // 00-####-####-####-####
        /VALIDATION\s+([\d-]+)/i  // After VALIDATION keyword
      ],
      contextKeywords: ['VALIDATION'],
      validationPattern: /^\d{2}-\d{4}-\d{4}-\d{4}-\d{4}$/,
      cleanupRules: [
        (text) => {
          // Extract just the number pattern
          const match = text.match(/\d{2}-\d{4}-\d{4}-\d{4}-\d{4}/);
          return match ? match[0] : text;
        }
      ]
    },
    {
      fieldName: 'Machine Number',
      searchPatterns: [
        /MACHINE\s+#?(\d{4,5})/i,  // MACHINE #2793
        /ASSET\s+#?(\d{4,5})/i     // ASSET #2793
      ],
      contextKeywords: ['MACHINE', 'ASSET'],
      validationPattern: /^\d{4,5}$/,
      cleanupRules: [
        (text) => {
          // Extract just the numbers
          const match = text.match(/\d{4,5}/);
          return match ? match[0] : text;
        }
      ]
    }
  ]
};
