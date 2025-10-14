-- Create user_customers junction table to prevent email enumeration
CREATE TABLE IF NOT EXISTS public.user_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, customer_id)
);

-- Enable RLS on user_customers
ALTER TABLE public.user_customers ENABLE ROW LEVEL SECURITY;

-- Users can view their own customer relationships
CREATE POLICY "Users can view their own customer relationships"
ON public.user_customers
FOR SELECT
USING (user_id = auth.uid());

-- Admins can manage all customer relationships
CREATE POLICY "Admins can manage all customer relationships"
ON public.user_customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create security definer function to check customer ownership
CREATE OR REPLACE FUNCTION public.has_customer(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_customers
    WHERE user_id = _user_id
      AND customer_id = _customer_id
  )
$$;

-- Update licenses RLS policy to use the new function
DROP POLICY IF EXISTS "Users can view their own licenses" ON public.licenses;
CREATE POLICY "Users can view their own licenses"
ON public.licenses
FOR SELECT
USING (has_customer(auth.uid(), customer_id));

-- Update license_usage RLS policy to use the new function
DROP POLICY IF EXISTS "Users can view their own license usage" ON public.license_usage;
CREATE POLICY "Users can view their own license usage"
ON public.license_usage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.id = license_usage.license_id
    AND has_customer(auth.uid(), l.customer_id)
  )
);

-- Add proper write policies for license_usage
CREATE POLICY "System can insert license usage via RPC"
ON public.license_usage
FOR INSERT
WITH CHECK (true); -- Will be controlled by SECURITY DEFINER function

CREATE POLICY "Admins can update license usage"
ON public.license_usage
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete license usage"
ON public.license_usage
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update consume_license_documents to use auth.uid() instead of trusting client
CREATE OR REPLACE FUNCTION public.consume_license_documents(_license_id uuid, _document_id uuid, _documents_count integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _customer_id uuid;
  _doc_owner uuid;
BEGIN
  -- Get authenticated user ID
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get license customer_id
  SELECT customer_id INTO _customer_id
  FROM public.licenses
  WHERE id = _license_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Verify user has access to this customer's license
  IF NOT has_customer(_user_id, _customer_id) THEN
    RETURN FALSE;
  END IF;

  -- Verify document ownership
  SELECT uploaded_by INTO _doc_owner
  FROM public.documents
  WHERE id = _document_id;

  IF _doc_owner != _user_id THEN
    RETURN FALSE;
  END IF;

  -- Check capacity
  IF NOT public.check_license_capacity(_license_id, _documents_count) THEN
    RETURN FALSE;
  END IF;
  
  -- Decrement remaining documents
  UPDATE public.licenses
  SET 
    remaining_documents = remaining_documents - _documents_count,
    updated_at = now()
  WHERE id = _license_id;
  
  -- Log the usage
  INSERT INTO public.license_usage (license_id, document_id, documents_used, user_id)
  VALUES (_license_id, _document_id, _documents_count, _user_id);
  
  -- Check if exhausted after this consumption
  UPDATE public.licenses
  SET status = 'exhausted'
  WHERE id = _license_id
  AND remaining_documents = 0;
  
  RETURN TRUE;
END;
$$;