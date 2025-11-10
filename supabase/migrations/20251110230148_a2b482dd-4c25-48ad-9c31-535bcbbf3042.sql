-- Create table for storing user dashboard widget preferences
CREATE TABLE public.user_dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own widgets
CREATE POLICY "Users can view their own dashboard widgets"
  ON public.user_dashboard_widgets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard widgets"
  ON public.user_dashboard_widgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard widgets"
  ON public.user_dashboard_widgets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard widgets"
  ON public.user_dashboard_widgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.user_dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_user_dashboard_widgets_user_id ON public.user_dashboard_widgets(user_id);
CREATE INDEX idx_user_dashboard_widgets_position ON public.user_dashboard_widgets(user_id, position);