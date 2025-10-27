-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Create cron job to process email imports every 5 minutes
SELECT cron.schedule(
  'process-email-imports-every-5-min',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/process-email-imports',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieWVyYWtrcnl1ZmxhbWxtcHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzE3MjcsImV4cCI6MjA3NjAwNzcyN30.QXWzMKWAQyK4Urs9vWmIy0eWObFZIR1G-DlertZzMNQ"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);