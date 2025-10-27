-- Create cron job to process job queue continuously
SELECT cron.schedule(
  'process-job-queue-every-minute',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/job-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieWVyYWtrcnl1ZmxhbWxtcHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzE3MjcsImV4cCI6MjA3NjAwNzcyN30.QXWzMKWAQyK4Urs9vWmIy0eWObFZIR1G-DlertZzMNQ"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);