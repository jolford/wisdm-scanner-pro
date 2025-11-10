-- Add validation_pattern column to zone_definitions for regex pattern matching
ALTER TABLE zone_definitions 
ADD COLUMN validation_pattern text,
ADD COLUMN validation_flags text DEFAULT 'i';

-- Add comment explaining the columns
COMMENT ON COLUMN zone_definitions.validation_pattern IS 'Regex pattern for validating extracted data from this zone';
COMMENT ON COLUMN zone_definitions.validation_flags IS 'Regex flags (e.g., i for case-insensitive, g for global)';