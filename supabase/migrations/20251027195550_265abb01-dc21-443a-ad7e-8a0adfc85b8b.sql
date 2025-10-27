-- Enable pg_cron extension for scheduled hot folder monitoring
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule hot folder monitoring every 5 minutes
SELECT cron.schedule(
  'process-hot-folders-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/process-hot-folders',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);