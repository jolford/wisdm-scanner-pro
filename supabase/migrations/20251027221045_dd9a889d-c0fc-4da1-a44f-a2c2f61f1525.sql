-- Disable scanner and email imports again
UPDATE scanner_import_configs 
SET is_active = false, 
    updated_at = now()
WHERE is_active = true;

UPDATE email_import_configs 
SET is_active = false, 
    updated_at = now()
WHERE is_active = true;