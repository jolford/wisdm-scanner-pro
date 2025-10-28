-- Add AI model preference to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS ocr_model text DEFAULT 'google/gemini-2.5-flash' CHECK (ocr_model IN ('google/gemini-2.5-flash', 'google/gemini-2.5-pro'));

COMMENT ON COLUMN public.projects.ocr_model IS 'AI model to use for OCR processing: flash (faster, cheaper) or pro (more accurate, expensive)';
