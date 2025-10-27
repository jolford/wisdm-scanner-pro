-- Re-enable scanner and email imports
UPDATE scanner_import_configs 
SET is_active = true, 
    updated_at = now()
WHERE is_active = false;

UPDATE email_import_configs 
SET is_active = true, 
    updated_at = now()
WHERE is_active = false;