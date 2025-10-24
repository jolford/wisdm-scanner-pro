-- Create customer_testimonials table
CREATE TABLE IF NOT EXISTS public.customer_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_testimonials ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all testimonials"
  ON public.customer_testimonials
  FOR SELECT
  USING (is_admin_enhanced());

CREATE POLICY "Admins can insert testimonials"
  ON public.customer_testimonials
  FOR INSERT
  WITH CHECK (is_admin_enhanced());

CREATE POLICY "Admins can update testimonials"
  ON public.customer_testimonials
  FOR UPDATE
  USING (is_admin_enhanced());

CREATE POLICY "Admins can delete testimonials"
  ON public.customer_testimonials
  FOR DELETE
  USING (is_admin_enhanced());

-- Create system_settings table for white-label config
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for system settings
CREATE POLICY "Admins can view system settings"
  ON public.system_settings
  FOR SELECT
  USING (is_admin_enhanced());

CREATE POLICY "Admins can manage system settings"
  ON public.system_settings
  FOR ALL
  USING (is_admin_enhanced());

-- Add updated_at trigger for customer_testimonials
CREATE TRIGGER update_customer_testimonials_updated_at
  BEFORE UPDATE ON public.customer_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();