-- Enable automatic job processing by creating trigger on jobs inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'call_job_processor'
  ) THEN
    CREATE TRIGGER call_job_processor
    AFTER INSERT ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_job_processor();
  END IF;
END $$;