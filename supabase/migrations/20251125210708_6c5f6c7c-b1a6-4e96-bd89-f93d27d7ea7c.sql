-- Add new columns to user_preferences for onboarding and saved filters
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS saved_filters JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_preferences.onboarding_dismissed IS 'Whether user has dismissed the onboarding guide';
COMMENT ON COLUMN public.user_preferences.onboarding_completed_steps IS 'Array of completed onboarding step IDs';
COMMENT ON COLUMN public.user_preferences.saved_filters IS 'User saved filter views organized by filter type (document, batch, etc.)';