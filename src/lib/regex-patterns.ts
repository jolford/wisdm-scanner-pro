// Common regex patterns for validation
export const REGEX_PATTERNS = {
  // Dates
  'Date (MM/DD/YYYY)': '(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/\\d{4}',
  'Date (DD/MM/YYYY)': '(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\\d{4}',
  'Date (YYYY-MM-DD)': '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])',
  
  // Numbers & Currency
  'Currency ($)': '\\$?\\s?\\d{1,3}(,\\d{3})*(\\.\\d{2})?',
  'Decimal Number': '\\d+\\.\\d+',
  'Integer': '\\d+',
  'Percentage': '\\d+(\\.\\d+)?%',
  
  // IDs & Codes
  'Social Security': '\\d{3}-\\d{2}-\\d{4}',
  'ZIP Code': '\\d{5}(-\\d{4})?',
  'Phone (US)': '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}',
  'Email': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
  
  // Address
  'Street Address': '\\d+\\s+[A-Za-z0-9\\s.,-]+',
  'State Code (US)': '[A-Z]{2}',
  
  // Business
  'Invoice Number': '(INV|inv)?[-#]?\\d{4,}',
  'PO Number': '(PO|po)?[-#]?\\d{4,}',
  'Account Number': '[A-Z0-9]{6,}',
  
  // Names
  'Full Name': '[A-Z][a-z]+\\s+[A-Z][a-z]+',
  'Company Name': '[A-Z][A-Za-z0-9\\s&.,]+',
  
  // Time
  'Time (12hr)': '(0?[1-9]|1[0-2]):[0-5][0-9]\\s?(AM|PM|am|pm)',
  'Time (24hr)': '([01]?[0-9]|2[0-3]):[0-5][0-9]',
} as const;

export type PatternName = keyof typeof REGEX_PATTERNS;

export function validatePattern(value: string, pattern: string, flags: string = 'i'): boolean {
  if (!pattern || !value) return true; // No validation if no pattern
  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(value);
  } catch (e) {
    console.error('Invalid regex pattern:', e);
    return true; // Don't fail on invalid patterns
  }
}

export function getPatternMatch(value: string, pattern: string, flags: string = 'i'): string | null {
  if (!pattern || !value) return null;
  try {
    const regex = new RegExp(pattern, flags);
    const match = value.match(regex);
    return match ? match[0] : null;
  } catch (e) {
    console.error('Invalid regex pattern:', e);
    return null;
  }
}
