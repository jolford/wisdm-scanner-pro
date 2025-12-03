-- Move pg_net extension from public to extensions schema
-- pg_net is used for HTTP requests from the database

-- Drop and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;