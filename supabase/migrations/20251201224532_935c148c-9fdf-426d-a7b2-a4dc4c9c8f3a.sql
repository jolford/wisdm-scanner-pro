-- Enable realtime for batches table to support real-time OCR progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;