-- Create function to trigger job processor via webhook
CREATE OR REPLACE FUNCTION trigger_job_processor()
RETURNS TRIGGER AS $$
BEGIN
  -- Call job processor edge function asynchronously
  PERFORM net.http_post(
    url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/job-processor',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:=jsonb_build_object('job_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to process new jobs
DROP TRIGGER IF EXISTS on_job_created ON jobs;
CREATE TRIGGER on_job_created
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_job_processor();