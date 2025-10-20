-- Update existing projects to be associated with Western Integrated Systems
-- This will enable cost tracking for future document processing
DO $$
DECLARE
  western_customer_id UUID;
BEGIN
  -- Get Western Integrated Systems customer ID
  SELECT id INTO western_customer_id 
  FROM customers 
  WHERE company_name = 'Western Integrated Systems'
  LIMIT 1;
  
  -- Update all projects without a customer_id to be associated with Western Integrated Systems
  IF western_customer_id IS NOT NULL THEN
    UPDATE projects 
    SET customer_id = western_customer_id
    WHERE customer_id IS NULL;
    
    RAISE NOTICE 'Updated projects to be associated with Western Integrated Systems';
  END IF;
END $$;