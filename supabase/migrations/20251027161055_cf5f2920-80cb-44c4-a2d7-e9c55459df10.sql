-- Fix search_path security issue
CREATE OR REPLACE FUNCTION trigger_job_processor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call job processor edge function asynchronously
  PERFORM net.http_post(
    url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/job-processor',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:=jsonb_build_object('job_id', NEW.id)
  );
  RETURN NEW;
END;
$$;