-- Move pgcrypto extension from public to extensions schema
-- This follows Supabase best practices for security

-- First, create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to postgres and authenticated roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Drop the extension from public schema if it exists there
DROP EXTENSION IF EXISTS pgcrypto;

-- Recreate pgcrypto in the extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;