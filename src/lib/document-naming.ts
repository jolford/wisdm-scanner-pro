/**
 * Apply document naming pattern with extracted metadata
 * @param pattern - Pattern string with {FieldName} placeholders
 * @param metadata - Extracted metadata object
 * @param originalFileName - Original file name to use if pattern is empty or fails
 * @returns Formatted document name
 */
export function applyDocumentNamingPattern(
  pattern: string | undefined,
  metadata: Record<string, any>,
  originalFileName: string
): string {
  if (!pattern || pattern.trim() === '') {
    return originalFileName;
  }

  try {
    let newName = pattern;
    
    // Replace all {FieldName} placeholders with metadata values
    const placeholderRegex = /\{([^}]+)\}/g;
    newName = newName.replace(placeholderRegex, (match, fieldName) => {
      const value = metadata[fieldName];
      // If field exists and has a value, use it; otherwise keep the placeholder
      return value !== undefined && value !== null && value !== '' 
        ? String(value).trim() 
        : match;
    });
    
    // If the pattern still contains unreplaced placeholders, use original name
    if (newName.includes('{') && newName.includes('}')) {
      return originalFileName;
    }
    
    // Clean up the name - remove invalid filename characters
    newName = newName.replace(/[<>:"/\\|?*]/g, '-');
    
    // Preserve the file extension from original file
    const extensionMatch = originalFileName.match(/\.\w+$/);
    const extension = extensionMatch ? extensionMatch[0] : '';
    
    // Remove extension from new name if it was added, then add it back
    newName = newName.replace(/\.\w+$/, '');
    
    return newName + extension;
  } catch (error) {
    console.error('Error applying document naming pattern:', error);
    return originalFileName;
  }
}
