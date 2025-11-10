-- Add anchor fields to zone_definitions for text-based positioning
ALTER TABLE zone_definitions
ADD COLUMN anchor_text text,
ADD COLUMN anchor_offset_x integer,
ADD COLUMN anchor_offset_y integer,
ADD COLUMN anchor_search_radius integer DEFAULT 100;

COMMENT ON COLUMN zone_definitions.anchor_text IS 'Text to search for as anchor point';
COMMENT ON COLUMN zone_definitions.anchor_offset_x IS 'Horizontal offset from anchor text';
COMMENT ON COLUMN zone_definitions.anchor_offset_y IS 'Vertical offset from anchor text';
COMMENT ON COLUMN zone_definitions.anchor_search_radius IS 'Search radius in pixels for finding anchor text';