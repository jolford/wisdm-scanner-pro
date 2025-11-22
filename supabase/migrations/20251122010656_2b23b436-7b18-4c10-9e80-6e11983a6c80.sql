-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Create a cron job to run scheduled exports every minute
-- This will check for any scheduled exports that should run at the current time
SELECT cron.schedule(
  'process-scheduled-exports-job',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/process-scheduled-exports',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieWVyYWtrcnl1ZmxhbWxtcHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzE3MjcsImV4cCI6MjA3NjAwNzcyN30.QXWzMKWAQyK4Urs9vWmIy0eWObFZIR1G-DlertZzMNQ"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);