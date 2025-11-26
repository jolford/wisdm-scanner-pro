/**
 * Field Formatters
 * Utilities for formatting extracted field values into proper display formats
 */

/**
 * Format a phone number into standard US format
 * Supports various input formats and returns (XXX) XXX-XXXX
 */
export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return '';
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format based on digit count
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    // Handle +1 country code
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if not a valid phone number
  return value;
}

/**
 * Format a Social Security Number into XXX-XX-XXXX format
 */
export function formatSSN(value: string | null | undefined): string {
  if (!value) return '';
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format if exactly 9 digits
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  
  // Return original if not valid SSN
  return value;
}

/**
 * Format a date into MM/DD/YYYY format
 * Handles various input formats
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  
  // Try to parse the date
  const date = new Date(value);
  
  // Check if valid date
  if (!isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  
  // Return original if not a valid date
  return value;
}

/**
 * Format currency values with proper $ and comma separators
 */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  
  // Convert to number
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  
  // Check if valid number
  if (isNaN(numValue)) return String(value);
  
  // Format with $ and commas
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numValue);
}

/**
 * Format ZIP code into XXXXX or XXXXX-XXXX format
 */
export function formatZipCode(value: string | null | undefined): string {
  if (!value) return '';
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length === 5) {
    return digits;
  } else if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  
  // Return original if not valid ZIP
  return value;
}

/**
 * Auto-detect field type and apply appropriate formatting
 */
export function autoFormatField(fieldName: string, value: string | null | undefined): string {
  if (!value) return '';
  
  const name = fieldName.toLowerCase();
  
  // Phone number patterns
  if (name.includes('phone') || name.includes('mobile') || name.includes('cell') || name.includes('fax')) {
    return formatPhoneNumber(value);
  }
  
  // SSN patterns
  if (name.includes('ssn') || name.includes('social security')) {
    return formatSSN(value);
  }
  
  // Date patterns
  if (name.includes('date') || name.includes('dob') || name === 'birth') {
    return formatDate(value);
  }
  
  // Currency patterns
  if (name.includes('amount') || name.includes('total') || name.includes('price') || 
      name.includes('cost') || name.includes('fee') || name.includes('balance')) {
    return formatCurrency(value);
  }
  
  // ZIP code patterns
  if (name.includes('zip') || name.includes('postal')) {
    return formatZipCode(value);
  }
  
  // Return original value if no pattern matches
  return value;
}
