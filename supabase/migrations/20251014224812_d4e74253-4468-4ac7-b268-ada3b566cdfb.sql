-- Create license status enum
CREATE TYPE license_status AS ENUM ('active', 'expired', 'suspended', 'exhausted');

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create licenses table
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  total_documents INTEGER NOT NULL CHECK (total_documents > 0),
  remaining_documents INTEGER NOT NULL CHECK (remaining_documents >= 0),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status license_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create license usage log table for audit trail
CREATE TABLE public.license_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  documents_used INTEGER NOT NULL DEFAULT 1,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_licenses_customer_id ON public.licenses(customer_id);
CREATE INDEX idx_licenses_status ON public.licenses(status);
CREATE INDEX idx_license_usage_license_id ON public.license_usage(license_id);
CREATE INDEX idx_license_usage_used_at ON public.license_usage(used_at);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Admins can manage all customers"
  ON public.customers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for licenses
CREATE POLICY "Admins can manage all licenses"
  ON public.licenses
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own licenses"
  ON public.licenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = licenses.customer_id
      AND customers.contact_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for license usage
CREATE POLICY "Admins can view all license usage"
  ON public.license_usage
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own license usage"
  ON public.license_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.licenses l
      JOIN public.customers c ON l.customer_id = c.id
      WHERE l.id = license_usage.license_id
      AND c.contact_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- Function to check if license has capacity
CREATE OR REPLACE FUNCTION public.check_license_capacity(
  _license_id UUID,
  _documents_needed INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _license RECORD;
BEGIN
  SELECT * INTO _license
  FROM public.licenses
  WHERE id = _license_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if license is active
  IF _license.status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if license has expired
  IF _license.end_date < now() THEN
    UPDATE public.licenses
    SET status = 'expired'
    WHERE id = _license_id;
    RETURN FALSE;
  END IF;
  
  -- Check if there are enough documents remaining
  IF _license.remaining_documents < _documents_needed THEN
    IF _license.remaining_documents = 0 THEN
      UPDATE public.licenses
      SET status = 'exhausted'
      WHERE id = _license_id;
    END IF;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to consume license documents
CREATE OR REPLACE FUNCTION public.consume_license_documents(
  _license_id UUID,
  _document_id UUID,
  _user_id UUID,
  _documents_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check capacity first
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

-- Function to generate license key
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 4);
    IF i < 4 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();